'use client'

import { useState } from 'react'

import { Button, ButtonLink } from '@/components/ui/Button'
import { FragrancePicker } from '@/components/ui/FragranceChip'
import { Price } from '@/components/ui/Price'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { Rating } from '@/components/ui/Rating'
import { Sheet } from '@/components/ui/Sheet'
import { StockStatus, stockLevel } from '@/components/ui/StockStatus'
import { MAX_LINE_QUANTITY } from '@/lib/stores/cart'

import { MediaCarousel } from './MediaCarousel'
import type { ProductCardData } from './types'

export type AddToCartPayload = { product: ProductCardData; fragranceId?: string; quantity: number }

/** Product summary without leaving the listing page. Bottom sheet on mobile, modal on desktop. */
export function QuickView({
  product,
  onOpenChange,
  onAddToCart,
}: {
  product: ProductCardData | null
  onOpenChange: (open: boolean) => void
  onAddToCart: (payload: AddToCartPayload) => void
}) {
  return (
    <Sheet open={Boolean(product)} onOpenChange={onOpenChange} side="center" title={product?.title ?? 'Quick view'} hideTitle>
      {product && <QuickViewBody key={product.id} product={product} onAddToCart={onAddToCart} />}
    </Sheet>
  )
}

function QuickViewBody({ product, onAddToCart }: { product: ProductCardData; onAddToCart: (p: AddToCartPayload) => void }) {
  const [fragranceId, setFragranceId] = useState<string | undefined>(
    product.fragrances?.find((f) => f.available !== false)?.id,
  )
  const [quantity, setQuantity] = useState(1)
  const option = product.fragrances?.find((f) => f.id === fragranceId)
  const level = option?.stock != null ? stockLevel(option.stock) : product.stock
  const soldOut = level === 'out_of_stock'
  const max = Math.min(MAX_LINE_QUANTITY, option?.stock ?? product.stockQuantity ?? MAX_LINE_QUANTITY)

  return (
    <div className="grid sm:grid-cols-2">
      <MediaCarousel media={product.media} sizes="(min-width: 640px) 480px, 100vw" aspect="aspect-square sm:aspect-[4/5]" />
      <div className="flex flex-col gap-4 p-5 sm:p-8">
        {product.subtitle && <p className="text-[11px] uppercase tracking-[0.3em] text-rose-600">{product.subtitle}</p>}
        <h2 className="text-3xl text-burgundy-700">{product.title}</h2>
        {product.rating && <Rating value={product.rating.average} count={product.rating.count} />}
        <Price
          price={option?.price ?? product.price}
          salePrice={option ? option.salePrice : product.salePrice}
          size="lg"
        />
        <StockStatus level={level} />
        {product.fragrances && product.fragrances.length > 0 && (
          <FragrancePicker
            options={product.fragrances}
            value={fragranceId}
            onChange={(id) => {
              setFragranceId(id)
              setQuantity(1)
            }}
          />
        )}
        <div className="flex gap-3">
          <QuantityStepper value={quantity} onChange={setQuantity} max={Math.max(1, max)} />
          <Button
            block
            disabled={soldOut || (product.requiresOption && !fragranceId)}
            onClick={() => onAddToCart({ product, fragranceId, quantity })}
          >
            {soldOut ? 'Sold out' : 'Add to cart'}
          </Button>
        </div>
        <ButtonLink href={`/products/${product.slug}`} variant="ghost" size="sm" className="self-start px-0 underline underline-offset-4">
          View full details
        </ButtonLink>
      </div>
    </div>
  )
}
