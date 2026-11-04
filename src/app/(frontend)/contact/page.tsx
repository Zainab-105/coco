import { Mail, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ContactForm } from '@/components/support/ContactForm'
import { WhatsAppIcon } from '@/components/ui/BrandIcons'
import { Container } from '@/components/ui/Layout'
import { whatsappLink } from '@/lib/format'
import { getStorefrontSettings } from '@/lib/storefront/data'

export const metadata: Metadata = { title: 'Contact us', alternates: { canonical: '/contact' } }

type Props = { searchParams: Promise<{ order?: string }> }

export default async function ContactPage({ searchParams }: Props) {
  const [settings, { order }] = await Promise.all([getStorefrontSettings(), searchParams])

  return (
    <Container className="max-w-4xl py-12">
      <h1 className="text-4xl text-burgundy-700 sm:text-5xl">Contact us</h1>
      <p className="mt-2 text-sm text-muted">
        Questions, complaints or returns: we&apos;re here to help. You may also find an answer in our{' '}
        <Link href="/faq" className="underline">
          FAQs
        </Link>
        .
      </p>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_260px]">
        <ContactForm initialOrder={order?.slice(0, 30)} />
        <aside className="space-y-3 text-sm">
          <h2 className="text-2xl text-burgundy-700">Other ways to reach us</h2>
          {settings.whatsappNumber && (
            <a href={whatsappLink(settings.whatsappNumber)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 hover:underline">
              <WhatsAppIcon size={16} /> WhatsApp us
            </a>
          )}
          {settings.supportPhone && (
            <a href={`tel:${settings.supportPhone}`} className="flex min-h-11 items-center gap-2 hover:underline">
              <Phone size={16} /> {settings.supportPhone}
            </a>
          )}
          {settings.supportEmail && (
            <a href={`mailto:${settings.supportEmail}`} className="flex min-h-11 items-center gap-2 hover:underline">
              <Mail size={16} /> {settings.supportEmail}
            </a>
          )}
          <Link href="/track-order" className="block underline">
            Track your order
          </Link>
        </aside>
      </div>
    </Container>
  )
}
