'use client'

import { useState } from 'react'

import { CartDrawer, type CartLineView } from '@/components/cart/CartDrawer'
import { ProductCard } from '@/components/product/ProductCard'
import { QuickView, type AddToCartPayload } from '@/components/product/QuickView'
import type { ProductCardData } from '@/components/product/types'
import { Button } from '@/components/ui/Button'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { FragrancePicker } from '@/components/ui/FragranceChip'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { effectivePrice } from '@/lib/pricing'

import { mockFragrances, mockProducts } from './mockProducts'

const shipping = { flatRate: 250, freeShippingThreshold: 3000 }

/** Live, clickable prototype of the listing -> quick view -> cart flow for client review. */
export function ProductGridDemo() {
  const [wishlist, setWishlist] = useState<Set<string>>(new Set(['p3']))
  const [quickView, setQuickView] = useState<ProductCardData | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [lines, setLines] = useState<CartLineView[]>([])

  const addToCart = ({ product, fragranceId, quantity }: AddToCartPayload) => {
    const fragrance = product.fragrances?.find((f) => f.id === fragranceId)
    const key = `${product.id}:${fragranceId ?? ''}`
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key)
      if (existing) return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + quantity } : l))
      return [
        ...prev,
        {
          key,
          slug: product.slug,
          title: product.title,
          variantLabel: fragrance ? `Fragrance: ${fragrance.name}` : undefined,
          image: product.media[0].src,
          unitPrice: effectivePrice(product.price, product.salePrice),
          quantity,
          maxQuantity: 10,
        },
      ]
    })
    setQuickView(null)
    setCartOpen(true)
  }

  const quickAdd = (product: ProductCardData) => {
    if (product.requiresOption) setQuickView(product)
    else addToCart({ product, quantity: 1 })
  }

  const toggleWishlist = (product: ProductCardData) =>
    setWishlist((prev) => {
      const next = new Set(prev)
      if (next.has(product.id)) next.delete(product.id)
      else next.add(product.id)
      return next
    })

  return (
    <>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
        {mockProducts.map((product, i) => (
          <li key={product.id}>
            <ProductCard
              product={product}
              priority={i < 2}
              wishlisted={wishlist.has(product.id)}
              onToggleWishlist={toggleWishlist}
              onQuickView={setQuickView}
              onQuickAdd={quickAdd}
            />
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => setCartOpen(true)}>
          Open cart drawer ({lines.reduce((n, l) => n + l.quantity, 0)})
        </Button>
        <Button variant="ghost" onClick={() => setQuickView(mockProducts[0])}>
          Open quick view
        </Button>
      </div>

      <QuickView product={quickView} onOpenChange={(open) => !open && setQuickView(null)} onAddToCart={addToCart} />
      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        lines={lines}
        shipping={shipping}
        onQuantityChange={(key, quantity) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity } : l)))}
        onRemove={(key) => setLines((prev) => prev.filter((l) => l.key !== key))}
      />
    </>
  )
}

export function FormControlsDemo() {
  const [fragrance, setFragrance] = useState('sweet-rose')
  const [qty, setQty] = useState(1)

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        <TextField label="Full name" placeholder="Ayesha Khan" autoComplete="name" />
        <TextField label="Mobile number" type="tel" inputMode="tel" placeholder="03XX XXXXXXX" hint="We'll call to confirm Cash on Delivery orders." />
        <TextField label="City" defaultValue="Lahre" error="Please choose a city from the list." />
        <TextAreaField label="Complete address" placeholder="House, street, area" />
      </div>
      <div className="space-y-6">
        <FragrancePicker options={mockFragrances.map((f) => ({ ...f, available: f.id !== 'forest-pine' }))} value={fragrance} onChange={setFragrance} />
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-muted">Quantity</p>
          <QuantityStepper value={qty} onChange={setQty} max={10} />
        </div>
      </div>
    </div>
  )
}
