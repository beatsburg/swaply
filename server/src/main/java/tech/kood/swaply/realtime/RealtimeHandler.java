package tech.kood.swaply.realtime;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * WebSocket endpoint /api/ws.
 *
 * Server -> client events (JSON with a "type" field):
 *   presence_snapshot { online: [ids] }               right after connecting
 *   presence          { user_id, online }              a connection went online/offline
 *   message           { chat_id, message }             new chat message
 *   read              { chat_id, reader_id }           messages were read
 *   typing            { chat_id, user_id, typing }     other user is typing / stopped
 *   + anything sent with RealtimeService.notifyUser (connection_request, connection_accepted, ...)
 *
 * Client -> server events:
 *   typing { chat_id, typing: true|false }
 *   ping   {}                                          keep-alive, server answers with pong
 *
 * Messages themselves are sent over REST (POST /api/chats/{id}/messages) and pushed out from there.
 */
@Component
public class RealtimeHandler extends TextWebSocketHandler {

    private final RealtimeService realtimeService;
    private final ChatService chatService;
    private final ObjectMapper objectMapper;

    public RealtimeHandler(RealtimeService realtimeService, ChatService chatService, ObjectMapper objectMapper) {
        this.realtimeService = realtimeService;
        this.chatService = chatService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Long userId = getUserId(session);
        if (userId == null) {
            closeQuietly(session);
            return;
        }

        boolean cameOnline = realtimeService.addSession(userId, session);
        if (cameOnline) {
            realtimeService.broadcastPresence(userId, true);
        }

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("type", "presence_snapshot");
        snapshot.put("online", realtimeService.getOnlineConnections(userId));
        realtimeService.sendToUser(userId, snapshot);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        Long userId = getUserId(session);
        if (userId == null) {
            return;
        }

        JsonNode json;
        try {
            json = objectMapper.readTree(message.getPayload());
        } catch (Exception e) {
            return; // ignore garbage
        }

        String type = json.path("type").asText("");
        switch (type) {
            case "typing" -> handleTyping(userId, json);
            case "ping" -> realtimeService.sendToUser(userId, Map.<String, Object>of("type", "pong"));
            default -> { /* unknown event, ignore */ }
        }
    }

    private void handleTyping(Long userId, JsonNode json) {
        if (!json.hasNonNull("chat_id")) {
            return;
        }
        long chatId = json.get("chat_id").asLong();
        boolean typing = json.path("typing").asBoolean(false);

        Long otherId;
        try {
            otherId = chatService.getOtherParticipant(chatId, userId);
        } catch (ResponseStatusException e) {
            return; // not my chat or not connected anymore
        }

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", "typing");
        event.put("chat_id", chatId);
        event.put("user_id", userId);
        event.put("typing", typing);
        realtimeService.sendToUser(otherId, event);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long userId = getUserId(session);
        if (userId == null) {
            return;
        }
        boolean wentOffline = realtimeService.removeSession(userId, session);
        if (wentOffline) {
            realtimeService.broadcastPresence(userId, false);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        closeQuietly(session);
    }

    private Long getUserId(WebSocketSession session) {
        Object value = session.getAttributes().get(JwtHandshakeInterceptor.USER_ID_ATTRIBUTE);
        return value instanceof Long id ? id : null;
    }

    private void closeQuietly(WebSocketSession session) {
        try {
            session.close();
        } catch (Exception ignored) {
        }
    }
}
