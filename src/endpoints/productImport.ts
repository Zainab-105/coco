import type { Endpoint, PayloadRequest } from 'payload'

import type { Product } from '@/payload-types'
import { hasRole } from '@/access/roles'

/**
 * POST /api/products/import  { rows: ImportRow[], dryRun: boolean }
 * Bulk update of existing products/variants matched by SKU: price, salePrice, costPrice, stock, status.
 * Dry run returns a preview of every change; applying writes them and records stock changes in the
 * inventory ledger as count corrections. Unknown SKUs are reported, never created.
 */
export type ImportRow = Record<string, string>

type Change = { field: string; from: unknown; to: unknown }
export type ImportResult = {
  line: number
  sku: string
  target?: string
  changes: Change[]
  errors: string[]
}

const FIELDS = ['price', 'salePrice', 'costPrice', 'stock'] as const
const STATUSES = ['draft', 'published', 'archived']
const MAX_ROWS = 1000

function parseNumber(raw: string | undefined, field: string, errors: string[]): number | null | undefined {
  if (raw == null || raw.trim() === '') return undefined
  if (raw.trim() === '-' && field === 'salePrice') return null // "-" clears a sale price
  const n = Number(raw.replace(/[, ]/g, '').replace(/^rs\.?/i, ''))
  if (!Number.isFinite(n) || n < 0 || (field === 'stock' && !Number.isInteger(n))) {
    errors.push(`${field} "${raw}" is not a valid ${field === 'stock' ? 'whole number' : 'amount'}`)
    return undefined
  }
  return n
}

type Variant = NonNullable<Product['variants']>[number]

/** Mirrors the export: a variant without its own price/sale/cost shows the product's value. */
export function effectiveVariantValue(product: Product, v: Variant, field: (typeof FIELDS)[number]): number | null {
  if (field === 'stock') return v.stock ?? null
  if (field === 'salePrice') return v.price != null ? (v.salePrice ?? null) : (v.salePrice ?? product.salePrice ?? null)
  return v[field] ?? product[field] ?? null
}

export const importProducts: Endpoint = {
  path: '/import',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!hasRole(req.user, ['owner', 'manager'])) return Response.json({ error: 'Forbidden' }, { status: 403 })
    const body = (await req.json?.()) as { rows?: ImportRow[]; dryRun?: boolean } | undefined
    const rows = Array.isArray(body?.rows) ? body!.rows : []
    if (!rows.length) return Response.json({ error: 'No rows to import' }, { status: 400 })
    if (rows.length > MAX_ROWS) return Response.json({ error: `Import at most ${MAX_ROWS} rows at a time` }, { status: 400 })
    const dryRun = body?.dryRun !== false

    const results: ImportResult[] = []
    const pending = new Map<number, { product: Product; data: Partial<Product>; stockMoves: { variantId?: string; delta: number }[] }>()
    const seen = new Set<string>()

    for (const [index, row] of rows.entries()) {
      const sku = (row.sku ?? '').trim()
      const result: ImportResult = { line: index + 2, sku, changes: [], errors: [] }
      results.push(result)
      if (!sku) {
        result.errors.push('Missing sku')
        continue
      }
      if (seen.has(sku)) {
        result.errors.push('Duplicate sku in file')
        continue
      }
      seen.add(sku)

      const { docs } = await req.payload.find({
        collection: 'products',
        where: { or: [{ sku: { equals: sku } }, { 'variants.sku': { equals: sku } }] },
        depth: 0,
        limit: 2,
        req,
      })
      if (docs.length !== 1) {
        result.errors.push(docs.length ? 'SKU matches more than one product' : 'No product or variant with this SKU')
        continue
      }

      const entry = pending.get(docs[0].id) ?? { product: docs[0], data: {}, stockMoves: [] }
      pending.set(docs[0].id, entry)
      const product = entry.product
      const variant = product.variants?.find((v) => v.sku === sku)
      result.target = variant ? `${product.title} (${variant.label})` : product.title

      const values: Partial<Record<(typeof FIELDS)[number], number | null>> = {}
      for (const field of FIELDS) {
        const v = parseNumber(row[field], field, result.errors)
        if (v !== undefined) values[field] = v
      }
      if (!variant && product.productType === 'variable' && values.stock !== undefined) {
        result.errors.push('Set stock on the variant SKUs of this product, not the product SKU')
      }
      const status = row.status?.trim().toLowerCase()
      if (status && !STATUSES.includes(status)) result.errors.push(`status must be one of ${STATUSES.join(', ')}`)
      if (result.errors.length) continue

      if (variant) {
        const variants = (entry.data.variants ?? product.variants ?? []).map((v) => {
          if (v.id !== variant.id) return v
          const next = { ...v }
          for (const field of FIELDS) {
            // Compare with what the export showed: values a variant inherits from its product.
            // An unchanged row must not turn inherited prices into fixed per-variant overrides.
            const current = effectiveVariantValue(product, v, field)
            if (values[field] === undefined || values[field] === current) continue
            result.changes.push({ field, from: current, to: values[field] })
            if (field === 'stock') entry.stockMoves.push({ variantId: v.id!, delta: (values.stock ?? 0) - (v.stock ?? 0) })
            ;(next as Record<string, unknown>)[field] = values[field]
          }
          return next
        })
        entry.data.variants = variants
      } else {
        for (const field of FIELDS) {
          if (values[field] === undefined || values[field] === (product[field] ?? null)) continue
          if (field === 'stock' && product.productType === 'variable') continue
          result.changes.push({ field, from: product[field] ?? null, to: values[field] })
          if (field === 'stock') entry.stockMoves.push({ delta: (values.stock ?? 0) - (product.stock ?? 0) })
          ;(entry.data as Record<string, unknown>)[field] = values[field]
        }
      }
      if (status && status !== product.status) {
        result.changes.push({ field: 'status', from: product.status, to: status })
        entry.data.status = status as Product['status']
      }
    }

    const hasErrors = results.some((r) => r.errors.length)
    if (dryRun || hasErrors) {
      return Response.json({ dryRun: true, applied: false, hasErrors, results })
    }

    for (const [id, { data, stockMoves, product }] of pending) {
      if (!Object.keys(data).length) continue
      await req.payload.update({ collection: 'products', id, data, req })
      for (const move of stockMoves) {
        if (!move.delta) continue
        await req.payload.create({
          collection: 'inventory-adjustments',
          data: {
            product: id,
            variantId: move.variantId,
            quantityChange: move.delta,
            reason: 'correction',
            reference: 'Bulk import',
            note: `Stock set by CSV import (${product.title})`,
            adjustedBy: req.user!.id,
          },
          // Stock was already written above; this entry only records it.
          context: { ledgerOnly: true },
          req,
        })
      }
    }
    return Response.json({ dryRun: false, applied: true, hasErrors: false, results })
  },
}
