import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-swap text-white hover:bg-swap-dark disabled:bg-swap/50',
  secondary: 'bg-white text-ink ring-1 ring-line hover:ring-ink/30 disabled:text-ink-soft',
  danger: 'bg-white text-pass ring-1 ring-pass/40 hover:bg-pass hover:text-white',
  ghost: 'text-ink-soft hover:text-ink hover:bg-white/70',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export const inputClass =
  'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-soft/60 focus:border-swap focus:outline-none focus:ring-2 focus:ring-swap/20'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-soft" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-line border-t-swap" />
      <span className="text-sm">{label}…</span>
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm px-6 py-16 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</div>}
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-pass/10 px-3 py-2 text-sm text-pass">{children}</p>
}

export function Badge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-pass px-1.5 text-[11px] font-bold leading-5 text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function PageTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{children}</h1>
      {aside}
    </div>
  )
}
