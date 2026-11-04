import { APIError, type CollectionBeforeChangeHook, type CollectionAfterChangeHook } from 'payload'

import type { InventoryAdjustment, Product } from '@/payload-types'
import { sendLowStockAlert } from '@/hooks/lowStock'

/**
 * Manual adjustments (restock, damage, count correction) change stock when they are saved.
 * Order-driven entries and import records are written after stock already moved, so they only log.
 */
export const applyManualAdjustment: CollectionBeforeChangeHook<InventoryAdjustment> = async ({ data, operation, req, context }) => {
  if (operation !== 'create' || context.ledgerOnly) return data
  if (data.reason === 'order' || data.reason === 'order_reversal') {
    throw new APIError('Order entries are added automatically. Choose Restock, Damaged / lost or Stock count correction.', 400, undefined, true)
  }

  const productId = typeof data.product === 'object' ? data.product?.id : data.product
  if (!productId) throw new APIError('Choose a product.', 400, undefined, true)
  const delta = Math.trunc(data.quantityChange ?? 0)
  if (!delta) throw new APIError('Quantity change cannot be zero.', 400, undefined, true)
  if (data.reason === 'damage' && delta > 0) throw new APIError('Damaged / lost stock must be a negative number.', 400, undefined, true)

  const product = await req.payload.findByID({ collection: 'products', id: productId, depth: 0, req })
  let variantId = data.variantId || undefined
  if (data.variantSku) {
    const v = product.variants?.find((x) => x.sku?.toLowerCase() === data.variantSku!.trim().toLowerCase())
    if (!v) throw new APIError(`No variant with SKU "${data.variantSku}" on ${product.title}.`, 400, undefined, true)
    variantId = v.id ?? undefined
  }
  if (product.productType === 'variable' && !variantId) {
    const skus = (product.variants ?? []).map((v) => `${v.label}: ${v.sku ?? 'no SKU'}`).join(', ')
    throw new APIError(`${product.title} has variants. Enter the variant SKU (${skus}).`, 400, undefined, true)
  }

  const current = variantId ? (product.variants?.find((v) => v.id === variantId)?.stock ?? 0) : (product.stock ?? 0)
  if (current + delta < 0) throw new APIError(`Stock would become negative (currently ${current}).`, 400, undefined, true)

  const update: Partial<Product> = variantId
    ? { variants: product.variants!.map((v) => (v.id === variantId ? { ...v, stock: current + delta } : v)) }
    : { stock: current + delta }
  await req.payload.update({ collection: 'products', id: productId, data: update, req })

  data.variantId = variantId
  data.adjustedBy ??= req.user?.collection === 'users' ? req.user.id : undefined
  return data
}

/** Emails the owner when a product drops to low or out of stock. */
export const alertOnLowStock: CollectionAfterChangeHook<Product> = ({ doc, previousDoc, operation, req }) => {
  if (operation !== 'update' || !previousDoc) return doc
  const worse = (s?: string | null) => (s === 'out_of_stock' ? 2 : s === 'low_stock' ? 1 : 0)
  if (worse(doc.stockStatus) > worse(previousDoc.stockStatus)) {
    void sendLowStockAlert(req.payload, doc)
  }
  return doc
}
