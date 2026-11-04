// @vitest-environment node
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'
import { createLocalReq, getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Order, Product, User } from '@/payload-types'
import { reportsExport } from '@/endpoints/reports'
import { markCartsRecovered, saveCheckoutCart, subscribe, unsubscribe } from '@/lib/marketing/server'
import { buildReport } from '@/lib/reports/build'
import { loadMarketing, loadReportData } from '@/lib/reports/load'
import { parseReportRange } from '@/lib/reports/range'

import { assertTestDatabase } from '../helpers/testDb'

/**
 * Reports must match the saved data (client requirement): dashboard figures are reconciled with
 * raw SQL over the same period. Also covers newsletter sign-up/unsubscribe and cart recovery.
 */
let payload: Payload
let owner: User
let staff: User
let ashtray: Product
let diffuser: Product

const collections = [
  'orders',
  'customers',
  'carts',
  'subscribers',
  'expenses',
  'inventory-adjustments',
  'coupons',
  'products',
  'categories',
  'fragrances',
  'activity-logs',
] as const

const TOKEN_A = '00000000-0000-4000-8000-00000000000a'
const TOKEN_B = '00000000-0000-4000-8000-00000000000b'

async function createOrder(
  phone: string,
  items: { product: Product; variantId?: string; quantity: number; unitCost?: number }[],
  extra: Partial<Pick<Order, 'discount' | 'coupon' | 'payment'>> = {},
) {
  return payload.create({
    collection: 'orders',
    data: {
      items: items.map((i) => ({
        product: i.product.id,
        variantId: i.variantId,
        title: i.product.title,
        unitPrice: i.variantId ? 1450 : 1800,
        unitCost: i.unitCost,
        quantity: i.quantity,
      })),
      shippingFee: 250,
      shippingAddress: { fullName: 'Report Tester', phone, city: 'Lahore', address: 'House 1' },
      payment: { method: 'cod', status: 'pending' },
      ...extra,
    } as Omit<Order, 'id' | 'createdAt' | 'updatedAt'>,
  })
}

async function exportAs(user: User, query: Record<string, string>) {
  const req = await createLocalReq({ user }, payload)
  req.query = query as PayloadRequest['query']
  return reportsExport.handler(req)
}

describe('reports', () => {
  beforeAll(async () => {
    assertTestDatabase()
    payload = await getPayload({ config: await config })
    for (const c of collections) await payload.delete({ collection: c, where: { id: { exists: true } } })
    await payload.delete({ collection: 'users', where: { email: { like: '@reports.test' } } })
    await payload.updateGlobal({ slug: 'store-settings', data: { inventory: { deductStockOn: 'placed', allowBackorders: true } } })

    owner = await payload.create({ collection: 'users', data: { email: 'owner@reports.test', password: 'Passw0rd!x', roles: ['owner'] } })
    staff = await payload.create({ collection: 'users', data: { email: 'staff@reports.test', password: 'Passw0rd!x', roles: ['staff'] } })
    const rose = await payload.create({ collection: 'fragrances', data: { name: 'Report Rose' } })
    const cat = await payload.create({ collection: 'categories', data: { title: 'Report Cat' } })
    ashtray = await payload.create({
      collection: 'products',
      data: { title: 'Report Ashtray', category: cat.id, productType: 'simple', price: 1800, costPrice: 700, stock: 50, status: 'published' },
    })
    diffuser = await payload.create({
      collection: 'products',
      data: {
        title: 'Report Diffuser',
        category: cat.id,
        productType: 'variable',
        price: 1450,
        costPrice: 500,
        status: 'published',
        variants: [{ label: 'Rose', fragrance: rose.id, stock: 50 }],
      },
    })
    const variantId = diffuser.variants![0].id!

    const coupon = await payload.create({ collection: 'coupons', data: { code: 'REPORT10', type: 'percentage', value: 10 } })
    await createOrder('03001110001', [{ product: diffuser, variantId, quantity: 2, unitCost: 500 }], { discount: 290, coupon: coupon.id })
    await createOrder('03001110002', [{ product: ashtray, quantity: 1, unitCost: 700 }], { payment: { method: 'jazzcash', status: 'paid' } })
    await createOrder('03001110002', [{ product: ashtray, quantity: 1 }, { product: diffuser, variantId, quantity: 1, unitCost: 500 }])
    const cancelled = await createOrder('03001110003', [{ product: ashtray, quantity: 3, unitCost: 700 }])
    await payload.update({ collection: 'orders', id: cancelled.id, data: { status: 'cancelled' } })
    const returned = await createOrder('03001110004', [{ product: ashtray, quantity: 1, unitCost: 700 }])
    await payload.update({ collection: 'orders', id: returned.id, data: { status: 'shipped' } })
    await payload.update({ collection: 'orders', id: returned.id, data: { status: 'returned' } })
    await payload.create({ collection: 'expenses', data: { title: 'Ads', amount: 3000, date: new Date().toISOString(), category: 'advertising' } })
  })

  afterAll(async () => {
    for (const c of collections) await payload.delete({ collection: c, where: { id: { exists: true } } })
    await payload.delete({ collection: 'users', where: { email: { like: '@reports.test' } } })
    await payload.updateGlobal({ slug: 'store-settings', data: { inventory: { allowBackorders: false } } })
  })

  it('matches raw SQL for orders, net sales, delivery and cost of goods', async () => {
    const range = parseReportRange({ range: '7d', compare: 'previous' })
    const report = buildReport(await loadReportData(payload, range))
    const db = (payload.db as unknown as PostgresAdapter).drizzle
    const window = sql`o.created_at >= ${range.from.toISOString()} AND o.created_at < ${range.to.toISOString()}`
    const revenue = sql`o.status NOT IN ('cancelled', 'returned', 'refunded')`

    const totals = await db.execute(sql`
      SELECT count(*)::int AS orders,
             coalesce(sum(o.subtotal - o.discount), 0)::int AS net,
             coalesce(sum(o.shipping_fee), 0)::int AS delivery,
             coalesce(sum(o.total), 0)::int AS collected
      FROM orders o WHERE ${window} AND ${revenue}`)
    const cogs = await db.execute(sql`
      SELECT coalesce(sum(i.unit_cost * i.quantity), 0)::int AS cogs, coalesce(sum(i.quantity), 0)::int AS units
      FROM orders_items i JOIN orders o ON o.id = i._parent_id WHERE ${window} AND ${revenue}`)
    const all = await db.execute(sql`SELECT count(*)::int AS placed FROM orders o WHERE ${window}`)

    const row = totals.rows[0] as { orders: number; net: number; delivery: number; collected: number }
    const items = cogs.rows[0] as { cogs: number; units: number }
    const k = report.kpis
    expect(k.revenueOrders).toBe(row.orders)
    expect(k.netSales).toBe(row.net)
    expect(k.deliveryCharges).toBe(row.delivery)
    expect(k.totalCollected).toBe(row.collected)
    expect(k.costOfGoods).toBe(items.cogs)
    expect(k.units).toBe(items.units)
    expect(k.ordersPlaced).toBe((all.rows[0] as { placed: number }).placed)

    // Known values for the seeded orders, so a broken query cannot pass by matching another.
    expect(k).toMatchObject({ revenueOrders: 3, cancelledOrders: 1, returnedOrders: 1, netSales: 2610 + 1800 + 3250, linesMissingCost: 1 })
    expect(k.expenses).toBe(3000)
    expect(k.customers).toBe(2)
    expect(report.series.reduce((s, p) => s + p.netSales, 0)).toBe(k.netSales)
    expect(report.sales.fragrances).toEqual([expect.objectContaining({ label: 'Report Rose', units: 3 })])
    expect(report.coupons).toEqual([expect.objectContaining({ code: 'REPORT10', orders: 1, discount: 290 })])
    expect(report.payments.split.find((r) => r.key === 'prepaid')?.orders).toBe(1)
  })

  it('exports report tables as CSV, keeping finance from staff, and logs it', async () => {
    const res = await exportAs(owner, { table: 'finance', range: '7d' })
    expect(res.status).toBe(200)
    const csv = await res.text()
    expect(csv).toContain('Estimated profit')
    expect(res.headers.get('Content-Disposition')).toMatch(/coco-report-finance-/)

    expect((await exportAs(staff, { table: 'finance', range: '7d' })).status).toBe(403)
    expect((await exportAs(staff, { table: 'products', range: '7d' })).status).toBe(200)
    expect((await exportAs(owner, { table: 'nope' })).status).toBe(400)

    const logs = await payload.find({ collection: 'activity-logs', where: { targetCollection: { equals: 'reports' } } })
    expect(logs.totalDocs).toBe(2)
  })

  describe('marketing', () => {
    it('subscribes once and unsubscribes by token, withdrawing customer email consent', async () => {
      expect(await subscribe(' News@Reports.Test ', 'footer', payload)).toBe(true)
      expect(await subscribe('news@reports.test', 'footer', payload)).toBe(true)
      expect(await subscribe('not-an-email', 'footer', payload)).toBe(false)
      const { docs } = await payload.find({ collection: 'subscribers', where: { email: { equals: 'news@reports.test' } } })
      expect(docs).toHaveLength(1)
      expect(docs[0].consentAt).toBeTruthy()

      const customer = await payload.create({
        collection: 'customers',
        data: { name: 'News Reader', phone: '+923009990001', email: 'news@reports.test', marketing: { emailConsent: true } },
      })
      expect(await unsubscribe(docs[0].unsubscribeToken!)).toBe(true)
      const after = await payload.findByID({ collection: 'subscribers', id: docs[0].id })
      expect(after.status).toBe('unsubscribed')
      expect(after.unsubscribedAt).toBeTruthy()
      expect((await payload.findByID({ collection: 'customers', id: customer.id })).marketing?.emailConsent).toBe(false)
      expect(await unsubscribe('00000000-0000-4000-8000-000000000000')).toBe(false)
    })

    it('captures a checkout as a cart, updates it, and marks it recovered by the order', async () => {
      const lines = [{ productId: ashtray.id, quantity: 2 }]
      expect(await saveCheckoutCart({ token: TOKEN_A, lines })).toBe(false) // no contact details yet
      expect(await saveCheckoutCart({ token: TOKEN_A, phone: '0300 1112233', lines })).toBe(true)
      expect(await saveCheckoutCart({ token: TOKEN_A, phone: '0300 1112233', fullName: 'Sana', lines: [{ productId: ashtray.id, quantity: 3 }] })).toBe(true)
      expect(await saveCheckoutCart({ token: TOKEN_B, email: 'cart@reports.test', lines })).toBe(true)

      const { docs } = await payload.find({ collection: 'carts', where: { token: { equals: TOKEN_A } } })
      expect(docs).toHaveLength(1)
      expect(docs[0]).toMatchObject({ phone: '+923001112233', name: 'Sana', subtotal: 5400, status: 'open' })
      expect(docs[0].items?.[0]).toMatchObject({ title: 'Report Ashtray', quantity: 3, unitPrice: 1800 })

      const order = await createOrder('03001112233', [{ product: ashtray, quantity: 3, unitCost: 700 }])
      await markCartsRecovered({ id: order.id, phone: '+923001112233' }, TOKEN_A, payload)
      const recovered = await payload.findByID({ collection: 'carts', id: docs[0].id, depth: 0 })
      expect(recovered).toMatchObject({ status: 'recovered', order: order.id })
      expect(await saveCheckoutCart({ token: TOKEN_A, phone: '0300 1112233', lines })).toBe(false)

      const stats = await loadMarketing(payload, parseReportRange({ range: 'today' }))
      expect(stats).toMatchObject({ cartsCaptured: 2, cartsRecovered: 1, cartsOpen: 1, abandonedValue: 3600, recoveredValue: order.total })
    })
  })
})
