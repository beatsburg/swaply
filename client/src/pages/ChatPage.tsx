import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { chatApi } from '../api/chats'
import { ApiError, errorText } from '../api/client'
import type { Message } from '../api/types'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorNote, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useInbox } from '../context/InboxContext'
import { useRealtime, useRealtimeEvent } from '../context/RealtimeContext'
import { useUserSummary } from '../hooks/useUserCard'
import { formatMessageTime } from '../utils/format'

const TYPING_SEND_EVERY_MS = 2000 // while typing, tell the other side at most every 2s
const TYPING_STOP_AFTER_MS = 2500 // no key pressed for 2.5s = stopped typing
const TYPING_HIDE_AFTER_MS = 4000 // safety net if the "stopped" event gets lost

/**
 * Merge two lists of messages, no duplicates (the sender gets the message from REST and WebSocket).
 * is_read only goes false -> true: the "read" event can arrive before our own POST response,
 * so an older copy must not flip it back to unread.
 */
function mergeMessages(a: Message[], b: Message[]): Message[] {
  const byId = new Map<number, Message>()
  for (const m of a) byId.set(m.id, m)
  for (const m of b) {
    const existing = byId.get(m.id)
    byId.set(m.id, existing ? { ...existing, ...m, is_read: existing.is_read || m.is_read } : m)
  }
  return [...byId.values()].sort((x, y) => x.id - y.id)
}

export function ChatPage() {
  const params = useParams()
  const chatId = Number(params.id)
  const { me } = useAuth()
  const { sendTyping, isOnline, setPresence, connected } = useRealtime()
  const { setActiveChatId, refreshChats } = useInbox()

  const [otherId, setOtherId] = useState<number | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const other = useUserSummary(otherId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stickToBottom = useRef(true)
  const distanceFromBottom = useRef<number | null>(null)
  const hideTypingTimer = useRef<number | undefined>(undefined)
  const stopTypingTimer = useRef<number | undefined>(undefined)
  const lastTypingSent = useRef(0)

  const markRead = useCallback(() => {
    chatApi
      .markRead(chatId)
      .then(() => refreshChats())
      .catch(() => {})
  }, [chatId, refreshChats])

  // This chat doesn't count towards the unread badge while it's open
  useEffect(() => {
    setActiveChatId(chatId)
    return () => setActiveChatId(null)
  }, [chatId, setActiveChatId])

  // First load: who is the other person + the latest page of messages
  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    setNotFound(false)
    setMessages([])
    setOtherId(null)
    setOtherTyping(false)

    Promise.all([chatApi.get(chatId), chatApi.messages(chatId)])
      .then(([chat, page]) => {
        if (cancelled) return
        stickToBottom.current = true
        setOtherId(chat.user_id)
        setMessages(page.messages)
        setHasMore(page.has_more)
        setLoaded(true)
        markRead()
        chatApi
          .presence(chat.user_id)
          .then((p) => setPresence(p.id, p.online))
          .catch(() => {})
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setError(errorText(err, 'Could not load the chat.'))
        setLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [chatId, markRead, setPresence])

  // After a reconnect, fetch the latest page again in case we missed something
  const wasConnected = useRef(connected)
  useEffect(() => {
    if (connected && !wasConnected.current && loaded && !notFound) {
      chatApi
        .messages(chatId)
        .then((page) => setMessages((prev) => mergeMessages(prev, page.messages)))
        .catch(() => {})
    }
    wasConnected.current = connected
  }, [connected, chatId, loaded, notFound])

  const isNearBottom = () => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  useRealtimeEvent((event) => {
    if (event.type === 'message' && event.chat_id === chatId) {
      const mine = event.message.sender_id === me?.id
      stickToBottom.current = mine || isNearBottom()
      setMessages((prev) => mergeMessages(prev, [event.message]))
      if (!mine) {
        setOtherTyping(false)
        if (document.visibilityState === 'visible') markRead()
      }
    } else if (event.type === 'typing' && event.chat_id === chatId && event.user_id === otherId) {
      window.clearTimeout(hideTypingTimer.current)
      stickToBottom.current = isNearBottom()
      setOtherTyping(event.typing)
      if (event.typing) {
        hideTypingTimer.current = window.setTimeout(() => setOtherTyping(false), TYPING_HIDE_AFTER_MS)
      }
    } else if (event.type === 'read' && event.chat_id === chatId && event.reader_id !== me?.id) {
      setMessages((prev) => prev.map((m) => (m.sender_id === me?.id ? { ...m, is_read: true } : m)))
    }
  })

  // Coming back to the tab marks new messages as read
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && loaded && !notFound) markRead()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loaded, notFound, markRead])

  // Stop timers and tell the other side we stopped typing when leaving
  useEffect(() => {
    return () => {
      window.clearTimeout(hideTypingTimer.current)
      window.clearTimeout(stopTypingTimer.current)
      if (lastTypingSent.current) sendTyping(chatId, false)
    }
  }, [chatId, sendTyping])

  // Keep the scroll position sensible: stay at the bottom for new messages,
  // stay in place when older messages are added on top
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (distanceFromBottom.current !== null) {
      el.scrollTop = el.scrollHeight - distanceFromBottom.current
      distanceFromBottom.current = null
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, otherTyping, loaded])

  const loadOlder = async () => {
    if (!hasMore || loadingOlder || messages.length === 0) return
    setLoadingOlder(true)
    try {
      const page = await chatApi.messages(chatId, messages[0].id)
      const el = scrollRef.current
      if (el) distanceFromBottom.current = el.scrollHeight - el.scrollTop
      stickToBottom.current = false
      setMessages((prev) => mergeMessages(page.messages, prev))
      setHasMore(page.has_more)
    } catch (err) {
      setError(errorText(err, 'Could not load older messages.'))
    } finally {
      setLoadingOlder(false)
    }
  }

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop < 60) loadOlder()
  }

  const stopTyping = () => {
    window.clearTimeout(stopTypingTimer.current)
    if (lastTypingSent.current) {
      sendTyping(chatId, false)
      lastTypingSent.current = 0
    }
  }

  const onDraftChange = (value: string) => {
    setDraft(value)
    if (!value.trim()) {
      stopTyping()
      return
    }
    const now = Date.now()
    if (now - lastTypingSent.current > TYPING_SEND_EVERY_MS) {
      sendTyping(chatId, true)
      lastTypingSent.current = now
    }
    window.clearTimeout(stopTypingTimer.current)
    stopTypingTimer.current = window.setTimeout(stopTyping, TYPING_STOP_AFTER_MS)
  }

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    setError(null)
    try {
      const message = await chatApi.send(chatId, content)
      stickToBottom.current = true
      setMessages((prev) => mergeMessages(prev, [message]))
      setDraft('')
      stopTyping()
      refreshChats()
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError(`You're no longer connected with ${other?.name ?? 'this person'}, so you can't send messages here.`)
      } else {
        setError(errorText(err, 'Message not sent. Try again.'))
      }
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  if (!loaded) return <Spinner label="Loading chat" />
  if (notFound) {
    return (
      <EmptyState title="This chat isn't available">
        You can only chat with people you're connected with.{' '}
        <Link to="/chats" className="font-semibold text-swap hover:underline">
          Back to chats
        </Link>
      </EmptyState>
    )
  }

  const online = otherId !== null && isOnline(otherId)
  const name = other?.name ?? '…'
  const lastMineId = [...messages].reverse().find((m) => m.sender_id === me?.id)?.id

  return (
    <div className="mx-auto flex h-[calc(100dvh-11rem)] max-w-2xl flex-col overflow-hidden rounded-[22px] bg-white ring-1 ring-line md:h-[calc(100dvh-7rem)]">
      <header className="flex items-center gap-3 border-b border-line px-3 py-2.5">
        <Link to="/chats" className="rounded-full p-1.5 text-ink-soft hover:bg-paper hover:text-ink" aria-label="Back to chats">
          <Icon name="back" />
        </Link>
        <Link to={`/users/${otherId}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar src={other?.profile_picture} name={name} size="sm" online={online} />
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{name}</p>
            <p className={`text-xs ${otherTyping ? 'text-swap' : 'text-ink-soft'}`}>
              {otherTyping ? 'typing…' : online ? 'Online' : 'Offline'}
            </p>
          </div>
        </Link>
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 space-y-3 overflow-y-auto bg-paper/60 px-3 py-4 sm:px-5">
        {hasMore ? (
          <div className="text-center">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink-soft ring-1 ring-line hover:text-ink"
            >
              {loadingOlder ? 'Loading…' : 'Load older messages'}
            </button>
          </div>
        ) : (
          messages.length > 0 && <p className="text-center text-xs text-ink-soft">This is the start of your chat with {name}</p>
        )}

        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-soft">
            Say hi to {name} and agree where and when to swap.
          </p>
        )}

        {messages.map((m) => {
          const mine = m.sender_id === me?.id
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <p
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2 text-[15px] leading-snug ${
                  mine ? 'rounded-br-md bg-swap text-white' : 'rounded-bl-md bg-white ring-1 ring-line'
                }`}
              >
                {m.content}
              </p>
              <span className="mt-1 px-1 text-[11px] text-ink-soft">
                <time dateTime={m.created_at}>{formatMessageTime(m.created_at)}</time>
                {mine && m.id === lastMineId && m.is_read && ', seen'}
              </span>
            </div>
          )
        })}

        {otherTyping && (
          <div className="flex items-center gap-2 text-sm text-ink-soft" role="status">
            <span className="rounded-[18px] rounded-bl-md bg-white px-3 py-2 ring-1 ring-line">💬 {name} is typing…</span>
          </div>
        )}
      </div>

      <form onSubmit={send} className="border-t border-line p-3">
        {error && (
          <div className="mb-2">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={stopTyping}
            placeholder={`Message ${name}`}
            maxLength={2000}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-paper px-3.5 py-2.5 text-[15px] focus:border-swap focus:bg-white focus:outline-none focus:ring-2 focus:ring-swap/20"
            aria-label="Message"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-swap text-white hover:bg-swap-dark disabled:bg-swap/40"
            aria-label="Send"
          >
            <Icon name="send" className="size-5" />
          </button>
        </div>
      </form>
    </div>
  )
}
