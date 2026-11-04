'use client'

import { Eye, Heart, Plus } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/Badge'
import { FragranceSwatch } from '@/components/ui/FragranceChip'
import { Price } from '@/components/ui/Price'
import { StockStatus } from '@/components/ui/StockStatus'
import { cn } from '@/lib/cn'
import { discountPercent } from '@/lib/pricing'

import { MediaCarousel } from './MediaCarousel'
import type { ProductCardData } from './types'

export function ProductCard({
  product,
  priority,
  wishlisted,
  onToggleWishlist,
  onQuickView,
  onQuickAdd,
}: {
  product: ProductCardData
  priority?: boolean
  wishlisted?: boolean
  onToggleWishlist?: (product: ProductCardData) => void
  onQuickView?: (product: ProductCardData) => void
  onQuickAdd?: (product: ProductCardData) => void
}) {
  const href = `/products/${product.slug}`
  const percent = discountPercent(product.price, product.salePrice)
  const soldOut = product.stock === 'out_of_stock'
  const addLabel = soldOut ? 'Sold out' : product.requiresOption ? 'Choose fragrance' : 'Add to cart'

  return (
    <article className="group/card relative flex flex-col">
      <div className="relative">
        <MediaCarousel
          media={product.media}
          href={href}
          priority={priority}
          sizes="(min-width: 1280px) 300px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        />

        <div className="pointer-events-none absolute top-2 left-2 flex flex-col items-start gap-1">
          {soldOut ? (
            <Badge tone="soldout">Sold out</Badge>
          ) : (
            percent > 0 && <Badge tone="sale">-{percent}%</Badge>
          )}
          {product.isNew && <Badge tone="new">New</Badge>}
        </div>

        <button
          type="button"
          onClick={() => onToggleWishlist?.(product)}
          aria-label={wishlisted ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`}
          aria-pressed={wishlisted}
          className="absolute top-1 right-1 flex size-11 items-center justify-center text-burgundy-700"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-cream-50/90 shadow-card">
            <Heart size={16} fill={wishlisted ? 'currentColor' : 'none'} />
          </span>
        </button>

        {/* Desktop: actions slide up on hover. Mobile: compact quick-view and quick-add buttons. */}
        <div className="absolute inset-x-2 bottom-6 hidden translate-y-2 gap-2 opacity-0 transition-all group-hover/card:translate-y-0 group-hover/card:opacity-100 focus-within:translate-y-0 focus-within:opacity-100 md:flex">
          <button
            type="button"
            onClick={() => onQuickAdd?.(product)}
            disabled={soldOut}
            className="min-h-10 flex-1 bg-burgundy-700 text-[11px] uppercase tracking-[0.16em] text-cream-50 hover:bg-burgundy-900 disabled:bg-muted"
          >
            {addLabel}
          </button>
          <button
            type="button"
            onClick={() => onQuickView?.(product)}
            aria-label={`Quick view ${product.title}`}
            className="flex size-10 items-center justify-center bg-cream-50 text-ink hover:text-burgundy-700"
          >
            <Eye size={18} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => onQuickView?.(product)}
          aria-label={`Quick view ${product.title}`}
          className="absolute bottom-5 left-1 flex size-11 items-center justify-center md:hidden"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-cream-50/90 text-ink shadow-card">
            <Eye size={16} />
          </span>
        </button>
        {!soldOut && (
          <button
            type="button"
            onClick={() => onQuickAdd?.(product)}
            aria-label={`${addLabel}: ${product.title}`}
            className="absolute right-1 bottom-5 flex size-11 items-center justify-center md:hidden"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-burgundy-700 text-cream-50 shadow-card">
              <Plus size={16} />
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 pt-3">
        {product.subtitle && (
          <p className="text-[10px] uppercase tracking-[0.2em] text-rose-600">{product.subtitle}</p>
        )}
        <h3 className="font-display text-lg leading-tight text-ink">
          <Link href={href} className="hover:text-burgundy-700">
            {product.title}
          </Link>
        </h3>
        {product.fragrances && product.fragrances.length > 1 && (
          <div role="img" className="flex items-center gap-1" aria-label={`${product.fragrances.length} fragrances`}>
            {product.fragrances.slice(0, 6).map((f) => (
              <FragranceSwatch key={f.id} color={f.swatch} className={cn('size-3', f.available === false && 'opacity-30')} />
            ))}
          </div>
        )}
        <Price price={product.price} salePrice={product.salePrice} size="sm" showDiscount={false} />
        <StockStatus level={product.stock} />
      </div>
    </article>
  )
}
