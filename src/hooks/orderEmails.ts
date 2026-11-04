import type { CollectionAfterChangeHook, Payload } from 'payload'

import type { Order } from '@/payload-types'
import { orderConfirmationEmail, orderDeliveredEmail, orderShippedEmail } from '@/lib/email/templates'

export async function sendOrderEmail(payload: Payload, order: Order, kind: 'confirmation' | 'shipped' | 'delivered') {
  if (!order.email) return
  const message =
    kind === 'confirmation' ? orderConfirmationEmail(order) : kind === 'shipped' ? orderShippedEmail(order) : orderDeliveredEmail(order)
  try {
    await payload.sendEmail({ to: order.email, ...message })
  } catch (error) {
    // Email problems must never block order processing.
    payload.logger.error({ err: error }, `Failed to send ${kind} email for ${order.orderNumber}`)
  }
}

/** Status emails when the owner marks an order shipped or delivered in the admin. */
export const sendStatusEmails: CollectionAfterChangeHook<Order> = async ({ doc, previousDoc, operation, req }) => {
  if (operation !== 'update' || doc.status === previousDoc?.status) return doc
  if (doc.status === 'shipped' || doc.status === 'delivered') {
    // Don't hold up the admin save while the mail server responds.
    void sendOrderEmail(req.payload, doc, doc.status)
  }
  return doc
}
