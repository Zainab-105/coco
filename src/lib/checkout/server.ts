import { timingSafeEqual } from 'node:crypto'

import 'server-only'

import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import {
  commitTransaction,
  createLocalReq,
  getPayload,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
} from 'payload'

import type { Category, Coupon, Media, Product } from '@/payload-types'
import config from '@/payload.config'
import { sendOrderEmail } from '@/hooks/orderEmails'
import { isGatewayConfigured } from '@/lib/payments'
import { isDoc, toMediaItem } from '@/lib/storefront/mappers'

import { computeQuote, type CatalogProduct, type CouponData, type Quote, type QuoteLineInput, type QuoteSettings } from './quote'
import type { CheckoutForm } from './validate'

const getPayloadClient = () => getPayload({ config })

const imageOf = (media: unknown) => toMediaItem(media as Media, 'card')?.src

function toCatalogProduct(p: Product): CatalogProduct {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug ?? String(p.id),
    published: p.status === 'published',
    productType: p.productType,
    price: p.price,
    salePrice: p.salePrice,
    costPrice: p.costPrice,
    stock: p.stock,
    sku: p.sku,
    categoryId: isDoc<Category>(p.category) ? p.category.id : (p.category as number | undefined),
    image: imageOf(p.gallery?.[0]?.media),
    variants: (p.variants ?? []).map((v) => ({
      id: v.id ?? '',
      label: v.label,
      price: v.price,
      salePrice: v.salePrice,
      costPrice: v.costPrice,
      stock: v.stock,
      sku: v.sku,
      image: imageOf(v.image),
    })),
  }
}

async function loadCatalog(payload: Payload, ids: number[], req?: PayloadRequest) {
  if (!ids.length) return new Map<number, CatalogProduct>()
  const { docs } = await payload.find({
    collection: 'products',
    where: { id: { in: ids } },
    depth: 1,
    limit: ids.length,
    overrideAccess: true,
    req,
  })
  return new Map(docs.map((d) => [d.id, toCatalogProduct(d)]))
}

export async function loadQuoteSettings(payload: Payload, req?: PayloadRequest): Promise<QuoteSettings> {
  const s = await payload.findGlobal({ slug: 'store-settings', depth: 0, req })
  return {
    flatRate: s.shipping?.flatRate ?? 250,
    freeShippingThreshold: s.shipping?.freeShippingThreshold,
    cityRates: (s.shipping?.cityRates ?? []).map((r) => ({ city: r.city, rate: r.rate })),
    giftWrap: { enabled: Boolean(s.giftWrap?.enabled), price: s.giftWrap?.price ?? 0 },
    allowBackorders: Boolean(s.inventory?.allowBackorders),
    payments: {
      codEnabled: s.payments?.codEnabled !== false,
      codMaxOrderValue: s.payments?.codMaxOrderValue,
      // A gateway is offered only when switched on in the admin AND its credentials are configured.
      jazzcashEnabled: Boolean(s.payments?.jazzcashEnabled) && isGatewayConfigured('jazzcash'),
      easypaisaEnabled: Boolean(s.payments?.easypaisaEnabled) && isGatewayConfigured('easypaisa'),
      manualTransferEnabled: Boolean(s.payments?.manualTransferInstructions?.trim()),
    },
  }
}

const toCouponData = (c: Coupon): CouponData => ({
  id: c.id,
  code: c.code,
  type: c.type,
  value: c.value ?? 0,
  maxDiscount: c.maxDiscount,
  minOrderAmount: c.minOrderAmount,
  usageLimit: c.usageLimit,
  usageCount: c.usageCount,
  perCustomerLimit: c.perCustomerLimit,
  startsAt: c.startsAt,
  endsAt: c.endsAt,
  active: c.active !== false,
  categoryIds: (c.appliesToCategories ?? []).map((cat) => (isDoc<Category>(cat) ? cat.id : (cat as number))),
})

async function loadCoupon(payload: Payload, code: string, req?: PayloadRequest) {
  const { docs } = await payload.find({
    collection: 'coupons',
    where: { code: { equals: code.trim().toUpperCase() } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return docs[0] ? toCouponData(docs[0]) : null
}

async function couponUsesByPhone(payload: Payload, couponId: number, phone: string, req?: PayloadRequest) {
  const { totalDocs } = await payload.count({
    collection: 'orders',
    where: {
      and: [
        { coupon: { equals: couponId } },
        { 'shippingAddress.phone': { equals: phone } },
        { status: { not_equals: 'cancelled' } },
      ],
    },
    overrideAccess: true,
    req,
  })
  return totalDocs
}

export type QuoteRequest = {
  lines: QuoteLineInput[]
  couponCode?: string
  city?: string
  giftWrap?: boolean
  phone?: string
}

async function quoteWith(payload: Payload, request: QuoteRequest, req?: PayloadRequest): Promise<Quote> {
  const lines = request.lines.slice(0, 30)
  const [catalog, settings] = await Promise.all([
    loadCatalog(payload, [...new Set(lines.map((l) => l.productId))], req),
    loadQuoteSettings(payload, req),
  ])
  let coupon: { code: string; data: CouponData | null } | undefined
  let customerCouponUses = 0
  if (request.couponCode) {
    const data = await loadCoupon(payload, request.couponCode, req)
    coupon = { code: request.couponCode, data }
    if (data?.perCustomerLimit != null && request.phone) {
      customerCouponUses = await couponUsesByPhone(payload, data.id, request.phone, req)
    }
  }
  return computeQuote({ lines, city: request.city, giftWrap: request.giftWrap, customerCouponUses }, catalog, settings, coupon)
}

export async function quoteCart(request: QuoteRequest): Promise<Quote> {
  return quoteWith(await getPayloadClient(), request)
}

export type PlacedOrder = { id: number; orderNumber: string; accessToken: string; paymentMethod: CheckoutForm['paymentMethod']; total: number }

export class CheckoutError extends Error {
  constructor(
    message: string,
    public quote?: Quote,
  ) {
    super(message)
  }
}

/**
 * Creates the order atomically: locks the products being bought, re-prices the cart from the
 * database, creates the order (hooks deduct stock and upsert the customer) and counts coupon
 * usage. Any failure rolls everything back.
 */
export async function placeOrder(form: CheckoutForm, lines: QuoteLineInput[]): Promise<PlacedOrder> {
  const payload = await getPayloadClient()
  const req = await createLocalReq({}, payload)
  await initTransaction(req)

  try {
    // Serialise concurrent checkouts of the same products so the last unit cannot be sold twice.
    const ids = [...new Set(lines.map((l) => Math.trunc(l.productId)).filter((n) => n > 0))]
    const db = payload.db as unknown as PostgresAdapter
    const session = req.transactionID ? db.sessions?.[await req.transactionID] : undefined
    if (session && ids.length) {
      await session.db.execute(sql`SELECT id FROM products WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}) FOR UPDATE`)
    }

    const quote = await quoteWith(
      payload,
      { lines, couponCode: form.couponCode, city: form.city, giftWrap: form.giftWrap, phone: form.phone },
      req,
    )
    if (!quote.lines.length) throw new CheckoutError('Your cart is empty or its items are no longer available.', quote)
    if (quote.issues.length) throw new CheckoutError('Your cart changed. Please review it and place the order again.', quote)
    if (form.couponCode && !quote.coupon?.applied) throw new CheckoutError(quote.coupon?.message ?? 'This code is not valid.', quote)
    const payment = quote.payments.find((p) => p.method === form.paymentMethod)
    if (!payment?.available) throw new CheckoutError(payment?.reason ?? 'Please choose another payment method.', quote)

    const order = await payload.create({
      collection: 'orders',
      depth: 0,
      overrideAccess: true,
      req,
      data: {
        status: 'new',
        source: 'website',
        items: quote.lines.map((l) => ({
          product: l.productId,
          variantId: l.variantId,
          title: l.title,
          variantLabel: l.variantLabel,
          sku: l.sku,
          unitPrice: l.unitPrice,
          unitCost: l.unitCost,
          quantity: l.quantity,
        })),
        discount: quote.discount,
        shippingFee: quote.shipping,
        coupon: quote.coupon?.applied ? quote.coupon.id : undefined,
        shippingAddress: {
          fullName: form.fullName,
          phone: form.phone,
          city: form.city,
          address: form.landmark ? `${form.address}\nNear: ${form.landmark}` : form.address,
        },
        email: form.email,
        marketingConsent: form.marketingConsent,
        gift: { wrap: quote.giftWrapFee > 0, wrapFee: quote.giftWrapFee, note: form.giftNote },
        payment: {
          method: form.paymentMethod,
          status: form.paymentMethod === 'bank_transfer' ? 'awaiting_verification' : 'pending',
        },
      },
    })

    if (quote.coupon?.applied && quote.coupon.id) {
      const current = await payload.findByID({ collection: 'coupons', id: quote.coupon.id, depth: 0, overrideAccess: true, req })
      await payload.update({
        collection: 'coupons',
        id: quote.coupon.id,
        data: { usageCount: (current.usageCount ?? 0) + 1 },
        overrideAccess: true,
        req,
      })
    }

    // Defensive: the server total must equal what the customer was shown.
    if (order.total !== quote.total) throw new Error(`Order total mismatch: ${order.total} vs ${quote.total}`)

    await commitTransaction(req)
    // Sent only after commit so a rolled-back order never triggers an email.
    void sendOrderEmail(payload, order, 'confirmation')
    return { id: order.id, orderNumber: order.orderNumber!, accessToken: order.accessToken!, paymentMethod: form.paymentMethod, total: order.total! }
  } catch (error) {
    await killTransaction(req)
    throw error
  }
}

/** Looks up an order for the customer-facing pages. Requires the private token or the phone number. */
export async function findCustomerOrder(orderNumber: string, secret: { token?: string; phone?: string }) {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: orderNumber.trim().toUpperCase() } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const order = docs[0]
  if (!order) return null
  const tokenOk =
    secret.token && order.accessToken && secret.token.length === order.accessToken.length &&
    timingSafeEqual(Buffer.from(secret.token), Buffer.from(order.accessToken))
  const phoneOk = secret.phone && order.shippingAddress.phone === secret.phone
  return tokenOk || phoneOk ? order : null
}
