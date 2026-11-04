import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'

import { CheckoutForm } from '@/components/checkout/CheckoutForm'
import { Container } from '@/components/ui/Layout'
import config from '@/payload.config'
import { getStorefrontSettings } from '@/lib/storefront/data'

export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } }

export default async function CheckoutPage() {
  const [settings, store] = await Promise.all([
    getStorefrontSettings(),
    getPayload({ config }).then((p) => p.findGlobal({ slug: 'store-settings', depth: 0 })),
  ])

  return (
    <Container className="py-8 sm:py-12">
      <h1 className="text-4xl text-burgundy-700">Checkout</h1>
      <p className="mt-1 text-sm text-muted">
        No account needed.{' '}
        <Link href="/account" className="underline">
          Sign in
        </Link>{' '}
        to use your saved details. We&apos;ll call or WhatsApp you to confirm Cash on Delivery orders.
      </p>
      <CheckoutForm
        giftWrap={{ enabled: Boolean(store.giftWrap?.enabled), price: store.giftWrap?.price ?? 0 }}
        deliveryEstimate={settings.shipping.deliveryEstimate}
        whatsappNumber={settings.whatsappNumber}
      />
    </Container>
  )
}
