import { describe, expect, it } from 'vitest'

import { calculateTotals, discountPercent, effectivePrice } from '@/lib/pricing'

const shipping = { flatRate: 250, freeShippingThreshold: 5000 }

describe('effectivePrice', () => {
  it('uses the sale price only when it is lower than the price', () => {
    expect(effectivePrice(1500, 1200)).toBe(1200)
    expect(effectivePrice(1500, 1800)).toBe(1500)
    expect(effectivePrice(1500, null)).toBe(1500)
    expect(effectivePrice(1500, 0)).toBe(1500)
  })

  it('rounds the discount percent', () => {
    expect(discountPercent(1500, 1200)).toBe(20)
    expect(discountPercent(1500, null)).toBe(0)
  })
})

describe('calculateTotals', () => {
  it('adds flat shipping below the free-shipping threshold', () => {
    expect(calculateTotals([{ unitPrice: 1200, quantity: 2 }], shipping)).toEqual({
      subtotal: 2400,
      discount: 0,
      shipping: 250,
      total: 2650,
    })
  })

  it('waives shipping at the threshold', () => {
    expect(calculateTotals([{ unitPrice: 2500, quantity: 2 }], shipping).shipping).toBe(0)
  })

  it('applies a capped percentage coupon', () => {
    const totals = calculateTotals([{ unitPrice: 4000, quantity: 1 }], shipping, {
      type: 'percentage',
      value: 20,
      maxDiscount: 500,
    })
    expect(totals.discount).toBe(500)
    expect(totals.total).toBe(4000 - 500 + 250)
  })

  it('ignores a coupon below its minimum order amount', () => {
    const totals = calculateTotals([{ unitPrice: 1000, quantity: 1 }], shipping, {
      type: 'fixed',
      value: 300,
      minOrderAmount: 2000,
    })
    expect(totals.discount).toBe(0)
  })

  it('never discounts more than the subtotal', () => {
    const totals = calculateTotals([{ unitPrice: 200, quantity: 1 }], shipping, {
      type: 'fixed',
      value: 1000,
    })
    expect(totals.discount).toBe(200)
    expect(totals.total).toBe(250)
  })

  it('supports free-shipping coupons', () => {
    const totals = calculateTotals([{ unitPrice: 1000, quantity: 1 }], shipping, {
      type: 'free_shipping',
      value: 0,
    })
    expect(totals.shipping).toBe(0)
    expect(totals.total).toBe(1000)
  })
})
