package tech.kood.swaply.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import tech.kood.swaply.security.UserPrincipal;
import tech.kood.swaply.service.PrivacyService;
import tech.kood.swaply.service.ProfileCompletionService;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Array;
import java.util.*;

@RestController
@RequestMapping
public class UserController {

    private final JdbcTemplate jdbcTemplate;
    private final PrivacyService privacyService;
    private final ProfileCompletionService profileCompletionService;

    @Value("${file.upload-dir:public/uploads}")
    private String uploadDir;

    private static final String DEFAULT_AVATAR = "/uploads/avatars/default-avatar.svg";

    public UserController(JdbcTemplate jdbcTemplate,
                          PrivacyService privacyService,
                          ProfileCompletionService profileCompletionService) {
        this.jdbcTemplate = jdbcTemplate;
        this.privacyService = privacyService;
        this.profileCompletionService = profileCompletionService;
    }

    // --- /me Endpoints ---

    @GetMapping({"/me", "/api/me"})
    public ResponseEntity<Map<String, Object>> getMe(@AuthenticationPrincipal UserPrincipal principal) {
        var rows = jdbcTemplate.queryForList(
                "SELECT u.id, u.email, p.name, p.avatar_url, p.is_completed " +
                "FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ?",
                principal.id());

        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        var row = rows.get(0);
        String avatar = (String) row.get("avatar_url");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", row.get("id"));
        result.put("name", row.get("name"));
        result.put("email", row.get("email"));
        result.put("profile_picture", avatar != null ? avatar : DEFAULT_AVATAR);
        result.put("is_completed", row.get("is_completed"));

        return ResponseEntity.ok(result);
    }

    @GetMapping({"/me/profile", "/api/me/profile"})
    public ResponseEntity<Map<String, Object>> getMeProfile(@AuthenticationPrincipal UserPrincipal principal) {
        var rows = jdbcTemplate.queryForList(
                "SELECT user_id AS id, name, about_me, city, latitude, longitude, is_completed " +
                "FROM profiles WHERE user_id = ?", principal.id());

        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Profile not found");
        }
        return ResponseEntity.ok(rows.get(0));
    }

    @PutMapping({"/me/profile", "/api/me/profile"})
    public ResponseEntity<Map<String, Object>> updateMeProfile(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody Map<String, Object> body) {

        String name = (String) body.get("name");
        String aboutMe = (String) body.get("about_me");
        String city = (String) body.get("city");
        Double lat = body.get("latitude") instanceof Number n ? n.doubleValue() : null;
        Double lon = body.get("longitude") instanceof Number n ? n.doubleValue() : null;

        jdbcTemplate.update(
                "UPDATE profiles SET " +
                "name = COALESCE(?, name), " +
                "about_me = COALESCE(?, about_me), " +
                "city = COALESCE(?, city), " +
                "latitude = COALESCE(?, latitude), " +
                "longitude = COALESCE(?, longitude), " +
                "updated_at = NOW() WHERE user_id = ?",
                name, aboutMe, city, lat, lon, principal.id());

        profileCompletionService.checkAndUpdateCompletion(principal.id());

        return getMeProfile(principal);
    }

    @GetMapping({"/me/bio", "/api/me/bio"})
    public ResponseEntity<Map<String, Object>> getMeBio(@AuthenticationPrincipal UserPrincipal principal) {
        var rows = jdbcTemplate.queryForList(
                "SELECT user_id AS id, interests, preferred_categories, preferred_conditions, " +
                "min_value, max_value, max_distance_km, weights " +
                "FROM user_bios WHERE user_id = ?", principal.id());

        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Bio not found");
        }
        return ResponseEntity.ok(convertBioRow(rows.get(0)));
    }

    @PutMapping({"/me/bio", "/api/me/bio"})
    public ResponseEntity<Map<String, Object>> updateMeBio(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody Map<String, Object> body) {

        List<?> interests = (List<?>) body.get("interests");
        List<?> categories = (List<?>) body.get("preferred_categories");
        List<?> conditions = (List<?>) body.get("preferred_conditions");
        Number minVal = (Number) body.get("min_value");
        Number maxVal = (Number) body.get("max_value");
        Number maxDist = (Number) body.get("max_distance_km");

        jdbcTemplate.execute((java.sql.Connection conn) -> {
            var ps = conn.prepareStatement(
                    "UPDATE user_bios SET " +
                    "interests = COALESCE(?, interests), " +
                    "preferred_categories = COALESCE(?, preferred_categories), " +
                    "preferred_conditions = COALESCE(?, preferred_conditions), " +
                    "min_value = COALESCE(?, min_value), " +
                    "max_value = COALESCE(?, max_value), " +
                    "max_distance_km = COALESCE(?, max_distance_km), " +
                    "updated_at = NOW() WHERE user_id = ?");

            if (interests != null) {
                ps.setArray(1, conn.createArrayOf("text", interests.toArray()));
            } else {
                ps.setNull(1, java.sql.Types.ARRAY);
            }

            if (categories != null) {
                ps.setArray(2, conn.createArrayOf("text", categories.toArray()));
            } else {
                ps.setNull(2, java.sql.Types.ARRAY);
            }

            if (conditions != null) {
                ps.setArray(3, conn.createArrayOf("text", conditions.toArray()));
            } else {
                ps.setNull(3, java.sql.Types.ARRAY);
            }

            if (minVal != null) ps.setBigDecimal(4, java.math.BigDecimal.valueOf(minVal.doubleValue()));
            else ps.setNull(4, java.sql.Types.NUMERIC);

            if (maxVal != null) ps.setBigDecimal(5, java.math.BigDecimal.valueOf(maxVal.doubleValue()));
            else ps.setNull(5, java.sql.Types.NUMERIC);

            if (maxDist != null) ps.setInt(6, maxDist.intValue());
            else ps.setNull(6, java.sql.Types.INTEGER);

            ps.setLong(7, principal.id());
            ps.executeUpdate();
            return null;
        });

        boolean isCompleted = profileCompletionService.checkAndUpdateCompletion(principal.id());

        Map<String, Object> bio = getMeBio(principal).getBody();
        Map<String, Object> res = new LinkedHashMap<>(bio != null ? bio : Map.of());
        res.put("is_completed", isCompleted);
        return ResponseEntity.ok(res);
    }

    @PostMapping({"/me/avatar", "/api/me/avatar"})
    public ResponseEntity<Map<String, String>> uploadMyAvatar(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam("avatar") MultipartFile file) throws IOException {

        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is empty");
        }

        Path avatarDir = Paths.get(uploadDir, "avatars");
        Files.createDirectories(avatarDir);

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "avatar.jpg";
        String ext = originalName.contains(".") ? originalName.substring(originalName.lastIndexOf(".")) : ".jpg";
        String filename = "avatar-" + principal.id() + "-" + System.currentTimeMillis() + ext;

        Path target = avatarDir.resolve(filename);
        Files.copy(file.getInputStream(), target);

        String avatarUrl = "/uploads/avatars/" + filename;
        jdbcTemplate.update("UPDATE profiles SET avatar_url = ?, updated_at = NOW() WHERE user_id = ?", avatarUrl, principal.id());

        return ResponseEntity.ok(Map.of("profile_picture", avatarUrl));
    }

    @DeleteMapping({"/me/avatar", "/api/me/avatar"})
    public ResponseEntity<Map<String, String>> deleteMyAvatar(@AuthenticationPrincipal UserPrincipal principal) {
        jdbcTemplate.update("UPDATE profiles SET avatar_url = NULL, updated_at = NOW() WHERE user_id = ?", principal.id());
        return ResponseEntity.ok(Map.of("profile_picture", DEFAULT_AVATAR));
    }

    // --- /users/:id Endpoints (STRICT 404 & EMAIL PRIVACY) ---

    @GetMapping({"/users/{id}", "/api/users/{id}"})
    public ResponseEntity<Map<String, Object>> getUserById(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable("id") Long targetId) {

        if (!privacyService.canViewProfile(principal.id(), targetId)) {
            // STRICT 404 Requirement
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        var rows = jdbcTemplate.queryForList("SELECT user_id AS id, name, avatar_url FROM profiles WHERE user_id = ?", targetId);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        var row = rows.get(0);
        String avatar = (String) row.get("avatar_url");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", row.get("id"));
        result.put("name", row.get("name"));
        result.put("profile_picture", avatar != null ? avatar : DEFAULT_AVATAR);
        // Notice: NO EMAIL EVER RETURNED!

        return ResponseEntity.ok(result);
    }

    @GetMapping({"/users/{id}/profile", "/api/users/{id}/profile"})
    public ResponseEntity<Map<String, Object>> getUserProfileById(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable("id") Long targetId) {

        if (!privacyService.canViewProfile(principal.id(), targetId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        var rows = jdbcTemplate.queryForList(
                "SELECT user_id AS id, about_me, city FROM profiles WHERE user_id = ?", targetId);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        return ResponseEntity.ok(rows.get(0));
    }

    @GetMapping({"/users/{id}/bio", "/api/users/{id}/bio"})
    public ResponseEntity<Map<String, Object>> getUserBioById(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable("id") Long targetId) {

        if (!privacyService.canViewProfile(principal.id(), targetId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        var rows = jdbcTemplate.queryForList(
                "SELECT user_id AS id, interests, preferred_categories, preferred_conditions, " +
                "min_value, max_value, max_distance_km, weights FROM user_bios WHERE user_id = ?", targetId);

        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        return ResponseEntity.ok(convertBioRow(rows.get(0)));
    }

    private Map<String, Object> convertBioRow(Map<String, Object> row) {
        Map<String, Object> copy = new LinkedHashMap<>(row);
        convertArrayField(copy, "interests");
        convertArrayField(copy, "preferred_categories");
        convertArrayField(copy, "preferred_conditions");
        return copy;
    }

    private void convertArrayField(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val instanceof Array sqlArray) {
            try {
                map.put(key, sqlArray.getArray());
            } catch (Exception e) {
                map.put(key, new Object[0]);
            }
        }
    }
}

