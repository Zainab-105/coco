import type { Granularity } from '@/lib/reports/range'

/** Shared by the server-rendered and interactive charts. */
export function niceMax(value: number) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value) ?? 10
  return step * magnitude
}

export const shortDate = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** Axis label for a bucket: "4 Nov" for days and weeks, "Nov 2026" for months, "2026" for years. */
export function periodLabel(key: string, granularity: Granularity = 'day') {
  if (granularity === 'year') return key.slice(0, 4)
  if (granularity === 'month') return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  return shortDate(key)
}
