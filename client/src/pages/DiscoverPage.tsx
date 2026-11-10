import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { chatApi } from '../api/chats'
import { errorText } from '../api/client'
import { matchingApi } from '../api/matching'
import type { Bio, Item, SwipeDirection, UserCard } from '../api/types'
import { loadUserCard, meApi } from '../api/users'
import { Avatar } from '../components/Avatar'
import { Chips } from '../components/ChipPicker'
import { Icon } from '../components/Icon'
import { ItemFacts, ItemImage, PriceTag } from '../components/Item'
import { Button, EmptyState, ErrorNote, Spinner } from '../components/ui'
import { INTERESTS } from '../constants'
import { useInbox } from '../context/InboxContext'

const SWIPE_THRESHOLD_PX = 110

export function DiscoverPage() {
  const { refreshConnections, refreshRequests } = useInbox()
  const navigate = useNavigate()
  const [cards, setCards] = useState<UserCard[] | null>(null)
  const [myItem, setMyItem] = useState<Item | null>(null)
  const [myBio, setMyBio] = useState<Bio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState<SwipeDirection | null>(null)
  const [match, setMatch] = useState<UserCard | null>(null)

  const loadDeck = useCallback(async () => {
    setError(null)
    try {
      const ids = await matchingApi.recommendations()
      // Over-fetching by design: ids first, then each user's data. Skip anyone we can't load.
      const results = await Promise.allSettled(ids.map((id) => loadUserCard(id)))
      setCards(results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])))
    } catch (err) {
      setError(errorText(err, 'Could not load recommendations.'))
      setCards([])
    }
  }, [])

  useEffect(() => {
    loadDeck()
    meApi.getItem().then(setMyItem).catch(() => setMyItem(null))
    meApi.getBio().then(setMyBio).catch(() => setMyBio(null))
  }, [loadDeck])

  const top = cards?.[0] ?? null

  const decide = useCallback(
    async (direction: SwipeDirection) => {
      if (!top || busy) return
      setBusy(true)
      setLeaving(direction)
      setError(null)
      try {
        const [result] = await Promise.all([
          matchingApi.swipe(top.id, direction),
          new Promise((resolve) => setTimeout(resolve, 220)), // let the card fly out
        ])
        if (result.matched) {
          setMatch(top)
          refreshConnections()
        }
        refreshRequests()
        setCards((prev) => (prev ? prev.slice(1) : prev))
      } catch (err) {
        setError(errorText(err, 'That didn’t go through. Try again.'))
      } finally {
        setLeaving(null)
        setBusy(false)
      }
    },
    [top, busy, refreshConnections, refreshRequests],
  )

  // When the 10 cards run out, ask for the next batch once
  const refilled = useRef(false)
  useEffect(() => {
    if (cards && cards.length === 0 && !refilled.current && !error) {
      refilled.current = true
      loadDeck()
    }
    if (cards && cards.length > 0) refilled.current = false
  }, [cards, error, loadDeck])

  // Arrow keys for desktop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (match || (e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowRight') decide('like')
      if (e.key === 'ArrowLeft') decide('dismiss')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [decide, match])

  const openChat = async (userId: number) => {
    try {
      const chat = await chatApi.open(userId)
      navigate(`/chats/${chat.id}`)
    } catch (err) {
      setError(errorText(err, 'Could not open the chat.'))
    }
  }

  if (cards === null) return <Spinner label="Finding swaps for you" />

  return (
    <div className="mx-auto max-w-md">
      {myItem && (
        <div className="mb-4 flex items-center gap-3 rounded-full bg-white py-1.5 pl-1.5 pr-4 ring-1 ring-line">
          <ItemImage item={myItem} className="size-9 shrink-0 rounded-full [&>span]:text-lg" />
          <p className="min-w-0 truncate text-sm">
            <span className="text-ink-soft">You offer </span>
            <span className="font-semibold">{myItem.title}</span>
          </p>
          <Link to="/profile" className="ml-auto shrink-0 text-xs font-semibold text-swap hover:underline">
            Change
          </Link>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {top ? (
        <>
          <div className="relative h-[max(calc(100dvh-24rem),380px)] md:h-[min(max(calc(100dvh-20rem),420px),560px)]">
            {/* The next card peeks out behind the top one */}
            {cards[1] && (
              <div className="absolute inset-x-3 top-3 h-full scale-[0.97] rounded-[28px] bg-white opacity-70 ring-1 ring-line" aria-hidden="true" />
            )}
            <SwipeCard
              key={top.id}
              card={top}
              myInterests={myBio?.interests ?? []}
              leaving={leaving}
              onDecide={decide}
            />
          </div>

          <div className="mt-5 flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => decide('dismiss')}
              disabled={busy}
              className="flex size-16 items-center justify-center rounded-full bg-white text-pass ring-1 ring-line transition-transform hover:scale-105 disabled:opacity-50"
              aria-label={`Pass on ${top.name}'s item`}
            >
              <Icon name="x" className="size-7" />
            </button>
            <button
              type="button"
              onClick={() => decide('like')}
              disabled={busy}
              className="flex size-20 items-center justify-center rounded-full bg-swap text-white shadow-[0_6px_0_var(--color-swap-dark)] transition-transform hover:scale-105 disabled:opacity-50"
              aria-label={`I'd swap for ${top.name}'s item`}
            >
              <Icon name="heart" className="size-9" />
            </button>
          </div>
          <p className="mt-4 hidden text-center text-xs text-ink-soft md:block">Drag the card, use the buttons, or press ← and →</p>
        </>
      ) : (
        <EmptyState title="No more swaps near you right now">
          We only show people whose items fit what you're looking for. Try a bigger radius or more categories in{' '}
          <Link to="/profile" className="font-semibold text-swap hover:underline">
            your profile
          </Link>
          , or check back later.
          <div className="mt-5">
            <Button variant="secondary" onClick={loadDeck}>
              Check again
            </Button>
          </div>
        </EmptyState>
      )}

      {match && (
        <MatchDialog
          card={match}
          myItem={myItem}
          onChat={() => openChat(match.id)}
          onClose={() => setMatch(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function SwipeCard({
  card,
  myInterests,
  leaving,
  onDecide,
}: {
  card: UserCard
  myInterests: string[]
  leaving: SwipeDirection | null
  onDecide: (d: SwipeDirection) => void
}) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('a,button')) return
    startX.current = e.clientX
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging) setDx(e.clientX - startX.current)
  }
  const onPointerUp = () => {
    if (!dragging) return
    setDragging(false)
    if (dx > SWIPE_THRESHOLD_PX) onDecide('like')
    else if (dx < -SWIPE_THRESHOLD_PX) onDecide('dismiss')
    else setDx(0)
  }

  const offset = leaving === 'like' ? 600 : leaving === 'dismiss' ? -600 : dx
  const item = card.item
  const shared = card.bio ? card.bio.interests.filter((i) => myInterests.includes(i)) : []

  return (
    <div
      className="absolute inset-0 flex touch-pan-y select-none flex-col overflow-hidden rounded-[28px] bg-white ring-1 ring-line"
      style={{
        transform: `translateX(${offset}px) rotate(${offset / 22}deg)`,
        transition: dragging ? 'none' : 'transform 220ms ease-out',
        cursor: dragging ? 'grabbing' : 'grab',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* The photo takes whatever height is left, the text below always fits */}
      <div className="relative min-h-28 flex-1">
        {item ? (
          <ItemImage item={item} className="pointer-events-none size-full" />
        ) : (
          <div className="flex size-full items-center justify-center bg-swap-soft text-ink-soft">No item photo</div>
        )}
        {item && <PriceTag value={item.estimated_value} className="absolute right-4 top-4 rotate-[-7deg]" />}

        {/* Swipe hints */}
        <span
          className="absolute left-4 top-5 rotate-[-10deg] rounded-lg border-[3px] border-online bg-white/90 px-2 text-2xl font-extrabold text-online"
          style={{ opacity: Math.max(0, Math.min(1, offset / SWIPE_THRESHOLD_PX)) }}
          aria-hidden="true"
        >
          SWAP
        </span>
        <span
          className="absolute right-4 top-16 rotate-[10deg] rounded-lg border-[3px] border-pass bg-white/90 px-2 text-2xl font-extrabold text-pass"
          style={{ opacity: Math.max(0, Math.min(1, -offset / SWIPE_THRESHOLD_PX)) }}
          aria-hidden="true"
        >
          PASS
        </span>
      </div>

      <div className="flex shrink-0 flex-col gap-3 p-5">
        <div>
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight">{item?.title ?? 'No active item'}</h2>
          {item?.description && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{item.description}</p>}
        </div>
        {item && <ItemFacts item={item} />}

        {shared.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-ink-soft">You both like</p>
            <Chips values={shared} options={INTERESTS} highlight={shared} />
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-line pt-3">
          <Avatar src={card.profile_picture} name={card.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{card.name}</p>
            {card.city && <p className="text-xs text-ink-soft">{card.city}</p>}
          </div>
          <Link to={`/users/${card.id}`} className="shrink-0 text-sm font-semibold text-swap hover:underline">
            View profile
          </Link>
        </div>
      </div>
    </div>
  )
}

function MatchDialog({
  card,
  myItem,
  onChat,
  onClose,
}: {
  card: UserCard
  myItem: Item | null
  onChat: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-5" role="dialog" aria-modal="true" aria-labelledby="match-title">
      <div className="w-full max-w-sm rounded-[28px] bg-tag p-6 text-center shadow-[0_8px_0_var(--color-tag-dark)]">
        <p id="match-title" className="text-4xl font-extrabold tracking-tight">It's a match</p>
        <p className="mt-2 text-sm">{card.name} wants to swap with you too.</p>

        <div className="my-6 flex items-center justify-center gap-3">
          {myItem && <ItemImage item={myItem} className="size-24 rotate-[-6deg] rounded-2xl ring-4 ring-white [&>span]:text-4xl" />}
          <span className="flex size-10 items-center justify-center rounded-full bg-ink text-tag">
            <Icon name="swap" className="size-5" />
          </span>
          {card.item && <ItemImage item={card.item} className="size-24 rotate-[6deg] rounded-2xl ring-4 ring-white [&>span]:text-4xl" />}
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={onChat} className="py-3 text-base">
            Message {card.name}
          </Button>
          <Button variant="ghost" onClick={onClose} className="text-ink hover:bg-white/40">
            Keep swiping
          </Button>
        </div>
      </div>
    </div>
  )
}
