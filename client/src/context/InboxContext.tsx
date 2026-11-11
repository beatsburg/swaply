import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { chatApi } from '../api/chats'
import { matchingApi } from '../api/matching'
import type { ChatSummary } from '../api/types'
import { useAuth } from './AuthContext'
import { useRealtime, useRealtimeEvent } from './RealtimeContext'

/**
 * Shared lists the navbar badges need: chats (+ unread), incoming requests and connections.
 * Everything reloads when a WebSocket event says something changed, no polling.
 */
type InboxContextValue = {
  chats: ChatSummary[]
  chatsLoaded: boolean
  totalUnread: number
  requests: number[]
  connections: number[]
  refreshChats: () => void
  refreshRequests: () => void
  refreshConnections: () => void
  /** ChatPage sets this so messages in the open chat don't count as unread */
  setActiveChatId: (chatId: number | null) => void
}

const InboxContext = createContext<InboxContextValue | null>(null)

export function InboxProvider({ children }: { children: ReactNode }) {
  const { token, me } = useAuth()
  const { connected } = useRealtime()
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [chatsLoaded, setChatsLoaded] = useState(false)
  const [requests, setRequests] = useState<number[]>([])
  const [connections, setConnections] = useState<number[]>([])
  const [activeChatId, setActiveChatId] = useState<number | null>(null)
  const chatsTimer = useRef<number | undefined>(undefined)

  const loadChats = useCallback(() => {
    chatApi
      .list()
      .then((list) => {
        setChats(list)
        setChatsLoaded(true)
      })
      .catch(() => setChatsLoaded(true))
  }, [])

  // Several events can come at once (message + read), wait a moment and load once
  const refreshChats = useCallback(() => {
    window.clearTimeout(chatsTimer.current)
    chatsTimer.current = window.setTimeout(loadChats, 150)
  }, [loadChats])

  const refreshRequests = useCallback(() => {
    matchingApi
      .incomingRequests()
      .then(setRequests)
      .catch(() => setRequests([]))
  }, [])

  const refreshConnections = useCallback(() => {
    matchingApi
      .connections()
      .then(setConnections)
      .catch(() => setConnections([]))
  }, [])

  const ready = Boolean(token && me?.is_completed)

  // Load everything on login, and again after a reconnect in case we missed events
  useEffect(() => {
    if (!ready) {
      setChats([])
      setRequests([])
      setConnections([])
      setChatsLoaded(false)
      return
    }
    loadChats()
    refreshRequests()
    refreshConnections()
  }, [ready, connected, loadChats, refreshRequests, refreshConnections])

  useEffect(() => () => window.clearTimeout(chatsTimer.current), [])

  useRealtimeEvent((event) => {
    if (!ready) return
    switch (event.type) {
      case 'message':
      case 'read':
        refreshChats()
        break
      case 'connection_request':
        refreshRequests()
        break
      case 'connection_accepted':
      case 'match':
      case 'disconnected':
        refreshRequests()
        refreshConnections()
        refreshChats()
        break
    }
  })

  const totalUnread = useMemo(
    () => chats.reduce((sum, chat) => (chat.id === activeChatId ? sum : sum + chat.unread_count), 0),
    [chats, activeChatId],
  )

  // Unread count in the browser tab title too
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Swaply` : 'Swaply'
  }, [totalUnread])

  const value = useMemo(
    () => ({
      chats,
      chatsLoaded,
      totalUnread,
      requests,
      connections,
      refreshChats,
      refreshRequests,
      refreshConnections,
      setActiveChatId,
    }),
    [chats, chatsLoaded, totalUnread, requests, connections, refreshChats, refreshRequests, refreshConnections],
  )

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
}

export function useInbox() {
  const ctx = useContext(InboxContext)
  if (!ctx) throw new Error('useInbox must be used inside InboxProvider')
  return ctx
}
