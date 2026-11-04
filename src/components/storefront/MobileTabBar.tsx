'use client'

import { Heart, House, LayoutGrid, Search, User } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/cn'

const tabs = [
  { href: '/', label: 'Home', icon: House, match: (p: string) => p === '/' },
  { href: '/collections', label: 'Shop', icon: LayoutGrid, match: (p: string) => p.startsWith('/collections') || p.startsWith('/products') },
  { href: '/search', label: 'Search', icon: Search, match: (p: string) => p.startsWith('/search') },
  { href: '/wishlist', label: 'Wishlist', icon: Heart, match: (p: string) => p.startsWith('/wishlist') },
  { href: '/account', label: 'Account', icon: User, match: (p: string) => p.startsWith('/account') },
]

/** Thumb-reach navigation for phones (client requirement: sticky, easy mobile navigation). */
export function MobileTabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-blush-200 bg-cream-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {tabs.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-[0.14em]',
                  active ? 'text-burgundy-700' : 'text-muted',
                )}
              >
                <Icon size={20} strokeWidth={active ? 2 : 1.5} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
