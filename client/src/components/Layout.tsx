import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useInbox } from '../context/InboxContext'
import { useRealtime } from '../context/RealtimeContext'
import { Avatar } from './Avatar'
import { Icon, type IconName } from './Icon'
import { Badge } from './ui'

type NavItem = { to: string; label: string; icon: IconName; badge?: number }

export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-xl font-extrabold tracking-tight">
      <span
        className={`flex size-8 items-center justify-center rounded-[10px] ${onDark ? 'bg-tag text-swap' : 'bg-swap text-tag'}`}
      >
        <Icon name="swap" className="size-5" />
      </span>
      swaply
    </span>
  )
}

export function Layout() {
  const { me, logout } = useAuth()
  const { totalUnread, requests } = useInbox()
  const { connected } = useRealtime()
  const navigate = useNavigate()

  const items: NavItem[] = [
    { to: '/', label: 'Discover', icon: 'cards' },
    { to: '/requests', label: 'Requests', icon: 'inbox', badge: requests.length },
    { to: '/chats', label: 'Chats', icon: 'chat', badge: totalUnread },
    { to: '/connections', label: 'Connections', icon: 'people' },
    { to: '/profile', label: 'Profile', icon: 'user' },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4">
          <NavLink to="/" aria-label="Swaply home">
            <Logo />
          </NavLink>

          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-white hover:text-ink'
                  }`
                }
              >
                {item.label}
                <Badge count={item.badge ?? 0} />
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {!connected && me && (
              <span className="hidden text-xs text-ink-soft sm:inline" role="status">
                Reconnecting…
              </span>
            )}
            {me && (
              <NavLink to="/profile" className="hidden md:block" aria-label="My profile">
                <Avatar src={me.profile_picture} name={me.name} size="sm" />
              </NavLink>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-white hover:text-ink"
            >
              <Icon name="logout" className="size-4" />
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      {/* Bottom tab bar on phones */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Main"
      >
        <div className="grid grid-cols-5">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
                  isActive ? 'text-swap' : 'text-ink-soft'
                }`
              }
            >
              <Icon name={item.icon} className="size-6" />
              {item.label}
              {(item.badge ?? 0) > 0 && (
                <span className="absolute right-[calc(50%-22px)] top-1">
                  <Badge count={item.badge ?? 0} />
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
