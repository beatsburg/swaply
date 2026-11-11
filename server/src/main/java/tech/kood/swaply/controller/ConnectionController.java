package tech.kood.swaply.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import tech.kood.swaply.security.UserPrincipal;

import java.util.List;
import java.util.Map;

@RestController
public class ConnectionController {

    private final JdbcTemplate jdbcTemplate;

    public ConnectionController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // what the frontend sends when swiping: { "target_user_id": 5, "direction": "like" }
    record SwipeRequest(Long target_user_id, String direction) {}

    // ♥ or ✕ on the Discover page
    @PostMapping({"/swipes", "/api/swipes"})
    public ResponseEntity<?> swipe(@AuthenticationPrincipal UserPrincipal principal,
                                   @RequestBody SwipeRequest request) {
        Long me = principal.id();
        Long target = request.target_user_id();
        String direction = request.direction();

        // 1. check the input
        if (target == null || target.equals(me)
                || !("like".equals(direction) || "dismiss".equals(direction))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid swipe"));
        }

        long user1 = Math.min(me, target);
        long user2 = Math.max(me, target);

        // 2. special case: they already liked me, so my like = accept → MATCH
        if ("like".equals(direction)) {
            int updated = jdbcTemplate.update(
                    "UPDATE connections SET status = 'accepted', updated_at = NOW() " +
                    "WHERE user1_id = ? AND user2_id = ? AND requester_id = ? AND status = 'pending'",
                    user1, user2, target);
            if (updated > 0) {
                saveSwipe(me, target, direction);
                return ResponseEntity.ok(Map.of("matched", true));
            }
        }

        // 3. you can only swipe people currently in your deck
        Integer inDeck = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM active_recommendations WHERE user_id = ? AND recommended_user_id = ?",
                Integer.class, me, target);
        if (inDeck == null || inDeck == 0) {
            return ResponseEntity.notFound().build();
        }

        // 4. save the swipe, and take them out of my deck
        saveSwipe(me, target, direction);
        jdbcTemplate.update(
                "DELETE FROM active_recommendations WHERE user_id = ? AND recommended_user_id = ?",
                me, target);

        // 5. like = send a request (lower id always stored first)
        if ("like".equals(direction)) {
            jdbcTemplate.update(
                    "INSERT INTO connections (user1_id, user2_id, requester_id, status) " +
                    "VALUES (?, ?, ?, 'pending') ON CONFLICT (user1_id, user2_id) DO NOTHING",
                    user1, user2, me);
        }

        return ResponseEntity.ok(Map.of("matched", false));
    }

    private void saveSwipe(Long me, Long target, String direction) {
        jdbcTemplate.update(
                "INSERT INTO swipes (swiper_id, target_user_id, direction) VALUES (?, ?, ?) " +
                "ON CONFLICT (swiper_id, target_user_id) DO NOTHING",
                me, target, direction);
    }

    // Requests page: who liked me and is waiting for my answer
    @GetMapping({"/connections/requests", "/api/connections/requests"})
    public List<Long> incomingRequests(@AuthenticationPrincipal UserPrincipal principal) {
        Long me = principal.id();
        return jdbcTemplate.queryForList(
                "SELECT requester_id FROM connections " +
                        "WHERE (user1_id = ? OR user2_id = ?) AND requester_id <> ? AND status = 'pending' " +
                        "ORDER BY created_at DESC",
                Long.class, me, me, me);
    }

    // Accept button
    @PostMapping({"/connections/{id}/accept", "/api/connections/{id}/accept"})
    public ResponseEntity<?> accept(@AuthenticationPrincipal UserPrincipal principal,
                                    @PathVariable("id") Long otherId) {
        return answerRequest(principal.id(), otherId, "accepted");
    }

    // Decline button
    @PostMapping({"/connections/{id}/reject", "/api/connections/{id}/reject"})
    public ResponseEntity<?> reject(@AuthenticationPrincipal UserPrincipal principal,
                                    @PathVariable("id") Long otherId) {
        return answerRequest(principal.id(), otherId, "rejected");
    }

    // shared by accept and reject: only the person who RECEIVED the request may answer it
    private ResponseEntity<?> answerRequest(Long me, Long otherId, String newStatus) {
        int updated = jdbcTemplate.update(
                "UPDATE connections SET status = ?, updated_at = NOW() " +
                        "WHERE user1_id = ? AND user2_id = ? AND requester_id = ? AND status = 'pending'",
                newStatus, Math.min(me, otherId), Math.max(me, otherId), otherId);
        if (updated == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("status", newStatus));
    }

    // Disconnect button
    @DeleteMapping({"/connections/{id}", "/api/connections/{id}"})
    public ResponseEntity<?> disconnect(@AuthenticationPrincipal UserPrincipal principal,
                                        @PathVariable("id") Long otherId) {
        Long me = principal.id();
        int updated = jdbcTemplate.update(
                "UPDATE connections SET status = 'disconnected', updated_at = NOW() " +
                        "WHERE user1_id = ? AND user2_id = ? AND status = 'accepted'",
                Math.min(me, otherId), Math.max(me, otherId));
        if (updated == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("status", "disconnected"));
    }
}

