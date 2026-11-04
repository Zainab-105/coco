import Link from 'next/link'

import { ProductGrid } from '@/components/product/ProductGrid'
import { ButtonLink } from '@/components/ui/Button'
import { Container } from '@/components/ui/Layout'
import { cn } from '@/lib/cn'
import { getFragrances, listProducts, PAGE_SIZE } from '@/lib/storefront/catalog'
import { filtersToSearch, parseFilters, priceBounds } from '@/lib/storefront/filters'
import { slugify } from '@/fields/slug'

import { CollectionToolbar, FilterSidebar } from './CollectionToolbar'

type Crumb = { href: string; label: string }

/** Shared listing for "Shop all" and every category page. */
export async function CollectionView({
  basePath,
  title,
  description,
  categoryIds,
  subcategories = [],
  crumbs,
  searchParams,
}: {
  basePath: string
  title: string
  description?: string | null
  categoryIds?: number[]
  subcategories?: { title: string; slug: string }[]
  crumbs: Crumb[]
  searchParams: Record<string, string | string[] | undefined>
}) {
  const state = parseFilters(searchParams)
  const allFragrances = await getFragrances()
  const fragranceIds = allFragrances.filter((f) => state.fragrances.includes(f.slug ?? '')).map((f) => f.id)

  const { products, total, hasMore } = await listProducts({
    categoryIds,
    fragranceIds,
    ...priceBounds(state.price),
    inStock: state.inStock,
    sort: state.sort,
    page: state.page,
  })
  const facets = allFragrances.map((f) => ({ slug: f.slug ?? slugify(f.name), name: f.name, swatch: f.swatch }))

  return (
    <Container className="pb-16">
      <nav aria-label="Breadcrumb" className="pt-6 text-xs text-muted">
        <ol className="flex flex-wrap gap-1.5">
          {crumbs.map((c, i) => (
            <li key={c.href} className="flex gap-1.5">
              {i > 0 && <span aria-hidden>/</span>}
              {i === crumbs.length - 1 ? <span aria-current="page">{c.label}</span> : <Link href={c.href} className="hover:text-burgundy-700">{c.label}</Link>}
            </li>
          ))}
        </ol>
      </nav>

      <header className="py-6 sm:py-10">
        <h1 className="text-4xl text-burgundy-700 sm:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm text-muted">{description}</p>}
        {subcategories.length > 0 && (
          <ul className="scrollbar-none -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {subcategories.map((s) => (
              <li key={s.slug} className="shrink-0">
                <Link href={`/collections/${s.slug}`} className="flex min-h-10 items-center border border-blush-200 bg-white px-4 text-sm hover:border-burgundy-500">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </header>

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-28">
            <FilterSidebar state={state} fragrances={facets} />
          </div>
        </aside>

        <div>
          <CollectionToolbar state={state} total={total} fragrances={facets} />

          {products.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <p className="font-display text-3xl text-burgundy-700">No products found</p>
              <p className="text-sm text-muted">Try removing a filter or browse all products.</p>
              <ButtonLink href={basePath} variant="outline">
                Clear filters
              </ButtonLink>
            </div>
          ) : (
            <>
              <h2 className="sr-only">Products</h2>
              <ProductGrid products={products} className="mt-6" />
              <div className="mt-12 flex flex-col items-center gap-3">
                <p className="text-xs text-muted">
                  Showing {products.length} of {total}
                </p>
                {hasMore && (
                  <ButtonLink
                    href={`${basePath}${filtersToSearch({ ...state, page: state.page + 1 })}`}
                    scroll={false}
                    variant="outline"
                    className={cn('min-w-48')}
                    aria-label={`Load ${Math.min(PAGE_SIZE, total - products.length)} more products`}
                  >
                    Load more
                  </ButtonLink>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Container>
  )
}
