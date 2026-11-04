import type { Metadata } from 'next'
import { headers } from 'next/headers'

import { OrderDetails } from '@/components/checkout/OrderDetails'
import { OrderTimeline } from '@/components/checkout/OrderTimeline'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Container } from '@/components/ui/Layout'
import { findCustomerOrder } from '@/lib/checkout/server'
import { normalizePkPhone } from '@/lib/phone'
import { clientIp, throttled } from '@/lib/throttle'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Track your order', robots: { index: false, follow: true } }

type Props = { searchParams: Promise<{ order?: string; phone?: string }> }

/** Order lookup by order number + the phone number used at checkout (both required). */
export default async function TrackOrderPage({ searchParams }: Props) {
  const { order: orderNumber = '', phone = '' } = await searchParams
  const searched = Boolean(orderNumber && phone)
  const normalized = normalizePkPhone(phone)
  // Stops guessing phone numbers against an order number. Pages are re-rendered, so count searches only.
  const limited = searched && throttled(`track-order:${clientIp(await headers())}`, 20)
  const order = searched && !limited && normalized ? await findCustomerOrder(orderNumber.slice(0, 30), { phone: normalized }) : null

  return (
    <Container className="max-w-4xl py-10">
      <h1 className="text-4xl text-burgundy-700">Track your order</h1>
      <p className="mt-2 text-sm text-muted">Enter the order number from your confirmation and the mobile number you used at checkout.</p>

      <form action="/track-order" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <TextField name="order" label="Order number" placeholder="COCO-261102-ABCD" defaultValue={orderNumber} required />
        <TextField name="phone" label="Mobile number" type="tel" inputMode="tel" placeholder="03XX XXXXXXX" defaultValue={phone} required />
        <Button type="submit">Track</Button>
      </form>

      {searched && !order && (
        <p className="mt-8 border-l-4 border-danger bg-danger/5 px-4 py-3 text-sm text-danger">
          {limited
            ? 'Too many searches. Please wait a few minutes or message us on WhatsApp.'
            : "We couldn't find an order with those details. Check the order number and phone, or message us on WhatsApp."}
        </p>
      )}

      {order && (
        <div className="mt-10 space-y-10">
          <p className="text-sm">
            Order <strong>{order.orderNumber}</strong>
          </p>
          <OrderTimeline status={order.status} />
          <OrderDetails order={order} />
        </div>
      )}
    </Container>
  )
}
