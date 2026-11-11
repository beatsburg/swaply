import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { errorText } from '../api/client'
import type { Bio, Item, MyProfile, Weights } from '../api/types'
import { meApi } from '../api/users'
import { Avatar } from '../components/Avatar'
import { ChipPicker } from '../components/ChipPicker'
import { Icon } from '../components/Icon'
import { ItemFacts, ItemImage, PriceTag } from '../components/Item'
import { Button, ErrorNote, Field, inputClass, PageTitle, Spinner } from '../components/ui'
import { CATEGORIES, CITIES, CONDITIONS, INTERESTS, WEIGHT_LABELS } from '../constants'
import { useAuth } from '../context/AuthContext'

export function ProfilePage() {
  const { me, refreshMe } = useAuth()
  const location = useLocation()
  const cameFromGuard = Boolean((location.state as { incomplete?: boolean } | null)?.incomplete)

  const [profile, setProfile] = useState<MyProfile | null>(null)
  const [bio, setBio] = useState<Bio | null>(null)
  const [item, setItem] = useState<Item | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [p, b, i] = await Promise.all([meApi.getProfile(), meApi.getBio(), meApi.getItem()])
      setProfile(p)
      setBio(b)
      setItem(i)
    } catch (err) {
      setLoadError(errorText(err, 'Could not load your profile.'))
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // After any save: reload /me so is_completed (and the guards) update
  const afterSave = useCallback(async () => {
    await refreshMe()
  }, [refreshMe])

  if (loadError) return <ErrorNote>{loadError}</ErrorNote>
  if (!profile || !bio || !me) return <Spinner label="Loading your profile" />

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle>Your profile</PageTitle>

      {me.is_completed ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-line">
          <p className="text-sm">Your profile is complete, so you're getting recommendations.</p>
          <Link to="/" className="text-sm font-semibold text-swap hover:underline">
            Go to Discover
          </Link>
        </div>
      ) : (
        <Checklist profile={profile} bio={bio} item={item} highlight={cameFromGuard} />
      )}

      <div className="space-y-6">
        <PhotoSection picture={me.profile_picture} name={me.name} onChanged={afterSave} />
        <AboutSection
          profile={profile}
          email={me.email}
          onSaved={async (p) => {
            setProfile(p)
            await afterSave()
          }}
        />
        <ItemSection
          item={item}
          onChanged={async (i) => {
            setItem(i)
            await afterSave()
          }}
        />
        <PreferencesSection
          bio={bio}
          onSaved={async (b) => {
            setBio(b)
            await afterSave()
          }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-[22px] bg-white p-5 ring-1 ring-line sm:p-6">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function SavedNote({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-online" role="status">
      <Icon name="check" className="size-4" /> Saved
    </span>
  )
}

/** Same rules as ProfileCompletionService on the backend, plus location which matching needs. */
function Checklist({ profile, bio, item, highlight }: { profile: MyProfile; bio: Bio; item: Item | null; highlight: boolean }) {
  const steps = [
    { done: Boolean(profile.name?.trim()), label: 'Add your name' },
    { done: profile.latitude !== null && profile.longitude !== null, label: 'Set your location' },
    { done: item !== null, label: 'Put up an item to swap' },
    { done: bio.interests.length > 0, label: 'Pick your interests' },
    { done: bio.preferred_categories.length > 0, label: 'Choose what kind of items you want' },
    { done: bio.preferred_conditions.length > 0, label: 'Choose which conditions you accept' },
    { done: bio.max_distance_km > 0, label: 'Set how far you would travel' },
  ]
  const doneCount = steps.filter((s) => s.done).length

  return (
    <div className={`mb-6 rounded-2xl p-5 ${highlight ? 'bg-tag' : 'bg-swap-soft'}`}>
      <p className="font-bold">Finish your profile to start swapping</p>
      <p className="mt-1 text-sm text-ink/75">
        Recommendations, requests and chats open up once these are done ({doneCount} of {steps.length}).
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-2 text-sm">
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                step.done ? 'bg-ink text-white' : 'bg-white ring-1 ring-ink/20'
              }`}
            >
              {step.done && <Icon name="check" className="size-3.5" />}
            </span>
            <span className={step.done ? 'text-ink/60 line-through' : ''}>{step.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// --- Photo ------------------------------------------------------------------

function PhotoSection({ picture, name, onChanged }: { picture: string; name: string; onChanged: () => Promise<void> }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasPicture = !picture.includes('default-avatar')

  const upload = async (file: File) => {
    setError(null)
    if (!file.type.startsWith('image/')) return setError('Choose an image file (JPG, PNG or WEBP).')
    if (file.size > 5 * 1024 * 1024) return setError('The image is too big. The limit is 5 MB.')
    setBusy(true)
    try {
      await meApi.uploadAvatar(file)
      await onChanged()
    } catch (err) {
      setError(errorText(err, 'Could not upload the picture.'))
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const remove = async () => {
    setError(null)
    setBusy(true)
    try {
      await meApi.removeAvatar()
      await onChanged()
    } catch (err) {
      setError(errorText(err, 'Could not remove the picture.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title="Profile picture">
      <div className="flex flex-wrap items-center gap-5">
        <Avatar src={picture} name={name} size="lg" />
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) upload(file)
            }}
          />
          <Button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
            <Icon name="camera" className="size-4" />
            {hasPicture ? 'Change picture' : 'Upload picture'}
          </Button>
          {hasPicture && (
            <Button type="button" variant="secondary" disabled={busy} onClick={remove}>
              Remove
            </Button>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </Section>
  )
}

// --- About + location -------------------------------------------------------

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

function nearestCity(lat: number, lon: number) {
  return CITIES.reduce((best, city) =>
    distanceKm(lat, lon, city.lat, city.lon) < distanceKm(lat, lon, best.lat, best.lon) ? city : best,
  )
}

function AboutSection({
  profile,
  email,
  onSaved,
}: {
  profile: MyProfile
  email: string
  onSaved: (p: MyProfile) => Promise<void>
}) {
  const [name, setName] = useState(profile.name ?? '')
  const [about, setAbout] = useState(profile.about_me ?? '')
  const [city, setCity] = useState(profile.city ?? '')
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    profile.latitude !== null && profile.longitude !== null ? { lat: profile.latitude, lon: profile.longitude } : null,
  )
  const [source, setSource] = useState<'saved' | 'gps' | 'city'>('saved')
  const [locating, setLocating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const pickCity = (cityName: string) => {
    setCity(cityName)
    const found = CITIES.find((c) => c.name === cityName)
    if (found) {
      setCoords({ lat: found.lat, lon: found.lon })
      setSource('city')
    }
  }

  const useDeviceLocation = () => {
    setError(null)
    if (!('geolocation' in navigator)) {
      setError('This browser cannot share its location. Pick your city instead.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5))
        const lon = Number(pos.coords.longitude.toFixed(5))
        setCoords({ lat, lon })
        setSource('gps')
        if (!city) setCity(nearestCity(lat, lon).name)
        setLocating(false)
      },
      () => {
        setError('Location access was blocked. Allow it in the browser, or pick your city instead.')
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    if (!name.trim()) return setError('Your name can’t be empty.')
    if (!coords) return setError('Set your location so we can find swaps near you.')

    setBusy(true)
    try {
      const updated = await meApi.updateProfile({
        name: name.trim(),
        about_me: about.trim(),
        city,
        latitude: coords.lat,
        longitude: coords.lon,
      })
      await onSaved(updated)
      setSaved(true)
    } catch (err) {
      setError(errorText(err, 'Could not save your details.'))
    } finally {
      setBusy(false)
    }
  }

  const sourceText =
    source === 'gps' ? 'your device location' : source === 'city' ? `${city} city centre` : 'your saved location'

  return (
    <Section title="About you" description={`Signed in as ${email}. Your email is never shown to other people.`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </Field>
        <Field label="About me" hint="A few words about you and why you swap.">
          <textarea
            className={`${inputClass} min-h-24 resize-y`}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            maxLength={500}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="City">
            <select className={inputClass} value={city} onChange={(e) => pickCity(e.target.value)}>
              <option value="">Choose a city</option>
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Button type="button" variant="secondary" onClick={useDeviceLocation} disabled={locating} className="py-2.5">
            <Icon name="pin" className="size-4" />
            {locating ? 'Finding you…' : 'Use my exact location'}
          </Button>
        </div>
        <p className="text-xs text-ink-soft">
          {coords
            ? `Distances are measured from ${sourceText} (${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)}). Other people only see your city.`
            : 'No location yet. Pick your city or share your device location.'}
        </p>

        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save details'}
          </Button>
          <SavedNote show={saved} />
        </div>
      </form>
    </Section>
  )
}

// --- Item -------------------------------------------------------------------

function ItemSection({ item, onChanged }: { item: Item | null; onChanged: (i: Item | null) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await meApi.removeItem()
      setConfirmRemove(false)
      await onChanged(null)
    } catch (err) {
      setError(errorText(err, 'Could not remove the item.'))
    } finally {
      setBusy(false)
    }
  }

  const description = 'You can offer one item at a time. People see it when you show up in their recommendations.'

  if (!item || editing) {
    return (
      <Section title={item ? 'Edit your item' : 'Your item to swap'} description={description}>
        <ItemForm
          item={item}
          onCancel={item ? () => setEditing(false) : undefined}
          onSaved={async (saved) => {
            setEditing(false)
            await onChanged(saved)
          }}
        />
      </Section>
    )
  }

  return (
    <Section title="Your item to swap" description={description}>
      <div className="flex flex-col gap-4 sm:flex-row">
        <ItemImage item={item} className="aspect-[4/3] w-full rounded-2xl sm:w-48" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-lg font-bold">{item.title}</p>
            <PriceTag value={item.estimated_value} className="shrink-0 text-base" />
          </div>
          {item.description && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.description}</p>}
          <div className="mt-3">
            <ItemFacts item={item} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
              Edit item
            </Button>
            {confirmRemove ? (
              <>
                <span className="text-sm">Remove it? You'll stop getting recommendations until you add a new one.</span>
                <Button type="button" variant="danger" disabled={busy} onClick={remove}>
                  Remove item
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmRemove(false)}>
                  Keep it
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setConfirmRemove(true)}>
                Remove item
              </Button>
            )}
          </div>
          {error && (
            <div className="mt-3">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}

function ItemForm({
  item,
  onSaved,
  onCancel,
}: {
  item: Item | null
  onSaved: (i: Item | null) => Promise<void>
  onCancel?: () => void
}) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [category, setCategory] = useState(item?.category ?? '')
  const [condition, setCondition] = useState(item?.condition ?? '')
  const [value, setValue] = useState(item ? String(item.estimated_value) : '')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!image) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const numericValue = Number(value)
    if (!title.trim()) return setError('Give your item a title.')
    if (!category) return setError('Choose a category.')
    if (!condition) return setError('Choose the condition.')
    if (value === '' || !Number.isFinite(numericValue) || numericValue < 0) return setError('Enter the value in euros.')
    if (image && image.size > 5 * 1024 * 1024) return setError('The image is too big. The limit is 5 MB.')

    const form = new FormData()
    form.append('title', title.trim())
    form.append('description', description.trim())
    form.append('category', category)
    form.append('condition', condition)
    form.append('estimated_value', String(numericValue))
    if (image) form.append('image', image)

    setBusy(true)
    try {
      const saved = item ? await meApi.updateItem(form) : await meApi.createItem(form)
      await onSaved(saved)
    } catch (err) {
      setError(errorText(err, 'Could not save the item.'))
    } finally {
      setBusy(false)
    }
  }

  const shownImage = preview ?? item?.image_url ?? null

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Title">
        <input
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={150}
          placeholder="Gravel bike, 56 cm frame"
        />
      </Field>
      <Field label="Description">
        <textarea
          className={`${inputClass} min-h-20 resize-y`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Category">
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Choose</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Condition">
          <select className={inputClass} value={condition} onChange={(e) => setCondition(e.target.value)}>
            <option value="">Choose</option>
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Value (€)">
          <input
            className={inputClass}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {shownImage && <img src={shownImage} alt="" className="size-20 rounded-xl object-cover" />}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-line hover:ring-ink/30">
          <Icon name="camera" className="size-4" />
          {shownImage ? 'Change photo' : 'Add a photo'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : item ? 'Save item' : 'Put item up for swap'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

// --- Preferences (bio) --------------------------------------------------------

function PreferencesSection({ bio, onSaved }: { bio: Bio; onSaved: (b: Bio) => Promise<void> }) {
  const [interests, setInterests] = useState(bio.interests)
  const [categories, setCategories] = useState(bio.preferred_categories)
  const [conditions, setConditions] = useState(bio.preferred_conditions)
  const [minValue, setMinValue] = useState(String(bio.min_value))
  const [maxValue, setMaxValue] = useState(String(bio.max_value))
  const [distance, setDistance] = useState(bio.max_distance_km)
  const [weights, setWeights] = useState<Weights>(bio.weights)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const min = Number(minValue)
    const max = Number(maxValue)
    if (interests.length === 0) return setError('Pick at least one interest.')
    if (categories.length === 0) return setError('Pick at least one kind of item you want.')
    if (conditions.length === 0) return setError('Pick at least one condition you accept.')
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max <= 0) return setError('Enter a value range in euros.')
    if (min > max) return setError('The lowest value can’t be higher than the highest.')

    setBusy(true)
    try {
      const updated = await meApi.updateBio({
        interests,
        preferred_categories: categories,
        preferred_conditions: conditions,
        min_value: min,
        max_value: max,
        max_distance_km: distance,
        weights,
      })
      await onSaved(updated)
      setSaved(true)
    } catch (err) {
      setError(errorText(err, 'Could not save your preferences.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title="What you're looking for" description="This is what we use to pick your recommendations.">
      <form onSubmit={handleSubmit} className="space-y-6">
        <ChipPicker label="Your interests" options={INTERESTS} selected={interests} onChange={setInterests} />
        <ChipPicker label="Items you'd like to get" options={CATEGORIES} selected={categories} onChange={setCategories} />
        <ChipPicker label="Conditions you accept" options={CONDITIONS} selected={conditions} onChange={setConditions} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lowest value (€)">
            <input
              className={inputClass}
              type="number"
              min={0}
              inputMode="numeric"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
            />
          </Field>
          <Field label="Highest value (€)">
            <input
              className={inputClass}
              type="number"
              min={0}
              inputMode="numeric"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
            />
          </Field>
        </div>

        <label className="block">
          <span className="flex items-baseline justify-between text-sm font-semibold">
            How far you'd travel for a swap
            <span className="text-base font-bold">{distance} km</span>
          </span>
          <input
            type="range"
            min={1}
            max={300}
            value={distance}
            onChange={(e) => setDistance(Number(e.target.value))}
            className="mt-2 w-full accent-swap"
          />
          <span className="mt-1 block text-xs text-ink-soft">We only recommend people within this radius.</span>
        </label>

        <fieldset>
          <legend className="text-sm font-semibold">What matters most to you</legend>
          <p className="mt-1 text-xs text-ink-soft">0 means it doesn't matter, 5 means it matters a lot.</p>
          <div className="mt-3 space-y-3">
            {WEIGHT_LABELS.map((w) => (
              <label key={w.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[180px_1fr_auto]">
                <span className="text-sm font-medium">
                  {w.label}
                  <span className="block text-xs font-normal text-ink-soft">{w.hint}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={5}
                  value={weights[w.key]}
                  onChange={(e) => setWeights({ ...weights, [w.key]: Number(e.target.value) })}
                  className="order-3 col-span-2 w-full accent-swap sm:order-none sm:col-span-1"
                  aria-label={`${w.label} importance`}
                />
                <span className="w-5 text-right text-sm font-bold">{weights[w.key]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save preferences'}
          </Button>
          <SavedNote show={saved} />
        </div>
      </form>
    </Section>
  )
}
