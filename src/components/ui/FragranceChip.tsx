'use client'

import { cn } from '@/lib/cn'

export type FragranceOption = {
  id: string
  name: string
  swatch?: string | null
  mood?: string | null
  available?: boolean
}

/** Single-select fragrance picker rendered as swatch chips (radio group semantics). */
export function FragrancePicker({
  options,
  value,
  onChange,
  label = 'Fragrance',
}: {
  options: FragranceOption[]
  value?: string
  onChange: (id: string) => void
  label?: string
}) {
  const selected = options.find((o) => o.id === value)

  return (
    <fieldset>
      <legend className="mb-3 text-xs uppercase tracking-[0.18em] text-muted">
        {label}: <span className="text-ink">{selected?.name ?? 'Choose one'}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-2 border px-3 text-sm transition-colors',
              value === option.id
                ? 'border-burgundy-700 bg-burgundy-700 text-cream-50'
                : 'border-blush-200 bg-white hover:border-burgundy-500',
              option.available === false && 'cursor-not-allowed opacity-45 line-through',
            )}
          >
            <input
              type="radio"
              name={label}
              value={option.id}
              checked={value === option.id}
              disabled={option.available === false}
              onChange={() => onChange(option.id)}
              className="sr-only"
            />
            <FragranceSwatch color={option.swatch} />
            {option.name}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function FragranceSwatch({ color, className }: { color?: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('size-4 shrink-0 rounded-full ring-1 ring-black/10', className)}
      style={{ background: color ?? 'var(--color-blush-200)' }}
    />
  )
}
