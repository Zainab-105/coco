import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/orderStatus'
import { normalizePkPhone } from '@/lib/phone'

/** Server-side validation of the checkout form. Returns clean values or per-field messages. */
export type CheckoutForm = {
  fullName: string
  phone: string
  email?: string
  city: string
  address: string
  landmark?: string
  paymentMethod: PaymentMethod
  giftWrap: boolean
  giftNote?: string
  couponCode?: string
  marketingConsent: boolean
  /** Honeypot: real people never fill this hidden field. */
  website?: string
}

export type CheckoutErrors = Partial<Record<keyof CheckoutForm | 'cart' | 'form', string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export function validateCheckout(raw: Record<string, unknown>): { data?: CheckoutForm; errors: CheckoutErrors } {
  const errors: CheckoutErrors = {}
  const fullName = clean(raw.fullName, 80)
  const phone = normalizePkPhone(clean(raw.phone, 20))
  const email = clean(raw.email, 120).toLowerCase()
  const city = clean(raw.city, 60)
  const address = typeof raw.address === 'string' ? raw.address.trim().slice(0, 300) : ''
  const paymentMethod = clean(raw.paymentMethod, 20) as PaymentMethod

  if (fullName.length < 3) errors.fullName = 'Please enter your full name.'
  if (!phone) errors.phone = 'Enter a valid Pakistani mobile number, e.g. 0300 1234567.'
  if (email && !EMAIL.test(email)) errors.email = 'Please check your email address.'
  if (city.length < 2) errors.city = 'Please enter your city.'
  if (address.length < 10) errors.address = 'Please enter your complete address (house, street, area).'
  if (!PAYMENT_METHODS.includes(paymentMethod)) errors.paymentMethod = 'Please choose a payment method.'

  if (Object.keys(errors).length) return { errors }
  return {
    errors,
    data: {
      fullName,
      phone: phone!,
      email: email || undefined,
      city,
      address,
      landmark: clean(raw.landmark, 120) || undefined,
      paymentMethod,
      giftWrap: raw.giftWrap === true || raw.giftWrap === 'on',
      giftNote: clean(raw.giftNote, 300) || undefined,
      couponCode: clean(raw.couponCode, 30).toUpperCase() || undefined,
      marketingConsent: raw.marketingConsent === true || raw.marketingConsent === 'on',
      website: clean(raw.website, 100) || undefined,
    },
  }
}
