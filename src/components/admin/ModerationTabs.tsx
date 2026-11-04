import Link from 'next/link'
import type { CollectionSlug, Payload } from 'payload'

const label = (s: string) => (s.charAt(0).toUpperCase() + s.slice(1)).replace(/_/g, ' ')

type Props = { payload: Payload; searchParams?: Record<string, unknown> }

/** Status tabs with live counts: the moderation queue for reviews and the to-do list for tickets. */
async function StatusTabs({ payload, searchParams, collection, statuses, urgent }: Props & { collection: CollectionSlug; statuses: string[]; urgent: string }) {
  const counts = await Promise.all(
    statuses.map(async (status) => [status, (await payload.count({ collection, where: { status: { equals: status } } })).totalDocs] as const),
  )
  const active = (searchParams?.where as { status?: { equals?: string } } | undefined)?.status?.equals
  const base = `/admin/collections/${collection}`

  const tab = (href: string, text: string, isActive: boolean, count?: number, highlight?: boolean) => (
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
      {count != null && <strong style={{ marginLeft: 6, color: isActive ? '#fff' : highlight && count ? '#a3262f' : 'var(--theme-elevation-500)' }}>{count}</strong>}
    </Link>
  )

  return (
    <nav aria-label="Filter by status" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 8 }}>
      {tab(base, 'All', !active)}
      {counts.map(([status, count]) => tab(`${base}?where[status][equals]=${status}`, label(status), active === status, count, status === urgent))}
    </nav>
  )
}

export const ReviewTabs = (props: Props) => <StatusTabs {...props} collection="reviews" statuses={['pending', 'approved', 'hidden', 'spam']} urgent="pending" />

export const TicketTabs = (props: Props) => <StatusTabs {...props} collection="support-tickets" statuses={['open', 'in_progress', 'resolved', 'closed']} urgent="open" />
