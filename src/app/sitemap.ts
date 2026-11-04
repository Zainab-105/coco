import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'

import config from '@/payload.config'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const staticPages = ['', '/collections', '/contact', '/faq', '/pages/shipping', '/pages/returns', '/pages/privacy', '/pages/terms'].map(
    (path) => ({ url: `${base}${path}`, changeFrequency: 'weekly' as const, priority: path === '' ? 1 : 0.5 }),
  )

  try {
    const payload = await getPayload({ config })
    const [products, categories] = await Promise.all([
      payload.find({
        collection: 'products',
        where: { status: { equals: 'published' } },
        select: { slug: true, updatedAt: true },
        limit: 1000,
        depth: 0,
      }),
      payload.find({ collection: 'categories', select: { slug: true, updatedAt: true }, limit: 200, depth: 0 }),
    ])
    return [
      ...staticPages,
      ...categories.docs.map((c) => ({ url: `${base}/collections/${c.slug}`, lastModified: c.updatedAt, priority: 0.8 })),
      ...products.docs.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updatedAt, priority: 0.9 })),
    ]
  } catch {
    return staticPages
  }
}
