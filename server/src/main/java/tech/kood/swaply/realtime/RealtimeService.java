package tech.kood.swaply.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Keeps track of open WebSocket sessions and pushes events to users.
 *
 * One user can have many sessions (several tabs or devices), so the map is
 * userId -> (sessionId -> session). A user is "online" while they have at least one session.
 *
 * Other parts of the backend (for example matching/connections) can call
 * {@link #notifyUser(Long, String, Map)} to push an event to a user in real time.
 */
@Service
public class RealtimeService {

    private static final int SEND_TIME_LIMIT_MS = 10_000;
    private static final int BUFFER_SIZE_LIMIT = 512 * 1024;

    private final Map<Long, Map<String, WebSocketSession>> sessionsByUser = new ConcurrentHashMap<>();
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public RealtimeService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    /** Returns true if this was the user's first open session (user just came online). */
    public boolean addSession(Long userId, WebSocketSession session) {
        // The decorator makes sending thread safe, two threads can't write to one socket at once
        WebSocketSession safeSession = new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, BUFFER_SIZE_LIMIT);
        Map<String, WebSocketSession> userSessions =
                sessionsByUser.computeIfAbsent(userId, id -> new ConcurrentHashMap<>());
        boolean wasOffline = userSessions.isEmpty();
        userSessions.put(session.getId(), safeSession);
        return wasOffline;
    }

    /** Returns true if this was the user's last open session (user just went offline). */
    public boolean removeSession(Long userId, WebSocketSession session) {
        Map<String, WebSocketSession> userSessions = sessionsByUser.get(userId);
        if (userSessions == null) {
            return false;
        }
        userSessions.remove(session.getId());
        if (userSessions.isEmpty()) {
            sessionsByUser.remove(userId);
            return true;
        }
        return false;
    }

    public boolean isOnline(Long userId) {
        Map<String, WebSocketSession> userSessions = sessionsByUser.get(userId);
        return userSessions != null && !userSessions.isEmpty();
    }

    /** Sends an event to every open session of the user. Does nothing if the user is offline. */
    public void sendToUser(Long userId, Map<String, Object> payload) {
        Map<String, WebSocketSession> userSessions = sessionsByUser.get(userId);
        if (userSessions == null || userSessions.isEmpty()) {
            return;
        }

        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (IOException e) {
            return;
        }

        for (WebSocketSession session : userSessions.values()) {
            if (!session.isOpen()) {
                continue;
            }
            try {
                session.sendMessage(new TextMessage(json));
            } catch (IOException | IllegalStateException e) {
                // Broken session, it gets removed when the connection closes
            }
        }
    }

    /**
     * Push a custom event to a user, e.g. from the connections logic:
     * realtimeService.notifyUser(targetId, "connection_request", Map.of("from_user_id", myId));
     * The frontend reloads requests/connections when it gets
     * "connection_request", "connection_accepted" or "disconnected".
     */
    public void notifyUser(Long userId, String type, Map<String, Object> data) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", type);
        if (data != null) {
            payload.putAll(data);
        }
        sendToUser(userId, payload);
    }

    /** IDs of users that have an accepted connection with this user. */
    public List<Long> getConnectedUserIds(Long userId) {
        return jdbcTemplate.queryForList(
                "SELECT CASE WHEN user1_id = ? THEN user2_id ELSE user1_id END " +
                "FROM connections WHERE (user1_id = ? OR user2_id = ?) AND status = 'accepted'",
                Long.class, userId, userId, userId);
    }

    /** Tells all connected users that this user went online or offline. */
    public void broadcastPresence(Long userId, boolean online) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "presence");
        payload.put("user_id", userId);
        payload.put("online", online);

        for (Long otherId : getConnectedUserIds(userId)) {
            sendToUser(otherId, payload);
        }
    }

    /** Which of my connections are online right now, sent to a client right after it connects. */
    public List<Long> getOnlineConnections(Long userId) {
        return getConnectedUserIds(userId).stream()
                .filter(this::isOnline)
                .toList();
    }
}
