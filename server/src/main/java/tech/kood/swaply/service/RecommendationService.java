package tech.kood.swaply.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class RecommendationService {

    private final JdbcTemplate jdbcTemplate;

    public RecommendationService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
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