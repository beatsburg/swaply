import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { chatApi } from '../api/chats'
import { errorText } from '../api/client'
import { matchingApi } from '../api/matching'
import { Avatar } from '../components/Avatar'
import { ItemRow } from '../components/Item'
import { Button, EmptyState, ErrorNote, PageTitle } from '../components/ui'
import { useInbox } from '../context/InboxContext'
import { useUserCard } from '../hooks/useUserCard'

export function RequestsPage() {
  const { requests } = useInbox()

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle>Requests</PageTitle>
      {requests.length === 0 ? (
        <EmptyState title="No requests right now">
          When someone wants your item, they show up here and you can accept or decline.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {requests.map((id) => (
            <RequestRow key={id} userId={id} />
          ))}
        </ul>
      )}
    </div>
  )
}

function RequestRow({ userId }: { userId: number }) {
  const { card, loading } = useUserCard(userId)
  const { refreshRequests, refreshConnections } = useInbox()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accept = async () => {
    setBusy(true)
    setError(null)
    try {
      await matchingApi.acceptRequest(userId)
      setAccepted(true)
      refreshConnections()
    } catch (err) {
      setError(errorText(err, 'Could not accept the request.'))
    } finally {
      setBusy(false)
    }
  }

  const decline = async () => {
    setBusy(true)
    setError(null)
    try {
      await matchingApi.declineRequest(userId)
      refreshRequests()
    } catch (err) {
      setError(errorText(err, 'Could not decline the request.'))
      setBusy(false)
    }
  }

  const openChat = async () => {
    try {
      const chat = await chatApi.open(userId)
      refreshRequests()
      navigate(`/chats/${chat.id}`)
    } catch (err) {
      setError(errorText(err, 'Could not open the chat.'))
    }
  }

  if (loading) return <li className="h-36 animate-pulse rounded-[22px] bg-white/60" />
  if (!card) return null

  return (
    <li className="rounded-[22px] bg-white p-4 ring-1 ring-line">
      <div className="flex items-center gap-3">
        <Avatar src={card.profile_picture} name={card.name} />
        <div className="min-w-0 flex-1">
          <Link to={`/users/${card.id}`} className="font-semibold hover:underline">
            {card.name}
          </Link>
          <p className="text-sm text-ink-soft">{accepted ? 'You are now connected' : 'Wants to swap with you'}</p>
        </div>
      </div>

      {card.item && (
        <div className="mt-3">
          <ItemRow item={card.item} label="They offer" />
        </div>
      )}

      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {accepted ? (
          <>
            <Button onClick={openChat}>Message {card.name}</Button>
            <Button variant="ghost" onClick={refreshRequests}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button onClick={accept} disabled={busy}>
              Accept
            </Button>
            <Button variant="secondary" onClick={decline} disabled={busy}>
              Decline
            </Button>
          </>
        )}
      </div>
    </li>
  )
}
