import type { Metadata } from 'next'

import { JsonLd } from '@/components/seo/JsonLd'
import { Container } from '@/components/ui/Layout'
import { faqJsonLd } from '@/lib/seo/jsonLd'
import { getPolicies } from '@/lib/storefront/data'

export const revalidate = 300
export const metadata: Metadata = { title: 'FAQs', alternates: { canonical: '/faq' } }

export default async function FaqPage() {
  const { faqs } = await getPolicies()
  return (
    <Container className="max-w-3xl py-12">
      {faqs.length > 0 && <JsonLd data={faqJsonLd(faqs)} />}
      <h1 className="text-4xl text-burgundy-700 sm:text-5xl">Frequently asked questions</h1>
      {faqs.length === 0 && <p className="mt-8 text-sm text-muted">This page is being updated. Please contact us for help.</p>}
      <div className="mt-8 border-t border-blush-200">
        {faqs.map((f) => (
          <details key={f.id} className="group border-b border-blush-200">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-display text-xl [&::-webkit-details-marker]:hidden">
              {f.question}
              <span aria-hidden className="text-lg transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="pb-5 text-sm leading-relaxed text-ink/80">{f.answer}</p>
          </details>
        ))}
      </div>
    </Container>
  )
}
