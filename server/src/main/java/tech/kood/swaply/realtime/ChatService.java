package tech.kood.swaply.realtime;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Chat logic: one conversation per pair of users, messages with cursor pagination.
 *
 * Rules:
 * - Only users with an ACCEPTED connection can open a chat or send messages.
 * - The conversation row always stores the smaller user id in user1_id, so the
 *   UNIQUE (user1_id, user2_id) constraint guarantees only one chat history per pair.
 * - Anything the user is not allowed to see returns 404, same as the /users endpoints.
 */
@Service
public class ChatService {

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 50;
    public static final int MAX_MESSAGE_LENGTH = 2000;

    private final JdbcTemplate jdbcTemplate;

    public ChatService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public boolean areConnected(Long userA, Long userB) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM connections " +
                "WHERE ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)) " +
                "AND status = 'accepted'",
                Integer.class, userA, userB, userB, userA);
        return count != null && count > 0;
    }

    /** Returns the other participant of the chat, or throws 404 if I'm not in it or we're no longer connected. */
    public Long getOtherParticipant(Long chatId, Long me) {
        var rows = jdbcTemplate.queryForList(
                "SELECT user1_id, user2_id FROM conversations WHERE id = ?", chatId);
        if (rows.isEmpty()) {
            throw notFound();
        }

        Long user1 = ((Number) rows.get(0).get("user1_id")).longValue();
        Long user2 = ((Number) rows.get(0).get("user2_id")).longValue();

        Long other;
        if (user1.equals(me)) {
            other = user2;
        } else if (user2.equals(me)) {
            other = user1;
        } else {
            throw notFound();
        }

        if (!areConnected(me, other)) {
            throw notFound();
        }
        return other;
    }

    /** Finds the existing chat between two connected users or creates it. */
    public Long getOrCreateChat(Long me, Long otherUserId) {
        if (otherUserId == null || otherUserId.equals(me) || !areConnected(me, otherUserId)) {
            throw notFound();
        }

        long user1 = Math.min(me, otherUserId);
        long user2 = Math.max(me, otherUserId);

        jdbcTemplate.update(
                "INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?) " +
                "ON CONFLICT (user1_id, user2_id) DO NOTHING",
                user1, user2);

        return jdbcTemplate.queryForObject(
                "SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?",
                Long.class, user1, user2);
    }

    /** All my chats with users I'm still connected to, the most recent first. */
    public List<Map<String, Object>> listChats(Long me) {
        var rows = jdbcTemplate.queryForList(
                "SELECT c.id, " +
                "       CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END AS other_id, " +
                "       c.created_at, " +
                "       lm.content AS last_content, lm.sender_id AS last_sender_id, lm.created_at AS last_created_at, " +
                "       (SELECT COUNT(*) FROM messages um " +
                "        WHERE um.conversation_id = c.id AND um.sender_id <> ? AND um.is_read = FALSE) AS unread_count " +
                "FROM conversations c " +
                "LEFT JOIN LATERAL ( " +
                "    SELECT m.content, m.sender_id, m.created_at FROM messages m " +
                "    WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1 " +
                ") lm ON TRUE " +
                "WHERE (c.user1_id = ? OR c.user2_id = ?) " +
                "  AND EXISTS ( " +
                "    SELECT 1 FROM connections cn WHERE cn.status = 'accepted' " +
                "    AND ((cn.user1_id = c.user1_id AND cn.user2_id = c.user2_id) " +
                "      OR (cn.user1_id = c.user2_id AND cn.user2_id = c.user1_id)) " +
                "  ) " +
                "ORDER BY COALESCE(lm.created_at, c.created_at) DESC, c.id DESC",
                me, me, me, me);

        List<Map<String, Object>> result = new ArrayList<>();
        for (var row : rows) {
            Map<String, Object> chat = new LinkedHashMap<>();
            chat.put("id", row.get("id"));
            chat.put("user_id", row.get("other_id"));
            chat.put("unread_count", ((Number) row.get("unread_count")).intValue());

            if (row.get("last_content") != null) {
                Map<String, Object> last = new LinkedHashMap<>();
                last.put("content", row.get("last_content"));
                last.put("sender_id", row.get("last_sender_id"));
                last.put("created_at", toIso(row.get("last_created_at")));
                chat.put("last_message", last);
                chat.put("updated_at", toIso(row.get("last_created_at")));
            } else {
                chat.put("last_message", null);
                chat.put("updated_at", toIso(row.get("created_at")));
            }
            result.add(chat);
        }
        return result;
    }

    /**
     * One page of messages, oldest first inside the page.
     * Pass beforeId = id of the oldest message you already have to get the page before it.
     */
    public Map<String, Object> getMessages(Long chatId, Long beforeId, int limit) {
        int pageSize = Math.max(1, Math.min(limit, MAX_PAGE_SIZE));

        List<Map<String, Object>> rows;
        // Fetch one extra row to know if there are more older messages
        if (beforeId == null) {
            rows = jdbcTemplate.queryForList(
                    "SELECT id, conversation_id, sender_id, content, is_read, created_at FROM messages " +
                    "WHERE conversation_id = ? ORDER BY id DESC LIMIT ?",
                    chatId, pageSize + 1);
        } else {
            rows = jdbcTemplate.queryForList(
                    "SELECT id, conversation_id, sender_id, content, is_read, created_at FROM messages " +
                    "WHERE conversation_id = ? AND id < ? ORDER BY id DESC LIMIT ?",
                    chatId, beforeId, pageSize + 1);
        }

        boolean hasMore = rows.size() > pageSize;
        if (hasMore) {
            rows = rows.subList(0, pageSize);
        }

        List<Map<String, Object>> messages = new ArrayList<>();
        for (var row : rows) {
            messages.add(toMessage(row));
        }
        Collections.reverse(messages);

        Map<String, Object> page = new LinkedHashMap<>();
        page.put("messages", messages);
        page.put("has_more", hasMore);
        return page;
    }

    public Map<String, Object> saveMessage(Long chatId, Long senderId, String rawContent) {
        String content = rawContent == null ? "" : rawContent.trim();
        if (content.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message cannot be empty");
        }
        if (content.length() > MAX_MESSAGE_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Message is too long (max " + MAX_MESSAGE_LENGTH + " characters)");
        }

        Map<String, Object> row = jdbcTemplate.queryForMap(
                "INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?) " +
                "RETURNING id, conversation_id, sender_id, content, is_read, created_at",
                chatId, senderId, content);

        jdbcTemplate.update("UPDATE conversations SET updated_at = NOW() WHERE id = ?", chatId);
        return toMessage(row);
    }

    /** Marks the other user's messages as read. Returns how many were updated. */
    public int markRead(Long chatId, Long me) {
        return jdbcTemplate.update(
                "UPDATE messages SET is_read = TRUE " +
                "WHERE conversation_id = ? AND sender_id <> ? AND is_read = FALSE",
                chatId, me);
    }

    private Map<String, Object> toMessage(Map<String, Object> row) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("id", row.get("id"));
        message.put("chat_id", row.get("conversation_id"));
        message.put("sender_id", row.get("sender_id"));
        message.put("content", row.get("content"));
        message.put("is_read", row.get("is_read"));
        message.put("created_at", toIso(row.get("created_at")));
        return message;
    }

    /** Timestamps always go out as ISO-8601 UTC strings, e.g. 2026-11-10T18:41:00Z */
    private String toIso(Object value) {
        if (value instanceof Timestamp ts) {
            return ts.toInstant().toString();
        }
        if (value instanceof OffsetDateTime odt) {
            return odt.toInstant().toString();
        }
        return value != null ? value.toString() : null;
    }

    private ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat not found");
    }
}
