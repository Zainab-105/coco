import { randomUUID } from 'node:crypto'

import 'server-only'

import { getPayload, type Payload } from 'payload'

import type { CustomerAccount, Order, Product } from '@/payload-types'
import config from '@/payload.config'
import { findCustomerOrder } from '@/lib/checkout/server'
import { ticketAlertEmail, ticketReceivedEmail } from '@/lib/email/templates'

import { sniffUpload, uploadProblem } from './uploads'
import { TICKET_TYPES, type FieldErrors, type ReviewForm, type TicketForm } from './validate'

export type IncomingFile = { size: number; bytes: Uint8Array }
export type SubmitResult = { ok: true; id: number } | { ok: false; errors: FieldErrors }

const client = () => getPayload({ config })
const relId = (value: unknown) => (typeof value === 'object' && value ? (value as { id: number }).id : (value as number | null | undefined))

class UnreadableFile extends Error {}

/** Stores files under random names, private until a review using them is approved. */
async function saveUploads(payload: Payload, files: IncomingFile[]): Promise<number[]> {
  const ids: number[] = []
  try {
    for (const file of files) {
      const type = sniffUpload(file.bytes)!
      const doc = await payload
        .create({
          collection: 'customer-uploads',
          data: { isPublic: false },
          file: { data: Buffer.from(file.bytes), mimetype: type.mimeType, name: `${randomUUID()}.${type.extension}`, size: file.size },
          overrideAccess: true,
        })
        .catch((error) => {
          payload.logger.warn({ err: error }, 'Rejected a customer upload')
          throw new UnreadableFile()
        })
      ids.push(doc.id)
    }
    return ids
  } catch (error) {
    await discardUploads(payload, ids)
    throw error
  }
}

async function discardUploads(payload: Payload, ids: number[]) {
  if (ids.length) await payload.delete({ collection: 'customer-uploads', where: { id: { in: ids } }, overrideAccess: true })
}

const FILE_ERROR: SubmitResult = { ok: false, errors: { files: 'We could not read one of your files. Please try another photo or video.' } }

const hasProduct = (order: Order, productId: number) => (order.items ?? []).some((i) => relId(i.product) === productId)

/**
 * The delivered order that proves this person bought the product: from the order link or order
 * number + phone, or a signed-in customer's own orders. Delivered only, so nobody can review
 * something still on its way or already returned.
 */
async function findPurchase(payload: Payload, form: ReviewForm, account?: CustomerAccount | null): Promise<Order | null> {
  if (form.orderNumber) {
    const order = await findCustomerOrder(form.orderNumber, { token: form.orderToken, phone: form.phone })
    return order && order.status === 'delivered' && hasProduct(order, form.productId) ? order : null
  }
  if (!account) return null
  const { docs } = await payload.find({
    collection: 'orders',
    where: {
      and: [{ email: { equals: account.email } }, { status: { equals: 'delivered' } }, { 'items.product': { equals: form.productId } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return docs[0] ?? null
}

/** Saves a review as pending for moderation. Verified only when a matching delivered order is found. */
export async function submitReview(form: ReviewForm, files: IncomingFile[], account?: CustomerAccount | null): Promise<SubmitResult> {
  const problem = uploadProblem(files)
  if (problem) return { ok: false, errors: { files: problem } }

  const payload = await client()
  const product = await payload
    .findByID({ collection: 'products', id: form.productId, depth: 0, overrideAccess: true, disableErrors: true })
    .catch(() => null)
  if (!product || (product as Product).status !== 'published') return { ok: false, errors: { form: 'This product is not available.' } }

  const purchase = await findPurchase(payload, form, account)
  if (form.orderNumber && !purchase) {
    return {
      ok: false,
      errors: { orderNumber: 'We could not match a delivered order for this product. Check the details, or leave them blank to post without the badge.' },
    }
  }
  const customer = relId(purchase?.customer) ?? undefined
  if (purchase) {
    const { totalDocs } = await payload.count({
      collection: 'reviews',
      where: {
        and: [
          { product: { equals: form.productId } },
          { or: [{ order: { equals: purchase.id } }, ...(customer ? [{ customer: { equals: customer } }] : [])] },
        ],
      },
      overrideAccess: true,
    })
    if (totalDocs) return { ok: false, errors: { form: 'You have already reviewed this product. Thank you!' } }
  }

  let attachments: number[]
  try {
    attachments = await saveUploads(payload, files)
  } catch (error) {
    if (error instanceof UnreadableFile) return FILE_ERROR
    throw error
  }
  try {
    const review = await payload.create({
      collection: 'reviews',
      data: {
        product: form.productId,
        authorName: form.authorName,
        rating: form.rating,
        title: form.title,
        body: form.body,
        attachments,
        status: 'pending',
        verifiedPurchase: Boolean(purchase),
        order: purchase?.id,
        customer,
      },
      overrideAccess: true,
    })
    return { ok: true, id: review.id }
  } catch (error) {
    await discardUploads(payload, attachments)
    throw error
  }
}

/** Creates a support ticket, alerts the store and acknowledges to the customer. */
export async function submitTicket(form: TicketForm, files: IncomingFile[]): Promise<SubmitResult> {
  const problem = uploadProblem(files)
  if (problem) return { ok: false, errors: { files: problem } }

  const payload = await client()
  // Linked for staff only when number and phone agree; otherwise the typed reference is kept as text.
  const order = form.orderNumber && form.phone ? await findCustomerOrder(form.orderNumber, { phone: form.phone }) : null
  const customerMatch = form.phone
    ? await payload.find({ collection: 'customers', where: { phone: { equals: form.phone } }, limit: 1, depth: 0, overrideAccess: true })
    : undefined

  let attachments: number[]
  try {
    attachments = await saveUploads(payload, files)
  } catch (error) {
    if (error instanceof UnreadableFile) return FILE_ERROR
    throw error
  }
  try {
    const ticket = await payload.create({
      collection: 'support-tickets',
      data: {
        type: form.type,
        priority: form.type === 'complaint' ? 'high' : 'normal',
        subject: `${TICKET_TYPES[form.type]}: ${form.message.replace(/\s+/g, ' ').slice(0, 60)}`,
        name: form.name,
        phone: form.phone,
        email: form.email,
        message: form.message,
        orderReference: form.orderNumber,
        order: order?.id,
        customer: customerMatch?.docs[0]?.id,
        attachments,
        status: 'open',
      },
      overrideAccess: true,
    })
    void notifyTicket(payload, ticket.id, form)
    return { ok: true, id: ticket.id }
  } catch (error) {
    await discardUploads(payload, attachments)
    throw error
  }
}

/** Emails must never block or fail the submission. */
async function notifyTicket(payload: Payload, id: number, form: TicketForm) {
  try {
    const settings = await payload.findGlobal({ slug: 'store-settings', depth: 0 })
    if (settings.supportEmail) await payload.sendEmail({ to: settings.supportEmail, ...ticketAlertEmail(id, form) })
    if (form.email) await payload.sendEmail({ to: form.email, ...ticketReceivedEmail(id) })
  } catch (error) {
    payload.logger.error({ err: error }, `Failed to send emails for ticket ${id}`)
  }
}
