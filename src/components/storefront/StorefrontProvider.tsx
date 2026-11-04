'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import type { AddToCartPayload } from '@/components/product/QuickView'
import type { ProductCardData } from '@/components/product/types'
import { trackEvent } from '@/lib/analytics'
import { cart, useCart } from '@/lib/stores/cart'
import { effectivePrice } from '@/lib/pricing'

type StorefrontContext = {
  openCart: () => void
  openQuickView: (product: ProductCardData) => void
  /** Adds directly when no option is needed, otherwise opens Quick View to choose one. */
  quickAdd: (product: ProductCardData) => void
  addToCart: (payload: AddToCartPayload) => void
}

// Both stay out of the first page load: most visits to a page never open them.
const CartDrawer = dynamic(() => import('@/components/cart/CartDrawer').then((m) => m.CartDrawer), { ssr: false })
const QuickView = dynamic(() => import('@/components/product/QuickView').then((m) => m.QuickView), { ssr: false })

const Ctx = createContext<StorefrontContext | null>(null)

export function useStorefront() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStorefront must be used inside <StorefrontProvider>')
  return ctx
}

const coverImage = (product: ProductCardData) => {
  const first = product.media.find((m) => m.type === 'image') ?? product.media[0]
  return first?.type === 'video' ? (first.poster ?? '') : (first?.src ?? '')
}

export function StorefrontProvider({
  shipping,
  children,
}: {
  shipping: { flatRate: number; freeShippingThreshold: number | null }
  children: ReactNode
}) {
  const lines = useCart()
  const [cartOpen, setCartOpen] = useState(false)
  const [quickView, setQuickView] = useState<ProductCardData | null>(null)
  const pathname = usePathname()
  const [overlayPath, setOverlayPath] = useState(pathname)

  // Overlays never survive a page change (e.g. tapping Checkout inside the cart drawer).
  if (pathname !== overlayPath) {
    setOverlayPath(pathname)
    setCartOpen(false)
    setQuickView(null)
  }

  const addToCart = useCallback(({ product, fragranceId, quantity }: AddToCartPayload) => {
    const option = product.fragrances?.find((o) => o.id === fragranceId)
    const price = option?.price ?? product.price
    const salePrice = option ? option.salePrice : product.salePrice
    const unitPrice = effectivePrice(price, salePrice)
    cart.add({
      productId: Number(product.id),
      variantId: option?.id,
      slug: product.slug,
      title: product.title,
      variantLabel: option ? `Fragrance: ${option.name}` : undefined,
      image: option?.image ?? coverImage(product),
      unitPrice,
      compareAtPrice: unitPrice < price ? price : undefined,
      quantity,
      maxQuantity: option?.stock ?? product.stockQuantity,
    })
    trackEvent('add_to_cart', {
      value: unitPrice * quantity,
      items: [{ item_id: product.id, item_name: product.title, item_variant: option?.name, price: unitPrice, quantity }],
    })
    setQuickView(null)
    setCartOpen(true)
  }, [])

  const value = useMemo<StorefrontContext>(
    () => ({
      openCart: () => setCartOpen(true),
      openQuickView: setQuickView,
      quickAdd: (product) => {
        if (product.stock === 'out_of_stock') return
        if (product.requiresOption) setQuickView(product)
        else addToCart({ product, quantity: 1 })
      },
      addToCart,
    }),
    [addToCart],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      {quickView && <QuickView product={quickView} onOpenChange={(open) => !open && setQuickView(null)} onAddToCart={addToCart} />}
      {cartOpen && (
        <CartDrawer
          open={cartOpen}
          onOpenChange={setCartOpen}
          lines={lines}
          shipping={shipping}
          onQuantityChange={cart.setQuantity}
          onRemove={cart.remove}
        />
      )}
    </Ctx.Provider>
  )
}
