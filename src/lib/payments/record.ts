import 'server-only'

import { getPayload } from 'payload'

import config from '@/payload.config'

export type PaymentOutcome = {
  orderNumber: string
  status: 'paid' | 'failed' | 'awaiting_verification'
  amount?: number
  transactionId?: string
  raw?: unknown
}

/**
 * Applies a verified gateway result to an order. Idempotent (a paid order is never downgraded)
 * and refuses to mark an order paid if the amount differs from the order total.
 */
export async function recordPayment(outcome: PaymentOutcome) {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: outcome.orderNumber } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const order = docs[0]
  if (!order) return null
  if (order.payment.status === 'paid') return order

  let status = outcome.status
  if (status === 'paid' && outcome.amount != null && Math.round(outcome.amount) !== Math.round(order.total ?? -1)) {
    payload.logger.error(`Payment amount mismatch for ${order.orderNumber}: got ${outcome.amount}, expected ${order.total}`)
    status = 'awaiting_verification'
  }

  return payload.update({
    collection: 'orders',
    id: order.id,
    overrideAccess: true,
    depth: 0,
    data: {
      // A verified online payment confirms a new order automatically.
      status: status === 'paid' && order.status === 'new' ? 'confirmed' : order.status,
      payment: {
        ...order.payment,
        status,
        transactionId: outcome.transactionId ?? order.payment.transactionId,
        paidAt: status === 'paid' ? new Date().toISOString() : order.payment.paidAt,
        gatewayResponse: (outcome.raw ?? null) as never,
      },
    },
  })
}
