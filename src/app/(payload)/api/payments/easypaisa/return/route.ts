import { getPayload } from 'payload'

import config from '@/payload.config'
import { siteUrl } from '@/lib/payments'
import { buildEasypaisaConfirm, easypaisaConfig, inquireEasypaisaTransaction } from '@/lib/payments/easypaisa'
import { recordPayment } from '@/lib/payments/record'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Easypay calls this twice: first with an auth_token (we confirm it), then with the final status. */
async function handle(request: Request) {
  const cfg = easypaisaConfig()
  if (!cfg) return new Response('Easypaisa is not configured', { status: 503 })

  const url = new URL(request.url)
  const params = new URLSearchParams(url.search)
  if (request.method === 'POST') {
    const form = await request.formData()
    for (const [k, v] of form.entries()) params.set(k, String(v))
  }

  const authToken = params.get('auth_token')
  if (authToken) {
    const confirm = buildEasypaisaConfirm(cfg, authToken, `${siteUrl()}/api/payments/easypaisa/return`)
    const inputs = Object.entries(confirm.fields)
      .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
      .join('')
    const html = `<!doctype html><html><body onload="document.forms[0].submit()" style="font-family:sans-serif;text-align:center;padding:48px">
<p>Confirming your Easypaisa payment...</p><form method="POST" action="${esc(confirm.action)}">${inputs}<button type="submit">Continue</button></form></body></html>`
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  const orderNumber = params.get('orderRefNumber') ?? params.get('orderRefNum') ?? ''
  if (!orderNumber) return Response.redirect(`${siteUrl()}/`, 303)

  // The redirect itself is not trusted; only the server-side inquiry can mark the order paid.
  const inquiry = await inquireEasypaisaTransaction(cfg, orderNumber).catch(() => ({ verified: false, paid: false }) as const)
  const reportedSuccess = params.get('status')?.toLowerCase() === 'success' || params.get('status') === '0000'
  await recordPayment({
    orderNumber,
    status: inquiry.paid ? 'paid' : reportedSuccess || !inquiry.verified ? 'awaiting_verification' : 'failed',
    amount: 'amount' in inquiry ? inquiry.amount : undefined,
    transactionId: 'transactionId' in inquiry ? inquiry.transactionId : undefined,
    raw: { redirect: Object.fromEntries(params), inquiry: 'raw' in inquiry ? inquiry.raw : null },
  })

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: orderNumber } },
    select: { accessToken: true },
    limit: 1,
    overrideAccess: true,
  })
  const token = docs[0]?.accessToken
  const failed = !inquiry.paid && !reportedSuccess ? '&payment=failed' : ''
  return Response.redirect(token ? `${siteUrl()}/order/${orderNumber}?t=${token}${failed}` : `${siteUrl()}/`, 303)
}

export const GET = handle
export const POST = handle
