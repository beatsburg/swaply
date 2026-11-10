import type { Item } from '../api/types'
import { CATEGORIES, CONDITIONS, emojiFor, labelFor } from '../constants'
import { formatMoney } from '../utils/format'

/**
 * The yellow price tag with a punched hole. The one bold element of the design.
 * className positions the tag (e.g. "absolute right-4 top-4 rotate-[-7deg]").
 */
export function PriceTag({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`inline-block ${className}`}>
      <span className="tag-hole relative inline-block rounded-l-[14px] rounded-r-lg bg-tag py-1.5 pl-6 pr-3 text-lg font-extrabold leading-none tracking-tight text-ink shadow-[0_2px_0_var(--color-tag-dark)]">
        {formatMoney(value)}
      </span>
    </span>
  )
}

export function ItemImage({ item, className = '' }: { item: Pick<Item, 'image_url' | 'category' | 'title'>; className?: string }) {
  if (item.image_url) {
    return <img src={item.image_url} alt={item.title} className={`object-cover ${className}`} />
  }
  return (
    <div className={`flex items-center justify-center bg-swap-soft ${className}`} role="img" aria-label={item.title}>
      <span className="text-6xl">{emojiFor(item.category)}</span>
    </div>
  )
}

export function ItemFacts({ item }: { item: Item }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
      <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-line">
        {emojiFor(item.category)} {labelFor(CATEGORIES, item.category)}
      </span>
      <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-line">{labelFor(CONDITIONS, item.condition)}</span>
    </div>
  )
}

/** Compact item row for lists (requests, connections, profile). */
export function ItemRow({ item, label }: { item: Item; label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-paper p-2 pr-3">
      <ItemImage item={item} className="size-14 shrink-0 rounded-xl [&>span]:text-2xl" />
      <div className="min-w-0 flex-1">
        {label && <p className="text-xs text-ink-soft">{label}</p>}
        <p className="truncate font-semibold">{item.title}</p>
        <p className="text-xs text-ink-soft">{labelFor(CONDITIONS, item.condition)}</p>
      </div>
      <span className="shrink-0 rounded-md bg-tag px-2 py-0.5 text-sm font-bold">{formatMoney(item.estimated_value)}</span>
    </div>
  )
}
