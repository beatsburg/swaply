import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, errorText } from '../api/client'
import { Logo } from '../components/Layout'
import { PriceTag } from '../components/Item'
import { Button, ErrorNote, Field, inputClass } from '../components/ui'
import { useAuth } from '../context/AuthContext'

type Mode = 'login' | 'register'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AuthPage({ mode }: { mode: Mode }) {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isRegister = mode === 'register'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (isRegister && !name.trim()) return setError('Enter your name.')
    if (!EMAIL_PATTERN.test(email.trim())) return setError('Enter a valid email address.')
    if (isRegister && password.length < 8) return setError('Use at least 8 characters for the password.')
    if (!password) return setError('Enter your password.')

    setBusy(true)
    try {
      if (isRegister) {
        await register(name.trim(), email.trim(), password)
        navigate('/profile', { replace: true })
      } else {
        await login(email.trim(), password)
        navigate('/', { replace: true })
      }
    } catch (err) {
      if (!isRegister && err instanceof ApiError && err.status === 401) {
        setError('Wrong email or password.')
      } else if (isRegister && err instanceof ApiError && err.status === 400) {
        setError(errorText(err, 'This email is already registered. Log in instead.'))
      } else {
        setError(errorText(err, 'Something went wrong. Try again.'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh md:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-swap px-12 py-12 text-white md:flex md:flex-col">
        <Logo onDark />
        <div className="mt-auto max-w-md">
          <p className="text-5xl font-extrabold leading-[1.05] tracking-tight">
            Swap the things you don't use for the things you want.
          </p>
          <p className="mt-5 max-w-sm text-lg leading-relaxed text-white/80">
            Put up one item, swipe through what people near you are offering, and chat when you both like each other's
            stuff.
          </p>
        </div>
        <div className="pointer-events-none absolute right-10 top-24 rotate-[8deg]" aria-hidden="true">
          <PriceTag value={450} className="scale-150" />
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <Logo />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{isRegister ? 'Create an account' : 'Log in'}</h1>
          <p className="mt-2 text-ink-soft">
            {isRegister ? 'Already have one? ' : 'New here? '}
            <Link to={isRegister ? '/login' : '/register'} className="font-semibold text-swap underline-offset-2 hover:underline">
              {isRegister ? 'Log in' : 'Create an account'}
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
            {isRegister && (
              <Field label="Name">
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
            )}
            <Field label="Email" hint={isRegister ? 'Only you can see your email.' : undefined}>
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </Field>
            <Field label="Password">
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
            </Field>

            {error && <ErrorNote>{error}</ErrorNote>}

            <Button type="submit" disabled={busy} className="w-full py-3 text-base">
              {busy ? 'One moment…' : isRegister ? 'Create account' : 'Log in'}
            </Button>
          </form>
        </div>
      </section>
    </div>
  )
}
