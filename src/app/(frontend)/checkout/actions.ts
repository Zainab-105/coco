'use server'

import { headers } from 'next/headers'
import { getPayload } from 'payload'

import config from '@/payload.config'

import type { Quote, QuoteLineInput } from '@/lib/checkout/quote'
import { CheckoutError, placeOrder, quoteCart } from '@/lib/checkout/server'
import { validateCheckout, type CheckoutErrors } from '@/lib/checkout/validate'
import { addAddress } from '@/lib/account/core'
import { getCurrentAccount } from '@/lib/account/server'
import { markCartsRecovered, saveCheckoutCart, subscribe } from '@/lib/marketing/server'
import { normalizePkPhone } from '@/lib/phone'
import { TURNSTILE_FAILED, verifyTurnstile } from '@/lib/security/turnstile'
import { clientIp, throttled } from '@/lib/throttle'

const sanitizeLines = (lines: unknown): QuoteLineInput[] =>
  Array.isArray(lines)
    ? lines
        .slice(0, 30)
        .map((l) => ({
          productId: Number(l?.productId),
          variantId: typeof l?.variantId === 'string' ? l.variantId.slice(0, 40) : undefined,
          quantity: Number(l?.quantity),
          expectedUnitPrice: Number.isFinite(Number(l?.expectedUnitPrice)) ? Number(l.expectedUnitPrice) : undefined,
        }))
        .filter((l) => Number.isInteger(l.productId) && l.productId > 0 && Number.isFinite(l.quantity) && l.quantity > 0)
    : []

export async function getQuoteAction(input: {
  lines: QuoteLineInput[]
  couponCode?: string
  city?: string
  giftWrap?: boolean
  phone?: string
}): Promise<Quote> {
  return quoteCart({
    lines: sanitizeLines(input.lines),
    couponCode: input.couponCode?.slice(0, 30) || undefined,
    city: input.city?.slice(0, 60),
    giftWrap: Boolean(input.giftWrap),
    phone: input.phone ? (normalizePkPhone(input.phone) ?? undefined) : undefined,
  })
}

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; token: string; redirectTo: string }
  | { ok: false; errors: CheckoutErrors; quote?: Quote }

/**
 * Saves the checkout in progress (abandoned-cart capture) once a valid phone or email is typed.
 * Best effort: failures never affect the visitor.
 */
export async function saveCheckoutDraftAction(input: {
  token: string
  form: Record<string, unknown>
  lines: unknown
}): Promise<void> {
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined)
  const token = text(input.token, 40) ?? ''
  if (throttled(`draft:${token}`, 30)) return
  try {
    await saveCheckoutCart({
      token,
      fullName: text(input.form?.fullName, 80),
      phone: text(input.form?.phone, 20),
      email: text(input.form?.email, 120),
      city: text(input.form?.city, 60),
      marketingConsent: input.form?.marketingConsent === true,
      lines: sanitizeLines(input.lines),
    })
  } catch (error) {
    console.warn('[checkout] could not save cart', (error as Error).message)
  }
}

export async function placeOrderAction(input: { form: Record<string, unknown>; lines: unknown; cartToken?: string; turnstile?: string }): Promise<PlaceOrderResult> {
  const { data, errors } = validateCheckout(input.form ?? {})
  if (!data) return { ok: false, errors }

  const ip = clientIp(await headers())
  if (throttled(`ip:${ip}`) || throttled(`phone:${data.phone}`, 4)) {
    return { ok: false, errors: { form: 'Too many orders in a short time. Please wait a few minutes or message us on WhatsApp.' } }
  }

  const lines = sanitizeLines(input.lines)
  if (!lines.length) return { ok: false, errors: { cart: 'Your cart is empty.' } }
  if (!(await verifyTurnstile(input.turnstile, ip))) return { ok: false, errors: { form: TURNSTILE_FAILED } }

  try {
    // A signed-in customer's order joins their history even if they cleared the email field.
    const account = await getCurrentAccount()
    if (account) data.email ??= account.email

    const order = await placeOrder(data, lines)
    // Marketing bookkeeping runs after the order is committed and never blocks it.
    void Promise.allSettled([
      markCartsRecovered({ id: order.id, phone: data.phone }, typeof input.cartToken === 'string' ? input.cartToken : undefined),
      data.marketingConsent && data.email ? subscribe(data.email, 'checkout') : Promise.resolve(false),
      account && !account.addresses?.length
        ? getPayload({ config }).then((payload) => addAddress(payload, account, { city: data.city, address: data.address }))
        : Promise.resolve(null),
    ]).then((results) =>
      results.forEach((r) => r.status === 'rejected' && console.warn('[checkout] post-order marketing step failed', r.reason)),
    )
    const query = `?t=${order.accessToken}`
    const redirectTo =
      order.paymentMethod === 'jazzcash' || order.paymentMethod === 'easypaisa'
        ? `/checkout/pay/${order.orderNumber}${query}`
        : `/order/${order.orderNumber}${query}&placed=1`
    return { ok: true, orderNumber: order.orderNumber, token: order.accessToken, redirectTo }
  } catch (error) {
    if (error instanceof CheckoutError) return { ok: false, errors: { form: error.message }, quote: error.quote }
    const message = error instanceof Error ? error.message : ''
    if (message.startsWith('Not enough stock')) return { ok: false, errors: { form: message } }
    console.error('[checkout] placeOrder failed', error)
    return { ok: false, errors: { form: 'We could not place your order. Please try again or order on WhatsApp.' } }
  }
}
