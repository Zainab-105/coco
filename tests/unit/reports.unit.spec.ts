import { describe, expect, it } from 'vitest'

import { buildReport, reportTables } from '@/lib/reports/build'
import {
  change,
  computeKpis,
  couponPerformance,
  inventoryReport,
  paymentMix,
  restockReason,
  salesBreakdown,
  slowSellers,
  statusFunnel,
  stockInsights,
  stockLabel,
  timeSeries,
  type InventoryRow,
  type ReportLookups,
  type ReportOrder,
  type ReportProduct,
} from '@/lib/reports/compute'
import { bucketKey, bucketKeys, parseReportRange, pktDay, pktMidnight, rangeQuery } from '@/lib/reports/range'

// 2026-11-02 10:00 in Pakistan (05:00 UTC).
const NOW = new Date('2026-11-02T05:00:00.000Z')

describe('report ranges (Pakistan time)', () => {
  it('uses the PKT calendar day, not UTC', () => {
    // 21:30 UTC on 1 Nov is already 2 Nov in Pakistan.
    expect(pktDay(new Date('2026-11-01T21:30:00Z'))).toBe('2026-11-02')
    expect(pktMidnight('2026-11-02').toISOString()).toBe('2026-11-01T19:00:00.000Z')
  })

  it('builds presets ending today, with an exclusive end', () => {
    const r = parseReportRange({ range: '7d' }, NOW)
    expect(pktDay(r.from)).toBe('2026-10-27')
    expect(r.to.toISOString()).toBe('2026-11-02T19:00:00.000Z')
    expect(r.label).toBe('Last 7 days')
    expect(r.granularity).toBe('day')
  })

  it('handles this month, last month and this year', () => {
    expect(pktDay(parseReportRange({ range: 'mtd' }, NOW).from)).toBe('2026-11-01')
    const last = parseReportRange({ range: 'last_month' }, NOW)
    expect([pktDay(last.from), pktDay(new Date(last.to.getTime() - 1))]).toEqual(['2026-10-01', '2026-10-31'])
    const ytd = parseReportRange({ range: 'ytd' }, NOW)
    expect(pktDay(ytd.from)).toBe('2026-01-01')
    expect(ytd.granularity).toBe('week')
  })

  it('compares with the previous period of equal length, or last year', () => {
    const r = parseReportRange({ range: '30d', compare: 'previous' }, NOW)
    expect(r.previous!.to).toEqual(r.from)
    expect(r.previous!.to.getTime() - r.previous!.from.getTime()).toBe(r.to.getTime() - r.from.getTime())
    const y = parseReportRange({ range: '30d', compare: 'year' }, NOW)
    expect(pktDay(y.previous!.from)).toBe('2025-10-04')
    expect(parseReportRange({ range: '30d', compare: 'none' }, NOW).previous).toBeUndefined()
  })

  it('accepts custom ranges (inclusive, any order) and rejects junk', () => {
    const r = parseReportRange({ range: 'custom', from: '2026-10-10', to: '2026-10-01' }, NOW)
    expect([pktDay(r.from), pktDay(new Date(r.to.getTime() - 1))]).toEqual(['2026-10-01', '2026-10-10'])
    expect(rangeQuery(r)).toBe('range=custom&compare=previous&from=2026-10-01&to=2026-10-10')
    expect(parseReportRange({ range: 'custom', from: 'x', to: '2026-10-01' }, NOW).preset).toBe('30d')
    expect(parseReportRange({ range: 'forever', compare: 'bogus' }, NOW)).toMatchObject({ preset: '30d', compare: 'previous' })
  })

  it('buckets by day, Monday weeks and months, including empty buckets', () => {
    expect(bucketKey(new Date('2026-11-04T10:00:00Z'), 'week')).toBe('2026-11-02')
    expect(bucketKey(new Date('2026-11-04T10:00:00Z'), 'month')).toBe('2026-11-01')
    const r = parseReportRange({ range: '7d' }, NOW)
    expect(bucketKeys(r, 'day')).toHaveLength(7)
    expect(bucketKeys(parseReportRange({ range: 'ytd' }, NOW), 'month')).toHaveLength(11)
  })

  it('groups by year, and keeps the chosen grouping in links', () => {
    expect(bucketKey(new Date('2026-11-04T10:00:00Z'), 'year')).toBe('2026-01-01')
    const r = parseReportRange({ range: 'custom', from: '2024-06-01', to: '2026-02-01', group: 'year' }, NOW)
    expect(r.granularity).toBe('year')
    expect(bucketKeys(r, 'year')).toEqual(['2024-01-01', '2025-01-01', '2026-01-01'])
    expect(rangeQuery(r)).toContain('group=year')
  })

  it('ignores an unknown grouping and picks one from the range', () => {
    const r = parseReportRange({ range: '30d', group: 'decade' }, NOW)
    expect(r.group).toBeUndefined()
    expect(r.granularity).toBe('day')
    expect(rangeQuery(r)).not.toContain('group')
  })

  it('covers the whole of last year', () => {
    const r = parseReportRange({ range: 'last_year' }, NOW)
    expect(pktDay(r.from)).toBe('2025-01-01')
    expect(pktDay(new Date(r.to.getTime() - 1))).toBe('2025-12-31')
  })
})

describe('stock suggestions', () => {
  const row = (over: Partial<InventoryRow>): InventoryRow => ({
    id: 1,
    title: 'A',
    stock: 50,
    stockValue: 0,
    unitsSold: 10,
    daysOfCover: 30,
    status: 'in_stock',
    lowOptions: [],
    missingCost: false,
    established: true,
    ...over,
  })

  it('suggests restocking what sells and is running out, soonest first', () => {
    const { restock } = stockInsights([
      row({ id: 1, daysOfCover: 30 }),
      row({ id: 2, daysOfCover: 14 }),
      row({ id: 3, daysOfCover: 3 }),
      row({ id: 4, daysOfCover: 40, status: 'low_stock' }),
      row({ id: 5, unitsSold: 0, daysOfCover: null, status: 'out_of_stock', stock: 0 }),
    ])
    expect(restock.map((r) => r.id)).toEqual([3, 2, 4])
  })

  it('lists a sold-out option first, and says which one', () => {
    const gone = row({ id: 2, stock: 147, daysOfCover: 900, status: 'out_of_stock', lowOptions: [{ label: 'Forest Pine', stock: 0 }] })
    const { restock } = stockInsights([row({ id: 1, daysOfCover: 3 }), gone])
    expect(restock.map((r) => r.id)).toEqual([2, 1])
    expect(restockReason(gone)).toBe('Forest Pine (0 left)')
    expect(restockReason(row({ daysOfCover: 3 }))).toBe('About 3 days of stock left')
  })

  it('does not call a product out of stock when only one option is', () => {
    expect(stockLabel({ status: 'out_of_stock', stock: 147, lowOptions: [{ label: 'Forest Pine', stock: 0 }] })).toBe('Option sold out')
    expect(stockLabel({ status: 'out_of_stock', stock: 0, lowOptions: [] })).toBe('Out of stock')
    expect(stockLabel({ status: 'low_stock', stock: 2, lowOptions: [] })).toBe('Low stock')
  })

  it('suggests promoting established stock that is not moving, unsold first', () => {
    const { promote } = stockInsights([
      row({ id: 1, daysOfCover: 30 }),
      row({ id: 2, daysOfCover: 60 }),
      row({ id: 3, unitsSold: 0, daysOfCover: null }),
      row({ id: 4, unitsSold: 0, daysOfCover: null, established: false }),
      row({ id: 5, unitsSold: 0, daysOfCover: null, stock: 0, status: 'out_of_stock' }),
    ])
    expect(promote.map((r) => r.id)).toEqual([3, 2])
  })
})

const range = parseReportRange({ range: 'custom', from: '2026-10-01', to: '2026-10-31' }, NOW)
const at = (day: string) => `${day}T07:00:00.000Z`

let nextId = 1
function order(partial: Partial<ReportOrder> & { items: ReportOrder['items'] }): ReportOrder {
  const subtotal = partial.items.reduce((s, i) => s + i.lineTotal, 0)
  const discount = partial.discount ?? 0
  const shippingFee = partial.shippingFee ?? 250
  const giftWrapFee = partial.giftWrapFee ?? 0
  return {
    id: nextId++,
    createdAt: at('2026-10-05'),
    status: 'delivered',
    paymentMethod: 'cod',
    subtotal,
    discount,
    shippingFee,
    giftWrapFee,
    total: subtotal - discount + shippingFee + giftWrapFee,
    ...partial,
  }
}
const line = (productId: number, quantity: number, unitPrice: number, unitCost: number | null = 500, variantId?: string) => ({
  productId,
  variantId,
  title: `P${productId}`,
  quantity,
  lineTotal: quantity * unitPrice,
  unitCost,
})

const products: ReportProduct[] = [
  {
    id: 1,
    title: 'Hanging Diffuser',
    status: 'published',
    createdAt: '2026-01-01T00:00:00Z',
    categoryTitle: 'Car Scents',
    fragranceIds: [],
    costPrice: 500,
    stock: 0,
    lowStockThreshold: 5,
    variants: [
      { id: 'rose', label: 'Sweet Rose', fragranceId: 10, stock: 3, costPrice: 500 },
      { id: 'ice', label: 'Cool Ice', fragranceId: 11, stock: 20, costPrice: null },
    ],
  },
  { id: 2, title: 'Ashtray', status: 'published', createdAt: '2026-01-01T00:00:00Z', categoryTitle: 'Accessories', fragranceIds: [], costPrice: 700, stock: 10, lowStockThreshold: 5, variants: [] },
  { id: 3, title: 'Room Diffuser Oud', status: 'published', createdAt: '2026-01-01T00:00:00Z', categoryTitle: 'Home Scents', fragranceIds: [12], costPrice: null, stock: 0, lowStockThreshold: 5, variants: [] },
  { id: 4, title: 'New Gift Set', status: 'published', createdAt: '2026-10-20T00:00:00Z', categoryTitle: 'Gift Sets', fragranceIds: [10, 11], costPrice: 2000, stock: 4, lowStockThreshold: 5, variants: [] },
]
const lookups: ReportLookups = {
  products,
  fragranceNames: new Map([
    [10, 'Sweet Rose'],
    [11, 'Cool Ice'],
    [12, 'Vanilla Oud'],
  ]),
  couponCodes: new Map([[7, 'WELCOME10']]),
}

const orders: ReportOrder[] = [
  // Returning customer 1 (ordered before the period); 10% coupon.
  order({ customerId: 1, customerFirstOrderAt: '2026-08-01T00:00:00Z', couponId: 7, discount: 290, items: [line(1, 2, 1450, 500, 'rose')] }),
  // New customer 2, two orders in the period -> counts as returning; prepaid.
  order({ customerId: 2, customerFirstOrderAt: at('2026-10-06'), createdAt: at('2026-10-06'), status: 'shipped', paymentMethod: 'jazzcash', items: [line(2, 1, 1800, 700)] }),
  order({ customerId: 2, customerFirstOrderAt: at('2026-10-06'), createdAt: at('2026-10-20'), status: 'new', giftWrapFee: 150, items: [line(3, 1, 2200, null)] }),
  // New customer 3.
  order({ customerId: 3, customerFirstOrderAt: at('2026-10-07'), createdAt: at('2026-10-07'), items: [line(1, 1, 1450, 500, 'ice')] }),
  // Cancelled: no sales at all.
  order({ customerId: 4, createdAt: at('2026-10-08'), status: 'cancelled', items: [line(2, 3, 1800, 700)] }),
  // Returned: counted in gross, reversed as a refund.
  order({ customerId: 5, createdAt: at('2026-10-09'), status: 'returned', items: [line(2, 1, 1800, 700)] }),
]

describe('KPIs', () => {
  const k = computeKpis(orders, [{ amount: 1000, date: at('2026-10-10'), category: 'advertising' }], range)

  it('derives gross, refunds and net sales without double counting', () => {
    expect(k.grossSales).toBe(2900 + 1800 + 2200 + 1450 + 1800)
    expect(k.discounts).toBe(290)
    expect(k.refunds).toBe(1800)
    expect(k.netSales).toBe(2900 - 290 + 1800 + 2200 + 1450)
    expect(k.netSales).toBe(k.grossSales - k.discounts - k.refunds)
  })

  it('counts orders, units, delivery and AOV over revenue orders only', () => {
    expect(k).toMatchObject({ ordersPlaced: 6, revenueOrders: 4, cancelledOrders: 1, returnedOrders: 1, units: 5 })
    expect(k.deliveryCharges).toBe(1000)
    expect(k.giftWrap).toBe(150)
    expect(k.totalCollected).toBe(k.netSales + 1000 + 150)
    expect(k.averageOrderValue).toBe(Math.round(k.totalCollected / 4))
  })

  it('computes cost of goods and estimated profit, flagging lines without cost', () => {
    expect(k.costOfGoods).toBe(2 * 500 + 700 + 500)
    expect(k.linesMissingCost).toBe(1)
    expect(k.grossProfit).toBe(k.netSales - k.costOfGoods)
    expect(k.expenses).toBe(1000)
    expect(k.estimatedProfit).toBe(k.totalCollected - k.costOfGoods - 1000)
  })

  it('splits new and returning customers', () => {
    expect(k).toMatchObject({ customers: 3, returningCustomers: 2, newCustomers: 1 })
    expect(k.repeatRate).toBeCloseTo(2 / 3)
  })

  it('computes cancellation, return and delivery rates', () => {
    expect(k.cancellationRate).toBeCloseTo(1 / 6)
    expect(k.returnRate).toBeCloseTo(1 / 4) // 1 returned of 4 shipped/delivered/returned
    expect(k.deliverySuccessRate).toBeCloseTo(2 / 3) // 2 delivered of 3 completed
  })

  it('reports percentage change, or null without a base', () => {
    expect(change(150, 100)).toBeCloseTo(0.5)
    expect(change(5, 0)).toBeNull()
    expect(change(5, undefined)).toBeNull()
  })
})

describe('breakdowns', () => {
  it('fills empty days and sums net sales per day', () => {
    const series = timeSeries(orders, range, 'day')
    expect(series).toHaveLength(31)
    expect(series.reduce((s, p) => s + p.netSales, 0)).toBe(computeKpis(orders, [], range).netSales)
    expect(series.find((p) => p.key === '2026-10-08')).toEqual({ key: '2026-10-08', netSales: 0, orders: 0 })
  })

  it('counts every status in the funnel', () => {
    const funnel = statusFunnel(orders)
    expect(funnel.reduce((s, f) => s + f.count, 0)).toBe(orders.length)
    expect(funnel.find((f) => f.status === 'delivered')?.count).toBe(2)
  })

  it('groups sales by product, category and fragrance, spreading discounts', () => {
    const sales = salesBreakdown(orders, lookups)
    const net = computeKpis(orders, [], range).netSales
    expect(sales.products.reduce((s, r) => s + r.netSales, 0)).toBe(net)
    expect(sales.categories.reduce((s, r) => s + r.netSales, 0)).toBe(net)
    expect(sales.products[0]).toMatchObject({ label: 'Hanging Diffuser', units: 3, orders: 2, netSales: 2610 + 1450 })
    expect(sales.fragrances.map((f) => f.label).sort()).toEqual(['Cool Ice', 'Sweet Rose', 'Vanilla Oud'])
    expect(sales.categories.find((c) => c.label === 'Accessories')?.units).toBe(1)
  })

  it('lists slow sellers, skipping products added during the period', () => {
    const slow = slowSellers(orders, products, range)
    expect(slow.map((s) => s.title)).not.toContain('New Gift Set')
    expect(slow[0]).toMatchObject({ units: 1 })
  })

  it('splits Cash on Delivery and prepaid', () => {
    const { split, methods } = paymentMix(orders)
    expect(split).toEqual([
      expect.objectContaining({ key: 'cod', orders: 3, cancelled: 1 }),
      expect.objectContaining({ key: 'prepaid', orders: 1, netSales: 1800 }),
    ])
    expect(methods.map((m) => m.key)).toEqual(['cod', 'jazzcash'])
  })

  it('reports coupon performance', () => {
    expect(couponPerformance(orders, lookups.couponCodes)).toEqual([
      { couponId: 7, code: 'WELCOME10', orders: 1, discount: 290, netSales: 2610, averageOrderValue: 2860 },
    ])
  })

  it('values stock at cost and estimates days of cover', () => {
    const inv = inventoryReport(orders, products, range)
    const diffuser = inv.rows.find((r) => r.id === 1)!
    // The Cool Ice variant has no own cost, so the product cost applies (as at checkout).
    expect(diffuser).toMatchObject({ stock: 23, stockValue: 23 * 500, status: 'low_stock', missingCost: false, unitsSold: 3 })
    const noCost = inventoryReport([], [{ ...products[2], stock: 4 }], range).rows[0]
    expect(noCost).toMatchObject({ stockValue: 0, missingCost: true })
    expect(diffuser.daysOfCover).toBe(Math.round(23 / (3 / 31)))
    expect(inv.rows.find((r) => r.id === 3)).toMatchObject({ status: 'out_of_stock', daysOfCover: 0 })
    expect(inv).toMatchObject({ outOfStock: 1, lowStock: 2 })
  })
})

describe('report tables', () => {
  it('builds every table from one report', () => {
    const report = buildReport({ range, orders, expenses: [], lookups })
    const tables = reportTables(report)
    expect(tables.finance.rows.find((r) => r.label === 'Net sales')?.value).toBe(report.kpis.netSales)
    expect(tables.finance.managerOnly).toBe(true)
    expect(tables.products.columns.map((c) => c.header)).not.toContain('Cost of goods')
    expect(tables.productProfit.columns.map((c) => c.header)).toContain('Gross profit')
  })
})
