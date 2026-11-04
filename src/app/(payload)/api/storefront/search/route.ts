import { effectivePrice } from '@/lib/pricing'
import { searchProducts } from '@/lib/storefront/catalog'

export type SearchSuggestion = { slug: string; title: string; subtitle?: string; price: number; image?: string }

/** Instant search suggestions for the header search panel. Public, read-only, published products only. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.slice(0, 80) ?? ''
  const products = await searchProducts(q, 6)
  const suggestions: SearchSuggestion[] = products.map((p) => ({
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    price: effectivePrice(p.price, p.salePrice),
    image: p.media.find((m) => m.type === 'image')?.src,
  }))
  return Response.json(suggestions, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } })
}
