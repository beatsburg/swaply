package tech.kood.swaply.dto;

import java.util.Map;

public record AuthResponse(String token, Map<String, Object> user) {
}

