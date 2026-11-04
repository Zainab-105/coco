import type { Metadata } from 'next'

import { Container } from '@/components/ui/Layout'
import { findSubscriberByToken } from '@/lib/marketing/server'

import { UnsubscribeForm } from './UnsubscribeForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Unsubscribe', robots: { index: false, follow: false } }

type Props = { searchParams: Promise<{ token?: string }> }

const mask = (email: string) => email.replace(/^(.{2})[^@]*/, (_, start: string) => `${start}***`)

/**
 * Newsletter unsubscribe. Needs a button press (not just opening the link), so email scanners
 * that prefetch links cannot unsubscribe people by accident.
 */
export default async function UnsubscribePage({ searchParams }: Props) {
  const { token = '' } = await searchParams
  const subscriber = token ? await findSubscriberByToken(token.slice(0, 40)) : null

  return (
    <Container className="max-w-xl py-16 text-center">
      <h1 className="text-4xl text-burgundy-700">Unsubscribe</h1>
      {!subscriber ? (
        <p className="mt-6 text-sm text-muted">This link is not valid or has expired. Message us and we will remove you from our list.</p>
      ) : subscriber.status === 'unsubscribed' ? (
        <p className="mt-6 text-sm text-muted">{mask(subscriber.email)} is already unsubscribed from COCO emails.</p>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted">Stop sending new scents and offers to {mask(subscriber.email)}? Order emails are not affected.</p>
          <UnsubscribeForm token={token} />
        </>
      )}
    </Container>
  )
}
