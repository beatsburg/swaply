import type { Option } from '../constants'

type Props = {
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
  label: string
}

/** Multi-select as toggle chips. */
export function ChipPicker({ options, selected, onChange, label }: Props) {
  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(option.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-line hover:ring-ink/30'
              }`}
            >
              {option.emoji && <span className="mr-1">{option.emoji}</span>}
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Read-only chips, shared ones highlighted. */
export function Chips({ values, options, highlight = [] }: { values: string[]; options: Option[]; highlight?: string[] }) {
  if (values.length === 0) return <p className="text-sm text-ink-soft">Nothing picked yet</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => {
        const option = options.find((o) => o.value === value)
        const shared = highlight.includes(value)
        return (
          <span
            key={value}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              shared ? 'bg-swap text-white' : 'bg-white text-ink ring-1 ring-line'
            }`}
          >
            {option?.emoji && <span className="mr-1">{option.emoji}</span>}
            {option?.label ?? value}
          </span>
        )
      })}
    </div>
  )
}
