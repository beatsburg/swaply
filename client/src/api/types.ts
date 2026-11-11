// Shapes of the data the backend returns. See API.md in the repo root.

export type Me = {
  id: number
  name: string
  email: string
  profile_picture: string
  is_completed: boolean
}

export type UserSummary = {
  id: number
  name: string
  profile_picture: string
}

export type MyProfile = {
  id: number
  name: string
  about_me: string
  city: string
  latitude: number | null
  longitude: number | null
  is_completed: boolean
}

export type PublicProfile = {
  id: number
  about_me: string
  city: string
}

export type Weights = {
  category: number
  value: number
  distance: number
  condition: number
  interests: number
}

export type Bio = {
  id: number
  interests: string[]
  preferred_categories: string[]
  preferred_conditions: string[]
  min_value: number
  max_value: number
  max_distance_km: number
  weights: Weights
}

export type Item = {
  id: number
  user_id: number
  title: string
  description: string
  category: string
  condition: string
  estimated_value: number
  image_url: string | null
  status: string
  created_at?: string
}

/** Everything we show about another user, combined from 4 endpoints. */
export type UserCard = {
  id: number
  name: string
  profile_picture: string
  about_me: string
  city: string
  bio: Bio | null
  item: Item | null
}

export type ChatSummary = {
  id: number
  user_id: number
  unread_count: number
  last_message: { content: string; sender_id: number; created_at: string } | null
  updated_at: string
}

export type Message = {
  id: number
  chat_id: number
  sender_id: number
  content: string
  is_read: boolean
  created_at: string
}

export type MessagePage = {
  messages: Message[]
  has_more: boolean
}

export type SwipeDirection = 'like' | 'dismiss'

export type SwipeResult = {
  matched: boolean
}
