import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { TrackEvent } from '@/components/analytics/Analytics'
import { ClearCart, SwitchToCodButton, TransferReferenceForm } from '@/components/checkout/OrderActions'
import { OrderDetails } from '@/components/checkout/OrderDetails'
import { OrderTimeline } from '@/components/checkout/OrderTimeline'
import { WhatsAppIcon } from '@/components/ui/BrandIcons'
import { ButtonLink, buttonClasses } from '@/components/ui/Button'
import { Container } from '@/components/ui/Layout'
import config from '@/payload.config'
import { findCustomerOrder } from '@/lib/checkout/server'
import { formatPKR, whatsappLink } from '@/lib/format'
import { getStorefrontSettings } from '@/lib/storefront/data'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Your order', robots: { index: false, follow: false } }

type Props = {
  params: Promise<{ number: string }>
  searchParams: Promise<{ t?: string; placed?: string; payment?: string }>
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { number } = await params
  const { t, placed, payment } = await searchParams
  const order = t ? await findCustomerOrder(number, { token: t }) : null
  if (!order) notFound()

  const [settings, store] = await Promise.all([
    getStorefrontSettings(),
    getPayload({ config }).then((p) => p.findGlobal({ slug: 'store-settings', depth: 0 })),
  ])
  const online = order.payment.method === 'jazzcash' || order.payment.method === 'easypaisa'
  const unpaidOnline = online && order.payment.status !== 'paid' && order.status === 'new'
  const waMessage = `Hi COCO, about my order ${order.orderNumber}.`
  const reviewable = [
    ...new Map(
      (order.items ?? []).flatMap((i) =>
        typeof i.product === 'object' && i.product.slug ? [[i.product.slug, { slug: i.product.slug, title: i.product.title }] as const] : [],
      ),
    ).values(),
  ]

  return (
    <Container className="max-w-4xl py-10">
      {(placed || order.payment.status === 'paid') && <ClearCart />}
      {(placed || (payment && order.payment.status === 'paid')) && (
        <TrackEvent
          name="purchase"
          once={order.orderNumber ?? String(order.id)}
          value={order.total ?? 0}
          shipping={order.shippingFee ?? 0}
          items={(order.items ?? []).map((i) => ({
            item_id: String(typeof i.product === 'object' ? i.product.id : i.product),
            item_name: i.title,
            item_variant: i.variantLabel ?? undefined,
            price: i.unitPrice,
            quantity: i.quantity,
          }))}
        />
      )}

      <header className="text-center">
        {payment === 'failed' || order.payment.status === 'failed' ? (
          <XCircle size={44} strokeWidth={1.25} className="mx-auto text-danger" />
        ) : order.payment.status === 'paid' || order.payment.method === 'cod' ? (
          <CheckCircle2 size={44} strokeWidth={1.25} className="mx-auto text-success" />
        ) : (
          <Clock size={44} strokeWidth={1.25} className="mx-auto text-gold-500" />
        )}
        <h1 className="mt-4 text-4xl text-burgundy-700 sm:text-5xl">
          {placed ? `Thank you, ${order.shippingAddress.fullName.split(' ')[0]}!` : 'Your order'}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Order <strong className="text-ink">{order.orderNumber}</strong> &middot; {formatPKR(order.total ?? 0)}
        </p>
        {order.email && placed && <p className="mt-1 text-xs text-muted">A confirmation has been sent to {order.email}.</p>}
      </header>

      <div className="mt-10">
        <OrderTimeline status={order.status} />
      </div>

      <section className="mt-10 border border-blush-200 bg-nude-100/60 p-5 text-sm leading-relaxed">
        {order.payment.method === 'cod' && (
          <p>
            <strong>Cash on Delivery.</strong> We&apos;ll call or WhatsApp you on {order.shippingAddress.phone.replace('+92', '0')} to
            confirm. Please keep {formatPKR(order.total ?? 0)} ready when the courier arrives.
          </p>
        )}

        {order.payment.method === 'bank_transfer' && order.payment.status !== 'paid' && (
          <>
            <p>
              <strong>Complete your payment.</strong> Transfer {formatPKR(order.total ?? 0)} using the details below and enter the
              transaction ID. Your order is confirmed once we verify the payment (a screenshot alone is not enough).
            </p>
            {store.payments?.manualTransferInstructions && (
              <p className="mt-3 whitespace-pre-line border-l-2 border-gold-500 bg-white px-4 py-3">{store.payments.manualTransferInstructions}</p>
            )}
            <TransferReferenceForm orderNumber={order.orderNumber!} token={t!} current={order.payment.transactionId} />
          </>
        )}

        {online && order.payment.status === 'paid' && <p><strong>Payment received.</strong> Thank you! We&apos;re preparing your order.</p>}

        {unpaidOnline && (
          <div className="space-y-4">
            <p>
              <strong>{order.payment.status === 'failed' || payment === 'failed' ? 'Your payment did not go through.' : 'Payment not completed yet.'}</strong>{' '}
              Your order is saved. You can try again or switch to Cash on Delivery.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={`/checkout/pay/${order.orderNumber}?t=${t}`}>Try payment again</ButtonLink>
              <SwitchToCodButton orderNumber={order.orderNumber!} token={t!} />
            </div>
          </div>
        )}

        {online && order.payment.status === 'awaiting_verification' && (
          <p className="mt-3">We&apos;re confirming your payment with the bank. This page will update once it&apos;s verified.</p>
        )}
      </section>

      <div className="mt-10">
        <OrderDetails order={order} />
      </div>

      {order.status === 'delivered' && reviewable.length > 0 && (
        <section className="mt-8 border border-blush-200 bg-white p-5 text-sm">
          <h2 className="text-2xl text-burgundy-700">How was it?</h2>
          <p className="mt-1 text-muted">A short review helps other customers choose. Your review gets a Verified purchase badge.</p>
          <ul className="mt-3 space-y-2">
            {reviewable.map(({ slug, title }) => (
              <li key={slug}>
                <Link href={`/products/${slug}?order=${order.orderNumber}&t=${t}#write-review`} className="underline">
                  Review {title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {settings.whatsappNumber && (
          <a href={whatsappLink(settings.whatsappNumber, waMessage)} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'whatsapp' })}>
            <WhatsAppIcon size={18} /> Questions? WhatsApp us
          </a>
        )}
        <ButtonLink href="/collections" variant="outline">
          Continue shopping
        </ButtonLink>
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        Bookmark this page to check your order status any time. Something wrong?{' '}
        <Link href={`/contact?order=${order.orderNumber}`} className="underline">
          Contact us
        </Link>
        .
      </p>
    </Container>
  )
}
