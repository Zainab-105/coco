import { randomBytes } from 'node:crypto'

import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook, type PayloadRequest } from 'payload'

import type { Order } from '@/payload-types'
import { generateOrderNumber } from '@/lib/orderNumber'
import { customerSegment, holdsStock, NON_REVENUE_STATUSES, type OrderStatus } from '@/lib/orderStatus'
import { normalizePkPhone } from '@/lib/phone'

type OrderItem = NonNullable<Order['items']>[number]

/** Postgres IDs are numeric; relationships arrive either as an ID or a populated doc. */
const relId = (value: unknown): number | undefined =>
  value && typeof value === 'object' && 'id' in value
    ? (value as { id: number }).id
    : (value as number | undefined)

/** Recomputes line totals and order totals so stored figures are always consistent. */
export const computeTotals: CollectionBeforeChangeHook = ({ data }) => {
  const items = (data.items ?? []) as OrderItem[]
  let subtotal = 0
  for (const item of items) {
    item.lineTotal = (item.unitPrice ?? 0) * (item.quantity ?? 0)
    subtotal += item.lineTotal
  }
  data.subtotal = subtotal
  data.discount = Math.min(data.discount ?? 0, subtotal)
  data.total = subtotal - data.discount + (data.shippingFee ?? 0) + (data.gift?.wrap ? (data.gift.wrapFee ?? 0) : 0)
  return data
}

/** Assigns order number, links or creates the CRM customer, tracks status history. */
export const prepareOrder: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  if (operation === 'create') {
    data.orderNumber ??= generateOrderNumber()
    data.accessToken ??= randomBytes(16).toString('hex')
    // Account order history matches on the exact email.
    if (data.email) data.email = String(data.email).trim().toLowerCase()

    const phone = normalizePkPhone(data.shippingAddress?.phone ?? '')
    if (phone) {
      data.shippingAddress.phone = phone
      if (!data.customer) data.customer = await upsertCustomer(req, phone, data)
    }
  }

  if (operation === 'update' && data.status !== originalDoc?.status) applyStatusSideEffects(data)

  if (operation === 'create' || data.status !== originalDoc?.status) {
    data.statusHistory = [
      ...(data.statusHistory ?? []),
      { status: data.status, changedAt: new Date().toISOString(), changedBy: req.user?.id },
    ]
  }

  await applyStockMovement(req, data, originalDoc)
  return data
}

/** Bookkeeping that follows a status change, so staff only have to change the status. */
function applyStatusSideEffects(data: Partial<Order>) {
  const now = new Date().toISOString()
  if (data.status === 'shipped') {
    data.fulfilment = { ...data.fulfilment, shippedAt: data.fulfilment?.shippedAt ?? now }
  }
  if (data.status === 'delivered') {
    data.fulfilment = { ...data.fulfilment, deliveredAt: data.fulfilment?.deliveredAt ?? now }
    // Cash on Delivery is collected by the courier at delivery.
    if (data.payment?.method === 'cod' && data.payment.status === 'pending') {
      data.payment = { ...data.payment, status: 'paid', paidAt: data.payment.paidAt ?? now }
    }
  }
  if (data.status === 'refunded') {
    data.refund = { ...data.refund, amount: data.refund?.amount ?? data.total }
    if (data.payment?.status === 'paid') data.payment = { ...data.payment, status: 'refunded' }
  }
}

async function upsertCustomer(req: PayloadRequest, phone: string, data: Partial<Order>) {
  const existing = await req.payload.find({
    collection: 'customers',
    where: { phone: { equals: phone } },
    limit: 1,
    depth: 0,
    req,
  })
  if (existing.docs[0]) return existing.docs[0].id

  const created = await req.payload.create({
    collection: 'customers',
    data: {
      name: data.shippingAddress?.fullName ?? 'Customer',
      phone,
      email: data.email ?? undefined,
      addresses: data.shippingAddress
        ? [{ city: data.shippingAddress.city, address: data.shippingAddress.address }]
        : [],
      marketing: {
        emailConsent: Boolean(data.marketingConsent),
        whatsappConsent: Boolean(data.marketingConsent),
        consentUpdatedAt: new Date().toISOString(),
      },
    },
    overrideAccess: true,
    req,
  })
  return created.id
}

/**
 * Deducts stock when an order enters a stock-holding status and restores it when the
 * order is cancelled or returned. `stockDeducted` makes the operation idempotent.
 */
async function applyStockMovement(req: PayloadRequest, data: Partial<Order>, originalDoc?: Order) {
  const settings = await req.payload.findGlobal({ slug: 'store-settings', depth: 0, req })
  const deductOn = settings.inventory?.deductStockOn ?? 'placed'
  const allowBackorders = Boolean(settings.inventory?.allowBackorders)

  const shouldHold = holdsStock(data.status as OrderStatus, deductOn)
  const isHolding = Boolean(originalDoc?.stockDeducted)
  if (shouldHold === isHolding) return

  const direction = shouldHold ? -1 : 1
  for (const item of data.items ?? []) {
    const productId = relId(item.product)
    if (!productId) continue

    const product = await req.payload.findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      req,
    })
    const delta = direction * (item.quantity ?? 0)
    const salesCount = Math.max(0, (product.salesCount ?? 0) - delta)
    const variant = item.variantId ? product.variants?.find((v) => v.id === item.variantId) : undefined
    const available = (variant ? variant.stock : product.stock) ?? 0

    if (direction < 0 && !allowBackorders && available < (item.quantity ?? 0)) {
      const name = variant ? `${product.title} (${variant.label})` : product.title
      throw new APIError(
        `Not enough stock for ${name}: ${Math.max(0, available)} left, ${item.quantity} ordered.`,
        400,
        undefined,
        true,
      )
    }

    const stockUpdate = variant
      ? {
          variants: product.variants!.map((v) => (v.id === variant.id ? { ...v, stock: available + delta } : v)),
        }
      : { stock: available + delta }

    await req.payload.update({
      collection: 'products',
      id: productId,
      data: { ...stockUpdate, salesCount },
      req,
    })

    await req.payload.create({
      collection: 'inventory-adjustments',
      data: {
        product: productId,
        variantId: item.variantId ?? undefined,
        quantityChange: delta,
        reason: shouldHold ? 'order' : 'order_reversal',
        reference: data.orderNumber ?? originalDoc?.orderNumber,
        adjustedBy: req.user?.collection === 'users' ? req.user.id : undefined,
      },
      overrideAccess: true,
      // Stock was already moved above; this entry only records it.
      context: { ledgerOnly: true },
      req,
    })
  }

  data.stockDeducted = shouldHold
}

/** Keeps customer purchase stats (orders, spend, segment) up to date. */
export const refreshCustomerStats: CollectionAfterChangeHook<Order> = async ({ doc, req }) => {
  const customerId = relId(doc.customer)
  if (!customerId) return doc

  const { docs } = await req.payload.find({
    collection: 'orders',
    where: {
      and: [{ customer: { equals: customerId } }, { status: { not_in: NON_REVENUE_STATUSES } }],
    },
    pagination: false,
    depth: 0,
    select: { total: true, createdAt: true },
    req,
  })

  const settings = await req.payload.findGlobal({ slug: 'store-settings', depth: 0, req })
  const orderCount = docs.length
  const totalSpent = docs.reduce((sum, o) => sum + (o.total ?? 0), 0)
  const dates = docs.map((o) => new Date(o.createdAt).getTime()).sort((a, b) => a - b)
  const lastOrderAt = dates.length ? new Date(dates[dates.length - 1]) : null

  await req.payload.update({
    collection: 'customers',
    id: customerId,
    data: {
      orderCount,
      totalSpent,
      averageOrderValue: orderCount ? Math.round(totalSpent / orderCount) : 0,
      firstOrderAt: dates.length ? new Date(dates[0]).toISOString() : null,
      lastOrderAt: lastOrderAt?.toISOString() ?? null,
      segment: customerSegment(
        { orderCount, totalSpent, lastOrderAt },
        {
          highValueThreshold: settings.crm?.highValueThreshold ?? 15000,
          inactiveAfterDays: settings.crm?.inactiveAfterDays ?? 90,
        },
      ),
    },
    overrideAccess: true,
    req,
  })

  return doc
}
