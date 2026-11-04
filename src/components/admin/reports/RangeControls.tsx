'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { COMPARE_MODES, RANGE_PRESETS } from '@/lib/reports/range'

const control = {
  minHeight: 34,
  padding: '0 10px',
  borderRadius: 4,
  border: '1px solid var(--theme-elevation-150)',
  background: 'var(--theme-input-bg, var(--theme-elevation-0))',
  color: 'inherit',
  fontSize: 13,
} as const

/** Date preset, custom range and comparison pickers. State lives in the URL so views are shareable. */
export function RangeControls({ from, to }: { from: string; to: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const preset = params.get('range') ?? '30d'
  const compare = params.get('compare') ?? 'previous'
  const [custom, setCustom] = useState({ from, to })

  const go = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(changes)) {
      if (v == null) next.delete(k)
      else next.set(k, v)
    }
    router.push(`${pathname}?${next}`)
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
        <label htmlFor="report-period">Period</label>
        <select
          id="report-period"
          style={control}
          value={preset}
          onChange={(e) =>
            go(e.target.value === 'custom' ? { range: 'custom', ...custom } : { range: e.target.value, from: null, to: null })
          }
        >
          {Object.entries(RANGE_PRESETS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </span>
      {preset === 'custom' && (
        <form
          style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}
          onSubmit={(e) => {
            e.preventDefault()
            go({ range: 'custom', from: custom.from, to: custom.to })
          }}
        >
          <input type="date" aria-label="From" style={control} value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          to
          <input type="date" aria-label="To" style={control} value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          <button type="submit" style={{ ...control, cursor: 'pointer' }}>
            Apply
          </button>
        </form>
      )}
      <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
        <label htmlFor="report-compare">Compare with</label>
        <select id="report-compare" style={control} value={compare} onChange={(e) => go({ compare: e.target.value })}>
          {Object.entries(COMPARE_MODES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </span>
    </div>
  )
}
