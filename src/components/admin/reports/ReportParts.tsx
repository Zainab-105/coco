import type { ReactNode } from 'react'

import type { Column, ColumnKind } from '@/lib/reports/build'
import { change } from '@/lib/reports/compute'

/** Shared building blocks for the admin dashboard and reports (inline styles follow the Payload theme). */
export const card = {
  background: 'var(--coco-surface)',
  border: '1px solid var(--coco-line)',
  borderRadius: 12,
  padding: 16,
} as const

export const muted = { color: 'var(--theme-elevation-500)', fontSize: 12 } as const

export const money = (n: number) => `${n < 0 ? '-' : ''}Rs ${Math.abs(Math.round(n)).toLocaleString('en-PK')}`
export const count = (n: number) => Math.round(n).toLocaleString('en-PK')
export const percent = (n: number) => `${(n * 100).toFixed(n !== 0 && Math.abs(n) < 0.1 ? 1 : 0)}%`
export const compactMoney = (n: number) =>
  n >= 1_000_000 ? `Rs ${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `Rs ${Math.round(n / 1000)}k` : money(n)

export function formatValue(kind: ColumnKind, value: unknown): string {
  if (value == null || value === '') return '–'
  if (typeof value !== 'number') return String(value).replace(/_/g, ' ')
  if (kind === 'money') return money(value)
  if (kind === 'percent') return percent(value)
  return count(value)
}

/** "▲ 12% vs previous". Green when the change is good (`lowerIsBetter` flips it for costs). */
export function Delta({ current, previous, lowerIsBetter }: { current: number; previous?: number; lowerIsBetter?: boolean }) {
  const delta = change(current, previous)
  if (delta == null) return <span style={muted}>{previous === 0 && current > 0 ? 'new vs previous' : '–'}</span>
  const good = lowerIsBetter ? delta < 0 : delta > 0
  const colour = delta === 0 ? 'var(--theme-elevation-500)' : good ? 'var(--coco-good)' : 'var(--coco-danger)'
  return (
    <span style={{ color: colour, fontSize: 12, whiteSpace: 'nowrap' }}>
      {delta > 0 ? '▲' : delta < 0 ? '▼' : '■'} {Math.abs(delta * 100).toFixed(Math.abs(delta) < 0.1 ? 1 : 0)}%
      <span style={{ color: 'var(--theme-elevation-500)' }}> vs previous</span>
    </span>
  )
}

export function Kpi({
  label,
  value,
  current,
  previous,
  lowerIsBetter,
  hint,
}: {
  label: string
  value: string
  current?: number
  previous?: number
  lowerIsBetter?: boolean
  hint?: string
}) {
  return (
    <div style={card} title={hint}>
      <div style={muted}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, margin: '4px 0', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {current != null && previous !== undefined ? <Delta current={current} previous={previous} lowerIsBetter={lowerIsBetter} /> : null}
    </div>
  )
}

export function KpiGrid({ children, min = 170 }: { children: ReactNode; min?: number }) {
  return <div style={{ display: 'grid', gap: 12, gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}>{children}</div>
}

export function Panel({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ ...card, display: 'grid', gap: 12, minWidth: 0 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3>
          {description && <p style={{ ...muted, margin: '4px 0 0' }}>{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

/** A report table with an optional CSV download link. */
export function ReportTable<T>({
  table,
  exportHref,
  limit,
}: {
  table: { title: string; description?: string; columns: Column<T>[]; rows: T[] }
  exportHref?: string
  limit?: number
}) {
  const rows = limit ? table.rows.slice(0, limit) : table.rows
  return (
    <Panel
      title={table.title}
      description={table.description}
      action={
        exportHref && table.rows.length ? (
          <a href={exportHref} style={{ fontSize: 12 }}>
            Download CSV
          </a>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <p style={{ ...muted, margin: 0 }}>No data for this period.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th
                    key={c.header}
                    style={{ textAlign: c.kind === 'text' ? 'left' : 'right', padding: '6px 8px', borderBottom: '1px solid var(--theme-elevation-150)', ...muted, fontWeight: 500 }}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {table.columns.map((c) => (
                    <td
                      key={c.header}
                      style={{
                        textAlign: c.kind === 'text' ? 'left' : 'right',
                        padding: '6px 8px',
                        borderBottom: '1px solid var(--theme-elevation-100)',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: c.kind === 'text' ? 'normal' : 'nowrap',
                      }}
                    >
                      {formatValue(c.kind, c.value(row))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {limit && table.rows.length > limit && <p style={{ ...muted, margin: '8px 0 0' }}>Top {limit} of {table.rows.length}. Download the CSV for all rows.</p>}
        </div>
      )}
    </Panel>
  )
}
