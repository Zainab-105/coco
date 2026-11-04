/** All money values are whole PKR (integers). */

export type CartLine = {
  unitPrice: number
  quantity: number
}

export type CouponRule = {
  type: 'percentage' | 'fixed' | 'free_shipping'
  value: number
  minOrderAmount?: number | null
  maxDiscount?: number | null
}

export type ShippingRule = {
  flatRate: number
  freeShippingThreshold?: number | null
}

export type OrderTotals = {
  subtotal: number
  discount: number
  shipping: number
  total: number
}

export function effectivePrice(price: number, salePrice?: number | null): number {
  return salePrice != null && salePrice > 0 && salePrice < price ? salePrice : price
}

export function discountPercent(price: number, salePrice?: number | null): number {
  const effective = effectivePrice(price, salePrice)
  if (effective >= price || price <= 0) return 0
  return Math.round(((price - effective) / price) * 100)
}

export function calculateTotals(
  lines: CartLine[],
  shippingRule: ShippingRule,
  coupon?: CouponRule | null,
): OrderTotals {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)

  let discount = 0
  let freeShipping =
    shippingRule.freeShippingThreshold != null &&
    shippingRule.freeShippingThreshold > 0 &&
    subtotal >= shippingRule.freeShippingThreshold

  const couponApplies = coupon && subtotal >= (coupon.minOrderAmount ?? 0)
  if (coupon && couponApplies) {
    if (coupon.type === 'percentage') {
      discount = Math.round((subtotal * coupon.value) / 100)
      if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount)
    } else if (coupon.type === 'fixed') {
      discount = coupon.value
    } else {
      freeShipping = true
    }
  }
  discount = Math.min(discount, subtotal)

  const shipping = subtotal === 0 || freeShipping ? 0 : shippingRule.flatRate

  return { subtotal, discount, shipping, total: subtotal - discount + shipping }
}
