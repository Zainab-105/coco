'use client'

import { useStorefront } from '@/components/storefront/StorefrontProvider'
import { cn } from '@/lib/cn'
import { useWishlist, wishlist } from '@/lib/stores/lists'

import { ProductCard } from './ProductCard'
import type { ProductCardData } from './types'

/** Product cards wired to the global cart, quick view and wishlist. */
export function ProductGrid({
  products,
  priorityCount = 2,
  layout = 'grid',
  className,
}: {
  products: ProductCardData[]
  priorityCount?: number
  layout?: 'grid' | 'row'
  className?: string
}) {
  const { openQuickView, quickAdd } = useStorefront()
  const saved = useWishlist()

  return (
    <ul
      className={cn(
        layout === 'grid'
          ? 'grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4'
          : 'scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-4',
        className,
      )}
    >
      {products.map((product, i) => (
        <li key={product.id} className={cn(layout === 'row' && 'w-[46%] shrink-0 snap-start sm:w-auto')}>
          <ProductCard
            product={product}
            priority={i < priorityCount}
            wishlisted={saved.includes(Number(product.id))}
            onToggleWishlist={(p) => wishlist.toggle(Number(p.id))}
            onQuickView={openQuickView}
            onQuickAdd={quickAdd}
          />
        </li>
      ))}
    </ul>
  )
}
