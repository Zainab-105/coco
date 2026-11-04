import type { Payload } from 'payload'

import type { Order } from '@/payload-types'
import { NON_REVENUE_STATUSES } from '@/lib/orderStatus'

import type { ReportExpense, ReportLookups, ReportOrder, ReportProduct } from './compute'
import type { DateRange, ReportRange } from './range'

const relId = (value: unknown): number | null =>
  value && typeof value === 'object' && 'id' in value ? (value as { id: number }).id : ((value as number | null | undefined) ?? null)

/** Orders created in [from, to), as report snapshots. Admin-only callers: access is bypassed. */
export async function loadOrders(payload: Payload, range: DateRange): Promise<ReportOrder[]> {
  const { docs } = await payload.find({
    collection: 'orders',
    where: {
      and: [{ createdAt: { greater_than_equal: range.from.toISOString() } }, { createdAt: { less_than: range.to.toISOString() } }],
    },
    sort: 'createdAt',
    pagination: false,
    depth: 0,
    overrideAccess: true,
    select: {
      createdAt: true,
      status: true,
      subtotal: true,
      discount: true,
      shippingFee: true,
      total: true,
      gift: true,
      payment: { method: true },
      coupon: true,
      customer: true,
      shippingAddress: { city: true },
      items: true,
    },
  })
  const orders = docs as Order[]

  const customerIds = [...new Set(orders.map((o) => relId(o.customer)).filter((id): id is number => id != null))]
  const firstOrders = new Map<number, string | null>()
  if (customerIds.length) {
    const { docs: customers } = await payload.find({
      collection: 'customers',
      where: { id: { in: customerIds } },
      pagination: false,
      depth: 0,
      overrideAccess: true,
      select: { firstOrderAt: true },
    })
    for (const c of customers) firstOrders.set(c.id, c.firstOrderAt ?? null)
  }

  return orders.map((o) => {
    const customerId = relId(o.customer)
    return {
      id: o.id,
      createdAt: o.createdAt,
      status: o.status,
      subtotal: o.subtotal ?? 0,
      discount: o.discount ?? 0,
      shippingFee: o.shippingFee ?? 0,
      giftWrapFee: o.gift?.wrap ? (o.gift.wrapFee ?? 0) : 0,
      total: o.total ?? 0,
      paymentMethod: o.payment.method,
      couponId: relId(o.coupon),
      customerId,
      customerFirstOrderAt: customerId != null ? firstOrders.get(customerId) : null,
      city: o.shippingAddress?.city,
      items: (o.items ?? []).map((i) => ({
        productId: relId(i.product) ?? 0,
        variantId: i.variantId,
        title: i.title,
        variantLabel: i.variantLabel,
        quantity: i.quantity ?? 0,
        lineTotal: i.lineTotal ?? (i.unitPrice ?? 0) * (i.quantity ?? 0),
        unitCost: i.unitCost,
      })),
    }
  })
}

export async function loadExpenses(payload: Payload, range: DateRange): Promise<ReportExpense[]> {
  const { docs } = await payload.find({
    collection: 'expenses',
    where: { and: [{ date: { greater_than_equal: range.from.toISOString() } }, { date: { less_than: range.to.toISOString() } }] },
    pagination: false,
    depth: 0,
    overrideAccess: true,
    select: { amount: true, date: true, category: true },
  })
  return docs.map((e) => ({ amount: e.amount ?? 0, date: e.date, category: e.category }))
}

export async function loadLookups(payload: Payload): Promise<ReportLookups> {
  const [products, categories, fragrances, coupons] = await Promise.all([
    payload.find({
      collection: 'products',
      pagination: false,
      depth: 0,
      overrideAccess: true,
      select: {
        title: true,
        status: true,
        createdAt: true,
        category: true,
        fragrances: true,
        costPrice: true,
        stock: true,
        lowStockThreshold: true,
        productType: true,
        variants: true,
      },
    }),
    payload.find({ collection: 'categories', pagination: false, depth: 0, overrideAccess: true, select: { title: true } }),
    payload.find({ collection: 'fragrances', pagination: false, depth: 0, overrideAccess: true, select: { name: true } }),
    payload.find({ collection: 'coupons', pagination: false, depth: 0, overrideAccess: true, select: { code: true } }),
  ])
  const categoryTitles = new Map(categories.docs.map((c) => [c.id, c.title]))

  return {
    products: products.docs.map(
      (p): ReportProduct => ({
        id: p.id,
        title: p.title,
        status: p.status ?? 'draft',
        createdAt: p.createdAt,
        categoryTitle: categoryTitles.get(relId(p.category) ?? -1) ?? null,
        fragranceIds: (p.fragrances ?? []).map(relId).filter((id): id is number => id != null),
        costPrice: p.costPrice,
        stock: p.stock ?? 0,
        lowStockThreshold: p.lowStockThreshold ?? 5,
        variants:
          p.productType === 'variable'
            ? (p.variants ?? []).map((v) => ({
                id: v.id ?? '',
                label: v.label,
                fragranceId: relId(v.fragrance),
                stock: v.stock ?? 0,
                costPrice: v.costPrice,
              }))
            : [],
      }),
    ),
    fragranceNames: new Map(fragrances.docs.map((f) => [f.id, f.name])),
    couponCodes: new Map(coupons.docs.map((c) => [c.id, c.code])),
  }
}

export type MarketingStats = {
  newSubscribers: number
  unsubscribed: number
  activeSubscribers: number
  cartsCaptured: number
  cartsRecovered: number
  cartsOpen: number
  abandonedValue: number
  recoveredValue: number
  recoveryRate: number
}

/** Newsletter and abandoned-cart figures for the period (carts by when they were started). */
export async function loadMarketing(payload: Payload, range: DateRange): Promise<MarketingStats> {
  const between = (field: string) => ({
    and: [{ [field]: { greater_than_equal: range.from.toISOString() } }, { [field]: { less_than: range.to.toISOString() } }],
  })
  const [newSubscribers, unsubscribed, activeSubscribers, carts] = await Promise.all([
    payload.count({ collection: 'subscribers', where: { and: [between('consentAt'), { status: { equals: 'subscribed' } }] }, overrideAccess: true }),
    payload.count({ collection: 'subscribers', where: between('unsubscribedAt'), overrideAccess: true }),
    payload.count({ collection: 'subscribers', where: { status: { equals: 'subscribed' } }, overrideAccess: true }),
    payload.find({
      collection: 'carts',
      where: between('createdAt'),
      pagination: false,
      depth: 1,
      overrideAccess: true,
      select: { status: true, subtotal: true, order: true },
      populate: { orders: { total: true, status: true } },
    }),
  ])
  const recovered = carts.docs.filter((c) => c.status === 'recovered')
  const open = carts.docs.filter((c) => c.status !== 'recovered')
  const recoveredValue = recovered.reduce((s, c) => {
    const order = c.order && typeof c.order === 'object' ? c.order : null
    return s + (order && !NON_REVENUE_STATUSES.includes(order.status) ? (order.total ?? 0) : 0)
  }, 0)

  return {
    newSubscribers: newSubscribers.totalDocs,
    unsubscribed: unsubscribed.totalDocs,
    activeSubscribers: activeSubscribers.totalDocs,
    cartsCaptured: carts.docs.length,
    cartsRecovered: recovered.length,
    cartsOpen: open.length,
    abandonedValue: open.reduce((s, c) => s + (c.subtotal ?? 0), 0),
    recoveredValue,
    recoveryRate: carts.docs.length ? recovered.length / carts.docs.length : 0,
  }
}

export type ReportData = {
  range: ReportRange
  orders: ReportOrder[]
  previousOrders?: ReportOrder[]
  expenses: ReportExpense[]
  previousExpenses?: ReportExpense[]
  lookups: ReportLookups
}

/** Everything the reports need for a range and its comparison period. */
export async function loadReportData(payload: Payload, range: ReportRange): Promise<ReportData> {
  const previous = range.previous
  const [orders, expenses, previousOrders, previousExpenses, lookups] = await Promise.all([
    loadOrders(payload, range),
    loadExpenses(payload, range),
    previous ? loadOrders(payload, previous) : undefined,
    previous ? loadExpenses(payload, previous) : undefined,
    loadLookups(payload),
  ])
  return { range, orders, previousOrders, expenses, previousExpenses, lookups }
}
