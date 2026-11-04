import 'server-only'

import { getPayload, type Payload, type Where } from 'payload'

import type { Subscriber } from '@/payload-types'
import config from '@/payload.config'
import { quoteCart } from '@/lib/checkout/server'
import type { QuoteLineInput } from '@/lib/checkout/quote'
import { normalizePkPhone } from '@/lib/phone'

const getPayloadClient = () => getPayload({ config })

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const normalizeEmail = (input: unknown): string | null => {
  if (typeof input !== 'string') return null
  const email = input.trim().toLowerCase().slice(0, 254)
  return EMAIL.test(email) ? email : null
}

/**
 * Adds an email to the newsletter list, or re-subscribes it. Returns false for invalid input.
 * Someone who unsubscribed is only re-subscribed by an explicit new sign-up (`source`).
 */
export async function subscribe(email: string, source: 'footer' | 'checkout' | 'account', payload?: Payload): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  const client = payload ?? (await getPayloadClient())
  const now = new Date().toISOString()
  const { docs } = await client.find({
    collection: 'subscribers',
    where: { email: { equals: normalized } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const existing = docs[0]
  if (!existing) {
    await client.create({
      collection: 'subscribers',
      data: { email: normalized, status: 'subscribed', source, consentAt: now },
      overrideAccess: true,
    })
  } else if (existing.status !== 'subscribed') {
    await client.update({
      collection: 'subscribers',
      id: existing.id,
      data: { status: 'subscribed', source, consentAt: now, unsubscribedAt: null },
      overrideAccess: true,
    })
  }
  return true
}

export async function findSubscriberByToken(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'subscribers',
    where: { unsubscribeToken: { equals: token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return docs[0] ?? null
}

/** Whether this email currently receives offers (account page). */
export async function isSubscribed(email: string) {
  const payload = await getPayloadClient()
  const { totalDocs } = await payload.count({
    collection: 'subscribers',
    where: { and: [{ email: { equals: email } }, { status: { equals: 'subscribed' } }] },
    overrideAccess: true,
  })
  return totalDocs > 0
}

/** For a signed-in customer, whose email is already proven. */
export async function unsubscribeEmail(email: string) {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({ collection: 'subscribers', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
  if (docs[0]) await withdraw(payload, docs[0])
}

/** Unsubscribes by the private token. */
export async function unsubscribe(token: string): Promise<boolean> {
  const subscriber = await findSubscriberByToken(token)
  if (!subscriber) return false
  await withdraw(await getPayloadClient(), subscriber)
  return true
}

/** Marks the subscriber unsubscribed and withdraws email consent on matching customer profiles. */
async function withdraw(payload: Payload, subscriber: Subscriber) {
  const now = new Date().toISOString()
  if (subscriber.status !== 'unsubscribed') {
    await payload.update({
      collection: 'subscribers',
      id: subscriber.id,
      data: { status: 'unsubscribed', unsubscribedAt: now },
      overrideAccess: true,
    })
  }
  const { docs: customers } = await payload.find({
    collection: 'customers',
    where: { and: [{ email: { equals: subscriber.email } }, { 'marketing.emailConsent': { equals: true } }] },
    depth: 0,
    limit: 20,
    overrideAccess: true,
  })
  for (const c of customers) {
    await payload.update({
      collection: 'customers',
      id: c.id,
      data: { marketing: { ...c.marketing, emailConsent: false, consentUpdatedAt: now } },
      overrideAccess: true,
    })
  }
}

export type CheckoutSnapshot = {
  token: string
  fullName?: string
  phone?: string
  email?: string
  city?: string
  marketingConsent?: boolean
  lines: QuoteLineInput[]
}

const TOKEN = /^[0-9a-f-]{36}$/i

/**
 * Saves (or refreshes) the visitor's checkout as a cart, priced from the database. Needs a
 * valid phone or email; otherwise nothing is stored. Recovered carts are never reopened.
 */
export async function saveCheckoutCart(input: CheckoutSnapshot): Promise<boolean> {
  if (!TOKEN.test(input.token) || !input.lines.length) return false
  const phone = input.phone ? normalizePkPhone(input.phone) : null
  const email = normalizeEmail(input.email)
  if (!phone && !email) return false

  const payload = await getPayloadClient()
  const quote = await quoteCart({ lines: input.lines })
  if (!quote.lines.length) return false

  const data = {
    name: input.fullName?.trim().slice(0, 80) || undefined,
    phone: phone ?? undefined,
    email: email ?? undefined,
    city: input.city?.trim().slice(0, 60) || undefined,
    marketingConsent: Boolean(input.marketingConsent),
    items: quote.lines.map((l) => ({
      product: l.productId,
      variantId: l.variantId,
      title: l.title,
      variantLabel: l.variantLabel,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    })),
    subtotal: quote.subtotal,
    lastActivityAt: new Date().toISOString(),
  }

  const { docs } = await payload.find({
    collection: 'carts',
    where: { token: { equals: input.token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const existing = docs[0]
  if (existing?.status === 'recovered') return false
  if (existing) await payload.update({ collection: 'carts', id: existing.id, data, overrideAccess: true })
  else await payload.create({ collection: 'carts', data: { ...data, token: input.token, status: 'open' }, overrideAccess: true })
  return true
}

/**
 * After an order is placed: the visitor's cart, and any other open cart for the same phone from
 * the last 14 days, count as recovered by that order.
 */
export async function markCartsRecovered(order: { id: number; phone: string }, token?: string, payload?: Payload) {
  const client = payload ?? (await getPayloadClient())
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const match: Where[] = [
    { and: [{ phone: { equals: order.phone } }, { lastActivityAt: { greater_than_equal: since } }] },
    ...(token && TOKEN.test(token) ? [{ token: { equals: token } }] : []),
  ]
  await client.update({
    collection: 'carts',
    where: { and: [{ status: { in: ['open', 'contacted'] } }, { or: match }] },
    data: { status: 'recovered', order: order.id },
    overrideAccess: true,
  })
}
