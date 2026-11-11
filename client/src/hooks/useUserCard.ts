import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import type { UserCard, UserSummary } from '../api/types'
import { getUserSummaryCached, loadUserCard } from '../api/users'

/** Full data of another user (/users/:id + /profile + /bio + /item). */
export function useUserCard(id: number | null) {
  const [card, setCard] = useState<UserCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (id === null) return
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    loadUserCard(id)
      .then((data) => {
        if (!cancelled) setCard(data)
      })
      .catch((err) => {
        if (cancelled) return
        setCard(null)
        setNotFound(err instanceof ApiError && err.status === 404)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  return { card, loading, notFound, reload }
}

/** Just name + picture, cached. Used in chat lists. */
export function useUserSummary(id: number | null) {
  const [summary, setSummary] = useState<UserSummary | null>(null)

  useEffect(() => {
    if (id === null) return
    let cancelled = false
    getUserSummaryCached(id)
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return summary
}
