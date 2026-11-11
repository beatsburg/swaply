package tech.kood.swaply.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Array;
import java.util.Map;

@Service
public class ProfileCompletionService {

    private final JdbcTemplate jdbcTemplate;

    public ProfileCompletionService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public boolean checkAndUpdateCompletion(Long userId) {
        if (userId == null) return false;

        // Check profile name and location
        String nameSql = "SELECT name, latitude, longitude FROM profiles WHERE user_id = ?";
        var nameRows = jdbcTemplate.queryForList(nameSql, userId);
        if (nameRows.isEmpty()) {
            setCompleted(userId, false);
            return false;
        }
        String name = (String) nameRows.get(0).get("name");
        if (name == null || name.trim().isEmpty()) {
            setCompleted(userId, false);
            return false;
        }
        boolean hasLocation = nameRows.get(0).get("latitude") != null
                && nameRows.get(0).get("longitude") != null;

        // Check bio 5 points
        String bioSql = "SELECT interests, preferred_categories, preferred_conditions, max_distance_km FROM user_bios WHERE user_id = ?";
        var bioRows = jdbcTemplate.queryForList(bioSql, userId);
        if (bioRows.isEmpty()) {
            setCompleted(userId, false);
            return false;
        }
        Map<String, Object> bio = bioRows.get(0);
        boolean hasInterests = hasArrayElements(bio.get("interests"));
        boolean hasCategories = hasArrayElements(bio.get("preferred_categories"));
        boolean hasConditions = hasArrayElements(bio.get("preferred_conditions"));

        Number dist = (Number) bio.get("max_distance_km");
        boolean hasDistance = dist != null && dist.intValue() > 0;

        // Check active trade item
        String itemSql = "SELECT COUNT(*) FROM items WHERE user_id = ? AND status = 'active'";
        Integer activeItemCount = jdbcTemplate.queryForObject(itemSql, Integer.class, userId);
        boolean hasActiveItem = activeItemCount != null && activeItemCount > 0;

        boolean isCompleted = hasInterests && hasCategories && hasConditions && hasDistance && hasActiveItem && hasLocation;
        setCompleted(userId, isCompleted);
        return isCompleted;
    }

    private void setCompleted(Long userId, boolean completed) {
        jdbcTemplate.update("UPDATE profiles SET is_completed = ?, updated_at = NOW() WHERE user_id = ?", completed, userId);
    }

    private boolean hasArrayElements(Object arrayObj) {
        if (arrayObj instanceof Array sqlArray) {
            try {
                Object[] arr = (Object[]) sqlArray.getArray();
                return arr != null && arr.length > 0;
            } catch (Exception e) {
                return false;
            }
        }
        if (arrayObj instanceof Object[] arr) {
            return arr.length > 0;
        }
        return false;
    }
}

