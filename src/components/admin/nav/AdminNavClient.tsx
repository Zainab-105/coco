'use client'

import {
  Activity,
  BarChart3,
  ChevronDown,
  ExternalLink,
  FileImage,
  FolderTree,
  Flower2,
  Gauge,
  Image as ImageIcon,
  Layers,
  Mail,
  Megaphone,
  MessageSquareWarning,
  Package,
  PackageCheck,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Shuffle,
  Star,
  Tag,
  UserCircle,
  Users,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useNav, usePreferences } from '@payloadcms/ui'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { createPersistentStore } from '@/lib/stores/persistent'

export type NavItem = { key: string; label: string; icon: string; href: string; badge?: number; createHref?: string }
export type NavGroup = { title: string; items: NavItem[] }

const ICONS: Record<string, LucideIcon> = {
  orders: ShoppingBag,
  customers: Users,
  carts: ShoppingCart,
  products: Package,
  categories: FolderTree,
  fragrances: Flower2,
  media: ImageIcon,
  stock: PackageCheck,
  bulk: Layers,
  coupons: Tag,
  banners: Megaphone,
  subscribers: Mail,
  redirects: Shuffle,
  reviews: Star,
  tickets: MessageSquareWarning,
  uploads: FileImage,
  accounts: UserCircle,
  expenses: Wallet,
  settings: Settings,
  team: UsersRound,
  activity: Activity,
  security: ShieldCheck,
  other: ReceiptText,
}

/** Collapsed sections are remembered per browser. */
const collapsed = createPersistentStore<string[]>('coco.admin.nav.collapsed', [])

function Row({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = ICONS[item.icon] ?? ICONS.other
  return (
    <li className={`coco-nav__row${active ? ' is-active' : ''}`}>
      <Link href={item.href} prefetch={false} className="coco-nav__link" aria-current={active ? 'page' : undefined}>
        <Icon size={17} strokeWidth={1.75} aria-hidden />
        <span className="coco-nav__label">{item.label}</span>
        {item.badge ? (
          <span className="coco-nav__badge" aria-label={`${item.badge} waiting`}>
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        ) : null}
      </Link>
      {item.createHref && (
        <Link href={item.createHref} prefetch={false} className="coco-nav__add" aria-label={`Add to ${item.label}`} title={`Add to ${item.label}`}>
          <Plus size={14} aria-hidden />
        </Link>
      )}
    </li>
  )
}

export function AdminNavClient({
  groups,
  user,
  logout,
}: {
  groups: NavGroup[]
  user: { name: string; email: string; role: string }
  logout: ReactNode
}) {
  const pathname = usePathname()
  const closed = collapsed.useStore()
  const [query, setQuery] = useState('')
  const search = useRef<HTMLInputElement>(null)
  const { setNavOpen } = useNav()
  const { getPreference } = usePreferences()

  // Payload starts the sidebar closed at 1440px and below, which is most laptops. There is room
  // for it down to tablet width, so open it unless this person chose to close it.
  useEffect(() => {
    const width = window.innerWidth
    if (width <= 1024 || width > 1440) return
    getPreference<{ open?: boolean }>('nav')
      .then((preference) => {
        if (preference?.open !== false) setNavOpen(true)
      })
      .catch(() => undefined)
  }, [getPreference, setNavOpen])

  // Ctrl+K (or Cmd+K) jumps to the menu search from anywhere in the admin.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const needle = query.trim().toLowerCase()
  const allItems = groups.flatMap((g) => g.items)
  const matches = needle ? allItems.filter((i) => i.label.toLowerCase().includes(needle)) : []

  const toggle = (title: string) => collapsed.set((list) => (list.includes(title) ? list.filter((t) => t !== title) : [...list, title]))

  const initials = user.name
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <>
      <Link href="/admin" prefetch={false} className="coco-nav__brand" aria-label="COCO admin home">
        {/* eslint-disable-next-line @next/next/no-img-element -- admin graphics render outside next/image's config */}
        <img src="/brand/coco-wordmark.png" alt="" />
        <span>Admin</span>
      </Link>

      <div className="coco-nav__search">
        <Search size={15} aria-hidden />
        <input
          ref={search}
          type="search"
          aria-label="Find a page in the menu"
          placeholder="Find a page"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('')
          }}
        />
        {query ? (
          <button type="button" aria-label="Clear" onClick={() => setQuery('')}>
            <X size={14} aria-hidden />
          </button>
        ) : (
          <kbd aria-hidden>Ctrl K</kbd>
        )}
      </div>

      <div className="coco-nav__scroll">
        {needle ? (
          matches.length ? (
            <ul className="coco-nav__list">
              {matches.map((item) => (
                <Row key={item.key} item={item} active={isActive(item.href)} />
              ))}
            </ul>
          ) : (
            <p className="coco-nav__empty">Nothing matches &ldquo;{query}&rdquo;</p>
          )
        ) : (
          <>
            <ul className="coco-nav__list">
              <li className={`coco-nav__row${pathname === '/admin' ? ' is-active' : ''}`}>
                <Link href="/admin" prefetch={false} className="coco-nav__link" aria-current={pathname === '/admin' ? 'page' : undefined}>
                  <Gauge size={17} strokeWidth={1.75} aria-hidden />
                  <span className="coco-nav__label">Dashboard</span>
                </Link>
              </li>
              <li className={`coco-nav__row${isActive('/admin/reports') ? ' is-active' : ''}`}>
                <Link href="/admin/reports" prefetch={false} className="coco-nav__link" aria-current={isActive('/admin/reports') ? 'page' : undefined}>
                  <BarChart3 size={17} strokeWidth={1.75} aria-hidden />
                  <span className="coco-nav__label">Reports</span>
                </Link>
              </li>
            </ul>

            {groups.map((group) => {
              const open = !closed.includes(group.title)
              const waiting = group.items.reduce((sum, i) => sum + (i.badge ?? 0), 0)
              return (
                <section key={group.title} className="coco-nav__group">
                  <button type="button" className="coco-nav__group-title" aria-expanded={open} onClick={() => toggle(group.title)}>
                    <span>{group.title}</span>
                    {!open && waiting > 0 && <span className="coco-nav__dot" aria-label={`${waiting} waiting`} />}
                    <ChevronDown size={14} className={open ? '' : 'is-closed'} aria-hidden />
                  </button>
                  {open && (
                    <ul className="coco-nav__list">
                      {group.items.map((item) => (
                        <Row key={item.key} item={item} active={isActive(item.href)} />
                      ))}
                    </ul>
                  )}
                </section>
              )
            })}
          </>
        )}
      </div>

      <div className="coco-nav__footer">
        <a href="/" target="_blank" rel="noopener noreferrer" className="coco-nav__store">
          <ExternalLink size={14} aria-hidden /> View store
        </a>
        <div className="coco-nav__user">
          <Link href="/admin/account" prefetch={false} className="coco-nav__account" title="Your account">
            <span className="coco-nav__initials" aria-hidden>
              {initials}
            </span>
            <span className="coco-nav__who">
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </span>
          </Link>
          {logout}
        </div>
      </div>
    </>
  )
}
