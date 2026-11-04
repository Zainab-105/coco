import { NavHamburger, NavWrapper } from '@payloadcms/next/client'
import { Logout } from '@payloadcms/ui'
import type { CollectionSlug, GlobalSlug, Payload, SanitizedPermissions, VisibleEntities } from 'payload'

import type { User } from '@/payload-types'
import { hasRole } from '@/access/roles'

import { AdminNavClient, type NavGroup, type NavItem } from './AdminNavClient'

type CollectionEntry = { collection: CollectionSlug; label: string; icon: string }
type GlobalEntry = { global: GlobalSlug; label: string; icon: string }
type LinkEntry = { href: string; label: string; icon: string; managerOnly?: boolean }
type Entry = CollectionEntry | GlobalEntry | LinkEntry

/** The menu is arranged by daily task rather than by data model. */
const MENU: { title: string; entries: Entry[] }[] = [
  {
    title: 'Sales',
    entries: [
      { collection: 'orders', label: 'Orders', icon: 'orders' },
      { collection: 'customers', label: 'Customers', icon: 'customers' },
      { collection: 'carts', label: 'Abandoned carts', icon: 'carts' },
    ],
  },
  {
    title: 'Catalog',
    entries: [
      { collection: 'products', label: 'Products', icon: 'products' },
      { collection: 'categories', label: 'Categories', icon: 'categories' },
      { collection: 'fragrances', label: 'Fragrances', icon: 'fragrances' },
      { collection: 'media', label: 'Media library', icon: 'media' },
      { collection: 'inventory-adjustments', label: 'Stock adjustments', icon: 'stock' },
      { href: '/admin/import-products', label: 'Bulk price & stock', icon: 'bulk', managerOnly: true },
    ],
  },
  {
    title: 'Marketing',
    entries: [
      { collection: 'coupons', label: 'Coupons', icon: 'coupons' },
      { collection: 'banners', label: 'Banners', icon: 'banners' },
      { collection: 'subscribers', label: 'Subscribers', icon: 'subscribers' },
      { collection: 'redirects', label: 'Redirects', icon: 'redirects' },
    ],
  },
  {
    title: 'Customer care',
    entries: [
      { collection: 'reviews', label: 'Reviews', icon: 'reviews' },
      { collection: 'support-tickets', label: 'Support tickets', icon: 'tickets' },
      { collection: 'customer-uploads', label: 'Customer files', icon: 'uploads' },
      { collection: 'customer-accounts', label: 'Customer accounts', icon: 'accounts' },
    ],
  },
  { title: 'Finance', entries: [{ collection: 'expenses', label: 'Expenses', icon: 'expenses' }] },
  {
    title: 'Settings',
    entries: [
      { global: 'store-settings', label: 'Store settings', icon: 'settings' },
      { collection: 'users', label: 'Team', icon: 'team' },
      { collection: 'activity-logs', label: 'Activity log', icon: 'activity' },
      { href: '/admin/security', label: 'Security (2FA)', icon: 'security' },
    ],
  },
]

const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

/** Work waiting in each area. Shown as badges on every admin page, so these stay simple indexed counts. */
async function workCounts(payload: Payload, visible: VisibleEntities) {
  const count = async (collection: CollectionSlug, where: Parameters<Payload['count']>[0]['where']) =>
    visible.collections.includes(collection) ? (await payload.count({ collection, where })).totalDocs : 0
  const [orders, reviews, tickets, products, carts] = await Promise.all([
    count('orders', { status: { equals: 'new' } }),
    count('reviews', { status: { equals: 'pending' } }),
    count('support-tickets', { status: { in: ['open', 'in_progress'] } }),
    count('products', { and: [{ status: { equals: 'published' } }, { stockStatus: { in: ['low_stock', 'out_of_stock'] } }] }),
    count('carts', { and: [{ status: { equals: 'open' } }, { lastActivityAt: { less_than: ago(3_600_000) } }, { lastActivityAt: { greater_than: ago(7 * 86_400_000) } }] }),
  ])
  return { orders, reviews, 'support-tickets': tickets, products, carts } as Partial<Record<CollectionSlug, number>>
}

/** Replaces Payload's default sidebar. Same permissions: only what this user may open is listed. */
export async function AdminNav({
  payload,
  user,
  permissions,
  visibleEntities,
}: {
  payload: Payload
  user?: User | null
  permissions?: SanitizedPermissions
  visibleEntities?: VisibleEntities
}) {
  const visible: VisibleEntities = visibleEntities ?? { collections: [], globals: [] }
  const counts = await workCounts(payload, visible)
  const canManage = hasRole(user, ['owner', 'manager'])

  const toItem = (entry: Entry): NavItem | null => {
    if ('href' in entry) return entry.managerOnly && !canManage ? null : { key: entry.href, label: entry.label, icon: entry.icon, href: entry.href }
    if ('global' in entry) {
      if (!visible.globals.includes(entry.global)) return null
      return { key: entry.global, label: entry.label, icon: entry.icon, href: `/admin/globals/${entry.global}` }
    }
    if (!visible.collections.includes(entry.collection)) return null
    const href = `/admin/collections/${entry.collection}`
    return {
      key: entry.collection,
      label: entry.label,
      icon: entry.icon,
      href,
      badge: counts[entry.collection] || undefined,
      createHref: permissions?.collections?.[entry.collection]?.create ? `${href}/create` : undefined,
    }
  }

  const groups: NavGroup[] = MENU.map((group) => ({ title: group.title, items: group.entries.map(toItem).filter((i): i is NavItem => i !== null) })).filter((g) => g.items.length)

  // A collection added later still appears, even before someone places it in the menu above.
  const listed = new Set(MENU.flatMap((g) => g.entries.flatMap((e) => ('collection' in e ? [e.collection as string] : []))))
  const extras = visible.collections.filter((slug) => !listed.has(slug))
  if (extras.length) {
    groups.push({
      title: 'Other',
      items: extras.map((slug) => ({ key: slug, label: slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), icon: 'other', href: `/admin/collections/${slug}` })),
    })
  }

  return (
    <NavWrapper baseClass="nav">
      <nav className="nav__wrap coco-nav" aria-label="Admin menu">
        <AdminNavClient
          groups={groups}
          user={{ name: user?.name || user?.email?.split('@')[0] || 'Account', email: user?.email ?? '', role: user?.roles?.[0] ?? '' }}
          logout={<Logout />}
        />
      </nav>
      <div className="nav__header">
        <div className="nav__header-content">
          <NavHamburger baseClass="nav" />
        </div>
      </div>
    </NavWrapper>
  )
}
