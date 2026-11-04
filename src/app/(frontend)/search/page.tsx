import type { Metadata } from 'next'
import { Search } from 'lucide-react'

import { ProductGrid } from '@/components/product/ProductGrid'
import { ButtonLink } from '@/components/ui/Button'
import { Container } from '@/components/ui/Layout'
import { searchProducts } from '@/lib/storefront/catalog'

type Props = { searchParams: Promise<{ q?: string }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams
  return { title: q ? `Search: ${q}` : 'Search', robots: { index: false, follow: true } }
}

export default async function SearchPage({ searchParams }: Props) {
  const q = ((await searchParams).q ?? '').slice(0, 80).trim()
  const results = q.length >= 2 ? await searchProducts(q, 48) : []

  return (
    <Container className="py-10">
      <h1 className="text-4xl text-burgundy-700">Search</h1>
      <form role="search" action="/search" className="mt-6 flex max-w-xl items-center gap-3 border-b-2 border-burgundy-700 pb-2">
        <Search size={20} className="text-muted" aria-hidden />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search scents, diffusers, gift sets..."
          aria-label="Search products"
          className="min-h-11 flex-1 bg-transparent text-lg outline-none [&::-webkit-search-cancel-button]:hidden"
        />
      </form>

      {q.length >= 2 && (
        <p className="mt-6 text-sm text-muted" aria-live="polite">
          {results.length} {results.length === 1 ? 'result' : 'results'} for &quot;{q}&quot;
        </p>
      )}

      {results.length > 0 ? (
        <ProductGrid products={results} className="mt-6" />
      ) : (
        q.length >= 2 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="font-display text-3xl text-burgundy-700">Nothing found</p>
            <p className="text-sm text-muted">Check the spelling or try a fragrance name like &quot;Rose&quot; or &quot;Oud&quot;.</p>
            <ButtonLink href="/collections" variant="outline">
              Browse all products
            </ButtonLink>
          </div>
        )
      )}
    </Container>
  )
}
