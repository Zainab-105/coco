import type { CollectionSlug, Endpoint, PayloadRequest, Where } from 'payload'

import type { Cart, Customer, Order, Product, Subscriber } from '@/payload-types'
import { hasRole } from '@/access/roles'
import { toCsv, type CsvColumn } from '@/lib/csv'
import { PAYMENT_METHOD_LABELS } from '@/lib/orderStatus'

/**
 * GET /api/{orders|customers|products}/export?where[...]=...
 * Exports the rows matching the admin list filters as CSV. Runs with the user's own access,
 * so field-level rules apply (staff never receive cost prices). Every export is audit-logged.
 */
const name = (v: unknown) => (v && typeof v === 'object' && 'title' in v ? (v as { title: string }).title : (v ?? ''))

const orderColumns: CsvColumn<Order>[] = [
  { header: 'Order number', value: (o) => o.orderNumber },
  { header: 'Date', value: (o) => o.createdAt },
  { header: 'Status', value: (o) => o.status },
  { header: 'Customer', value: (o) => o.shippingAddress.fullName },
  { header: 'Phone', value: (o) => o.shippingAddress.phone },
  { header: 'Email', value: (o) => o.email },
  { header: 'City', value: (o) => o.shippingAddress.city },
  { header: 'Address', value: (o) => o.shippingAddress.address },
  { header: 'Items', value: (o) => (o.items ?? []).map((i) => `${i.title}${i.variantLabel ? ` (${i.variantLabel})` : ''} x${i.quantity}`).join('; ') },
  { header: 'Units', value: (o) => (o.items ?? []).reduce((n, i) => n + (i.quantity ?? 0), 0) },
  { header: 'Subtotal', value: (o) => o.subtotal },
  { header: 'Discount', value: (o) => o.discount },
  { header: 'Delivery', value: (o) => o.shippingFee },
  { header: 'Gift wrap', value: (o) => (o.gift?.wrap ? o.gift.wrapFee : 0) },
  { header: 'Total', value: (o) => o.total },
  { header: 'Cost of goods', value: (o) => (o.items ?? []).reduce((s, i) => s + (i.unitCost ?? 0) * (i.quantity ?? 0), 0) },
  { header: 'Payment method', value: (o) => PAYMENT_METHOD_LABELS[o.payment.method] },
  { header: 'Payment status', value: (o) => o.payment.status },
  { header: 'Transaction ID', value: (o) => o.payment.transactionId },
  { header: 'Courier', value: (o) => o.fulfilment?.courier },
  { header: 'Tracking number', value: (o) => o.fulfilment?.trackingNumber },
  { header: 'Refund amount', value: (o) => o.refund?.amount },
  { header: 'Source', value: (o) => o.source },
]

const customerColumns: CsvColumn<Customer>[] = [
  { header: 'Name', value: (c) => c.name },
  { header: 'Phone', value: (c) => c.phone },
  { header: 'Email', value: (c) => c.email },
  { header: 'City', value: (c) => c.addresses?.[0]?.city },
  { header: 'Segment', value: (c) => c.segment },
  { header: 'Orders', value: (c) => c.orderCount },
  { header: 'Total spent', value: (c) => c.totalSpent },
  { header: 'Average order value', value: (c) => c.averageOrderValue },
  { header: 'First order', value: (c) => c.firstOrderAt },
  { header: 'Last order', value: (c) => c.lastOrderAt },
  { header: 'Email consent', value: (c) => (c.marketing?.emailConsent ? 'yes' : 'no') },
  { header: 'WhatsApp consent', value: (c) => (c.marketing?.whatsappConsent ? 'yes' : 'no') },
  { header: 'Consent updated', value: (c) => c.marketing?.consentUpdatedAt },
]

const serverURL = () => (process.env.NEXT_PUBLIC_SERVER_URL ?? '').replace(/\/$/, '')

const subscriberColumns: CsvColumn<Subscriber>[] = [
  { header: 'Email', value: (s) => s.email },
  { header: 'Status', value: (s) => s.status },
  { header: 'Source', value: (s) => s.source },
  { header: 'Consent given', value: (s) => s.consentAt },
  { header: 'Unsubscribed', value: (s) => s.unsubscribedAt },
  { header: 'Unsubscribe link', value: (s) => (s.unsubscribeToken ? `${serverURL()}/unsubscribe?token=${s.unsubscribeToken}` : '') },
]

const cartColumns: CsvColumn<Cart>[] = [
  { header: 'Last activity', value: (c) => c.lastActivityAt },
  { header: 'Status', value: (c) => c.status },
  { header: 'Name', value: (c) => c.name },
  { header: 'Phone', value: (c) => c.phone },
  { header: 'Email', value: (c) => c.email },
  { header: 'City', value: (c) => c.city },
  { header: 'Items', value: (c) => (c.items ?? []).map((i) => `${i.title}${i.variantLabel ? ` (${i.variantLabel})` : ''} x${i.quantity}`).join('; ') },
  { header: 'Subtotal', value: (c) => c.subtotal },
  { header: 'Marketing consent', value: (c) => (c.marketingConsent ? 'yes' : 'no') },
  { header: 'Recovered order', value: (c) => (c.order && typeof c.order === 'object' ? c.order.orderNumber : c.order) },
]

/** One row per product, plus one per variant, matching the bulk import format. */
type ProductRow = { product: Product; variant?: NonNullable<Product['variants']>[number] }
const productColumns: CsvColumn<ProductRow>[] = [
  { header: 'sku', value: (r) => (r.variant ? r.variant.sku : r.product.sku) },
  { header: 'title', value: (r) => r.product.title },
  { header: 'variant', value: (r) => r.variant?.label },
  { header: 'category', value: (r) => name(r.product.category) },
  { header: 'status', value: (r) => r.product.status },
  { header: 'price', value: (r) => (r.variant ? (r.variant.price ?? r.product.price) : r.product.price) },
  { header: 'salePrice', value: (r) => (r.variant ? (r.variant.price != null ? r.variant.salePrice : (r.variant.salePrice ?? r.product.salePrice)) : r.product.salePrice) },
  { header: 'costPrice', value: (r) => (r.variant ? (r.variant.costPrice ?? r.product.costPrice) : r.product.costPrice) },
  { header: 'stock', value: (r) => (r.variant ? r.variant.stock : r.product.productType === 'variable' ? '' : r.product.stock) },
  { header: 'salesCount', value: (r) => (r.variant ? '' : r.product.salesCount) },
]

const COST_HEADERS = new Set(['Cost of goods', 'costPrice'])

function exportEndpoint<T>(collection: CollectionSlug, columns: CsvColumn<T>[], toRows: (docs: unknown[]) => T[]): Endpoint {
  return {
    path: '/export',
    method: 'get',
    handler: async (req: PayloadRequest) => {
      if (!hasRole(req.user, ['owner', 'manager', 'staff'])) return Response.json({ error: 'Forbidden' }, { status: 403 })
      const where = (req.query?.where ?? {}) as Where
      const { docs } = await req.payload.find({
        collection,
        where,
        sort: '-createdAt',
        pagination: false,
        limit: 10_000,
        depth: 1,
        overrideAccess: false,
        user: req.user,
        req,
      })
      const canSeeCosts = hasRole(req.user, ['owner', 'manager'])
      const visible = canSeeCosts ? columns : columns.filter((c) => !COST_HEADERS.has(c.header))
      const csv = toCsv(toRows(docs), visible)

      await req.payload.create({
        collection: 'activity-logs',
        data: { user: req.user!.id, action: 'export', targetCollection: collection, summary: `Exported ${docs.length} rows` },
        req,
      })

      const date = new Date().toISOString().slice(0, 10)
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="coco-${collection}-${date}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    },
  }
}

export const exportSubscribers = exportEndpoint<Subscriber>('subscribers', subscriberColumns, (docs) => docs as Subscriber[])
export const exportCarts = exportEndpoint<Cart>('carts', cartColumns, (docs) => docs as Cart[])
export const exportOrders = exportEndpoint<Order>('orders', orderColumns, (docs) => docs as Order[])
export const exportCustomers = exportEndpoint<Customer>('customers', customerColumns, (docs) => docs as Customer[])
export const exportProducts = exportEndpoint<ProductRow>('products', productColumns, (docs) =>
  (docs as Product[]).flatMap((product) =>
    product.productType === 'variable' && product.variants?.length
      ? product.variants.map((variant) => ({ product, variant }))
      : [{ product }],
  ),
)
