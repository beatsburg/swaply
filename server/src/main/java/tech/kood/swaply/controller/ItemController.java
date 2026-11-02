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
import java.util.Map;

@RestController
@RequestMapping
public class ItemController {

    private final JdbcTemplate jdbcTemplate;
    private final PrivacyService privacyService;
    private final ProfileCompletionService profileCompletionService;

    @Value("${file.upload-dir:public/uploads}")
    private String uploadDir;

    public ItemController(JdbcTemplate jdbcTemplate,
                          PrivacyService privacyService,
                          ProfileCompletionService profileCompletionService) {
        this.jdbcTemplate = jdbcTemplate;
        this.privacyService = privacyService;
        this.profileCompletionService = profileCompletionService;
    }

    @GetMapping({"/me/item", "/api/me/item"})
    public ResponseEntity<Map<String, Object>> getMeItem(@AuthenticationPrincipal UserPrincipal principal) {
        var rows = jdbcTemplate.queryForList(
                "SELECT id, user_id, title, description, category, condition, estimated_value, image_url, status, created_at " +
                "FROM items WHERE user_id = ? AND status = 'active' LIMIT 1", principal.id());

        if (rows.isEmpty()) {
            return ResponseEntity.ok(null);
        }
        return ResponseEntity.ok(rows.get(0));
    }

    @PostMapping({"/me/item", "/api/me/item"})
    public ResponseEntity<Map<String, Object>> createMeItem(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam("title") String title,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam("category") String category,
            @RequestParam("condition") String condition,
            @RequestParam(value = "estimated_value", required = false) Double estimatedValue,
            @RequestParam(value = "image", required = false) MultipartFile image) throws IOException {

        if (title == null || title.isBlank() || category == null || condition == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Title, category and condition are required");
        }

        // Check if user already has an active item
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM items WHERE user_id = ? AND status = 'active'", Integer.class, principal.id());
        if (count != null && count > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You already have an active item. Update or remove it before adding a new one.");
        }

        String imageUrl = null;
        if (image != null && !image.isEmpty()) {
            Path itemDir = Paths.get(uploadDir, "items");
            Files.createDirectories(itemDir);
            String originalName = image.getOriginalFilename() != null ? image.getOriginalFilename() : "item.jpg";
            String ext = originalName.contains(".") ? originalName.substring(originalName.lastIndexOf(".")) : ".jpg";
            String filename = "item-" + principal.id() + "-" + System.currentTimeMillis() + ext;
            Files.copy(image.getInputStream(), itemDir.resolve(filename));
            imageUrl = "/uploads/items/" + filename;
        }

        double val = estimatedValue != null ? estimatedValue : 0.0;

        jdbcTemplate.update(
                "INSERT INTO items (user_id, title, description, category, condition, estimated_value, image_url, status) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, 'active')",
                principal.id(), title.trim(), description != null ? description : "", category, condition, val, imageUrl);

        profileCompletionService.checkAndUpdateCompletion(principal.id());

        return ResponseEntity.status(HttpStatus.CREATED).body(getMeItem(principal).getBody());
    }

    @DeleteMapping({"/me/item", "/api/me/item"})
    public ResponseEntity<Map<String, String>> deleteMeItem(@AuthenticationPrincipal UserPrincipal principal) {
        int updated = jdbcTemplate.update(
                "UPDATE items SET status = 'archived', updated_at = NOW() WHERE user_id = ? AND status = 'active'",
                principal.id());

        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No active item found");
        }

        profileCompletionService.checkAndUpdateCompletion(principal.id());
        return ResponseEntity.ok(Map.of("message", "Item archived successfully"));
    }

    @GetMapping({"/users/{id}/item", "/api/users/{id}/item"})
    public ResponseEntity<Map<String, Object>> getUserItemById(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable("id") Long targetId) {

        if (!privacyService.canViewProfile(principal.id(), targetId)) {
            // STRICT 404
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        var rows = jdbcTemplate.queryForList(
                "SELECT id, user_id, title, description, category, condition, estimated_value, image_url, status " +
                "FROM items WHERE user_id = ? AND status = 'active' LIMIT 1", targetId);

        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No active item for this user");
        }

        return ResponseEntity.ok(rows.get(0));
    }
}

