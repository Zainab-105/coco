import type { CollectionBeforeChangeHook, FieldHook } from 'payload'

import type { Product } from '@/payload-types'
import { effectivePrice } from '@/lib/pricing'

/**
 * Keeps `effectivePrice`, `totalStock` and `stockStatus` in sync so the admin can filter "Low stock" /
 * "Out of stock" and the storefront can filter by availability without loading variants.
 */
export const computeStock: CollectionBeforeChangeHook<Product> = ({ data, originalDoc }) => {
  const merged = { ...originalDoc, ...data }
  const total =
    merged.productType === 'variable'
      ? (merged.variants ?? []).reduce((sum, v) => sum + Math.max(0, v.stock ?? 0), 0)
      : Math.max(0, merged.stock ?? 0)
  const threshold = merged.lowStockThreshold ?? 5

  // Lowest price a customer can pay right now; used for price filters and sorting.
  const variantPrices =
    merged.productType === 'variable'
      ? (merged.variants ?? [])
          .filter((v) => v.price != null || v.salePrice != null)
          .map((v) => effectivePrice(v.price ?? merged.price ?? 0, v.salePrice ?? merged.salePrice))
      : []
  data.effectivePrice = Math.min(effectivePrice(merged.price ?? 0, merged.salePrice), ...variantPrices)
  data.totalStock = total
  data.stockStatus = total <= 0 ? 'out_of_stock' : total <= threshold ? 'low_stock' : 'in_stock'
  return data
}

/** A duplicated product starts as an unpublished draft with fresh stats. */
export const resetOnDuplicate =
  <T>(value: T): FieldHook =>
  () =>
    value

/** Unique text fields (slug, SKU) get a suffix when a product is duplicated. */
export const uniqueOnDuplicate: FieldHook = ({ value }) =>
  typeof value === 'string' && value ? `${value}-copy-${Date.now().toString(36).slice(-4)}` : value
