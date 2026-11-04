import type { Order } from '@/payload-types'
import { formatPKR } from '@/lib/format'
import { PAYMENT_METHOD_LABELS } from '@/lib/orderStatus'

/** Transactional emails. Inline styles only: email clients ignore stylesheets. */
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const site = () => (process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const orderUrl = (o: Order) => `${site()}/order/${o.orderNumber}?t=${o.accessToken}`

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#faf4ee;font-family:Helvetica,Arial,sans-serif;color:#2b1a1c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff">
<tr><td style="background:#6b1f2a;padding:24px;text-align:center;color:#faf4ee;font-family:Georgia,serif;font-size:28px;letter-spacing:8px">COCO</td></tr>
<tr><td style="padding:28px 24px">
<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-weight:normal;color:#6b1f2a;font-size:24px">${esc(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:16px 24px;background:#f3e3d8;font-size:12px;color:#6e5a5c;text-align:center">Little Scents. Big Vibes. &middot; Questions? Just reply to this email.</td></tr>
</table></td></tr></table></body></html>`
}

function itemsTable(o: Order) {
  const rows = (o.items ?? [])
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #e9cfc2">${esc(i.title)}${i.variantLabel ? `<br><span style="color:#6e5a5c;font-size:12px">${esc(i.variantLabel)}</span>` : ''} &times; ${i.quantity}</td><td style="padding:8px 0;border-bottom:1px solid #e9cfc2;text-align:right">${formatPKR(i.lineTotal ?? 0)}</td></tr>`,
    )
    .join('')
  const line = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:4px 0;${bold ? 'font-weight:bold' : 'color:#6e5a5c'}">${label}</td><td style="padding:4px 0;text-align:right;${bold ? 'font-weight:bold' : ''}">${value}</td></tr>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}
${line('Subtotal', formatPKR(o.subtotal ?? 0))}
${o.discount ? line('Discount', `-${formatPKR(o.discount)}`) : ''}
${line('Delivery', o.shippingFee ? formatPKR(o.shippingFee) : 'Free')}
${o.gift?.wrap && o.gift.wrapFee ? line('Gift wrap', formatPKR(o.gift.wrapFee)) : ''}
${line('Total', formatPKR(o.total ?? 0), true)}</table>`
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#6b1f2a;color:#faf4ee;padding:14px 24px;text-decoration:none;font-size:13px;letter-spacing:2px;text-transform:uppercase">${esc(label)}</a></p>`

export function orderConfirmationEmail(o: Order) {
  const method = PAYMENT_METHOD_LABELS[o.payment.method]
  const next =
    o.payment.method === 'cod'
      ? 'We will call or WhatsApp you shortly to confirm your order. Please keep the exact amount ready at delivery.'
      : o.payment.method === 'bank_transfer'
        ? 'Your order will be confirmed once we verify your payment.'
        : 'Your order is confirmed as soon as your payment is received.'
  const body = `<p style="font-size:14px;line-height:1.6">Hi ${esc(o.shippingAddress.fullName)}, thank you for your order <strong>${esc(o.orderNumber)}</strong>.</p>
<p style="font-size:14px;line-height:1.6">${next}</p>
${itemsTable(o)}
<p style="font-size:14px;line-height:1.6;margin-top:16px"><strong>Payment:</strong> ${esc(method)}<br><strong>Deliver to:</strong> ${esc(o.shippingAddress.fullName)}, ${esc(o.shippingAddress.address)}, ${esc(o.shippingAddress.city)}</p>
${button(orderUrl(o), 'View your order')}`
  return {
    subject: `Your COCO order ${o.orderNumber}`,
    html: layout('Thank you for your order', body),
    text: `Thank you for your order ${o.orderNumber}. Total ${formatPKR(o.total ?? 0)} (${method}). ${next} View it at ${orderUrl(o)}`,
  }
}

export function orderShippedEmail(o: Order) {
  const tracking = o.fulfilment?.trackingNumber
    ? `<p style="font-size:14px;line-height:1.6"><strong>Courier:</strong> ${esc(o.fulfilment.courier ?? '')}<br><strong>Tracking number:</strong> ${esc(o.fulfilment.trackingNumber)}</p>`
    : ''
  return {
    subject: `Your COCO order ${o.orderNumber} is on its way`,
    html: layout('Your order is on its way', `<p style="font-size:14px;line-height:1.6">Good news, ${esc(o.shippingAddress.fullName)}: order <strong>${esc(o.orderNumber)}</strong> has been handed to the courier.</p>${tracking}${o.payment.method === 'cod' ? `<p style="font-size:14px">Amount to pay on delivery: <strong>${formatPKR(o.total ?? 0)}</strong></p>` : ''}${button(orderUrl(o), 'Track your order')}`),
    text: `Order ${o.orderNumber} has shipped.${o.fulfilment?.trackingNumber ? ` Tracking: ${o.fulfilment.courier ?? ''} ${o.fulfilment.trackingNumber}.` : ''} ${orderUrl(o)}`,
  }
}

export function orderDeliveredEmail(o: Order) {
  return {
    subject: `Your COCO order ${o.orderNumber} was delivered`,
    html: layout('Delivered. Enjoy your scent!', `<p style="font-size:14px;line-height:1.6">Hi ${esc(o.shippingAddress.fullName)}, your order <strong>${esc(o.orderNumber)}</strong> has been delivered. We hope it makes every journey better.</p><p style="font-size:14px;line-height:1.6">Loved it? A short review helps other customers choose their scent.</p>${button(orderUrl(o), 'View your order')}`),
    text: `Order ${o.orderNumber} was delivered. Thank you for shopping with COCO.`,
  }
}

export function loginCodeEmail(code: string, minutes: number) {
  return {
    subject: `${code} is your COCO sign-in code`,
    html: layout('Your sign-in code', `<p style="font-size:14px;line-height:1.6">Enter this code on the COCO website to sign in. It works for ${minutes} minutes.</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold;margin:24px 0;color:#6b1f2a">${esc(code)}</p><p style="font-size:13px;line-height:1.6;color:#6e5a5c">Did not ask for this? You can ignore this email. Nobody can sign in without the code, and we will never ask you for it.</p>`),
    text: `Your COCO sign-in code is ${code}. It works for ${minutes} minutes. If you did not ask for it, ignore this email.`,
  }
}

/** Acknowledgement only: never repeats the message, so the form cannot be used to send content to others. */
export function ticketReceivedEmail(id: number) {
  return {
    subject: `We received your message (ref ${id})`,
    html: layout('We received your message', `<p style="font-size:14px;line-height:1.6">Thank you for contacting COCO. Our team will reply as soon as possible. Your reference is <strong>#${id}</strong>.</p>`),
    text: `Thank you for contacting COCO. Our team will reply as soon as possible. Your reference is #${id}.`,
  }
}

export function ticketAlertEmail(id: number, t: { type: string; name: string; phone?: string; email?: string; orderNumber?: string; message: string }) {
  const url = `${site()}/admin/collections/support-tickets/${id}`
  const contact = [t.name, t.phone, t.email, t.orderNumber && `Order ${t.orderNumber}`].filter(Boolean).join(' | ')
  return {
    subject: `New ${t.type} from the website (#${id})`,
    html: layout(`New ${t.type} (#${id})`, `<p style="font-size:14px;line-height:1.6"><strong>${esc(contact)}</strong></p><p style="font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(t.message)}</p>${button(url, 'Open in admin')}`),
    text: `${contact}\n\n${t.message}\n\n${url}`,
  }
}
