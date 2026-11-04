import Link from 'next/link'
import type { Payload } from 'payload'

import { ORDER_STATUSES } from '@/lib/orderStatus'

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Status tabs with live counts above the Orders list (work queue for the day). */
export async function OrderStatusTabs({ payload, searchParams }: { payload: Payload; searchParams?: Record<string, unknown> }) {
  const counts = await Promise.all(
    ORDER_STATUSES.map(async (status) => [status, (await payload.count({ collection: 'orders', where: { status: { equals: status } } })).totalDocs] as const),
  )
  const where = searchParams?.where as { status?: { equals?: string } } | undefined
  const active = where?.status?.equals

  const tab = (href: string, text: string, isActive: boolean, count?: number, urgent?: boolean) => (
    <Link
      key={text}
      href={href}
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        fontSize: 13,
        textDecoration: 'none',
        border: '1px solid var(--theme-elevation-150)',
        background: isActive ? 'var(--coco-burgundy, #6b1f2a)' : 'var(--theme-elevation-50)',
        color: isActive ? '#fff' : 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
      {count != null && (
        <strong style={{ marginLeft: 6, color: isActive ? '#fff' : urgent && count ? '#a3262f' : 'var(--theme-elevation-500)' }}>{count}</strong>
      )}
    </Link>
  )

  return (
    <nav aria-label="Order status" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 8 }}>
      {tab('/admin/collections/orders', 'All', !active)}
      {counts.map(([status, count]) =>
        tab(`/admin/collections/orders?where[status][equals]=${status}`, label(status), active === status, count, status === 'new'),
      )}
    </nav>
  )
}
