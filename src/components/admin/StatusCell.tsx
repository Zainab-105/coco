'use client'

import type { DefaultCellComponentProps } from 'payload'

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'grey' | 'burgundy'

const tones: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: '#e3f1e6', fg: '#2f6b3a' },
  amber: { bg: '#fbf0d9', fg: '#8a5a00' },
  red: { bg: '#f8e1e2', fg: '#a3262f' },
  blue: { bg: '#e3ecf8', fg: '#2b5a92' },
  grey: { bg: '#ececec', fg: '#555555' },
  burgundy: { bg: '#f3e3d8', fg: '#6b1f2a' },
}

/** Colour for every status value used across orders, payments, stock, reviews and tickets. */
const toneFor: Record<string, Tone> = {
  // orders
  new: 'burgundy',
  confirmed: 'blue',
  processing: 'blue',
  shipped: 'blue',
  delivered: 'green',
  cancelled: 'grey',
  returned: 'amber',
  refunded: 'amber',
  // payments
  pending: 'amber',
  awaiting_verification: 'amber',
  paid: 'green',
  failed: 'red',
  // stock
  in_stock: 'green',
  low_stock: 'amber',
  out_of_stock: 'red',
  // products
  published: 'green',
  draft: 'grey',
  archived: 'grey',
  // reviews
  approved: 'green',
  hidden: 'grey',
  spam: 'red',
  // customer segments ("new" shares the order colour)
  repeat: 'blue',
  high_value: 'green',
  inactive: 'grey',
  // tickets
  open: 'burgundy',
  in_progress: 'blue',
  resolved: 'green',
  closed: 'grey',
  // abandoned carts ("open"/"closed" shared with tickets)
  contacted: 'blue',
  recovered: 'green',
  // subscribers
  subscribed: 'green',
  unsubscribed: 'grey',
  // banners
  live: 'green',
  scheduled: 'blue',
  ended: 'grey',
  off: 'grey',
}

const label = (value: string) => value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

export function StatusPill({ value, text }: { value: string; text?: string }) {
  const { bg, fg } = tones[toneFor[value] ?? 'grey']

  return (
    <span
      style={{
        background: bg,
        color: fg,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        padding: '2px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      {text ?? label(value)}
    </span>
  )
}

export function StatusCell({ cellData }: DefaultCellComponentProps) {
  if (typeof cellData !== 'string' || !cellData) return <span>-</span>
  return <StatusPill value={cellData} />
}

export function MoneyCell({ cellData }: DefaultCellComponentProps) {
  if (typeof cellData !== 'number') return <span>-</span>
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>Rs {cellData.toLocaleString('en-PK')}</span>
}
