import { getPayload } from 'payload'

import config from '@/payload.config'
import { siteUrl } from '@/lib/payments'
import { jazzcashConfig, verifyJazzCashResponse } from '@/lib/payments/jazzcash'
import { recordPayment } from '@/lib/payments/record'

/** JazzCash posts the signed transaction result here, then we send the customer to their order page. */
export async function POST(request: Request) {
  const cfg = jazzcashConfig()
  if (!cfg) return new Response('JazzCash is not configured', { status: 503 })

  const form = await request.formData()
  const fields = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]))
  const result = verifyJazzCashResponse(cfg, fields)

  const payload = await getPayload({ config })
  if (!result.valid) {
    payload.logger.warn(`Rejected JazzCash callback: ${result.reason} (${fields.pp_BillReference ?? 'no ref'})`)
    return Response.redirect(`${siteUrl()}/`, 303)
  }

  await recordPayment({
    orderNumber: result.orderNumber,
    status: result.paid ? 'paid' : result.pending ? 'awaiting_verification' : 'failed',
    amount: result.amount,
    transactionId: result.transactionId,
    raw: fields,
  })

  const { docs } = await payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: result.orderNumber } },
    select: { accessToken: true },
    limit: 1,
    overrideAccess: true,
  })
  const token = docs[0]?.accessToken
  const status = result.paid ? '' : '&payment=failed'
  return Response.redirect(token ? `${siteUrl()}/order/${result.orderNumber}?t=${token}${status}` : `${siteUrl()}/`, 303)
}
