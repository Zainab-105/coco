'use client'

const KEY = 'coco:checkout-token'

/**
 * Random id for the visitor's current checkout, so repeated saves update one abandoned-cart
 * record. A new id starts after each order.
 */
export const checkoutSession = {
  token(): string {
    try {
      const existing = window.localStorage.getItem(KEY)
      if (existing) return existing
      const token = crypto.randomUUID()
      window.localStorage.setItem(KEY, token)
      return token
    } catch {
      return crypto.randomUUID()
    }
  },
  reset() {
    try {
      window.localStorage.removeItem(KEY)
    } catch {
      // Storage unavailable: nothing to reset.
    }
  },
}
