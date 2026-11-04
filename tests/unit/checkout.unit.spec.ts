import { describe, expect, it } from 'vitest'

import { computeQuote, type CatalogProduct, type CouponData, type QuoteSettings } from '@/lib/checkout/quote'
import { validateCheckout } from '@/lib/checkout/validate'

const settings: QuoteSettings = {
  flatRate: 250,
  freeShippingThreshold: 3000,
  cityRates: [{ city: 'Gwadar', rate: 450 }],
  giftWrap: { enabled: true, price: 150 },
  allowBackorders: false,
  payments: { codEnabled: true, codMaxOrderValue: 25000, jazzcashEnabled: false, easypaisaEnabled: false, manualTransferEnabled: true },
}

const diffuser: CatalogProduct = {
  id: 1,
  title: 'Hanging Car Diffuser',
  slug: 'hcd',
  published: true,
  productType: 'variable',
  price: 1450,
  salePrice: 1199,
  costPrice: 520,
  categoryId: 10,
  variants: [
    { id: 'rose', label: 'Sweet Rose', stock: 5, costPrice: 520 },
    { id: 'oud', label: 'Vanilla Oud', price: 1650, stock: 2 },
    { id: 'pine', label: 'Forest Pine', stock: 0 },
  ],
}
const ashtray: CatalogProduct = { id: 2, title: 'Ashtray', slug: 'ash', published: true, productType: 'simple', price: 1800, stock: 10, categoryId: 20, variants: [] }
const draft: CatalogProduct = { ...ashtray, id: 3, published: false }
const catalog = new Map([diffuser, ashtray, draft].map((p) => [p.id, p]))

const coupon = (over: Partial<CouponData> = {}): CouponData => ({
  id: 9,
  code: 'WELCOME10',
  type: 'percentage',
  value: 10,
  maxDiscount: 500,
  active: true,
  categoryIds: [],
  ...over,
})

describe('computeQuote', () => {
  it('prices lines from the catalog, not the browser', () => {
    const q = computeQuote({ lines: [{ productId: 1, variantId: 'rose', quantity: 2, expectedUnitPrice: 1 }] }, catalog, settings)
    expect(q.lines[0]).toMatchObject({ unitPrice: 1199, compareAtPrice: 1450, unitCost: 520, lineTotal: 2398 })
    expect(q.issues).toEqual([expect.objectContaining({ type: 'price_changed' })])
    expect(q).toMatchObject({ subtotal: 2398, shipping: 250, total: 2648 })
  })

  it('uses variant price overrides without inheriting the product sale price', () => {
    const q = computeQuote({ lines: [{ productId: 1, variantId: 'oud', quantity: 1 }] }, catalog, settings)
    expect(q.lines[0].unitPrice).toBe(1650)
  })

  it('removes unavailable items and caps quantities at stock', () => {
    const q = computeQuote(
      {
        lines: [
          { productId: 1, variantId: 'pine', quantity: 1 },
          { productId: 3, quantity: 1 },
          { productId: 99, quantity: 1 },
          { productId: 1, variantId: 'nope', quantity: 1 },
          { productId: 1, variantId: 'oud', quantity: 1 },
          { productId: 1, variantId: 'oud', quantity: 4 },
        ],
      },
      catalog,
      settings,
    )
    expect(q.lines).toHaveLength(1)
    expect(q.lines[0]).toMatchObject({ variantId: 'oud', quantity: 2 })
    expect(q.issues.map((i) => i.type).sort()).toEqual(['quantity_reduced', 'removed', 'removed', 'removed', 'removed'])
  })

  it('allows backorders when enabled', () => {
    const q = computeQuote({ lines: [{ productId: 1, variantId: 'pine', quantity: 3 }] }, catalog, { ...settings, allowBackorders: true })
    expect(q.lines[0].quantity).toBe(3)
  })

  it('applies free delivery over the threshold and per-city rates below it', () => {
    expect(computeQuote({ lines: [{ productId: 2, quantity: 2 }] }, catalog, settings).shipping).toBe(0)
    expect(computeQuote({ lines: [{ productId: 2, quantity: 1 }], city: ' gwadar ' }, catalog, settings).shipping).toBe(450)
  })

  it('adds gift wrap only when offered', () => {
    expect(computeQuote({ lines: [{ productId: 2, quantity: 1 }], giftWrap: true }, catalog, settings).giftWrapFee).toBe(150)
    const off = { ...settings, giftWrap: { enabled: false, price: 150 } }
    expect(computeQuote({ lines: [{ productId: 2, quantity: 1 }], giftWrap: true }, catalog, off).giftWrapFee).toBe(0)
  })

  it('applies a capped percentage coupon', () => {
    const q = computeQuote({ lines: [{ productId: 2, quantity: 5 }] }, catalog, settings, { code: 'welcome10', data: coupon() })
    expect(q.coupon).toMatchObject({ code: 'WELCOME10', applied: true })
    expect(q.discount).toBe(500)
    expect(q.total).toBe(9000 - 500)
  })

  it('restricts coupons to their categories', () => {
    const q = computeQuote(
      { lines: [{ productId: 1, variantId: 'rose', quantity: 1 }, { productId: 2, quantity: 1 }] },
      catalog,
      settings,
      { code: 'X', data: coupon({ type: 'fixed', value: 5000, categoryIds: [10] }) },
    )
    expect(q.discount).toBe(1199)
    const none = computeQuote({ lines: [{ productId: 2, quantity: 1 }] }, catalog, settings, { code: 'X', data: coupon({ categoryIds: [10] }) })
    expect(none.coupon?.applied).toBe(false)
  })

  it.each([
    ['unknown code', null, /not valid/],
    ['inactive', coupon({ active: false }), /not valid/],
    ['expired', coupon({ endsAt: '2020-01-01' }), /expired/],
    ['not started', coupon({ startsAt: '2099-01-01' }), /not active yet/],
    ['used up', coupon({ usageLimit: 5, usageCount: 5 }), /usage limit/],
    ['below minimum', coupon({ minOrderAmount: 5000 }), /Add Rs 3,200 more/],
  ])('rejects a coupon: %s', (_, data, message) => {
    const q = computeQuote({ lines: [{ productId: 2, quantity: 1 }] }, catalog, settings, { code: 'X', data })
    expect(q.coupon?.applied).toBe(false)
    expect(q.coupon?.message).toMatch(message)
    expect(q.discount).toBe(0)
  })

  it('enforces the per-customer coupon limit', () => {
    const q = computeQuote({ lines: [{ productId: 2, quantity: 1 }], customerCouponUses: 1 }, catalog, settings, {
      code: 'X',
      data: coupon({ perCustomerLimit: 1 }),
    })
    expect(q.coupon?.message).toMatch(/already used/)
  })

  it('applies free-shipping coupons', () => {
    const q = computeQuote({ lines: [{ productId: 2, quantity: 1 }] }, catalog, settings, { code: 'F', data: coupon({ type: 'free_shipping', value: 0 }) })
    expect(q.shipping).toBe(0)
  })

  it('limits Cash on Delivery to the configured order value', () => {
    const q = computeQuote({ lines: [{ productId: 2, quantity: 10 }] }, catalog, { ...settings, payments: { ...settings.payments, codMaxOrderValue: 10000 } })
    const cod = q.payments.find((p) => p.method === 'cod')
    expect(cod).toMatchObject({ available: false })
    expect(cod?.reason).toMatch(/up to Rs 10,000/)
  })
})

describe('validateCheckout', () => {
  const valid = { fullName: 'Ayesha Khan', phone: '0300-1234567', city: 'Lahore', address: 'House 12, Street 4, DHA', paymentMethod: 'cod' }

  it('normalises and cleans input', () => {
    const { data } = validateCheckout({ ...valid, fullName: '  Ayesha   Khan ', email: 'A@Example.COM', couponCode: ' welcome10 ', giftWrap: 'on' })
    expect(data).toMatchObject({ fullName: 'Ayesha Khan', phone: '+923001234567', email: 'a@example.com', couponCode: 'WELCOME10', giftWrap: true })
  })

  it('reports field errors', () => {
    const { data, errors } = validateCheckout({ fullName: 'A', phone: '123', email: 'bad', city: '', address: 'short', paymentMethod: 'bitcoin' })
    expect(data).toBeUndefined()
    expect(Object.keys(errors).sort()).toEqual(['address', 'city', 'email', 'fullName', 'paymentMethod', 'phone'])
  })
})
