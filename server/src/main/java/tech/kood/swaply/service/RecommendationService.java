package tech.kood.swaply.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class RecommendationService {

    private final JdbcTemplate jdbcTemplate;

    public RecommendationService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    record Scored(Long id, double score) {}

    private static final String CANDIDATES_SQL = """
            SELECT p.user_id, p.latitude, p.longitude,
                   b.max_distance_km, b.interests, b.preferred_categories, b.preferred_conditions,
                   b.min_value, b.max_value, b.weights,
                   i.category, i.condition, i.estimated_value
            FROM profiles p
            JOIN user_bios b ON b.user_id = p.user_id
            JOIN items i     ON i.user_id = p.user_id
            WHERE i.status = 'active'
              AND p.user_id <> ?
              AND p.is_completed = true
              AND p.latitude IS NOT NULL
              AND NOT EXISTS (
                    SELECT 1 FROM swipes s
                    WHERE s.swiper_id = ?
                      AND s.target_user_id = p.user_id
              )
              AND NOT EXISTS (
                    SELECT 1 FROM swipes s
                    WHERE s.swiper_id = p.user_id
                      AND s.target_user_id = ?
                      AND s.direction = 'dismiss'
              )
              AND NOT EXISTS (
                    SELECT 1 FROM connections c
                    WHERE (c.user1_id = ? AND c.user2_id = p.user_id)
                       OR (c.user1_id = p.user_id AND c.user2_id = ?)
              )
            """;

    public java.util.List<UserData> loadCandidates(Long myId) {
        return jdbcTemplate.query(
                CANDIDATES_SQL,
                (rs, rowNum) -> mapRow(rs),
                myId, myId, myId, myId, myId
        );
    }

        private static final String ME_SQL = """
            SELECT p.user_id, p.latitude, p.longitude,
                   b.max_distance_km, b.interests, b.preferred_categories, b.preferred_conditions,
                   b.min_value, b.max_value, b.weights,
                   i.category, i.condition, i.estimated_value
            FROM profiles p
            JOIN user_bios b ON b.user_id = p.user_id
            JOIN items i     ON i.user_id = p.user_id
            WHERE i.status = 'active'
              AND p.user_id = ?
            """;

        public UserData loadMe(Long myId) {
            java.util.List<UserData> rows = jdbcTemplate.query(ME_SQL, (rs, rowNum) -> mapRow(rs), myId);
            if (rows.isEmpty()) {
                return null;
            }
            return rows.get((0));
        }
    public java.util.List<Scored> scoreCandidates(Long myId) {
        UserData me = loadMe(myId);
        if (me == null) {
            return java.util.List.of();
        }

        java.util.List<Scored> results = new java.util.ArrayList<>();
        for (UserData them : loadCandidates(myId)) {
            double score = MatchingScorer.scorePair(me, them);
            if (score >= 0.4) {
                results.add(new Scored(them.id(), score));
            }
        }
        return results;
    }

    private UserData mapRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        java.util.Map<String, Object> w = parseWeights(rs.getString("weights"));

        return new UserData(
                rs.getLong("user_id"),

                rs.getDouble("latitude"),
                rs.getDouble("longitude"),
                rs.getInt("max_distance_km"),

                toList(rs.getArray("interests")),
                toList(rs.getArray("preferred_categories")),
                toList(rs.getArray("preferred_conditions")),
                rs.getDouble("min_value"),
                rs.getDouble("max_value"),

                weight(w, "category"),
                weight(w, "value"),
                weight(w, "distance"),
                weight(w, "condition"),
                weight(w, "interests"),

                rs.getString("category"),
                rs.getString("condition"),
                rs.getDouble("estimated_value")
        );
    }

    // --- ready-made helpers ---

    private static java.util.List<String> toList(java.sql.Array arr) throws java.sql.SQLException {
        if (arr == null) return java.util.List.of();
        return java.util.List.of((String[]) arr.getArray());
    }

    @SuppressWarnings("unchecked")
    private static java.util.Map<String, Object> parseWeights(String json) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().readValue(json, java.util.Map.class);
        } catch (Exception e) {
            return java.util.Map.of();
        }
    }

    private static int weight(java.util.Map<String, Object> w, String key) {
        Object v = w.get(key);
        return (v instanceof Number n) ? n.intValue() : 1;
    }
}