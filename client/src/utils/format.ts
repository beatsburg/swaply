const DEFAULT_AVATAR_MARKER = 'default-avatar'

/** The backend returns a default svg when there's no picture, we show the 👤 placeholder instead. */
export function hasRealPicture(url: string | null | undefined): url is string {
  return Boolean(url) && !url!.includes(DEFAULT_AVATAR_MARKER)
}

export function formatMoney(value: number): string {
  return `€${Math.round(value).toLocaleString('en-US')}`
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function timeOf(date: Date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** Date and time shown under every chat message: "Today 20:41", "Yesterday 09:03", "3 Nov 14:20" */
export function formatMessageTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  if (sameDay(date, now)) return `Today ${timeOf(date)}`
  if (sameDay(date, yesterday)) return `Yesterday ${timeOf(date)}`

  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric'
  return `${date.toLocaleDateString('en-GB', options)} ${timeOf(date)}`
}

/** Short time for the chat list: "20:41", "Yesterday", "3 Nov" */
export function formatListTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(date, now)) return timeOf(date)
  if (sameDay(date, yesterday)) return 'Yesterday'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
