import { hasRealPicture } from '../utils/format'

const SIZES = {
  sm: 'size-9 text-lg',
  md: 'size-12 text-2xl',
  lg: 'size-24 text-5xl',
}

type Props = {
  src: string | null | undefined
  name: string
  size?: keyof typeof SIZES
  /** undefined = don't show a dot at all */
  online?: boolean
}

export function Avatar({ src, name, size = 'md', online }: Props) {
  return (
    <span className={`relative inline-flex shrink-0 ${SIZES[size]}`}>
      {hasRealPicture(src) ? (
        <img src={src} alt={name} className="size-full rounded-full object-cover ring-2 ring-white" />
      ) : (
        <span
          className="flex size-full items-center justify-center rounded-full bg-swap-soft ring-2 ring-white"
          role="img"
          aria-label={`${name} has no profile picture`}
        >
          👤
        </span>
      )}
      {online !== undefined && <OnlineDot online={online} className="absolute bottom-0 right-0" />}
    </span>
  )
}

export function OnlineDot({ online, className = '' }: { online: boolean; className?: string }) {
  return (
    <span
      className={`block size-3 rounded-full ring-2 ring-white ${online ? 'bg-online' : 'bg-ink-soft/40'} ${className}`}
      title={online ? 'Online' : 'Offline'}
      aria-label={online ? 'Online' : 'Offline'}
    />
  )
}
