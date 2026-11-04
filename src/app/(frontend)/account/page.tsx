import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'

import { AccountDetails, AddressBook, OffersToggle, SignInForm, SignOut } from '@/components/account/AccountForms'
import { Container } from '@/components/ui/Layout'
import config from '@/payload.config'
import { accountOrders } from '@/lib/account/core'
import { getCurrentAccount } from '@/lib/account/server'
import { formatPKR } from '@/lib/format'
import { isSubscribed } from '@/lib/marketing/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'My account', robots: { index: false, follow: false } }

const date = (iso: string) => new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })

/** Optional account: sign in with an emailed code. Checkout never requires it. */
export default async function AccountPage() {
  const account = await getCurrentAccount()

  if (!account) {
    return (
      <Container className="max-w-md py-12">
        <h1 className="text-4xl text-burgundy-700">My account</h1>
        <p className="mt-2 text-sm text-muted">Sign in with a code sent to your email, no password needed. See your orders, save addresses and keep your wishlist on every device.</p>
        <SignInForm />
        <p className="mt-6 text-xs text-muted">
          Ordered as a guest? Your orders appear here if you sign in with the email you used at checkout. You can also{' '}
          <Link href="/track-order" className="underline">
            track an order
          </Link>{' '}
          without an account.
        </p>
      </Container>
    )
  }

  const [orders, subscribed] = await Promise.all([accountOrders(await getPayload({ config }), account), isSubscribed(account.email)])

  return (
    <Container className="max-w-4xl py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-4xl text-burgundy-700">{account.name ? `Hi, ${account.name.split(' ')[0]}` : 'My account'}</h1>
          <p className="mt-1 text-sm text-muted">{account.email}</p>
        </div>
        <SignOut />
      </div>

      <section aria-labelledby="orders-title" className="mt-10">
        <h2 id="orders-title" className="text-2xl text-burgundy-700">
          Your orders
        </h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No orders with this email yet.{' '}
            <Link href="/collections" className="underline">
              Start shopping
            </Link>
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-blush-200 border border-blush-200 bg-white text-sm">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/order/${o.orderNumber}?t=${o.accessToken}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-4 hover:bg-nude-100/40">
                  <span>
                    <span className="block font-medium">{o.orderNumber}</span>
                    <span className="text-xs text-muted">{date(o.createdAt)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="bg-nude-100 px-2 py-0.5 text-xs capitalize">{o.status}</span>
                    <span>{formatPKR(o.total ?? 0)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-2">
        <AddressBook addresses={(account.addresses ?? []).map((a) => ({ id: a.id ?? '', label: a.label ?? '', city: a.city, address: a.address }))} />
        <div className="space-y-10">
          <AccountDetails name={account.name ?? ''} phone={account.phone ?? ''} />
          <OffersToggle subscribed={subscribed} />
          <p className="text-sm">
            <Link href="/wishlist" className="underline">
              Your wishlist
            </Link>{' '}
            is saved to your account.
          </p>
        </div>
      </div>
    </Container>
  )
}
