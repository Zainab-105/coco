/**
 * Report date ranges. All days are Pakistan Standard Time (UTC+5, no daylight saving), so
 * "today" in the admin matches the shop's day, not the server's.
 */
const PKT_OFFSET_MS = 5 * 3_600_000
const DAY_MS = 86_400_000

export const RANGE_PRESETS = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  mtd: 'This month',
  last_month: 'Last month',
  ytd: 'This year',
  custom: 'Custom range',
} as const
export type RangePreset = keyof typeof RANGE_PRESETS

export const COMPARE_MODES = { previous: 'Previous period', year: 'Same period last year', none: 'No comparison' } as const
export type CompareMode = keyof typeof COMPARE_MODES

export type Granularity = 'day' | 'week' | 'month'

/** `to` is exclusive. */
export type DateRange = { from: Date; to: Date }

export type ReportRange = DateRange & {
  preset: RangePreset
  label: string
  compare: CompareMode
  previous?: DateRange
  granularity: Granularity
}

/** "2026-11-02" for the PKT calendar day containing `date`. */
export function pktDay(date: Date): string {
  return new Date(date.getTime() + PKT_OFFSET_MS).toISOString().slice(0, 10)
}

/** Midnight PKT at the start of a "YYYY-MM-DD" day, as a UTC instant. */
export function pktMidnight(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) - PKT_OFFSET_MS)
}

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS)

function addMonths(day: string, months: number): string {
  const [y, m] = day.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + months, 1))
  return d.toISOString().slice(0, 10)
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const validDay = (v: unknown): v is string => typeof v === 'string' && ISO_DAY.test(v) && !Number.isNaN(Date.parse(v))

function presetRange(preset: Exclude<RangePreset, 'custom'>, now: Date): DateRange {
  const today = pktMidnight(pktDay(now))
  const tomorrow = addDays(today, 1)
  const day = pktDay(now)
  switch (preset) {
    case 'today':
      return { from: today, to: tomorrow }
    case 'yesterday':
      return { from: addDays(today, -1), to: today }
    case '7d':
      return { from: addDays(today, -6), to: tomorrow }
    case '30d':
      return { from: addDays(today, -29), to: tomorrow }
    case '90d':
      return { from: addDays(today, -89), to: tomorrow }
    case 'mtd':
      return { from: pktMidnight(`${day.slice(0, 7)}-01`), to: tomorrow }
    case 'last_month': {
      const first = `${day.slice(0, 7)}-01`
      return { from: pktMidnight(addMonths(first, -1)), to: pktMidnight(first) }
    }
    case 'ytd':
      return { from: pktMidnight(`${day.slice(0, 4)}-01-01`), to: tomorrow }
  }
}

export function granularityFor(range: DateRange): Granularity {
  const days = Math.round((range.to.getTime() - range.from.getTime()) / DAY_MS)
  if (days <= 92) return 'day'
  if (days <= 400) return 'week'
  return 'month'
}

export function comparisonRange(range: DateRange, mode: CompareMode): DateRange | undefined {
  if (mode === 'none') return undefined
  if (mode === 'year') {
    const shift = (d: Date) => {
      const x = new Date(d)
      x.setUTCFullYear(x.getUTCFullYear() - 1)
      return x
    }
    return { from: shift(range.from), to: shift(range.to) }
  }
  const length = range.to.getTime() - range.from.getTime()
  return { from: new Date(range.from.getTime() - length), to: range.from }
}

const formatDay = (date: Date) =>
  new Date(date.getTime() + PKT_OFFSET_MS).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export function describeRange(range: DateRange): string {
  const last = new Date(range.to.getTime() - 1)
  const a = formatDay(range.from)
  const b = formatDay(last)
  return a === b ? a : `${a} – ${b}`
}

/**
 * Reads ?range=30d&compare=previous (or ?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD, both
 * inclusive). Unknown or invalid input falls back to the last 30 days.
 */
export function parseReportRange(params: Record<string, string | string[] | undefined>, now = new Date()): ReportRange {
  const get = (key: string) => {
    const v = params[key]
    return Array.isArray(v) ? v[0] : v
  }
  let preset = (get('range') ?? '30d') as RangePreset
  if (!(preset in RANGE_PRESETS)) preset = '30d'
  const compare = ((get('compare') ?? 'previous') in COMPARE_MODES ? (get('compare') ?? 'previous') : 'previous') as CompareMode

  let range: DateRange
  const from = get('from')
  const to = get('to')
  if (preset === 'custom' && validDay(from) && validDay(to)) {
    const [start, end] = from <= to ? [from, to] : [to, from]
    // Cap custom ranges at about three years to keep report queries bounded.
    const fromDate = pktMidnight(start)
    const toDate = addDays(pktMidnight(end), 1)
    range = { from: toDate.getTime() - fromDate.getTime() > 1100 * DAY_MS ? addDays(toDate, -1100) : fromDate, to: toDate }
  } else {
    if (preset === 'custom') preset = '30d'
    range = presetRange(preset, now)
  }

  return {
    ...range,
    preset,
    compare,
    label: preset === 'custom' ? describeRange(range) : RANGE_PRESETS[preset],
    previous: comparisonRange(range, compare),
    granularity: granularityFor(range),
  }
}

/** Start of the bucket (as a PKT day string) that `date` falls in. Weeks start on Monday. */
export function bucketKey(date: Date, granularity: Granularity): string {
  const day = pktDay(date)
  if (granularity === 'day') return day
  if (granularity === 'month') return `${day.slice(0, 7)}-01`
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
  return pktDay(addDays(pktMidnight(day), -weekday))
}

/** Every bucket key in the range, in order, so empty days still show on charts. */
export function bucketKeys(range: DateRange, granularity: Granularity): string[] {
  const keys: string[] = []
  let key = bucketKey(range.from, granularity)
  const lastKey = bucketKey(new Date(range.to.getTime() - 1), granularity)
  while (key <= lastKey && keys.length < 1200) {
    keys.push(key)
    key =
      granularity === 'month'
        ? addMonths(key, 1)
        : pktDay(addDays(pktMidnight(key), granularity === 'week' ? 7 : 1))
  }
  return keys
}

/** Query-string for a range, used by links and exports. */
export function rangeQuery(range: Pick<ReportRange, 'preset' | 'compare' | 'from' | 'to'>): string {
  const q = new URLSearchParams({ range: range.preset, compare: range.compare })
  if (range.preset === 'custom') {
    q.set('from', pktDay(range.from))
    q.set('to', pktDay(new Date(range.to.getTime() - 1)))
  }
  return q.toString()
}
