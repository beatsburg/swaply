// Person C endpoints: chat REST + presence. Real-time events come over the WebSocket (RealtimeContext).
import { api } from './client'
import type { ChatSummary, Message, MessagePage } from './types'

export const chatApi = {
  list: () => api<ChatSummary[]>('/chats'),
  /** Start or resume the one chat with a connected user */
  open: (userId: number) => api<{ id: number; user_id: number }>('/chats', { method: 'POST', json: { user_id: userId } }),
  get: (chatId: number) => api<{ id: number; user_id: number }>(`/chats/${chatId}`),
  messages: (chatId: number, before?: number, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (before) params.set('before', String(before))
    return api<MessagePage>(`/chats/${chatId}/messages?${params}`)
  },
  send: (chatId: number, content: string) =>
    api<Message>(`/chats/${chatId}/messages`, { method: 'POST', json: { content } }),
  markRead: (chatId: number) => api<{ updated: number }>(`/chats/${chatId}/read`, { method: 'POST' }),
  presence: (userId: number) => api<{ id: number; online: boolean }>(`/presence/${userId}`),
}
