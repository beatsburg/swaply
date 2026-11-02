package tech.kood.swaply.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tech.kood.swaply.dto.AuthResponse;
import tech.kood.swaply.dto.LoginRequest;
import tech.kood.swaply.dto.RegisterRequest;
import tech.kood.swaply.security.JwtUtil;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.Map;

@RestController
@RequestMapping
public class AuthController {

    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthController(JdbcTemplate jdbcTemplate, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping({"/auth/register", "/api/auth/register"})
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest req) {
        if (req.email() == null || req.password() == null || req.name() == null ||
            req.email().isBlank() || req.password().isBlank() || req.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email, password and name are required");
        }

        String email = req.email().trim().toLowerCase();

        // Check if email already exists
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE email = ?", Integer.class, email);
        if (count != null && count > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is already registered");
        }

        // Hash password with BCrypt
        String passwordHash = passwordEncoder.encode(req.password());

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, email);
            ps.setString(2, passwordHash);
            return ps;
        }, keyHolder);

        Number key = (Number) keyHolder.getKeys().get("id");
        Long userId = key.longValue();

        // Initialize profile
        jdbcTemplate.update("INSERT INTO profiles (user_id, name) VALUES (?, ?)", userId, req.name().trim());

        // Initialize user bio
        jdbcTemplate.update("INSERT INTO user_bios (user_id) VALUES (?)", userId);

        String token = jwtUtil.generateToken(userId, email);

        Map<String, Object> userMap = Map.of(
                "id", userId,
                "email", email,
                "name", req.name().trim()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(new AuthResponse(token, userMap));
    }

    @PostMapping({"/auth/login", "/api/auth/login"})
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest req) {
        if (req.email() == null || req.password() == null || req.email().isBlank() || req.password().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password are required");
        }

        String email = req.email().trim().toLowerCase();

        var rows = jdbcTemplate.queryForList("SELECT id, email, password_hash FROM users WHERE email = ?", email);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        var user = rows.get(0);
        String hash = (String) user.get("password_hash");
        Long userId = ((Number) user.get("id")).longValue();

        if (!passwordEncoder.matches(req.password(), hash)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        var profileRows = jdbcTemplate.queryForList("SELECT name FROM profiles WHERE user_id = ?", userId);
        String name = profileRows.isEmpty() ? "" : (String) profileRows.get(0).get("name");

        String token = jwtUtil.generateToken(userId, email);

        Map<String, Object> userMap = Map.of(
                "id", userId,
                "email", email,
                "name", name
        );

        return ResponseEntity.ok(new AuthResponse(token, userMap));
    }

    @PostMapping({"/auth/logout", "/api/auth/logout"})
    public ResponseEntity<Map<String, String>> logout() {
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }
}

