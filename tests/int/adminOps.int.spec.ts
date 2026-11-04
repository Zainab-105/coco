// @vitest-environment node
import type { Payload, PayloadRequest } from 'payload'
import { createLocalReq, getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Order, Product, User } from '@/payload-types'
import { mergeCustomer } from '@/endpoints/customerMerge'
import { exportOrders, exportProducts } from '@/endpoints/exports'
import { importProducts, type ImportResult } from '@/endpoints/productImport'
import { parseCsv } from '@/lib/csv'

import { assertTestDatabase } from '../helpers/testDb'

/** Admin operations: manual stock adjustments, CSV import/export, customer merge, status side effects. */
let payload: Payload
let owner: User
let staff: User
let simple: Product
let variable: Product

const collections = ['orders', 'customers', 'inventory-adjustments', 'products', 'categories', 'activity-logs'] as const

async function call(
  endpoint: { handler: (req: PayloadRequest) => Promise<Response> | Response },
  user: User | null,
  init: { body?: unknown; query?: Record<string, unknown>; routeParams?: Record<string, unknown> } = {},
) {
  const req = await createLocalReq({ user: user ?? undefined }, payload)
  if (!user) req.user = null
  req.query = (init.query ?? {}) as PayloadRequest['query']
  req.routeParams = init.routeParams
  req.json = async () => init.body
  return endpoint.handler(req)
}

const productById = (id: number) => payload.findByID({ collection: 'products', id, depth: 0 })

describe('admin operations', () => {
  beforeAll(async () => {
    assertTestDatabase()
    payload = await getPayload({ config: await config })
    for (const c of collections) await payload.delete({ collection: c, where: { id: { exists: true } } })
    await payload.delete({ collection: 'users', where: { email: { like: '@ops.test' } } })
    await payload.updateGlobal({ slug: 'store-settings', data: { inventory: { deductStockOn: 'placed', allowBackorders: false } } })

    owner = await payload.create({ collection: 'users', data: { email: 'owner@ops.test', password: 'Passw0rd!x', roles: ['owner'] } })
    staff = await payload.create({ collection: 'users', data: { email: 'staff@ops.test', password: 'Passw0rd!x', roles: ['staff'] } })
    const cat = await payload.create({ collection: 'categories', data: { title: 'Ops Cat' } })
    simple = await payload.create({
      collection: 'products',
      data: { title: 'Ops Ashtray', category: cat.id, productType: 'simple', sku: 'OPS-ASH', price: 1800, costPrice: 700, stock: 10, status: 'published' },
    })
    variable = await payload.create({
      collection: 'products',
      data: {
        title: 'Ops Diffuser',
        category: cat.id,
        productType: 'variable',
        sku: 'OPS-HCD',
        price: 1450,
        status: 'published',
        variants: [
          { label: 'Rose', sku: 'OPS-HCD-ROSE', stock: 5 },
          { label: 'Ice', sku: 'OPS-HCD-ICE', stock: 5 },
        ],
      },
    })
  })

  afterAll(async () => {
    for (const c of collections) await payload.delete({ collection: c, where: { id: { exists: true } } })
    await payload.delete({ collection: 'users', where: { email: { like: '@ops.test' } } })
  })

  describe('manual stock adjustments', () => {
    it('restocks a variant by SKU and records who did it', async () => {
      const entry = await payload.create({
        collection: 'inventory-adjustments',
        data: { product: variable.id, variantSku: 'ops-hcd-ice', quantityChange: 24, reason: 'restock', reference: 'INV-001' },
        user: owner,
      })
      expect((await productById(variable.id)).variants?.find((v) => v.label === 'Ice')?.stock).toBe(29)
      expect(entry.variantId).toBeTruthy()
    })

    it('rejects invalid adjustments without changing stock', async () => {
      const bad = [
        { product: variable.id, quantityChange: 3, reason: 'restock' as const },
        { product: simple.id, quantityChange: 2, reason: 'damage' as const },
        { product: simple.id, quantityChange: -50, reason: 'correction' as const },
        { product: simple.id, quantityChange: 5, reason: 'order' as const },
      ]
      const messages = [/has variants/, /must be a negative/, /negative/, /added automatically/]
      for (const [i, data] of bad.entries()) {
        await expect(payload.create({ collection: 'inventory-adjustments', data, user: owner })).rejects.toThrow(messages[i])
      }
      expect((await productById(simple.id)).stock).toBe(10)
    })
  })

  describe('bulk price & stock import', () => {
    const rows = [
      { sku: 'OPS-ASH', price: '1,900', salePrice: '1650', stock: '12' },
      { sku: 'OPS-HCD-ROSE', stock: '8', costPrice: '500' },
    ]

    it('previews changes without writing anything', async () => {
      const res = await call(importProducts, owner, { body: { rows, dryRun: true } })
      const body = (await res.json()) as { applied: boolean; results: ImportResult[] }
      expect(body.applied).toBe(false)
      expect(body.results[0].changes).toEqual([
        { field: 'price', from: 1800, to: 1900 },
        { field: 'salePrice', from: null, to: 1650 },
        { field: 'stock', from: 10, to: 12 },
      ])
      expect((await productById(simple.id)).price).toBe(1800)
    })

    it('blocks the whole import when any row has an error', async () => {
      const res = await call(importProducts, owner, { body: { rows: [...rows, { sku: 'NOPE', price: 'abc' }], dryRun: false } })
      const body = (await res.json()) as { applied: boolean; hasErrors: boolean }
      expect(body).toMatchObject({ applied: false, hasErrors: true })
      expect((await productById(simple.id)).price).toBe(1800)
    })

    it('applies changes and logs stock moves once', async () => {
      const res = await call(importProducts, owner, { body: { rows, dryRun: false } })
      expect(((await res.json()) as { applied: boolean }).applied).toBe(true)
      const ash = await productById(simple.id)
      expect(ash).toMatchObject({ price: 1900, salePrice: 1650, stock: 12, effectivePrice: 1650 })
      expect((await productById(variable.id)).variants?.find((v) => v.label === 'Rose')).toMatchObject({ stock: 8, costPrice: 500 })

      const ledger = await payload.find({ collection: 'inventory-adjustments', where: { reference: { equals: 'Bulk import' } } })
      expect(ledger.docs.map((d) => d.quantityChange).sort()).toEqual([2, 3])
    })

    it('re-importing an unchanged export changes nothing (inherited variant prices stay inherited)', async () => {
      const exported = await (await call(exportProducts, owner)).text()
      const res = await call(importProducts, owner, { body: { rows: parseCsv(exported).rows, dryRun: true } })
      const body = (await res.json()) as { results: ImportResult[] }
      expect(body.results.filter((r) => r.changes.length)).toEqual([])
      expect(body.results.filter((r) => r.errors.length)).toEqual([])
    })

    it('is limited to managers and owners', async () => {
      expect((await call(importProducts, staff, { body: { rows } })).status).toBe(403)
    })
  })

  describe('orders: status side effects and export', () => {
    let order: Order

    it('stamps shipped/delivered dates and marks COD paid on delivery', async () => {
      order = await payload.create({
        collection: 'orders',
        depth: 0,
        data: {
          status: 'new',
          items: [{ product: simple.id, title: 'Ops Ashtray', unitPrice: 1650, unitCost: 700, quantity: 1 }],
          shippingFee: 250,
          shippingAddress: { fullName: 'Ops Buyer', phone: '0300 5550001', city: 'Lahore', address: 'House 1, Street 1' },
          payment: { method: 'cod', status: 'pending' },
        },
      })
      const shipped = await payload.update({ collection: 'orders', id: order.id, data: { status: 'shipped' }, depth: 0 })
      expect(shipped.fulfilment?.shippedAt).toBeTruthy()
      const delivered = await payload.update({ collection: 'orders', id: order.id, data: { status: 'delivered' }, depth: 0 })
      expect(delivered.fulfilment?.deliveredAt).toBeTruthy()
      expect(delivered.payment).toMatchObject({ status: 'paid' })
      expect(delivered.payment.paidAt).toBeTruthy()
    })

    it('exports filtered orders as CSV; cost columns only for managers and owners', async () => {
      const ownerCsv = await (await call(exportOrders, owner, { query: { where: { status: { equals: 'delivered' } } } })).text()
      const parsed = parseCsv(ownerCsv)
      expect(parsed.rows).toHaveLength(1)
      expect(parsed.rows[0]).toMatchObject({ 'Order number': order.orderNumber, Phone: "'+923005550001", Total: '1900', 'Cost of goods': '700' })

      const staffCsv = parseCsv(await (await call(exportOrders, staff)).text())
      expect(staffCsv.headers).not.toContain('Cost of goods')

      expect((await call(exportOrders, null)).status).toBe(403)

      const logs = await payload.find({
        collection: 'activity-logs',
        where: { and: [{ action: { equals: 'export' } }, { targetCollection: { equals: 'orders' } }] },
      })
      expect(logs.totalDocs).toBe(2)
    })
  })

  describe('customer merge', () => {
    it('moves orders and details from a duplicate profile, then deletes it', async () => {
      const mk = (phone: string, name: string) =>
        payload.create({
          collection: 'orders',
          depth: 0,
          data: {
            status: 'new',
            items: [{ product: simple.id, title: 'Ops Ashtray', unitPrice: 1000, quantity: 1 }],
            shippingAddress: { fullName: name, phone, city: 'Karachi', address: `Address of ${name}` },
            payment: { method: 'cod', status: 'pending' },
          },
        })
      const a = await mk('0311 0000001', 'Sana Iqbal')
      const b = await mk('0322 0000002', 'Sana I.')
      await payload.update({ collection: 'customers', id: b.customer as number, data: { notes: 'Prefers evening delivery' } })

      const res = await call(mergeCustomer, owner, { routeParams: { id: a.customer }, body: { phone: '0322-0000002' } })
      expect(((await res.json()) as { ordersMoved: number }).ordersMoved).toBe(1)

      const merged = await payload.findByID({ collection: 'customers', id: a.customer as number, depth: 0 })
      expect(merged.orderCount).toBe(2)
      expect(merged.addresses).toHaveLength(2)
      expect(merged.notes).toContain('Prefers evening delivery')
      expect((await payload.count({ collection: 'customers', where: { phone: { equals: '+923220000002' } } })).totalDocs).toBe(0)

      expect((await call(mergeCustomer, staff, { routeParams: { id: a.customer }, body: { phone: '0311 0000001' } })).status).toBe(403)
    })
  })
})
