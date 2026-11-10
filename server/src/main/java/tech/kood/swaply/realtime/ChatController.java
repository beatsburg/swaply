package tech.kood.swaply.realtime;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tech.kood.swaply.security.UserPrincipal;
import tech.kood.swaply.service.PrivacyService;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping
public class ChatController {

    private final ChatService chatService;
    private final RealtimeService realtimeService;
    private final PrivacyService privacyService;

    public ChatController(ChatService chatService, RealtimeService realtimeService, PrivacyService privacyService) {
        this.chatService = chatService;
        this.realtimeService = realtimeService;
        this.privacyService = privacyService;
    }

    /** List of my chats, most recent first, with unread counts. */
    @GetMapping({"/chats", "/api/chats"})
    public ResponseEntity<List<Map<String, Object>>> listChats(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(chatService.listChats(principal.id()));
    }

    /** Start or resume a chat with a connected user. Body: { "user_id": 5 } */
    @PostMapping({"/chats", "/api/chats"})
    public ResponseEntity<Map<String, Object>> openChat(@AuthenticationPrincipal UserPrincipal principal,
                                                        @RequestBody Map<String, Object> body) {
        Long otherId = body.get("user_id") instanceof Number n ? n.longValue() : null;
        Long chatId = chatService.getOrCreateChat(principal.id(), otherId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", chatId);
        result.put("user_id", otherId);
        return ResponseEntity.ok(result);
    }

    @GetMapping({"/chats/{id}", "/api/chats/{id}"})
    public ResponseEntity<Map<String, Object>> getChat(@AuthenticationPrincipal UserPrincipal principal,
                                                       @PathVariable("id") Long chatId) {
        Long otherId = chatService.getOtherParticipant(chatId, principal.id());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", chatId);
        result.put("user_id", otherId);
        return ResponseEntity.ok(result);
    }

    /** Paginated history. ?before=<message id>&limit=20 */
    @GetMapping({"/chats/{id}/messages", "/api/chats/{id}/messages"})
    public ResponseEntity<Map<String, Object>> getMessages(@AuthenticationPrincipal UserPrincipal principal,
                                                           @PathVariable("id") Long chatId,
                                                           @RequestParam(value = "before", required = false) Long before,
                                                           @RequestParam(value = "limit", required = false) Integer limit) {
        chatService.getOtherParticipant(chatId, principal.id()); // 404 if not allowed
        int pageSize = limit != null ? limit : ChatService.DEFAULT_PAGE_SIZE;
        return ResponseEntity.ok(chatService.getMessages(chatId, before, pageSize));
    }

    /** Send a message. Body: { "content": "Hi!" }. Both users get it instantly over WebSocket. */
    @PostMapping({"/chats/{id}/messages", "/api/chats/{id}/messages"})
    public ResponseEntity<Map<String, Object>> sendMessage(@AuthenticationPrincipal UserPrincipal principal,
                                                           @PathVariable("id") Long chatId,
                                                           @RequestBody Map<String, Object> body) {
        Long otherId = chatService.getOtherParticipant(chatId, principal.id());
        Object content = body.get("content");
        Map<String, Object> message = chatService.saveMessage(chatId, principal.id(),
                content instanceof String s ? s : null);

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", "message");
        event.put("chat_id", chatId);
        event.put("message", message);
        realtimeService.sendToUser(otherId, event);
        realtimeService.sendToUser(principal.id(), event); // my other tabs

        return ResponseEntity.status(HttpStatus.CREATED).body(message);
    }

    /** Mark the other user's messages in this chat as read. */
    @PostMapping({"/chats/{id}/read", "/api/chats/{id}/read"})
    public ResponseEntity<Map<String, Object>> markRead(@AuthenticationPrincipal UserPrincipal principal,
                                                        @PathVariable("id") Long chatId) {
        Long otherId = chatService.getOtherParticipant(chatId, principal.id());
        int updated = chatService.markRead(chatId, principal.id());

        if (updated > 0) {
            Map<String, Object> event = new LinkedHashMap<>();
            event.put("type", "read");
            event.put("chat_id", chatId);
            event.put("reader_id", principal.id());
            realtimeService.sendToUser(otherId, event);
            realtimeService.sendToUser(principal.id(), event);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("updated", updated);
        return ResponseEntity.ok(result);
    }

    /** Online/offline status. Same visibility rules as /users/{id}, otherwise 404. */
    @GetMapping({"/presence/{id}", "/api/presence/{id}"})
    public ResponseEntity<Map<String, Object>> getPresence(@AuthenticationPrincipal UserPrincipal principal,
                                                           @PathVariable("id") Long userId) {
        if (!privacyService.canViewProfile(principal.id(), userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", userId);
        result.put("online", realtimeService.isOnline(userId));
        return ResponseEntity.ok(result);
    }
}
