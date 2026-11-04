/** Schema.org structured data for search results. Pure builders, so the output can be tested. */
export const siteUrl = () => (process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/** Search engines need absolute URLs; uploads and pages are usually site-relative. */
export const absoluteUrl = (url: string) => (/^https?:\/\//.test(url) ? url : `${siteUrl()}${url.startsWith('/') ? '' : '/'}${url}`)

type ReviewInput = { authorName: string; rating: number; title?: string | null; body?: string | null; date: string }

export type ProductLdInput = {
  title: string
  slug: string
  description?: string | null
  sku?: string | null
  images: string[]
  /** Prices customers pay: one per option, or a single price. */
  prices: number[]
  inStock: boolean
  ratingAverage?: number | null
  ratingCount?: number | null
  reviews?: ReviewInput[]
}

export function productJsonLd(p: ProductLdInput) {
  const url = absoluteUrl(`/products/${p.slug}`)
  const availability = p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
  const low = Math.min(...p.prices)
  const high = Math.max(...p.prices)
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: p.description ?? undefined,
    sku: p.sku ?? undefined,
    brand: { '@type': 'Brand', name: 'COCO' },
    image: p.images.map(absoluteUrl),
    url,
    offers:
      low === high
        ? { '@type': 'Offer', priceCurrency: 'PKR', price: low, availability, url }
        : { '@type': 'AggregateOffer', priceCurrency: 'PKR', lowPrice: low, highPrice: high, offerCount: p.prices.length, availability, url },
    aggregateRating: p.ratingCount ? { '@type': 'AggregateRating', ratingValue: p.ratingAverage, reviewCount: p.ratingCount } : undefined,
    review: p.reviews?.length
      ? p.reviews.slice(0, 5).map((r) => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: r.authorName },
          datePublished: r.date.slice(0, 10),
          name: r.title ?? undefined,
          reviewBody: r.body ?? undefined,
          reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
        }))
      : undefined,
  }
}

export const breadcrumbJsonLd = (crumbs: { href: string; label: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: absoluteUrl(c.href) })),
})

export const organizationJsonLd = (s: { storeName: string; supportPhone?: string; supportEmail?: string; social: Record<string, string | undefined> }) => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: s.storeName,
  url: absoluteUrl('/'),
  logo: absoluteUrl('/brand/coco-logo-full.png'),
  sameAs: Object.values(s.social).filter(Boolean),
  contactPoint:
    s.supportPhone || s.supportEmail
      ? { '@type': 'ContactPoint', contactType: 'customer support', telephone: s.supportPhone, email: s.supportEmail, areaServed: 'PK' }
      : undefined,
})

export const websiteJsonLd = (storeName: string) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: storeName,
  url: absoluteUrl('/'),
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${absoluteUrl('/search')}?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
})

export const faqJsonLd = (faqs: { question: string; answer: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
})

/** Safe inside a <script> tag: customer text (reviews) cannot close it. */
export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c')
