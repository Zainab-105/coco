'use client'

import { Heart, Menu, Search, ShoppingBag, User } from 'lucide-react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState } from 'react'

import { WhatsAppIcon } from '@/components/ui/BrandIcons'
import { Sheet } from '@/components/ui/Sheet'
import { whatsappLink } from '@/lib/format'
import type { NavCategory } from '@/lib/storefront/data'
import { cartCount as countItems, useCart } from '@/lib/stores/cart'

import { useStorefront } from './StorefrontProvider'

const SearchSheet = dynamic(() => import('./SearchSheet').then((m) => m.SearchSheet), { ssr: false })

const iconBtn = 'flex size-11 items-center justify-center text-ink transition-colors hover:text-burgundy-700'

export function HeaderBar({ nav, whatsappNumber }: { nav: NavCategory[]; whatsappNumber?: string }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { openCart } = useStorefront()
  const cartCount = countItems(useCart())

  return (
    <header className="sticky top-0 z-40 border-b border-blush-200 bg-cream-50/95 backdrop-blur supports-[backdrop-filter]:bg-cream-50/85">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-2 sm:px-6 lg:h-20">
        <div className="flex items-center">
          <button type="button" className={`${iconBtn} lg:hidden`} aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Menu size={22} strokeWidth={1.5} />
          </button>
          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex gap-7 text-[12px] uppercase tracking-[0.2em]">
              {nav.map((item) => (
                <li key={item.slug} className="group relative">
                  <Link href={`/collections/${item.slug}`} className="py-7 hover:text-burgundy-700">
                    {item.title}
                  </Link>
                  {item.children.length > 0 && (
                    <ul className="invisible absolute top-full left-0 min-w-56 border border-blush-200 bg-cream-50 py-2 opacity-0 shadow-card transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                      {item.children.map((child) => (
                        <li key={child.slug}>
                          <Link href={`/collections/${child.slug}`} className="block px-5 py-2.5 tracking-[0.12em] normal-case hover:bg-nude-100">
                            {child.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <Link href="/" aria-label="COCO home" className="flex flex-col items-center">
          <Image src="/brand/coco-wordmark.png" alt="" width={217} height={47} priority className="h-6 w-auto lg:h-7" />
        </Link>

        <div className="flex items-center justify-end">
          <button type="button" className={iconBtn} aria-label="Search" onClick={() => setSearchOpen(true)}>
            <Search size={20} strokeWidth={1.5} />
          </button>
          <Link href="/account" className={`${iconBtn} hidden sm:flex`} aria-label="Account">
            <User size={20} strokeWidth={1.5} />
          </Link>
          <Link href="/wishlist" className={`${iconBtn} hidden sm:flex`} aria-label="Wishlist">
            <Heart size={20} strokeWidth={1.5} />
          </Link>
          <button type="button" className={`${iconBtn} relative`} aria-label={`Cart, ${cartCount} items`} onClick={openCart}>
            <ShoppingBag size={20} strokeWidth={1.5} />
            {cartCount > 0 && (
              <span className="absolute top-1.5 right-1 flex min-w-4 items-center justify-center rounded-full bg-burgundy-700 px-1 text-[10px] leading-4 text-cream-50">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {searchOpen && <SearchSheet open onOpenChange={setSearchOpen} />}

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} side="left" title="Menu">
        <nav aria-label="Mobile" className="px-5 py-4">
          <ul className="divide-y divide-blush-200">
            {nav.map((item) => (
              <li key={item.slug} className="py-3">
                <Link
                  href={`/collections/${item.slug}`}
                  onClick={() => setMenuOpen(false)}
                  className="block py-1 font-display text-2xl text-burgundy-700"
                >
                  {item.title}
                </Link>
                {item.children.length > 0 && (
                  <ul className="mt-1 space-y-1 pl-1">
                    {item.children.map((child) => (
                      <li key={child.slug}>
                        <Link
                          href={`/collections/${child.slug}`}
                          onClick={() => setMenuOpen(false)}
                          className="block py-2 text-sm text-muted"
                        >
                          {child.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <ul className="mt-6 space-y-1 text-sm uppercase tracking-[0.16em]">
            {[
              ['/account', 'My account'],
              ['/track-order', 'Track order'],
              ['/contact', 'Contact us'],
              ['/faq', 'FAQs'],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} onClick={() => setMenuOpen(false)} className="block py-2.5">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          {whatsappNumber && (
            <a
              href={whatsappLink(whatsappNumber, 'Hi COCO, I need help with an order.')}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center gap-3 border border-blush-200 p-4 text-sm"
            >
              <WhatsAppIcon size={22} className="text-[#1f8f4e]" />
              Need help ordering? Chat with us
            </a>
          )}
        </nav>
      </Sheet>
    </header>
  )
}
