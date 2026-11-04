import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Container } from '@/components/ui/Layout'
import { RichText } from '@/components/ui/RichText'
import { getPolicies } from '@/lib/storefront/data'

export const revalidate = 300

const PAGES = {
  shipping: { title: 'Shipping & delivery', key: 'shipping' },
  returns: { title: 'Returns & exchanges', key: 'returns' },
  privacy: { title: 'Privacy policy', key: 'privacy' },
  terms: { title: 'Terms of service', key: 'terms' },
} as const

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = PAGES[(await params).slug as keyof typeof PAGES]
  return page ? { title: page.title, alternates: { canonical: `/pages/${(await params).slug}` } } : {}
}

/** Policy pages, edited by the owner in Store Settings > Policies. */
export default async function PolicyPage({ params }: Props) {
  const page = PAGES[(await params).slug as keyof typeof PAGES]
  if (!page) notFound()
  const content = (await getPolicies())[page.key]

  return (
    <Container className="max-w-3xl py-12">
      <h1 className="text-4xl text-burgundy-700 sm:text-5xl">{page.title}</h1>
      <div className="mt-8">
        {content ? (
          <RichText data={content} className="text-base" />
        ) : (
          <p className="text-sm text-muted">This page is being updated. Please contact us on WhatsApp for details.</p>
        )}
      </div>
    </Container>
  )
}
