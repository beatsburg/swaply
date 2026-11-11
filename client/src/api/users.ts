// Person A endpoints: auth, my profile/bio/item/avatar, other users' data.
import { api, ApiError } from './client'
import type { Bio, Item, Me, MyProfile, PublicProfile, UserCard, UserSummary, Weights } from './types'

type AuthResponse = { token: string; user: { id: number; email: string; name: string } }

export const authApi = {
  login: (email: string, password: string) =>
    api<AuthResponse>('/auth/login', { method: 'POST', json: { email, password } }),
  register: (name: string, email: string, password: string) =>
    api<AuthResponse>('/auth/register', { method: 'POST', json: { name, email, password } }),
  logout: () => api<unknown>('/auth/logout', { method: 'POST' }),
}

export type ProfileUpdate = {
  name?: string
  about_me?: string
  city?: string
  latitude?: number | null
  longitude?: number | null
}

export type BioUpdate = Omit<Bio, 'id'>

export const meApi = {
  get: () => api<Me>('/me'),
  getProfile: () => api<MyProfile>('/me/profile'),
  updateProfile: (data: ProfileUpdate) => api<MyProfile>('/me/profile', { method: 'PUT', json: data }),
  getBio: async () => normalizeBio(await api<unknown>('/me/bio')),
  updateBio: async (data: BioUpdate) => normalizeBio(await api<unknown>('/me/bio', { method: 'PUT', json: data })),

  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('avatar', file)
    return api<{ profile_picture: string }>('/me/avatar', { method: 'POST', form })
  },
  removeAvatar: () => api<{ profile_picture: string }>('/me/avatar', { method: 'DELETE' }),

  // Returns an empty body (null) when there's no active item
  getItem: async () => normalizeItem(await api<unknown>('/me/item')),
  createItem: async (form: FormData) => normalizeItem(await api<unknown>('/me/item', { method: 'POST', form })),
  updateItem: async (form: FormData) => normalizeItem(await api<unknown>('/me/item', { method: 'PUT', form })),
  removeItem: () => api<unknown>('/me/item', { method: 'DELETE' }),
}

export const usersApi = {
  get: (id: number) => api<UserSummary>(`/users/${id}`),
  getProfile: (id: number) => api<PublicProfile>(`/users/${id}/profile`),
  getBio: async (id: number) => normalizeBio(await api<unknown>(`/users/${id}/bio`)),
  getItem: async (id: number) => normalizeItem(await api<unknown>(`/users/${id}/item`)),
}

/**
 * The API is generic on purpose, so showing one user needs several requests (TASK: "a bit of over fetching").
 * Throws ApiError 404 if we are not allowed to see this user.
 */
export async function loadUserCard(id: number): Promise<UserCard> {
  const [summary, profile, bio, item] = await Promise.all([
    usersApi.get(id),
    usersApi.getProfile(id),
    usersApi.getBio(id).catch(() => null),
    usersApi.getItem(id).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return null // user has no active item
      throw err
    }),
  ])
  return {
    id: summary.id,
    name: summary.name,
    profile_picture: summary.profile_picture,
    about_me: profile.about_me ?? '',
    city: profile.city ?? '',
    bio,
    item,
  }
}

// Small cache for name + picture, used by chat and request lists so we don't refetch on every render.
const summaryCache = new Map<number, { at: number; promise: Promise<UserSummary> }>()
const SUMMARY_TTL_MS = 60_000

export function getUserSummaryCached(id: number): Promise<UserSummary> {
  const cached = summaryCache.get(id)
  if (cached && Date.now() - cached.at < SUMMARY_TTL_MS) return cached.promise
  const promise = usersApi.get(id)
  promise.catch(() => summaryCache.delete(id))
  summaryCache.set(id, { at: Date.now(), promise })
  return promise
}

// --- normalizing ---
// Postgres types come through Spring in slightly odd shapes (numeric as string, jsonb as an object
// with a "value" string), so we clean them up in one place.

const DEFAULT_WEIGHTS: Weights = { category: 3, value: 2, distance: 2, condition: 2, interests: 1 }

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function parseWeights(raw: unknown): Weights {
  let value = raw
  if (value && typeof value === 'object' && 'value' in value && typeof (value as { value: unknown }).value === 'string') {
    value = (value as { value: string }).value // jsonb serialized as PGobject
  }
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      value = null
    }
  }
  const w = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    category: toNumber(w.category, DEFAULT_WEIGHTS.category),
    value: toNumber(w.value, DEFAULT_WEIGHTS.value),
    distance: toNumber(w.distance, DEFAULT_WEIGHTS.distance),
    condition: toNumber(w.condition, DEFAULT_WEIGHTS.condition),
    interests: toNumber(w.interests, DEFAULT_WEIGHTS.interests),
  }
}

export function normalizeBio(raw: unknown): Bio {
  const b = (raw ?? {}) as Record<string, unknown>
  return {
    id: toNumber(b.id, 0),
    interests: toStringArray(b.interests),
    preferred_categories: toStringArray(b.preferred_categories),
    preferred_conditions: toStringArray(b.preferred_conditions),
    min_value: toNumber(b.min_value, 0),
    max_value: toNumber(b.max_value, 1000),
    max_distance_km: toNumber(b.max_distance_km, 50),
    weights: parseWeights(b.weights),
  }
}

export function normalizeItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== 'object') return null
  const i = raw as Record<string, unknown>
  return {
    id: toNumber(i.id, 0),
    user_id: toNumber(i.user_id, 0),
    title: String(i.title ?? ''),
    description: String(i.description ?? ''),
    category: String(i.category ?? 'other'),
    condition: String(i.condition ?? 'good'),
    estimated_value: toNumber(i.estimated_value, 0),
    image_url: typeof i.image_url === 'string' && i.image_url ? i.image_url : null,
    status: String(i.status ?? 'active'),
    created_at: typeof i.created_at === 'string' ? i.created_at : undefined,
  }
}
