import { Lock } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { AutoSubmitForm } from '@/components/checkout/AutoSubmitForm'
import { Container } from '@/components/ui/Layout'
import { findCustomerOrder } from '@/lib/checkout/server'
import { formatPKR } from '@/lib/format'
import { siteUrl } from '@/lib/payments'
import { buildEasypaisaRequest, easypaisaConfig } from '@/lib/payments/easypaisa'
import { buildJazzCashRequest, jazzcashConfig } from '@/lib/payments/jazzcash'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Redirecting to payment', robots: { index: false, follow: false } }

type Props = { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> }

/** Builds the signed gateway request server-side and hands the browser to JazzCash / Easypaisa. */
export default async function PayPage({ params, searchParams }: Props) {
  const { number } = await params
  const { t } = await searchParams
  const order = t ? await findCustomerOrder(number, { token: t }) : null
  if (!order) notFound()
  const orderPage = `/order/${order.orderNumber}?t=${t}`
  if (order.payment.status === 'paid' || order.status !== 'new') redirect(orderPage)

  const total = order.total ?? 0
  let request: { action: string; fields: Record<string, string> } | null = null
  if (order.payment.method === 'jazzcash') {
    const cfg = jazzcashConfig()
    if (cfg) request = buildJazzCashRequest(cfg, { orderNumber: order.orderNumber!, total }, `${siteUrl()}/api/payments/jazzcash/return`)
  } else if (order.payment.method === 'easypaisa') {
    const cfg = easypaisaConfig()
    if (cfg) {
      request = buildEasypaisaRequest(
        cfg,
        { orderNumber: order.orderNumber!, total, email: order.email, phone: order.shippingAddress.phone },
        `${siteUrl()}/api/payments/easypaisa/return`,
      )
    }
  }
  if (!request) redirect(orderPage)

  const gateway = order.payment.method === 'jazzcash' ? 'JazzCash' : 'Easypaisa'
  return (
    <Container className="max-w-xl py-24 text-center">
      <Lock size={36} strokeWidth={1.25} className="mx-auto text-burgundy-700" />
      <h1 className="mt-4 text-3xl text-burgundy-700">Taking you to {gateway}</h1>
      <p className="mt-2 text-sm text-muted">
        Order {order.orderNumber} &middot; {formatPKR(total)}. Don&apos;t close this window.
      </p>
      <AutoSubmitForm action={request.action} fields={request.fields} label={`Continue to ${gateway}`} />
    </Container>
  )
}
