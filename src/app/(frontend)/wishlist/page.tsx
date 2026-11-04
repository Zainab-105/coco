import type { Metadata } from 'next'
import Link from 'next/link'

import { WishlistView } from '@/components/product/WishlistView'
import { Container } from '@/components/ui/Layout'

export const metadata: Metadata = { title: 'Wishlist', robots: { index: false, follow: true } }

export default function WishlistPage() {
  return (
    <Container className="py-10">
      <h1 className="text-4xl text-burgundy-700">Wishlist</h1>
      <p className="mt-2 text-sm text-muted">
        Saved on this device.{' '}
        <Link href="/account" className="underline underline-offset-2">
          Sign in
        </Link>{' '}
        to keep it across devices.
      </p>
      <WishlistView />
    </Container>
  )
}
