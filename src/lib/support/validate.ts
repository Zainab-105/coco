import { normalizePkPhone } from '@/lib/phone'

/** Validation for the public review and contact forms. Messages are shown under each field. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

export type FieldErrors = Record<string, string>

export type ReviewForm = {
  productId: number
  authorName: string
  rating: number
  title?: string
  body: string
  orderNumber?: string
  orderToken?: string
  phone?: string
}

export function validateReview(raw: Record<string, unknown>): { data?: ReviewForm; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const productId = Number(raw.productId)
  const rating = Number(raw.rating)
  const authorName = text(raw.authorName, 60)
  const body = text(raw.body, 2000)
  const orderNumber = text(raw.orderNumber, 30).toUpperCase()
  const orderToken = text(raw.orderToken, 64)
  const rawPhone = text(raw.phone, 20)
  const phone = rawPhone ? normalizePkPhone(rawPhone) : undefined

  if (!Number.isInteger(productId) || productId <= 0) errors.form = 'Something went wrong. Please reload the page and try again.'
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = 'Please choose a star rating.'
  if (authorName.length < 2) errors.authorName = 'Please enter your name.'
  if (body.length < 10) errors.body = 'Please write at least a few words.'
  if (phone === null) errors.phone = 'Enter a valid Pakistani mobile number, e.g. 0300 1234567.'
  if (orderNumber && !orderToken && !phone && !errors.phone) errors.phone = 'Enter the mobile number used for this order.'
  if (Object.keys(errors).length) return { errors }

  return {
    errors,
    data: {
      productId,
      rating,
      authorName,
      body,
      title: text(raw.title, 100) || undefined,
      orderNumber: orderNumber || undefined,
      orderToken: orderToken || undefined,
      phone: phone ?? undefined,
    },
  }
}

export const TICKET_TYPES = {
  enquiry: 'Question',
  complaint: 'Complaint',
  return: 'Return or exchange',
  feedback: 'Feedback',
} as const
export type TicketType = keyof typeof TICKET_TYPES

export type TicketForm = {
  type: TicketType
  name: string
  phone?: string
  email?: string
  orderNumber?: string
  message: string
}

export function validateTicket(raw: Record<string, unknown>): { data?: TicketForm; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const name = text(raw.name, 80)
  const message = text(raw.message, 4000)
  const email = text(raw.email, 120).toLowerCase()
  const rawPhone = text(raw.phone, 20)
  const phone = rawPhone ? normalizePkPhone(rawPhone) : undefined
  const type = (text(raw.type, 20) in TICKET_TYPES ? text(raw.type, 20) : 'enquiry') as TicketType

  if (name.length < 2) errors.name = 'Please enter your name.'
  if (phone === null) errors.phone = 'Enter a valid Pakistani mobile number, e.g. 0300 1234567.'
  if (email && !EMAIL.test(email)) errors.email = 'Please check your email address.'
  if (!phone && !email && !errors.phone) errors.phone = 'Please give a mobile number or email so we can reply.'
  if (message.length < 10) errors.message = 'Please tell us a little more.'
  if (Object.keys(errors).length) return { errors }

  return {
    errors,
    data: {
      type,
      name,
      message,
      phone: phone ?? undefined,
      email: email || undefined,
      orderNumber: text(raw.orderNumber, 30).toUpperCase() || undefined,
    },
  }
}
