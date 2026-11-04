import { beforeEach, describe, expect, it } from 'vitest'

import { cart, cartCount, MAX_LINE_QUANTITY } from '@/lib/stores/cart'
import { useCart } from '@/lib/stores/cart'

// The store is a module singleton; read its state through the same subscribe/get path React uses.
import { renderHook } from '@testing-library/react'

const lines = () => renderHook(() => useCart()).result.current

const diffuser = {
  productId: 7,
  variantId: 'v1',
  slug: 'hanging-car-diffuser',
  title: 'Hanging Car Diffuser',
  image: '/x.webp',
  unitPrice: 1199,
  quantity: 1,
  maxQuantity: 4,
}

describe('cart store', () => {
  beforeEach(() => cart.clear())

  it('merges the same product + variant into one line', () => {
    cart.add(diffuser)
    cart.add({ ...diffuser, quantity: 2 })
    expect(lines()).toHaveLength(1)
    expect(lines()[0].quantity).toBe(3)
  })

  it('keeps different variants on separate lines', () => {
    cart.add(diffuser)
    cart.add({ ...diffuser, variantId: 'v2' })
    expect(lines()).toHaveLength(2)
    expect(cartCount(lines())).toBe(2)
  })

  it('caps quantity at available stock and the per-line maximum', () => {
    cart.add({ ...diffuser, quantity: 9 })
    expect(lines()[0].quantity).toBe(4)
    cart.add({ ...diffuser, variantId: undefined, maxQuantity: undefined, quantity: 50 })
    expect(lines()[1].quantity).toBe(MAX_LINE_QUANTITY)
    cart.setQuantity(lines()[0].key, 0)
    expect(lines()[0].quantity).toBe(1)
  })

  it('persists to localStorage and removes lines', () => {
    cart.add(diffuser)
    expect(JSON.parse(localStorage.getItem('coco.cart.v1') ?? '[]')).toHaveLength(1)
    cart.remove(lines()[0].key)
    expect(lines()).toHaveLength(0)
  })
})
