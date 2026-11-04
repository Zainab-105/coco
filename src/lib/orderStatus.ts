export const ORDER_STATUSES = [
  'new',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'refunded',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const PAYMENT_METHODS = ['cod', 'jazzcash', 'easypaisa', 'bank_transfer'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: 'Cash on Delivery',
  jazzcash: 'JazzCash',
  easypaisa: 'Easypaisa',
  bank_transfer: 'Bank transfer',
}

export const PAYMENT_STATUSES = ['pending', 'awaiting_verification', 'paid', 'failed', 'refunded'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/** Statuses that never count towards revenue. */
export const NON_REVENUE_STATUSES: OrderStatus[] = ['cancelled', 'returned', 'refunded']

/** Statuses in which an order's items are no longer on the shelf. */
export function holdsStock(status: OrderStatus, deductOn: 'placed' | 'confirmed'): boolean {
  if (NON_REVENUE_STATUSES.includes(status)) return false
  if (status === 'new') return deductOn === 'placed'
  return true
}

export type CustomerSegment = 'new' | 'repeat' | 'high_value' | 'inactive'

export function customerSegment(
  stats: { orderCount: number; totalSpent: number; lastOrderAt?: Date | null },
  opts: { highValueThreshold: number; inactiveAfterDays: number; now?: Date },
): CustomerSegment {
  const now = opts.now ?? new Date()
  if (stats.lastOrderAt) {
    const days = (now.getTime() - stats.lastOrderAt.getTime()) / 86_400_000
    if (days > opts.inactiveAfterDays) return 'inactive'
  }
  if (stats.totalSpent >= opts.highValueThreshold) return 'high_value'
  if (stats.orderCount > 1) return 'repeat'
  return 'new'
}
