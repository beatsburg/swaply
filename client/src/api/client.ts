// Small fetch wrapper: adds the JWT, parses JSON (or an empty body), throws ApiError on failure.

const TOKEN_KEY = 'swaply_token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // storage blocked, the session just won't survive a reload
  }
}

export class ApiError extends Error {
  status: number
  /** Message from the server body, if it sent one */
  serverMessage: string | null

  constructor(status: number, serverMessage: string | null) {
    super(serverMessage ?? `Request failed with status ${status}`)
    this.status = status
    this.serverMessage = serverMessage
  }
}

/** Turns any error into text for the UI. Spring hides exception messages by default, so we need a fallback. */
export function errorText(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.serverMessage) return err.serverMessage
  if (err instanceof TypeError) return 'Could not reach the server. Check that the backend is running.'
  return fallback
}

let onUnauthorized: (() => void) | null = null

/** AuthContext registers this so an expired token logs the user out everywhere. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  json?: unknown
  form?: FormData
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let body: BodyInit | undefined
  if (options.form) {
    body = options.form // browser sets the multipart boundary itself
  } else if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.json)
  }

  const res = await fetch(`/api${path}`, { method: options.method ?? 'GET', headers, body })

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/auth')) {
      onUnauthorized?.()
    }
    throw new ApiError(res.status, readServerMessage(data))
  }

  return data as T
}

function readServerMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  // Spring's default error body has "error": "Bad Request" which isn't useful, prefer "message"
  if (typeof record.message === 'string' && record.message && record.message !== 'No message available') {
    return record.message
  }
  return null
}
