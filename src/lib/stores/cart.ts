'use client'

import { createPersistentStore } from './persistent'

/**
 * Cart lines are a display snapshot only. Checkout re-reads prices and stock on the server,
 * so a stale or edited localStorage cart can never change what the customer is charged.
 */
export type CartItem = {
  key: string
  productId: number
  variantId?: string
  slug: string
  title: string
  variantLabel?: string
  image: string
  unitPrice: number
  compareAtPrice?: number
  quantity: number
  maxQuantity?: number
}

export const MAX_LINE_QUANTITY = 10

export const lineKey = (productId: number, variantId?: string) => `${productId}:${variantId ?? ''}`

const store = createPersistentStore<CartItem[]>('coco.cart.v1', [])

export const useCart = store.useStore

const clampQty = (quantity: number, max?: number) =>
  Math.max(1, Math.min(quantity, max ?? MAX_LINE_QUANTITY, MAX_LINE_QUANTITY))

export const cart = {
  add(item: Omit<CartItem, 'key'>) {
    const key = lineKey(item.productId, item.variantId)
    store.set((lines) => {
      const existing = lines.find((l) => l.key === key)
      if (existing) {
        return lines.map((l) =>
          l.key === key ? { ...l, ...item, key, quantity: clampQty(l.quantity + item.quantity, item.maxQuantity) } : l,
        )
      }
      return [...lines, { ...item, key, quantity: clampQty(item.quantity, item.maxQuantity) }]
    })
  },
  setQuantity(key: string, quantity: number) {
    store.set((lines) => lines.map((l) => (l.key === key ? { ...l, quantity: clampQty(quantity, l.maxQuantity) } : l)))
  },
  remove(key: string) {
    store.set((lines) => lines.filter((l) => l.key !== key))
  },
  clear() {
    store.set([])
  },
  /** Applies server-confirmed prices, quantities and removals to the device cart. */
  syncFromQuote(quoted: { key: string; unitPrice: number; compareAtPrice?: number; quantity: number; image?: string }[]) {
    const byKey = new Map(quoted.map((q) => [q.key, q]))
    store.set((lines) =>
      lines
        .filter((l) => byKey.has(l.key))
        .map((l) => {
          const q = byKey.get(l.key)!
          return { ...l, unitPrice: q.unitPrice, compareAtPrice: q.compareAtPrice, quantity: q.quantity, image: q.image ?? l.image }
        }),
    )
  },
}

export const cartCount = (lines: CartItem[]) => lines.reduce((n, l) => n + l.quantity, 0)
