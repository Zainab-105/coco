// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Product } from '@/payload-types'
import { CheckoutError, findCustomerOrder, placeOrder, SUSPECTED_BOT_NOTE } from '@/lib/checkout/server'
import type { CheckoutForm } from '@/lib/checkout/validate'
import { recordPayment } from '@/lib/payments/record'

import { assertTestDatabase } from '../helpers/testDb'

/** End-to-end checkout against Postgres: pricing, coupons, payment rules, stock and concurrency. */
let payload: Payload
let lamp: Product
let diffuser: Product

const form = (over: Partial<CheckoutForm> = {}): CheckoutForm => ({
  fullName: 'Hira Javed',
  phone: '+923331112223',
  city: 'Lahore',
  address: 'House 5, Street 2, Gulberg',
  paymentMethod: 'cod',
  giftWrap: false,
  marketingConsent: false,
  ...over,
})

const stock = async (id: number) => (await payload.findByID({ collection: 'products', id, depth: 0 })).stock

describe('checkout', () => {
  beforeAll(async () => {
    assertTestDatabase()
    payload = await getPayload({ config: await config })
    for (const collection of ['orders', 'customers', 'inventory-adjustments', 'coupons', 'products', 'categories'] as const) {
      await payload.delete({ collection, where: { id: { exists: true } } })
    }
    await payload.updateGlobal({
      slug: 'store-settings',
      data: {
        shipping: { flatRate: 250, freeShippingThreshold: 3000, cityRates: [] },
        giftWrap: { enabled: true, price: 150 },
        inventory: { deductStockOn: 'placed', allowBackorders: false },
        payments: { codEnabled: true, codMaxOrderValue: 5000, manualTransferInstructions: 'JazzCash wallet 0300-0000000 (COCO)' },
      },
    })
    const cat = await payload.create({ collection: 'categories', data: { title: 'Checkout Cat' } })
    lamp = await payload.create({
      collection: 'products',
      data: { title: 'Test Lamp', category: cat.id, productType: 'simple', price: 1000, costPrice: 400, stock: 5, status: 'published' },
    })
    diffuser = await payload.create({
      collection: 'products',
      data: {
        title: 'Test Diffuser',
        category: cat.id,
        productType: 'variable',
        price: 1450,
        salePrice: 1199,
        status: 'published',
        variants: [{ label: 'Rose', stock: 1 }],
      },
    })
    await payload.create({
      collection: 'coupons',
      data: { code: 'ONCE10', type: 'percentage', value: 10, perCustomerLimit: 1, usageLimit: 10 },
    })
  })

  afterAll(async () => {
    for (const collection of ['orders', 'customers', 'inventory-adjustments', 'coupons', 'products', 'categories'] as const) {
      await payload.delete({ collection, where: { id: { exists: true } } })
    }
  })

  let token = ''
  let orderNumber = ''

  it('places a COD order with server prices, coupon, gift wrap and stock deduction', async () => {
    const placed = await placeOrder(form({ couponCode: 'ONCE10', giftWrap: true, giftNote: 'Happy birthday' }), [
      { productId: lamp.id, quantity: 2, expectedUnitPrice: 1000 },
    ])
    token = placed.accessToken
    orderNumber = placed.orderNumber
    expect(token).toMatch(/^[a-f0-9]{32}$/)
    // 2000 - 10% (200) + 250 delivery + 150 gift wrap
    expect(placed.total).toBe(2200)

    const order = (await findCustomerOrder(orderNumber, { token }))!
    expect(order).toMatchObject({ subtotal: 2000, discount: 200, shippingFee: 250, total: 2200 })
    expect(order.gift).toMatchObject({ wrap: true, wrapFee: 150, note: 'Happy birthday' })
    expect(order.payment).toMatchObject({ method: 'cod', status: 'pending' })
    expect(order.items?.[0]).toMatchObject({ unitPrice: 1000, unitCost: 400, quantity: 2 })
    expect(await stock(lamp.id)).toBe(3)

    const coupon = (await payload.find({ collection: 'coupons', where: { code: { equals: 'ONCE10' } } })).docs[0]
    expect(coupon.usageCount).toBe(1)
  })

  it('keeps an order whose hidden anti-bot field was autofilled, and flags it for staff', async () => {
    const placed = await placeOrder(form({ phone: '+923000000009', website: 'https://example.com' }), [{ productId: lamp.id, quantity: 1 }])
    const flagged = await payload.findByID({ collection: 'orders', id: placed.id, depth: 0 })
    expect(flagged.internalNotes?.[0]?.note).toBe(SUSPECTED_BOT_NOTE)

    const normal = await placeOrder(form({ phone: '+923000000010' }), [{ productId: lamp.id, quantity: 1 }])
    expect((await payload.findByID({ collection: 'orders', id: normal.id, depth: 0 })).internalNotes ?? []).toHaveLength(0)
    await payload.update({ collection: 'products', id: lamp.id, data: { stock: 3 } })
  })

  it('only shows an order with the right token or phone', async () => {
    expect(await findCustomerOrder(orderNumber, { token: 'f'.repeat(32) })).toBeNull()
    expect(await findCustomerOrder(orderNumber, {})).toBeNull()
    expect((await findCustomerOrder(orderNumber.toLowerCase(), { phone: '+923331112223' }))?.orderNumber).toBe(orderNumber)
  })

  it('refuses the same coupon twice for one customer and rolls everything back', async () => {
    await expect(placeOrder(form({ couponCode: 'ONCE10' }), [{ productId: lamp.id, quantity: 1 }])).rejects.toThrow(/already used/)
    expect(await stock(lamp.id)).toBe(3)
  })

  it('rejects a cart whose prices changed since it was shown', async () => {
    const attempt = placeOrder(form({ phone: '+923000000001' }), [{ productId: lamp.id, quantity: 1, expectedUnitPrice: 10 }])
    await expect(attempt).rejects.toBeInstanceOf(CheckoutError)
    await expect(attempt).rejects.toThrow(/cart changed/)
  })

  it('enforces the Cash on Delivery limit and allows manual transfer instead', async () => {
    await payload.update({ collection: 'products', id: lamp.id, data: { stock: 10 } })
    const big = [{ productId: lamp.id, quantity: 6 }]
    await expect(placeOrder(form({ phone: '+923000000002' }), big)).rejects.toThrow(/up to Rs 5,000/)

    const transfer = await placeOrder(form({ phone: '+923000000002', paymentMethod: 'bank_transfer' }), big)
    const order = (await findCustomerOrder(transfer.orderNumber, { token: transfer.accessToken }))!
    expect(order.payment.status).toBe('awaiting_verification')
  })

  it('refuses online gateways that are not configured', async () => {
    await expect(placeOrder(form({ phone: '+923000000003', paymentMethod: 'jazzcash' }), [{ productId: lamp.id, quantity: 1 }])).rejects.toThrow(
      /Coming soon/,
    )
  })

  it('sells the last unit only once under concurrent checkouts', async () => {
    const variantId = diffuser.variants![0].id!
    const results = await Promise.allSettled([
      placeOrder(form({ phone: '+923000000010' }), [{ productId: diffuser.id, variantId, quantity: 1 }]),
      placeOrder(form({ phone: '+923000000011' }), [{ productId: diffuser.id, variantId, quantity: 1 }]),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const after = await payload.findByID({ collection: 'products', id: diffuser.id, depth: 0 })
    expect(after.variants?.[0].stock).toBe(0)
  })

  it('records gateway payments safely', async () => {
    // Wrong amount: never marked paid.
    await recordPayment({ orderNumber, status: 'paid', amount: 1, transactionId: 'X1' })
    let order = (await findCustomerOrder(orderNumber, { token }))!
    expect(order.payment.status).toBe('awaiting_verification')

    await recordPayment({ orderNumber, status: 'paid', amount: 2200, transactionId: 'X2' })
    order = (await findCustomerOrder(orderNumber, { token }))!
    expect(order.payment).toMatchObject({ status: 'paid', transactionId: 'X2' })
    expect(order.status).toBe('confirmed')

    // A later failure callback must not undo a confirmed payment.
    await recordPayment({ orderNumber, status: 'failed' })
    order = (await findCustomerOrder(orderNumber, { token }))!
    expect(order.payment.status).toBe('paid')
  })
})
