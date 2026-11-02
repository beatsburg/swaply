package tech.kood.swaply.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tech.kood.swaply.security.UserPrincipal;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping
public class StubController {

    private final JdbcTemplate jdbcTemplate;

    public StubController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping({"/recommendations", "/api/recommendations"})
    public ResponseEntity<List<Long>> getRecommendations(@AuthenticationPrincipal UserPrincipal principal) {
        // If profile is not complete, return empty list (TASK.md line 31)
        Boolean isCompleted = jdbcTemplate.queryForObject(
                "SELECT is_completed FROM profiles WHERE user_id = ?", Boolean.class, principal.id());

        if (isCompleted == null || !isCompleted) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        // Return max 10 IDs from active_recommendations (populated by Person B)
        List<Long> ids = jdbcTemplate.queryForList(
                "SELECT recommended_user_id FROM active_recommendations WHERE user_id = ? ORDER BY score DESC LIMIT 10",
                Long.class, principal.id());

        return ResponseEntity.ok(ids);
    }

    @GetMapping({"/connections", "/api/connections"})
    public ResponseEntity<List<Long>> getConnections(@AuthenticationPrincipal UserPrincipal principal) {
        List<Long> ids = jdbcTemplate.queryForList(
                "SELECT CASE WHEN user1_id = ? THEN user2_id ELSE user1_id END " +
                "FROM connections WHERE (user1_id = ? OR user2_id = ?) AND status = 'accepted'",
                Long.class, principal.id(), principal.id(), principal.id());

        return ResponseEntity.ok(ids);
    }
}

