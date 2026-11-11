import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { chatApi } from '../api/chats'
import { errorText } from '../api/client'
import { matchingApi } from '../api/matching'
import type { SwipeDirection } from '../api/types'
import { Avatar, OnlineDot } from '../components/Avatar'
import { Chips } from '../components/ChipPicker'
import { Icon } from '../components/Icon'
import { ItemFacts, ItemImage, PriceTag } from '../components/Item'
import { Button, EmptyState, ErrorNote, Spinner } from '../components/ui'
import { CATEGORIES, CONDITIONS, INTERESTS } from '../constants'
import { useInbox } from '../context/InboxContext'
import { useRealtime } from '../context/RealtimeContext'
import { useUserCard } from '../hooks/useUserCard'
import { formatMoney } from '../utils/format'

export function UserPage() {
  const params = useParams()
  const userId = Number(params.id)
  const validId = Number.isInteger(userId) && userId > 0
  const { card, loading, notFound, reload } = useUserCard(validId ? userId : null)
  const { connections, requests, refreshConnections, refreshRequests, refreshChats } = useInbox()
  const { isOnline, setPresence } = useRealtime()
  const navigate = useNavigate()
  const [recommended, setRecommended] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  const isConnected = connections.includes(userId)
  const hasRequest = requests.includes(userId)

  // Presence from REST first, live updates come over the WebSocket
  useEffect(() => {
    if (!validId) return
    chatApi
      .presence(userId)
      .then((p) => setPresence(p.id, p.online))
      .catch(() => {})
  }, [userId, validId, setPresence])

  useEffect(() => {
    if (!validId) return
    matchingApi
      .recommendations()
      .then((ids) => setRecommended(ids.includes(userId)))
      .catch(() => setRecommended(false))
  }, [userId, validId])

  if (!validId || notFound) {
    return (
      <EmptyState title="This profile isn't available">
        You can only see people who are recommended to you, have a request with you, or are connected with you.
      </EmptyState>
    )
  }
  if (loading || !card) return <Spinner label="Loading profile" />

  const run = async (action: () => Promise<unknown>, fallback: string, success?: string) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      if (success) setNote(success)
    } catch (err) {
      setError(errorText(err, fallback))
    } finally {
      setBusy(false)
    }
  }

  const swipe = (direction: SwipeDirection) =>
    run(
      async () => {
        const result = await matchingApi.swipe(userId, direction)
        setRecommended(false)
        refreshConnections()
        refreshRequests()
        if (direction === 'dismiss') navigate('/', { replace: true })
        else if (result.matched) setNote(`It's a match. You and ${card.name} are now connected.`)
        else setNote(`Request sent. ${card.name} will see it in their requests.`)
      },
      'That didn’t go through. Try again.',
    )

  const openChat = () =>
    run(async () => {
      const chat = await chatApi.open(userId)
      navigate(`/chats/${chat.id}`)
    }, 'Could not open the chat.')

  const online = isOnline(userId)
  const bio = card.bio

  return (
    <div className="mx-auto max-w-3xl">
      <button type="button" onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
        <Icon name="back" className="size-4" /> Back
      </button>

      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
        {/* Person */}
        <section className="rounded-[28px] bg-white p-6 ring-1 ring-line">
          <div className="flex items-center gap-4">
            <Avatar src={card.profile_picture} name={card.name} size="lg" />
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold leading-tight tracking-tight">{card.name}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
                <OnlineDot online={online} /> {online ? 'Online' : 'Offline'}
              </p>
              {card.city && (
                <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
                  <Icon name="pin" className="size-4" /> {card.city}
                </p>
              )}
            </div>
          </div>

          {card.about_me && <p className="mt-5 leading-relaxed">{card.about_me}</p>}

          {bio && (
            <dl className="mt-6 space-y-4">
              <div>
                <dt className="mb-1.5 text-sm font-semibold">Interests</dt>
                <dd>
                  <Chips values={bio.interests} options={INTERESTS} />
                </dd>
              </div>
              <div>
                <dt className="mb-1.5 text-sm font-semibold">Looking for</dt>
                <dd>
                  <Chips values={bio.preferred_categories} options={CATEGORIES} />
                </dd>
              </div>
              <div>
                <dt className="mb-1.5 text-sm font-semibold">Accepts condition</dt>
                <dd>
                  <Chips values={bio.preferred_conditions} options={CONDITIONS} />
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div>
                  <dt className="text-ink-soft">Value range</dt>
                  <dd className="font-semibold">
                    {formatMoney(bio.min_value)} to {formatMoney(bio.max_value)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-soft">Travels up to</dt>
                  <dd className="font-semibold">{bio.max_distance_km} km</dd>
                </div>
              </div>
            </dl>
          )}
        </section>

        {/* Item + actions */}
        <section>
          {card.item ? (
            <div className="overflow-hidden rounded-[28px] bg-white ring-1 ring-line">
              <div className="relative">
                <ItemImage item={card.item} className="aspect-[4/3] w-full" />
                <PriceTag value={card.item.estimated_value} className="absolute right-4 top-4 rotate-[-7deg]" />
              </div>
              <div className="p-5">
                <p className="text-sm text-ink-soft">{card.name} offers</p>
                <h2 className="text-xl font-bold tracking-tight">{card.item.title}</h2>
                {card.item.description && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{card.item.description}</p>}
                <div className="mt-3">
                  <ItemFacts item={card.item} />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[28px] bg-white p-6 text-sm text-ink-soft ring-1 ring-line">
              {card.name} has no item up for swap right now.
            </div>
          )}

          <div className="mt-4 space-y-3">
            {note && <p className="rounded-xl bg-swap-soft px-3 py-2 text-sm">{note}</p>}
            {error && <ErrorNote>{error}</ErrorNote>}

            {isConnected && (
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={openChat} disabled={busy} className="py-3">
                  <Icon name="chat" className="size-4" /> Message {card.name}
                </Button>
                {confirmDisconnect ? (
                  <>
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await matchingApi.disconnect(userId)
                          refreshConnections()
                          refreshChats()
                          setConfirmDisconnect(false)
                          reload()
                        }, 'Could not disconnect.')
                      }
                    >
                      Yes, disconnect
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmDisconnect(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" onClick={() => setConfirmDisconnect(true)}>
                    Disconnect
                  </Button>
                )}
              </div>
            )}

            {!isConnected && hasRequest && (
              <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
                <p className="text-sm">{card.name} wants to swap with you.</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(
                        async () => {
                          await matchingApi.acceptRequest(userId)
                          refreshConnections()
                          refreshRequests()
                        },
                        'Could not accept the request.',
                        `You and ${card.name} are now connected.`,
                      )
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await matchingApi.declineRequest(userId)
                        refreshRequests()
                        navigate('/requests', { replace: true })
                      }, 'Could not decline the request.')
                    }
                  >
                    Decline
                  </Button>
                </div>
              </div>
            )}

            {!isConnected && !hasRequest && recommended && (
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => swipe('like')} className="py-3">
                  <Icon name="heart" className="size-4" /> I'd swap for this
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => swipe('dismiss')} className="py-3">
                  Not for me
                </Button>
              </div>
            )}

            {!isConnected && !hasRequest && !recommended && !note && (
              <p className="text-sm text-ink-soft">
                Waiting for {card.name} to answer your request. <Link to="/" className="font-semibold text-swap hover:underline">Back to Discover</Link>
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
