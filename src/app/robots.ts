import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  // SITE_INDEXABLE lets audit builds on other hosts see what production serves.
  const isProduction = process.env.SITE_INDEXABLE === '1' || (base.includes('coco.pk') && !base.includes('staging'))

  return {
    // Staging and local environments must never be indexed.
    rules: isProduction
      ? {
          userAgent: '*',
          // Image files live under /api, and Google must be able to fetch them for product results.
          allow: ['/', '/api/media/file/', '/api/customer-uploads/file/'],
          disallow: ['/admin', '/api', '/search', '/wishlist', '/checkout', '/account', '/order', '/track-order', '/unsubscribe', '/print', '/design-system'],
        }
      : { userAgent: '*', disallow: '/' },
    sitemap: `${base}/sitemap.xml`,
  }
}
