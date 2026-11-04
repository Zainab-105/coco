'use client'

import { Heart, RotateCcw, ShieldCheck, Truck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useStorefront } from '@/components/storefront/StorefrontProvider'
import { WhatsAppIcon } from '@/components/ui/BrandIcons'
import { Button, buttonClasses } from '@/components/ui/Button'
import { FragrancePicker } from '@/components/ui/FragranceChip'
import { Price } from '@/components/ui/Price'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { StockStatus, stockLevel } from '@/components/ui/StockStatus'
import { cn } from '@/lib/cn'
import { formatPKR, whatsappLink } from '@/lib/format'
import { effectivePrice } from '@/lib/pricing'
import { MAX_LINE_QUANTITY } from '@/lib/stores/cart'
import { recentlyViewed, useWishlist, wishlist } from '@/lib/stores/lists'

import type { ProductCardData } from './types'

/** Option picker, price, quantity and add-to-cart. A compact bar sticks to the bottom on mobile once scrolled past. */
export function ProductPurchase({
  product,
  deliveryEstimate,
  whatsappNumber,
}: {
  product: ProductCardData
  deliveryEstimate: string
  whatsappNumber?: string
}) {
  const { addToCart } = useStorefront()
  const saved = useWishlist().includes(Number(product.id))
  const [fragranceId, setFragranceId] = useState(product.fragrances?.find((f) => f.available !== false)?.id)
  const [quantity, setQuantity] = useState(1)
  const [showSticky, setShowSticky] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    recentlyViewed.add(Number(product.id))
  }, [product.id])

  useEffect(() => {
    const el = buttonRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setShowSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const option = product.fragrances?.find((f) => f.id === fragranceId)
  const price = option?.price ?? product.price
  const salePrice = option ? option.salePrice : product.salePrice
  const level = option?.stock != null ? stockLevel(option.stock) : product.stock
  const soldOut = level === 'out_of_stock'
  const max = Math.max(1, Math.min(MAX_LINE_QUANTITY, option?.stock ?? product.stockQuantity ?? MAX_LINE_QUANTITY))
  const needsChoice = product.requiresOption && !fragranceId
  const add = () => addToCart({ product, fragranceId, quantity })

  const waMessage = `Hi COCO, I'd like to order: ${product.title}${option ? ` (${option.name})` : ''} x${quantity}.`

  return (
    <div className="flex flex-col gap-5">
      <Price price={price} salePrice={salePrice} size="lg" />
      <StockStatus level={level} />

      {product.fragrances && product.fragrances.length > 0 && (
        <div>
          <FragrancePicker options={product.fragrances} value={fragranceId} onChange={(id) => (setFragranceId(id), setQuantity(1))} />
          {option?.mood && <p className="mt-2 text-sm italic text-muted">{option.mood}</p>}
        </div>
      )}

      <div ref={buttonRef} className="flex gap-3">
        <QuantityStepper value={quantity} onChange={setQuantity} max={max} />
        <Button block size="lg" disabled={soldOut || needsChoice} onClick={add}>
          {soldOut ? 'Sold out' : needsChoice ? 'Choose a fragrance' : 'Add to cart'}
        </Button>
        <button
          type="button"
          onClick={() => wishlist.toggle(Number(product.id))}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
          className="flex size-14 shrink-0 items-center justify-center border border-blush-200 text-burgundy-700 hover:border-burgundy-500"
        >
          <Heart size={20} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {whatsappNumber && (
        <a
          href={whatsappLink(whatsappNumber, waMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses({ variant: 'whatsapp', block: true })}
        >
          <WhatsAppIcon size={18} /> Order on WhatsApp
        </a>
      )}

      <ul className="grid gap-3 border-y border-blush-200 py-4 text-sm sm:grid-cols-3">
        <li className="flex items-center gap-2">
          <ShieldCheck size={18} className="shrink-0 text-burgundy-700" /> Cash on Delivery
        </li>
        <li className="flex items-center gap-2">
          <Truck size={18} className="shrink-0 text-burgundy-700" /> {deliveryEstimate}
        </li>
        <li className="flex items-center gap-2">
          <RotateCcw size={18} className="shrink-0 text-burgundy-700" /> Easy exchanges
        </li>
      </ul>

      <div
        aria-hidden={!showSticky}
        className={cn(
          'fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 border-t border-blush-200 bg-cream-50/95 px-4 py-3 backdrop-blur transition-transform lg:hidden',
          showSticky ? 'translate-y-0' : 'pointer-events-none translate-y-[200%]',
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{product.title}{option ? ` - ${option.name}` : ''}</p>
          <p className="text-sm font-medium text-burgundy-700">{formatPKR(effectivePrice(price, salePrice))}</p>
        </div>
        <Button size="sm" disabled={soldOut || needsChoice} onClick={add} tabIndex={showSticky ? 0 : -1}>
          {soldOut ? 'Sold out' : 'Add to cart'}
        </Button>
      </div>
    </div>
  )
}
