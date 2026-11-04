/**
 * Small server-rendered SVG charts for the admin reports. No chart library: the data is a few
 * dozen points, and plain SVG keeps the admin bundle unchanged. Hover a point for its value.
 */
import { niceMax, shortDate } from './chartScale'

const BURGUNDY = '#6b1f2a'
const MUTED = 'var(--theme-elevation-400)'
const GRID = 'var(--theme-elevation-100)'

const W = 760
const H = 220
const PAD = { top: 12, right: 12, bottom: 28, left: 64 }

export type ChartPoint = { key: string; value: number }

function frame(max: number, format: (n: number) => string) {
  const innerH = H - PAD.top - PAD.bottom
  return [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = PAD.top + innerH - f * innerH
    return (
      <g key={f}>
        <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke={GRID} />
        <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={11} fill={MUTED}>
          {format(max * f)}
        </text>
      </g>
    )
  })
}

function xLabels(points: ChartPoint[], x: (i: number) => number) {
  const every = Math.max(1, Math.ceil(points.length / 7))
  return points.map((p, i) =>
    i % every === 0 || i === points.length - 1 ? (
      <text key={p.key} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={MUTED}>
        {shortDate(p.key)}
      </text>
    ) : null,
  )
}

/** Vertical bars per period. */
export function BarChart({ label, points, format }: { label: string; points: ChartPoint[]; format: (n: number) => string }) {
  const max = niceMax(Math.max(...points.map((p) => p.value), 0))
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const slot = innerW / Math.max(1, points.length)
  const barW = Math.max(2, slot * 0.7)
  const x = (i: number) => PAD.left + slot * i + slot / 2

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: 'block' }}>
      {frame(max, format)}
      {points.map((p, i) => {
        const h = (p.value / max) * innerH
        return (
          <rect key={p.key} x={x(i) - barW / 2} y={PAD.top + innerH - h} width={barW} height={h} fill={BURGUNDY} opacity={0.85} rx={1}>
            <title>{`${shortDate(p.key)}: ${format(p.value)}`}</title>
          </rect>
        )
      })}
      {xLabels(points, x)}
    </svg>
  )
}

/** Horizontal bars, e.g. orders by status or sales by category. */
export function BarList({ rows, format }: { rows: { label: string; value: number; tone?: string; extra?: string }[]; format: (n: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
      {rows.map((r) => (
        <li key={r.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 160px) 1fr auto', gap: 10, alignItems: 'center', fontSize: 13 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>
            {r.label}
          </span>
          <span style={{ background: GRID, borderRadius: 4, height: 10, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${(r.value / max) * 100}%`, background: r.tone ?? BURGUNDY, borderRadius: 4 }} />
          </span>
          <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }}>
            {format(r.value)}
            {r.extra && <span style={{ color: MUTED, marginLeft: 6 }}>{r.extra}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
