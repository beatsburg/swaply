import { Link } from 'react-router-dom'
import type { ChatSummary } from '../api/types'
import { Avatar } from '../components/Avatar'
import { Badge, EmptyState, PageTitle, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useInbox } from '../context/InboxContext'
import { useRealtime } from '../context/RealtimeContext'
import { useUserSummary } from '../hooks/useUserCard'
import { formatListTime } from '../utils/format'

export function ChatsPage() {
  const { chats, chatsLoaded } = useInbox()

  if (!chatsLoaded) return <Spinner label="Loading chats" />

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle>Chats</PageTitle>
      {chats.length === 0 ? (
        <EmptyState title="No chats yet">
          Open one of your{' '}
          <Link to="/connections" className="font-semibold text-swap hover:underline">
            connections
          </Link>{' '}
          and send a message to agree on a swap.
        </EmptyState>
      ) : (
        // The backend already sorts by the latest message, newest first
        <ul className="overflow-hidden rounded-[22px] bg-white ring-1 ring-line">
          {chats.map((chat) => (
            <ChatRow key={chat.id} chat={chat} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ChatRow({ chat }: { chat: ChatSummary }) {
  const user = useUserSummary(chat.user_id)
  const { me } = useAuth()
  const { isOnline } = useRealtime()
  const unread = chat.unread_count > 0
  const last = chat.last_message
  const name = user?.name ?? '…'

  return (
    <li className="border-b border-line last:border-b-0">
      <Link to={`/chats/${chat.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-paper">
        <Avatar src={user?.profile_picture} name={name} online={isOnline(chat.user_id)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`truncate ${unread ? 'font-bold' : 'font-semibold'}`}>{name}</p>
            <span className={`shrink-0 text-xs ${unread ? 'font-semibold text-swap' : 'text-ink-soft'}`}>
              {formatListTime(chat.updated_at)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className={`truncate text-sm ${unread ? 'text-ink' : 'text-ink-soft'}`}>
              {last ? `${last.sender_id === me?.id ? 'You: ' : ''}${last.content}` : 'No messages yet'}
            </p>
            <Badge count={chat.unread_count} />
          </div>
        </div>
      </Link>
    </li>
  )
}
