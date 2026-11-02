package tech.kood.swaply.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping
public class DevController {

    private final JdbcTemplate jdbcTemplate;

    public DevController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Wipes all application data from PostgreSQL tables.
     * Fulfills TASK.md line 131 requirement to easily test the app with 0 users.
     */
    @PostMapping({"/dev/reset", "/api/dev/reset"})
    public ResponseEntity<Map<String, String>> resetDatabase() {
        jdbcTemplate.execute(
                "TRUNCATE TABLE messages, conversations, connections, swipes, " +
                "active_recommendations, exchanges, items, user_bios, profiles, users " +
                "RESTART IDENTITY CASCADE");

        return ResponseEntity.ok(Map.of(
                "message", "Database reset complete. All tables truncated.",
                "status", "empty"
        ));
    }
}
