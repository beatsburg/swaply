package tech.kood.swaply.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class PrivacyService {

    private final JdbcTemplate jdbcTemplate;

    public PrivacyService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public boolean canViewProfile(Long requesterId, Long targetUserId) {
        if (requesterId == null || targetUserId == null) return false;
        if (requesterId.equals(targetUserId)) return true;

        // 1. Check active recommendations
        String recSql = "SELECT COUNT(*) FROM active_recommendations WHERE user_id = ? AND recommended_user_id = ?";
        Integer recCount = jdbcTemplate.queryForObject(recSql, Integer.class, requesterId, targetUserId);
        if (recCount != null && recCount > 0) {
            return true;
        }

        // 2. Check connection (pending or accepted)
        String connSql = "SELECT COUNT(*) FROM connections " +
                "WHERE ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)) " +
                "AND status IN ('pending', 'accepted')";
        Integer connCount = jdbcTemplate.queryForObject(connSql, Integer.class, requesterId, targetUserId, targetUserId, requesterId);
        return connCount != null && connCount > 0;
    }
}

