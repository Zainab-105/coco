'use server'

import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { findCustomerOrder, loadQuoteSettings } from '@/lib/checkout/server'

/** Customer submits the transaction ID of a manual JazzCash/Easypaisa/bank transfer. Staff still verify it. */
export async function submitTransferReference(orderNumber: string, token: string, formData: FormData) {
  const reference = String(formData.get('reference') ?? '').trim().slice(0, 60)
  if (reference.length < 4) return { ok: false, message: 'Please enter the transaction ID from your payment app.' }
  const order = await findCustomerOrder(orderNumber, { token })
  if (!order || order.payment.method !== 'bank_transfer' || order.payment.status === 'paid') {
    return { ok: false, message: 'This order cannot be updated.' }
  }
  const payload = await getPayload({ config })
  await payload.update({
    collection: 'orders',
    id: order.id,
    overrideAccess: true,
    data: { payment: { ...order.payment, transactionId: reference, status: 'awaiting_verification' } },
  })
  revalidatePath(`/order/${orderNumber}`)
  return { ok: true, message: 'Thanks! We will confirm your order once the payment is verified.' }
}

/** After a failed or abandoned online payment, the customer can switch to Cash on Delivery. */
export async function switchToCashOnDelivery(orderNumber: string, token: string) {
  const order = await findCustomerOrder(orderNumber, { token })
  if (!order || order.payment.status === 'paid' || order.payment.method === 'cod' || order.status !== 'new') {
    return { ok: false, message: 'This order cannot be changed. Please contact us.' }
  }
  const payload = await getPayload({ config })
  const settings = await loadQuoteSettings(payload)
  const limit = settings.payments.codMaxOrderValue ?? 0
  if (!settings.payments.codEnabled || (limit > 0 && (order.total ?? 0) > limit)) {
    return { ok: false, message: 'Cash on Delivery is not available for this order.' }
  }
  await payload.update({
    collection: 'orders',
    id: order.id,
    overrideAccess: true,
    data: { payment: { ...order.payment, method: 'cod', status: 'pending' } },
  })
  revalidatePath(`/order/${orderNumber}`)
  return { ok: true, message: 'Switched to Cash on Delivery.' }
}
