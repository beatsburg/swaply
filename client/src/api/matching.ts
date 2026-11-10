// Person B endpoints: recommendations, swipes, connection requests, connections.
//
// /recommendations and /connections are in API.md. The rest are what the frontend expects from
// the matching branch. If Jan's endpoints are named differently, this is the only file to change.
import { api } from './client'
import type { SwipeDirection, SwipeResult } from './types'

export const matchingApi = {
  /** Max 10 user ids, best match first */
  recommendations: () => api<number[]>('/recommendations'),

  /** Accepted connections, user ids only */
  connections: () => api<number[]>('/connections'),

  /** "like" = connection request (or a match if they already liked us), "dismiss" = never show again */
  swipe: async (targetUserId: number, direction: SwipeDirection): Promise<SwipeResult> => {
    const res = await api<Partial<SwipeResult> | null>('/swipes', {
      method: 'POST',
      json: { target_user_id: targetUserId, direction },
    })
    return { matched: Boolean(res?.matched) }
  },

  /** Incoming pending requests, user ids of the people who liked me */
  incomingRequests: () => api<number[]>('/connections/requests'),

  acceptRequest: (userId: number) => api<unknown>(`/connections/${userId}/accept`, { method: 'POST' }),
  declineRequest: (userId: number) => api<unknown>(`/connections/${userId}/reject`, { method: 'POST' }),
  disconnect: (userId: number) => api<unknown>(`/connections/${userId}`, { method: 'DELETE' }),
}
