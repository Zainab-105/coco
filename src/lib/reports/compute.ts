import { NON_REVENUE_STATUSES, ORDER_STATUSES, type OrderStatus, type PaymentMethod } from '@/lib/orderStatus'

import { bucketKey, bucketKeys, type DateRange, type Granularity } from './range'

/**
 * Pure report maths over plain order/product snapshots, so every figure on the dashboard can be
 * unit-tested and reconciled against SQL.
 *
 * Definitions (also shown in the admin):
 * - Gross sales     = item subtotals of every order except cancelled ones
 * - Refunds/returns = item value (after discount) of returned and refunded orders
 * - Net sales       = gross - discounts - refunds  (= item value of revenue orders)
 * - Revenue orders  = everything except cancelled, returned and refunded
 * - Estimated profit = net sales + delivery and gift-wrap charges - cost of goods - expenses
 */
export type ReportOrderItem = {
  productId: number
  variantId?: string | null
  title: string
  variantLabel?: string | null
  quantity: number
  lineTotal: number
  unitCost?: number | null
}

export type ReportOrder = {
  id: number
  createdAt: string
  status: OrderStatus
  subtotal: number
  discount: number
  shippingFee: number
  giftWrapFee: number
  total: number
  paymentMethod: PaymentMethod
  couponId?: number | null
  customerId?: number | null
  /** The customer's first ever (non-cancelled) order, used to tell new from returning buyers. */
  customerFirstOrderAt?: string | null
  city?: string | null
  items: ReportOrderItem[]
}

export type ReportProduct = {
  id: number
  title: string
  status: 'draft' | 'published' | 'archived' | string
  createdAt: string
  categoryTitle?: string | null
  fragranceIds: number[]
  costPrice?: number | null
  stock: number
  lowStockThreshold: number
  variants: { id: string; label: string; fragranceId?: number | null; stock: number; costPrice?: number | null }[]
}

export type ReportExpense = { amount: number; date: string; category?: string | null }

export type ReportLookups = {
  products: ReportProduct[]
  fragranceNames: Map<number, string>
  couponCodes: Map<number, string>
}

const PREPAID: PaymentMethod[] = ['jazzcash', 'easypaisa', 'bank_transfer']
const RETURNED: OrderStatus[] = ['returned', 'refunded']

const isRevenue = (o: ReportOrder) => !NON_REVENUE_STATUSES.includes(o.status)
const itemValue = (o: ReportOrder) => o.subtotal - o.discount
const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0)
const sum = <T>(rows: T[], value: (row: T) => number) => rows.reduce((s, r) => s + value(r), 0)

export type Kpis = {
  ordersPlaced: number
  revenueOrders: number
  cancelledOrders: number
  returnedOrders: number
  units: number
  grossSales: number
  discounts: number
  refunds: number
  netSales: number
  deliveryCharges: number
  giftWrap: number
  /** Net sales + delivery + gift wrap: what customers paid on revenue orders. */
  totalCollected: number
  averageOrderValue: number
  costOfGoods: number
  grossProfit: number
  grossMargin: number
  expenses: number
  estimatedProfit: number
  /** Order lines without a cost snapshot; profit is overstated while this is above zero. */
  linesMissingCost: number
  customers: number
  newCustomers: number
  returningCustomers: number
  repeatRate: number
  cancellationRate: number
  returnRate: number
  deliverySuccessRate: number
}

export function computeKpis(orders: ReportOrder[], expenses: ReportExpense[], range: DateRange): Kpis {
  const sold = orders.filter((o) => o.status !== 'cancelled')
  const revenue = orders.filter(isRevenue)
  const returned = orders.filter((o) => RETURNED.includes(o.status))

  const grossSales = sum(sold, (o) => o.subtotal)
  const discounts = sum(sold, (o) => o.discount)
  const refunds = sum(returned, itemValue)
  const netSales = grossSales - discounts - refunds
  const deliveryCharges = sum(revenue, (o) => o.shippingFee)
  const giftWrap = sum(revenue, (o) => o.giftWrapFee)
  const totalCollected = netSales + deliveryCharges + giftWrap

  let costOfGoods = 0
  let linesMissingCost = 0
  for (const o of revenue) {
    for (const i of o.items) {
      if (i.unitCost == null) linesMissingCost++
      else costOfGoods += i.unitCost * i.quantity
    }
  }
  const expenseTotal = sum(expenses, (e) => e.amount)

  // Customers who bought in the period: returning if they had ordered before it, or ordered twice in it.
  const byCustomer = new Map<number, ReportOrder[]>()
  for (const o of revenue) {
    if (o.customerId == null) continue
    byCustomer.set(o.customerId, [...(byCustomer.get(o.customerId) ?? []), o])
  }
  let returningCustomers = 0
  for (const list of byCustomer.values()) {
    const first = list[0].customerFirstOrderAt
    if (list.length > 1 || (first && new Date(first) < range.from)) returningCustomers++
  }

  const reached = orders.filter((o) => ['shipped', 'delivered', 'returned', 'refunded'].includes(o.status))
  const completed = orders.filter((o) => ['delivered', 'returned', 'refunded'].includes(o.status))

  return {
    ordersPlaced: orders.length,
    revenueOrders: revenue.length,
    cancelledOrders: orders.length - sold.length,
    returnedOrders: returned.length,
    units: sum(revenue, (o) => sum(o.items, (i) => i.quantity)),
    grossSales,
    discounts,
    refunds,
    netSales,
    deliveryCharges,
    giftWrap,
    totalCollected,
    averageOrderValue: revenue.length ? Math.round(totalCollected / revenue.length) : 0,
    costOfGoods,
    grossProfit: netSales - costOfGoods,
    grossMargin: ratio(netSales - costOfGoods, netSales),
    expenses: expenseTotal,
    estimatedProfit: totalCollected - costOfGoods - expenseTotal,
    linesMissingCost,
    customers: byCustomer.size,
    newCustomers: byCustomer.size - returningCustomers,
    returningCustomers,
    repeatRate: ratio(returningCustomers, byCustomer.size),
    cancellationRate: ratio(orders.length - sold.length, orders.length),
    returnRate: ratio(returned.length, reached.length),
    deliverySuccessRate: ratio(orders.filter((o) => o.status === 'delivered').length, completed.length),
  }
}

/** Percentage change, or null when there is nothing to compare with. */
export function change(current: number, previous: number | undefined): number | null {
  if (previous == null || previous === 0) return null
  return (current - previous) / Math.abs(previous)
}

export type SeriesPoint = { key: string; netSales: number; orders: number }

/** Net sales and revenue orders per day/week/month/year, including empty buckets. */
export function timeSeries(orders: ReportOrder[], range: DateRange, granularity: Granularity): SeriesPoint[] {
  const points = new Map(bucketKeys(range, granularity).map((key) => [key, { key, netSales: 0, orders: 0 }]))
  for (const o of orders) {
    if (!isRevenue(o)) continue
    const point = points.get(bucketKey(new Date(o.createdAt), granularity))
    if (!point) continue
    point.netSales += itemValue(o)
    point.orders++
  }
  return [...points.values()]
}

export type StatusCount = { status: OrderStatus; count: number; value: number }

export function statusFunnel(orders: ReportOrder[]): StatusCount[] {
  return ORDER_STATUSES.map((status) => {
    const rows = orders.filter((o) => o.status === status)
    return { status, count: rows.length, value: sum(rows, (o) => o.total) }
  })
}

export type SalesRow = { key: string; label: string; orders: number; units: number; netSales: number; costOfGoods: number; share: number }

/**
 * Item sales grouped by `keyOf`. Discounts are spread over an order's lines in proportion to
 * their value, so grouped net sales add up to the overall net sales.
 */
function groupSales(
  orders: ReportOrder[],
  keyOf: (item: ReportOrderItem) => { key: string; label: string } | null,
): SalesRow[] {
  const rows = new Map<string, SalesRow & { orderIds: Set<number> }>()
  let total = 0
  for (const o of orders) {
    if (!isRevenue(o)) continue
    const factor = o.subtotal > 0 ? (o.subtotal - o.discount) / o.subtotal : 0
    for (const item of o.items) {
      const group = keyOf(item)
      if (!group) continue
      const row =
        rows.get(group.key) ??
        { ...group, orders: 0, units: 0, netSales: 0, costOfGoods: 0, share: 0, orderIds: new Set<number>() }
      const net = item.lineTotal * factor
      row.orderIds.add(o.id)
      row.units += item.quantity
      row.netSales += net
      row.costOfGoods += (item.unitCost ?? 0) * item.quantity
      rows.set(group.key, row)
      total += net
    }
  }
  return [...rows.values()]
    .map(({ orderIds, ...row }) => ({ ...row, orders: orderIds.size, netSales: Math.round(row.netSales), share: ratio(row.netSales, total) }))
    .sort((a, b) => b.netSales - a.netSales || b.units - a.units)
}

export type SalesBreakdown = { products: SalesRow[]; variants: SalesRow[]; categories: SalesRow[]; fragrances: SalesRow[] }

export function salesBreakdown(orders: ReportOrder[], lookups: ReportLookups): SalesBreakdown {
  const products = new Map(lookups.products.map((p) => [p.id, p]))

  const fragranceOf = (item: ReportOrderItem): number | undefined => {
    const product = products.get(item.productId)
    if (!product) return undefined
    const variant = item.variantId ? product.variants.find((v) => v.id === item.variantId) : undefined
    if (variant?.fragranceId) return variant.fragranceId
    // Single-scent products only; gift sets with several scents are not attributed.
    return product.fragranceIds.length === 1 ? product.fragranceIds[0] : undefined
  }

  return {
    products: groupSales(orders, (i) => ({ key: String(i.productId), label: products.get(i.productId)?.title ?? i.title })),
    variants: groupSales(orders, (i) => ({
      key: `${i.productId}:${i.variantId ?? ''}`,
      label: `${products.get(i.productId)?.title ?? i.title}${i.variantLabel ? ` – ${i.variantLabel}` : ''}`,
    })),
    categories: groupSales(orders, (i) => {
      const label = products.get(i.productId)?.categoryTitle ?? 'Uncategorised'
      return { key: label, label }
    }),
    fragrances: groupSales(orders, (i) => {
      const id = fragranceOf(i)
      return id ? { key: String(id), label: lookups.fragranceNames.get(id) ?? `Fragrance ${id}` } : null
    }),
  }
}

export type SlowSeller = { id: number; title: string; units: number; stock: number }

/**
 * Published products with the fewest units sold in the period (zero first). Products added
 * during the period are left out: they have not had a fair chance to sell.
 */
export function slowSellers(orders: ReportOrder[], products: ReportProduct[], range: DateRange, limit = 10): SlowSeller[] {
  const units = new Map<number, number>()
  for (const o of orders) {
    if (!isRevenue(o)) continue
    for (const i of o.items) units.set(i.productId, (units.get(i.productId) ?? 0) + i.quantity)
  }
  return products
    .filter((p) => p.status === 'published' && new Date(p.createdAt) < range.from)
    .map((p) => ({ id: p.id, title: p.title, units: units.get(p.id) ?? 0, stock: totalStock(p) }))
    .sort((a, b) => a.units - b.units || b.stock - a.stock)
    .slice(0, limit)
}

export type PaymentRow = { key: 'cod' | 'prepaid' | PaymentMethod; orders: number; netSales: number; share: number; cancelled: number }

/** Cash on Delivery vs prepaid, plus each method. `cancelled` helps judge fake COD orders. */
export function paymentMix(orders: ReportOrder[]): { split: PaymentRow[]; methods: PaymentRow[] } {
  const revenue = orders.filter(isRevenue)
  const build = (key: PaymentRow['key'], match: (o: ReportOrder) => boolean): PaymentRow => {
    const rows = revenue.filter(match)
    return {
      key,
      orders: rows.length,
      netSales: sum(rows, itemValue),
      share: ratio(rows.length, revenue.length),
      cancelled: orders.filter((o) => o.status === 'cancelled' && match(o)).length,
    }
  }
  const methods = (['cod', 'jazzcash', 'easypaisa', 'bank_transfer'] as const)
    .map((m) => build(m, (o) => o.paymentMethod === m))
    .filter((r) => r.orders || r.cancelled)
  return {
    split: [build('cod', (o) => o.paymentMethod === 'cod'), build('prepaid', (o) => PREPAID.includes(o.paymentMethod))],
    methods,
  }
}

export type CouponRow = { couponId: number; code: string; orders: number; discount: number; netSales: number; averageOrderValue: number }

export function couponPerformance(orders: ReportOrder[], couponCodes: Map<number, string>): CouponRow[] {
  const rows = new Map<number, CouponRow & { collected: number }>()
  for (const o of orders) {
    if (!isRevenue(o) || o.couponId == null) continue
    const row = rows.get(o.couponId) ?? {
      couponId: o.couponId,
      code: couponCodes.get(o.couponId) ?? `#${o.couponId}`,
      orders: 0,
      discount: 0,
      netSales: 0,
      averageOrderValue: 0,
      collected: 0,
    }
    row.orders++
    row.discount += o.discount
    row.netSales += itemValue(o)
    row.collected += o.total
    rows.set(o.couponId, row)
  }
  return [...rows.values()]
    .map(({ collected, ...r }) => ({ ...r, averageOrderValue: Math.round(collected / r.orders) }))
    .sort((a, b) => b.netSales - a.netSales)
}

export type CityRow = { city: string; orders: number; netSales: number }

export function topCities(orders: ReportOrder[], limit = 10): CityRow[] {
  const rows = new Map<string, CityRow>()
  for (const o of orders) {
    if (!isRevenue(o)) continue
    const city = (o.city ?? '').trim().replace(/\s+/g, ' ')
    const key = city.toLowerCase() || 'unknown'
    const row = rows.get(key) ?? { city: city || 'Unknown', orders: 0, netSales: 0 }
    row.orders++
    row.netSales += itemValue(o)
    rows.set(key, row)
  }
  return [...rows.values()].sort((a, b) => b.netSales - a.netSales).slice(0, limit)
}

const totalStock = (p: ReportProduct) => (p.variants.length ? sum(p.variants, (v) => Math.max(0, v.stock)) : Math.max(0, p.stock))

export type InventoryRow = {
  id: number
  title: string
  stock: number
  stockValue: number
  unitsSold: number
  /** Days the current stock lasts at the period's sales rate; null when nothing sold. */
  daysOfCover: number | null
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
  missingCost: boolean
  /** Published before the period began, so its sales in the period are a fair signal. */
  established: boolean
}

export type InventorySummary = {
  rows: InventoryRow[]
  units: number
  stockValue: number
  lowStock: number
  outOfStock: number
  missingCost: number
}

/** Current stock (not historical) valued at cost, with days of cover from the period's sales. */
export function inventoryReport(orders: ReportOrder[], products: ReportProduct[], range: DateRange): InventorySummary {
  const days = Math.max(1, (range.to.getTime() - range.from.getTime()) / 86_400_000)
  const sold = new Map<number, number>()
  for (const o of orders) {
    if (!isRevenue(o)) continue
    for (const i of o.items) sold.set(i.productId, (sold.get(i.productId) ?? 0) + i.quantity)
  }

  const rows = products
    .filter((p) => p.status !== 'archived')
    .map((p): InventoryRow => {
      const stock = totalStock(p)
      let missingCost = false
      const stockValue = p.variants.length
        ? sum(p.variants, (v) => {
            const cost = v.costPrice ?? p.costPrice
            if (cost == null && v.stock > 0) missingCost = true
            return Math.max(0, v.stock) * (cost ?? 0)
          })
        : stock * (p.costPrice ?? 0)
      if (!p.variants.length && p.costPrice == null && stock > 0) missingCost = true
      const lowest = p.variants.length ? Math.min(...p.variants.map((v) => v.stock)) : stock
      const unitsSold = sold.get(p.id) ?? 0
      return {
        id: p.id,
        title: p.title,
        stock,
        stockValue,
        unitsSold,
        daysOfCover: unitsSold ? Math.round(stock / (unitsSold / days)) : null,
        status: lowest <= 0 ? 'out_of_stock' : lowest <= p.lowStockThreshold ? 'low_stock' : 'in_stock',
        missingCost,
        established: p.status === 'published' && new Date(p.createdAt) < range.from,
      }
    })
    .sort((a, b) => (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity) || a.stock - b.stock)

  return {
    rows,
    units: sum(rows, (r) => r.stock),
    stockValue: sum(rows, (r) => r.stockValue),
    lowStock: rows.filter((r) => r.status === 'low_stock').length,
    outOfStock: rows.filter((r) => r.status === 'out_of_stock').length,
    missingCost: rows.filter((r) => r.missingCost).length,
  }
}

export const RESTOCK_WITHIN_DAYS = 14
export const PROMOTE_OVER_DAYS = 60

/**
 * Suggestions from stock and the period's sales. Restock: selling, and low, or running out within
 * two weeks. Promote: plenty of stock that sold nothing, or would take over two months to sell.
 */
export function stockInsights(rows: InventoryRow[]) {
  const restock = rows
    .filter((r) => r.unitsSold > 0 && (r.status !== 'in_stock' || (r.daysOfCover ?? Infinity) <= RESTOCK_WITHIN_DAYS))
    .sort((a, b) => (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity))
  const promote = rows
    .filter((r) => r.established && r.stock > 0 && r.status === 'in_stock' && (r.daysOfCover === null || r.daysOfCover >= PROMOTE_OVER_DAYS))
    .sort((a, b) => (b.daysOfCover ?? Infinity) - (a.daysOfCover ?? Infinity) || b.stock - a.stock)
  return { restock, promote }
}

export type ExpenseRow = { category: string; amount: number }

export function expensesByCategory(expenses: ReportExpense[]): ExpenseRow[] {
  const rows = new Map<string, number>()
  for (const e of expenses) rows.set(e.category ?? 'other', (rows.get(e.category ?? 'other') ?? 0) + e.amount)
  return [...rows.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount)
}
