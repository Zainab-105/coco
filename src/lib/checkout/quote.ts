import { formatPKR } from '@/lib/format'
import type { PaymentMethod } from '@/lib/orderStatus'
import { effectivePrice } from '@/lib/pricing'

/**
 * Authoritative price calculation for checkout. Pure: callers load catalog/coupon/settings
 * snapshots from the database, so this never trusts prices sent by the browser.
 */

export type QuoteLineInput = { productId: number; variantId?: string; quantity: number; expectedUnitPrice?: number }

export type CatalogVariant = {
  id: string
  label: string
  price?: number | null
  salePrice?: number | null
  costPrice?: number | null
  stock?: number | null
  sku?: string | null
  image?: string
}

export type CatalogProduct = {
  id: number
  title: string
  slug: string
  published: boolean
  productType: 'simple' | 'variable' | 'bundle'
  price: number
  salePrice?: number | null
  costPrice?: number | null
  stock?: number | null
  sku?: string | null
  categoryId?: number
  image?: string
  variants: CatalogVariant[]
}

export type CouponData = {
  id: number
  code: string
  type: 'percentage' | 'fixed' | 'free_shipping'
  value: number
  maxDiscount?: number | null
  minOrderAmount?: number | null
  usageLimit?: number | null
  usageCount?: number | null
  perCustomerLimit?: number | null
  startsAt?: string | null
  endsAt?: string | null
  active: boolean
  categoryIds: number[]
}

export type QuoteSettings = {
  flatRate: number
  freeShippingThreshold?: number | null
  cityRates: { city: string; rate: number }[]
  giftWrap: { enabled: boolean; price: number }
  allowBackorders: boolean
  payments: {
    codEnabled: boolean
    codMaxOrderValue?: number | null
    jazzcashEnabled: boolean
    easypaisaEnabled: boolean
    manualTransferEnabled: boolean
  }
}

export type QuotedLine = {
  key: string
  productId: number
  variantId?: string
  title: string
  variantLabel?: string
  slug: string
  sku?: string
  image?: string
  unitPrice: number
  compareAtPrice?: number
  unitCost?: number
  quantity: number
  lineTotal: number
  categoryId?: number
}

export type QuoteIssue = { key: string; type: 'removed' | 'quantity_reduced' | 'price_changed'; message: string }

export type PaymentOption = { method: PaymentMethod; available: boolean; reason?: string }

export type Quote = {
  lines: QuotedLine[]
  issues: QuoteIssue[]
  coupon?: { code: string; id?: number; applied: boolean; message: string }
  subtotal: number
  discount: number
  shipping: number
  giftWrapFee: number
  total: number
  freeShippingRemaining: number
  payments: PaymentOption[]
}

export type QuoteInput = {
  lines: QuoteLineInput[]
  city?: string
  giftWrap?: boolean
  /** How many times this customer (by phone) has already used the coupon. */
  customerCouponUses?: number
  now?: Date
}

const MAX_QTY = 10
const lineKey = (productId: number, variantId?: string) => `${productId}:${variantId ?? ''}`

export function computeQuote(
  input: QuoteInput,
  catalog: Map<number, CatalogProduct>,
  settings: QuoteSettings,
  coupon?: { code: string; data: CouponData | null },
): Quote {
  const issues: QuoteIssue[] = []
  const lines: QuotedLine[] = []
  const merged = new Map<string, QuoteLineInput>()

  // Merge duplicate lines so stock checks see the real total per product/variant.
  for (const l of input.lines) {
    const key = lineKey(l.productId, l.variantId)
    const prev = merged.get(key)
    merged.set(key, { ...l, quantity: (prev?.quantity ?? 0) + Math.max(0, Math.floor(l.quantity)) })
  }

  for (const [key, req] of merged) {
    if (req.quantity < 1) continue
    const product = catalog.get(req.productId)
    if (!product || !product.published) {
      issues.push({ key, type: 'removed', message: 'A product in your cart is no longer available and was removed.' })
      continue
    }
    const variant = req.variantId ? product.variants.find((v) => v.id === req.variantId) : undefined
    if (product.productType === 'variable' && !variant) {
      issues.push({ key, type: 'removed', message: `${product.title}: the selected fragrance is no longer available.` })
      continue
    }

    const name = variant ? `${product.title} (${variant.label})` : product.title
    const stock = (variant ? variant.stock : product.stock) ?? 0
    let quantity = Math.min(req.quantity, MAX_QTY)
    if (!settings.allowBackorders) {
      if (stock <= 0) {
        issues.push({ key, type: 'removed', message: `${name} is sold out and was removed.` })
        continue
      }
      if (quantity > stock) {
        quantity = stock
        issues.push({ key, type: 'quantity_reduced', message: `Only ${stock} of ${name} left; quantity updated.` })
      }
    }

    const price = variant?.price ?? product.price
    const salePrice = variant ? (variant.price != null ? variant.salePrice : (variant.salePrice ?? product.salePrice)) : product.salePrice
    const unitPrice = effectivePrice(price, salePrice)
    if (req.expectedUnitPrice != null && req.expectedUnitPrice !== unitPrice) {
      issues.push({ key, type: 'price_changed', message: `The price of ${name} is now ${formatPKR(unitPrice)}.` })
    }

    lines.push({
      key,
      productId: product.id,
      variantId: variant?.id,
      title: product.title,
      variantLabel: variant?.label,
      slug: product.slug,
      sku: (variant?.sku ?? product.sku) || undefined,
      image: variant?.image ?? product.image,
      unitPrice,
      compareAtPrice: unitPrice < price ? price : undefined,
      unitCost: (variant?.costPrice ?? product.costPrice) ?? undefined,
      quantity,
      lineTotal: unitPrice * quantity,
      categoryId: product.categoryId,
    })
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)

  // Coupon
  let discount = 0
  let freeShippingByCoupon = false
  let couponResult: Quote['coupon']
  if (coupon) {
    const check = validateCoupon(coupon.data, lines, subtotal, input.customerCouponUses ?? 0, input.now ?? new Date())
    couponResult = { code: coupon.code.toUpperCase(), id: coupon.data?.id, applied: check.ok, message: check.message }
    if (check.ok && coupon.data) {
      const c = coupon.data
      if (c.type === 'percentage') {
        discount = Math.round((check.eligibleSubtotal * c.value) / 100)
        if (c.maxDiscount) discount = Math.min(discount, c.maxDiscount)
      } else if (c.type === 'fixed') {
        discount = Math.min(c.value, check.eligibleSubtotal)
      } else {
        freeShippingByCoupon = true
      }
    }
  }
  discount = Math.min(discount, subtotal)

  // Delivery: per-city override, free over threshold or with a free-shipping coupon.
  const cityRate = input.city
    ? settings.cityRates.find((r) => r.city.trim().toLowerCase() === input.city!.trim().toLowerCase())?.rate
    : undefined
  const threshold = settings.freeShippingThreshold ?? 0
  const freeByThreshold = threshold > 0 && subtotal >= threshold
  const shipping = subtotal === 0 || freeByThreshold || freeShippingByCoupon ? 0 : (cityRate ?? settings.flatRate)

  const giftWrapFee = input.giftWrap && settings.giftWrap.enabled && subtotal > 0 ? settings.giftWrap.price : 0
  const total = subtotal - discount + shipping + giftWrapFee

  return {
    lines,
    issues,
    coupon: couponResult,
    subtotal,
    discount,
    shipping,
    giftWrapFee,
    total,
    freeShippingRemaining: threshold > 0 ? Math.max(0, threshold - subtotal) : 0,
    payments: paymentOptions(settings, total),
  }
}

function validateCoupon(
  c: CouponData | null,
  lines: QuotedLine[],
  subtotal: number,
  customerUses: number,
  now: Date,
): { ok: boolean; message: string; eligibleSubtotal: number } {
  const fail = (message: string) => ({ ok: false, message, eligibleSubtotal: 0 })
  if (!c || !c.active) return fail('This code is not valid.')
  if (c.startsAt && new Date(c.startsAt) > now) return fail('This code is not active yet.')
  if (c.endsAt && new Date(c.endsAt) < now) return fail('This code has expired.')
  if (c.usageLimit != null && (c.usageCount ?? 0) >= c.usageLimit) return fail('This code has reached its usage limit.')
  if (c.perCustomerLimit != null && customerUses >= c.perCustomerLimit) return fail('You have already used this code.')
  if (c.minOrderAmount && subtotal < c.minOrderAmount) {
    return fail(`Add ${formatPKR(c.minOrderAmount - subtotal)} more to use this code.`)
  }
  const eligible = c.categoryIds.length
    ? lines.filter((l) => l.categoryId != null && c.categoryIds.includes(l.categoryId)).reduce((s, l) => s + l.lineTotal, 0)
    : subtotal
  if (eligible === 0 && c.type !== 'free_shipping') return fail('This code does not apply to the items in your cart.')
  const message =
    c.type === 'free_shipping' ? 'Free delivery applied.' : c.type === 'percentage' ? `${c.value}% off applied.` : `${formatPKR(c.value)} off applied.`
  return { ok: true, message, eligibleSubtotal: eligible }
}

function paymentOptions(settings: QuoteSettings, total: number): PaymentOption[] {
  const p = settings.payments
  const codLimit = p.codMaxOrderValue ?? 0
  return [
    {
      method: 'cod',
      available: p.codEnabled && (codLimit === 0 || total <= codLimit),
      reason: !p.codEnabled
        ? 'Cash on Delivery is not available right now.'
        : codLimit > 0 && total > codLimit
          ? `Cash on Delivery is available for orders up to ${formatPKR(codLimit)}.`
          : undefined,
    },
    { method: 'jazzcash', available: p.jazzcashEnabled, reason: p.jazzcashEnabled ? undefined : 'Coming soon' },
    { method: 'easypaisa', available: p.easypaisaEnabled, reason: p.easypaisaEnabled ? undefined : 'Coming soon' },
    {
      method: 'bank_transfer',
      available: p.manualTransferEnabled,
      reason: p.manualTransferEnabled ? undefined : 'Not available',
    },
  ]
}
