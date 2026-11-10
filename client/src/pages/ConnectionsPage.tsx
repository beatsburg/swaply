import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { chatApi } from '../api/chats'
import { errorText } from '../api/client'
import { matchingApi } from '../api/matching'
import { Avatar } from '../components/Avatar'
import { ItemRow } from '../components/Item'
import { Button, EmptyState, ErrorNote, PageTitle } from '../components/ui'
import { useInbox } from '../context/InboxContext'
import { useRealtime } from '../context/RealtimeContext'
import { useUserCard } from '../hooks/useUserCard'

export function ConnectionsPage() {
  const { connections } = useInbox()

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle>Connections</PageTitle>
      {connections.length === 0 ? (
        <EmptyState title="No connections yet">
          You connect with someone when you both want each other's items.{' '}
          <Link to="/" className="font-semibold text-swap hover:underline">
            Start swiping
          </Link>
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {connections.map((id) => (
            <ConnectionCard key={id} userId={id} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ConnectionCard({ userId }: { userId: number }) {
  const { card, loading } = useUserCard(userId)
  const { isOnline } = useRealtime()
  const { refreshConnections, refreshChats } = useInbox()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openChat = async () => {
    setError(null)
    try {
      const chat = await chatApi.open(userId)
      navigate(`/chats/${chat.id}`)
    } catch (err) {
      setError(errorText(err, 'Could not open the chat.'))
    }
  }

  const disconnect = async () => {
    setBusy(true)
    setError(null)
    try {
      await matchingApi.disconnect(userId)
      refreshConnections()
      refreshChats()
    } catch (err) {
      setError(errorText(err, 'Could not disconnect.'))
      setBusy(false)
    }
  }

  if (loading) return <li className="h-44 animate-pulse rounded-[22px] bg-white/60" />
  if (!card) return null

  return (
    <li className="flex flex-col rounded-[22px] bg-white p-4 ring-1 ring-line">
      <div className="flex items-center gap-3">
        <Avatar src={card.profile_picture} name={card.name} online={isOnline(card.id)} />
        <div className="min-w-0 flex-1">
          <Link to={`/users/${card.id}`} className="block truncate font-semibold hover:underline">
            {card.name}
          </Link>
          <p className="text-xs text-ink-soft">
            {isOnline(card.id) ? 'Online' : 'Offline'}
            {card.city && `, ${card.city}`}
          </p>
        </div>
      </div>
      {card.item && (
        <div className="mt-3">
          <ItemRow item={card.item} />
        </div>
      )}
      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        {confirming ? (
          <>
            <span className="text-sm">Disconnect from {card.name}?</span>
            <Button variant="danger" onClick={disconnect} disabled={busy}>
              Disconnect
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button onClick={openChat}>Message</Button>
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              Disconnect
            </Button>
          </>
        )}
      </div>
    </li>
  )
}
