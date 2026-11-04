// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

import { assertTestDatabase } from '../helpers/testDb'
import type { Order, Product } from '@/payload-types'

/**
 * Exercises the order hooks against a real Postgres (TEST_DATABASE_URL):
 * order numbers, CRM upsert by phone, customer stats, stock ledger, reversal on cancel.
 */
let payload: Payload
let simple: Product
let variable: Product

const wipe = async () => {
  for (const collection of [
    'orders',
    'customers',
    'inventory-adjustments',
    'products',
    'categories',
    'fragrances',
  ] as const) {
    await payload.delete({ collection, where: { id: { exists: true } } })
  }
}

const stockOf = async (id: number) => (await payload.findByID({ collection: 'products', id, depth: 0 })).stock
const variantStockOf = async (id: number, variantId: string) =>
  (await payload.findByID({ collection: 'products', id, depth: 0 })).variants?.find((v) => v.id === variantId)?.stock

const orderData = (phone: string, items: Order['items']) =>
  ({
    status: 'new',
    items,
    shippingFee: 250,
    shippingAddress: { fullName: 'Ayesha Khan', phone, city: 'Lahore', address: '12 Main Boulevard' },
    payment: { method: 'cod', status: 'pending' },
  }) as Omit<Order, 'id' | 'createdAt' | 'updatedAt'>

describe('order workflow', () => {
  beforeAll(async () => {
    assertTestDatabase()
    payload = await getPayload({ config: await config })
    await wipe()
    await payload.updateGlobal({ slug: 'store-settings', data: { inventory: { deductStockOn: 'placed', allowBackorders: false } } })

    const category = await payload.create({ collection: 'categories', data: { title: 'Test Scents' } })
    const rose = await payload.create({ collection: 'fragrances', data: { name: 'Test Rose' } })
    simple = await payload.create({
      collection: 'products',
      data: { title: 'Test Ashtray', category: category.id, productType: 'simple', price: 1000, stock: 10, status: 'published' },
    })
    variable = await payload.create({
      collection: 'products',
      data: {
        title: 'Test Diffuser',
        category: category.id,
        productType: 'variable',
        price: 1450,
        status: 'published',
        variants: [
          { label: 'Rose', fragrance: rose.id, stock: 5 },
          { label: 'Ice', stock: 5 },
        ],
      },
    })
  })

  afterAll(async () => {
    await wipe()
  })

  let first: Order

  it('creates an order with a number, server totals and a CRM customer', async () => {
    const variantId = variable.variants![0].id!
    first = await payload.create({
      collection: 'orders',
      depth: 0,
      data: orderData('0300-1234567', [
        { product: simple.id, title: 'Test Ashtray', unitPrice: 1000, quantity: 2 },
        { product: variable.id, variantId, title: 'Test Diffuser', variantLabel: 'Rose', unitPrice: 1450, quantity: 1 },
      ]),
    })

    expect(first.orderNumber).toMatch(/^COCO-\d{6}-[A-Z0-9]{4}$/)
    expect(first.subtotal).toBe(3450)
    expect(first.total).toBe(3700)
    expect(first.items?.[0].lineTotal).toBe(2000)
    expect(first.statusHistory).toHaveLength(1)
    expect(first.shippingAddress.phone).toBe('+923001234567')

    const customer = await payload.findByID({ collection: 'customers', id: first.customer as number })
    expect(customer.phone).toBe('+923001234567')
    expect(customer.orderCount).toBe(1)
    expect(customer.totalSpent).toBe(3700)
    expect(customer.segment).toBe('new')
  })

  it('deducts stock and writes the ledger', async () => {
    expect(await stockOf(simple.id)).toBe(8)
    expect(await variantStockOf(variable.id, variable.variants![0].id!)).toBe(4)
    expect(await variantStockOf(variable.id, variable.variants![1].id!)).toBe(5)

    const ledger = await payload.find({ collection: 'inventory-adjustments', where: { reference: { equals: first.orderNumber } } })
    expect(ledger.totalDocs).toBe(2)
    expect(ledger.docs.every((d) => d.reason === 'order')).toBe(true)
  })

  it('links a second order with a differently formatted phone to the same customer', async () => {
    const second = await payload.create({
      collection: 'orders',
      depth: 0,
      data: orderData('+92 300 1234567', [{ product: simple.id, title: 'Test Ashtray', unitPrice: 1000, quantity: 1 }]),
    })
    expect(second.customer).toBe(first.customer)

    const customers = await payload.count({ collection: 'customers' })
    expect(customers.totalDocs).toBe(1)

    const customer = await payload.findByID({ collection: 'customers', id: first.customer as number })
    expect(customer.orderCount).toBe(2)
    expect(customer.segment).toBe('repeat')
    expect(await stockOf(simple.id)).toBe(7)
  })

  it('restores stock once when an order is cancelled', async () => {
    await payload.update({ collection: 'orders', id: first.id, data: { status: 'cancelled' } })
    expect(await stockOf(simple.id)).toBe(9)
    expect(await variantStockOf(variable.id, variable.variants![0].id!)).toBe(5)

    // Saving the cancelled order again must not restore stock twice.
    await payload.update({ collection: 'orders', id: first.id, data: { fulfilment: { courier: 'TCS' } } })
    expect(await stockOf(simple.id)).toBe(9)

    const updated = await payload.findByID({ collection: 'orders', id: first.id })
    expect(updated.statusHistory?.map((h) => h.status)).toEqual(['new', 'cancelled'])

    const customer = await payload.findByID({ collection: 'customers', id: first.customer as number })
    expect(customer.orderCount).toBe(1)
    expect(customer.totalSpent).toBe(1250)
  })

  it('keeps totalStock and stockStatus in sync', async () => {
    const v = await payload.findByID({ collection: 'products', id: variable.id, depth: 0 })
    expect(v.totalStock).toBe(10)
    expect(v.stockStatus).toBe('in_stock')

    const low = await payload.update({ collection: 'products', id: simple.id, data: { stock: 3 } })
    expect(low.stockStatus).toBe('low_stock')
    const out = await payload.update({ collection: 'products', id: simple.id, data: { stock: 0 } })
    expect(out.stockStatus).toBe('out_of_stock')
    await payload.update({ collection: 'products', id: simple.id, data: { stock: 9 } })
  })

  it('duplicates a product as a draft with a unique slug and fresh stats', async () => {
    await payload.update({ collection: 'products', id: simple.id, data: { sku: 'ASH-01' } })
    const copy = await payload.duplicate({ collection: 'products', id: simple.id })
    expect(copy.slug).not.toBe(simple.slug)
    expect(copy.slug).toMatch(/^test-ashtray-copy-/)
    expect(copy.sku).toMatch(/^ASH-01-copy-/)
    expect(copy.status).toBe('draft')
    expect(copy.salesCount).toBe(0)
  })

  it('rejects an order for more than the available stock', async () => {
    const before = await stockOf(simple.id)
    await expect(
      payload.create({
        collection: 'orders',
        depth: 0,
        data: orderData('03222222222', [{ product: simple.id, title: 'Test Ashtray', unitPrice: 1000, quantity: 99 }]),
      }),
    ).rejects.toThrow(/Not enough stock for Test Ashtray/)
    expect(await stockOf(simple.id)).toBe(before)
    expect((await payload.count({ collection: 'customers', where: { phone: { equals: '+923222222222' } } })).totalDocs).toBe(0)
  })

  it('only deducts on confirmation when configured that way', async () => {
    await payload.updateGlobal({ slug: 'store-settings', data: { inventory: { deductStockOn: 'confirmed' } } })
    const order = await payload.create({
      collection: 'orders',
      depth: 0,
      data: orderData('03111111111', [{ product: simple.id, title: 'Test Ashtray', unitPrice: 1000, quantity: 3 }]),
    })
    expect(await stockOf(simple.id)).toBe(9)

    await payload.update({ collection: 'orders', id: order.id, data: { status: 'confirmed' } })
    expect(await stockOf(simple.id)).toBe(6)

    await payload.updateGlobal({ slug: 'store-settings', data: { inventory: { deductStockOn: 'placed' } } })
  })
})
