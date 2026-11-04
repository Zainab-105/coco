import type { Payload } from 'payload'

import type { Product } from '@/payload-types'

/** Low-stock email to the store's support email (or LOW_STOCK_ALERT_EMAIL). Never throws. */
export async function sendLowStockAlert(payload: Payload, product: Product) {
  try {
    const settings = await payload.findGlobal({ slug: 'store-settings', depth: 0 })
    const to = process.env.LOW_STOCK_ALERT_EMAIL || settings.supportEmail
    if (!to) return
    const lines =
      product.productType === 'variable'
        ? (product.variants ?? [])
            .filter((v) => (v.stock ?? 0) <= (product.lowStockThreshold ?? 5))
            .map((v) => `${v.label}${v.sku ? ` (${v.sku})` : ''}: ${v.stock ?? 0} left`)
        : [`${product.stock ?? 0} left`]
    const state = product.stockStatus === 'out_of_stock' ? 'is out of stock' : 'is running low'
    const admin = `${(process.env.NEXT_PUBLIC_SERVER_URL ?? '').replace(/\/$/, '')}/admin/collections/products/${product.id}`
    await payload.sendEmail({
      to,
      subject: `Stock alert: ${product.title} ${state}`,
      text: `${product.title} ${state}.\n\n${lines.join('\n')}\n\nRestock or update it here: ${admin}`,
      html: `<p><strong>${product.title}</strong> ${state}.</p><ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul><p><a href="${admin}">Open in admin</a></p>`,
    })
  } catch (error) {
    payload.logger.error({ err: error }, `Low-stock alert failed for product ${product.id}`)
  }
}
