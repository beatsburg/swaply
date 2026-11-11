import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Message } from '../api/types'
import { useAuth } from './AuthContext'

// Events the server pushes over the WebSocket (see RealtimeHandler.java)
export type RealtimeEvent =
  | { type: 'presence_snapshot'; online: number[] }
  | { type: 'presence'; user_id: number; online: boolean }
  | { type: 'message'; chat_id: number; message: Message }
  | { type: 'read'; chat_id: number; reader_id: number }
  | { type: 'typing'; chat_id: number; user_id: number; typing: boolean }
  | { type: 'connection_request' | 'connection_accepted' | 'match' | 'disconnected'; [key: string]: unknown }
  | { type: 'pong' }

type Listener = (event: RealtimeEvent) => void

type RealtimeContextValue = {
  /** True while the socket is open */
  connected: boolean
  isOnline: (userId: number) => boolean
  /** Store presence we got from REST (GET /presence/:id) */
  setPresence: (userId: number, online: boolean) => void
  sendTyping: (chatId: number, typing: boolean) => void
  /** Returns an unsubscribe function */
  subscribe: (listener: Listener) => () => void
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

const PING_INTERVAL_MS = 25_000
const MAX_RECONNECT_DELAY_MS = 15_000

function socketUrl(token: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/ws?token=${encodeURIComponent(token)}`
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const [connected, setConnected] = useState(false)
  const [online, setOnline] = useState<Set<number>>(() => new Set())
  const socketRef = useRef<WebSocket | null>(null)
  const listenersRef = useRef<Set<Listener>>(new Set())

  useEffect(() => {
    if (!token) return

    let stopped = false
    let retryDelay = 1000
    let retryTimer: number | undefined
    let pingTimer: number | undefined

    const connect = () => {
      const ws = new WebSocket(socketUrl(token))
      socketRef.current = ws

      ws.onopen = () => {
        retryDelay = 1000
        setConnected(true)
        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
        }, PING_INTERVAL_MS)
      }

      ws.onmessage = (msg) => {
        let event: RealtimeEvent
        try {
          event = JSON.parse(msg.data)
        } catch {
          return
        }

        if (event.type === 'presence_snapshot') {
          setOnline(new Set(event.online))
        } else if (event.type === 'presence') {
          const { user_id, online: isNowOnline } = event
          setOnline((prev) => {
            const next = new Set(prev)
            if (isNowOnline) next.add(user_id)
            else next.delete(user_id)
            return next
          })
        }

        listenersRef.current.forEach((listener) => listener(event))
      }

      ws.onclose = () => {
        window.clearInterval(pingTimer)
        setConnected(false)
        if (socketRef.current === ws) socketRef.current = null
        if (stopped) return
        // Reconnect with backoff: 1s, 2s, 4s ... max 15s
        retryTimer = window.setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 2, MAX_RECONNECT_DELAY_MS)
      }
    }

    connect()

    return () => {
      stopped = true
      window.clearTimeout(retryTimer)
      window.clearInterval(pingTimer)
      socketRef.current?.close()
      socketRef.current = null
      setConnected(false)
      setOnline(new Set())
    }
  }, [token])

  const isOnline = useCallback((userId: number) => online.has(userId), [online])

  const setPresence = useCallback((userId: number, isNowOnline: boolean) => {
    setOnline((prev) => {
      if (prev.has(userId) === isNowOnline) return prev
      const next = new Set(prev)
      if (isNowOnline) next.add(userId)
      else next.delete(userId)
      return next
    })
  }, [])

  const sendTyping = useCallback((chatId: number, typing: boolean) => {
    const ws = socketRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'typing', chat_id: chatId, typing }))
    }
  }, [])

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const value = useMemo(
    () => ({ connected, isOnline, setPresence, sendTyping, subscribe }),
    [connected, isOnline, setPresence, sendTyping, subscribe],
  )

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider')
  return ctx
}

/** Subscribe to realtime events for as long as the component is mounted. */
export function useRealtimeEvent(listener: Listener) {
  const { subscribe } = useRealtime()
  const listenerRef = useRef(listener)
  useEffect(() => {
    listenerRef.current = listener
  })
  useEffect(() => subscribe((event) => listenerRef.current(event)), [subscribe])
}
