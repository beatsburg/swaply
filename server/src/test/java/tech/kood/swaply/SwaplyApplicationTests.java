package tech.kood.swaply;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import tech.kood.swaply.dto.AuthResponse;
import tech.kood.swaply.dto.LoginRequest;
import tech.kood.swaply.dto.RegisterRequest;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SwaplyApplicationTests {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String getBaseUrl() {
        return "http://localhost:" + port;
    }

    private HttpHeaders createAuthHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    @Test
    @DisplayName("Person A: Complete Integration & Acceptance Test Suite")
    void testPersonAFullWorkflow() {
        // 1. Health check
        ResponseEntity<Map> healthRes = restTemplate.getForEntity(getBaseUrl() + "/health", Map.class);
        assertEquals(HttpStatus.OK, healthRes.getStatusCode());
        assertEquals("ok", healthRes.getBody().get("status"));

        // 2. Register User 1
        String email1 = "testuser_" + System.currentTimeMillis() + "@example.com";
        RegisterRequest regReq1 = new RegisterRequest(email1, "SecretPass123!", "Jaanis Test");
        ResponseEntity<AuthResponse> regRes1 = restTemplate.postForEntity(
                getBaseUrl() + "/auth/register", regReq1, AuthResponse.class);

        assertEquals(HttpStatus.CREATED, regRes1.getStatusCode());
        assertNotNull(regRes1.getBody().token());
        assertEquals("Jaanis Test", regRes1.getBody().user().get("name"));
        String token1 = regRes1.getBody().token();
        Long userId1 = ((Number) regRes1.getBody().user().get("id")).longValue();

        // 3. Password hashed with BCrypt
        String dbHash = jdbcTemplate.queryForObject(
                "SELECT password_hash FROM users WHERE id = ?", String.class, userId1);
        assertNotNull(dbHash);
        assertTrue(dbHash.startsWith("$2a$") || dbHash.startsWith("$2b$"));
        assertTrue(passwordEncoder.matches("SecretPass123!", dbHash));

        // 4. Login User 1
        LoginRequest loginReq1 = new LoginRequest(email1, "SecretPass123!");
        ResponseEntity<AuthResponse> loginRes1 = restTemplate.postForEntity(
                getBaseUrl() + "/auth/login", loginReq1, AuthResponse.class);
        assertEquals(HttpStatus.OK, loginRes1.getStatusCode());
        assertNotNull(loginRes1.getBody().token());

        // 5. GET /me returns default avatar placeholder
        HttpEntity<Void> meEntity = new HttpEntity<>(createAuthHeaders(token1));
        ResponseEntity<Map> meRes = restTemplate.exchange(
                getBaseUrl() + "/me", HttpMethod.GET, meEntity, Map.class);
        assertEquals(HttpStatus.OK, meRes.getStatusCode());
        assertEquals("Jaanis Test", meRes.getBody().get("name"));
        assertTrue(((String) meRes.getBody().get("profile_picture")).contains("default-avatar.svg"));

        // 6. Update Profile
        Map<String, Object> updateProfileBody = Map.of(
                "about_me", "Passionate about trading gadgets and outdoor gear.",
                "city", "Tallinn"
        );
        HttpEntity<Map<String, Object>> updateProfileEntity = new HttpEntity<>(updateProfileBody, createAuthHeaders(token1));
        ResponseEntity<Map> updatedProfileRes = restTemplate.exchange(
                getBaseUrl() + "/me/profile", HttpMethod.PUT, updateProfileEntity, Map.class);
        assertEquals(HttpStatus.OK, updatedProfileRes.getStatusCode());
        assertEquals("Tallinn", updatedProfileRes.getBody().get("city"));

        // 7. Update Bio (5+ biographical criteria)
        Map<String, Object> bioBody = Map.of(
                "interests", List.of("cycling", "tech", "gaming"),
                "preferred_categories", List.of("electronics", "sports"),
                "preferred_conditions", List.of("new", "like_new"),
                "min_value", 50,
                "max_value", 500,
                "max_distance_km", 30
        );
        HttpEntity<Map<String, Object>> bioEntity = new HttpEntity<>(bioBody, createAuthHeaders(token1));
        ResponseEntity<Map> updatedBioRes = restTemplate.exchange(
                getBaseUrl() + "/me/bio", HttpMethod.PUT, bioEntity, Map.class);
        assertEquals(HttpStatus.OK, updatedBioRes.getStatusCode());
        assertEquals(30, updatedBioRes.getBody().get("max_distance_km"));

        // 8. Add Active Item
        HttpHeaders formHeaders = new HttpHeaders();
        formHeaders.setBearerAuth(token1);
        formHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> itemForm = new LinkedMultiValueMap<>();
        itemForm.add("title", "Gravel Bike 2024");
        itemForm.add("description", "Lightweight aluminum frame");
        itemForm.add("category", "sports");
        itemForm.add("condition", "like_new");
        itemForm.add("estimated_value", "450");

        HttpEntity<MultiValueMap<String, String>> itemEntity = new HttpEntity<>(itemForm, formHeaders);
        ResponseEntity<Map> itemRes = restTemplate.exchange(
                getBaseUrl() + "/me/item", HttpMethod.POST, itemEntity, Map.class);
        assertEquals(HttpStatus.CREATED, itemRes.getStatusCode());
        assertEquals("Gravel Bike 2024", itemRes.getBody().get("title"));

        // 9. Constraint: Cannot add second active item
        ResponseEntity<Map> duplicateItemRes = restTemplate.exchange(
                getBaseUrl() + "/me/item", HttpMethod.POST, itemEntity, Map.class);
        assertEquals(HttpStatus.BAD_REQUEST, duplicateItemRes.getStatusCode());

        // 10. Check profile completion status
        ResponseEntity<Map> meCompletedRes = restTemplate.exchange(
                getBaseUrl() + "/me", HttpMethod.GET, meEntity, Map.class);
        assertEquals(Boolean.TRUE, meCompletedRes.getBody().get("is_completed"));

        // 11. Register User 2 (Unrelated user)
        String email2 = "stranger_" + System.currentTimeMillis() + "@example.com";
        RegisterRequest regReq2 = new RegisterRequest(email2, "Pass123!", "Stranger");
        ResponseEntity<AuthResponse> regRes2 = restTemplate.postForEntity(
                getBaseUrl() + "/auth/register", regReq2, AuthResponse.class);
        String token2 = regRes2.getBody().token();
        Long userId2 = ((Number) regRes2.getBody().user().get("id")).longValue();

        // 12. STRICT 404 Access Control: User 2 tries to view User 1 before recommended/connected
        HttpEntity<Void> u2Entity = new HttpEntity<>(createAuthHeaders(token2));

        ResponseEntity<Map> u1FromU2 = restTemplate.exchange(
                getBaseUrl() + "/users/" + userId1, HttpMethod.GET, u2Entity, Map.class);
        assertEquals(HttpStatus.NOT_FOUND, u1FromU2.getStatusCode());

        ResponseEntity<Map> u1ProfileFromU2 = restTemplate.exchange(
                getBaseUrl() + "/users/" + userId1 + "/profile", HttpMethod.GET, u2Entity, Map.class);
        assertEquals(HttpStatus.NOT_FOUND, u1ProfileFromU2.getStatusCode());

        ResponseEntity<Map> u1BioFromU2 = restTemplate.exchange(
                getBaseUrl() + "/users/" + userId1 + "/bio", HttpMethod.GET, u2Entity, Map.class);
        assertEquals(HttpStatus.NOT_FOUND, u1BioFromU2.getStatusCode());

        ResponseEntity<Map> u1ItemFromU2 = restTemplate.exchange(
                getBaseUrl() + "/users/" + userId1 + "/item", HttpMethod.GET, u2Entity, Map.class);
        assertEquals(HttpStatus.NOT_FOUND, u1ItemFromU2.getStatusCode());

        // 13. Grant active recommendation to User 2 -> now can view User 1!
        jdbcTemplate.update(
                "INSERT INTO active_recommendations (user_id, recommended_user_id, score) VALUES (?, ?, 95.0)",
                userId2, userId1);

        ResponseEntity<Map> u1AllowedRes = restTemplate.exchange(
                getBaseUrl() + "/users/" + userId1, HttpMethod.GET, u2Entity, Map.class);
        assertEquals(HttpStatus.OK, u1AllowedRes.getStatusCode());
        assertEquals("Jaanis Test", u1AllowedRes.getBody().get("name"));
        assertEquals(userId1.intValue(), u1AllowedRes.getBody().get("id"));

        // 14. Email Privacy Guarantee: Email NEVER returned in /users/{id}
        assertNull(u1AllowedRes.getBody().get("email"));

        // 15. Incomplete Profile recommendations check: User 2 has incomplete profile -> returns []
        ResponseEntity<List> recsIncompleteRes = restTemplate.exchange(
                getBaseUrl() + "/recommendations", HttpMethod.GET, u2Entity, List.class);
        assertEquals(HttpStatus.OK, recsIncompleteRes.getStatusCode());
        assertTrue(recsIncompleteRes.getBody().isEmpty());

        // 16. Complete Profile recommendations check: User 1 receives User 2 ID
        jdbcTemplate.update(
                "INSERT INTO active_recommendations (user_id, recommended_user_id, score) VALUES (?, ?, 90.0)",
                userId1, userId2);

        ResponseEntity<List> recsCompleteRes = restTemplate.exchange(
                getBaseUrl() + "/recommendations", HttpMethod.GET, meEntity, List.class);
        assertEquals(HttpStatus.OK, recsCompleteRes.getStatusCode());
        assertTrue(recsCompleteRes.getBody().contains(userId2.intValue()));
    }
}

