import type { Metadata } from 'next'

import { CollectionView } from '@/components/collection/CollectionView'
import { JsonLd } from '@/components/seo/JsonLd'
import { breadcrumbJsonLd } from '@/lib/seo/jsonLd'
import { socialCard } from '@/lib/seo/meta'
import { redirectOrNotFound } from '@/lib/seo/redirectLookup'
import { getCategoryBySlug } from '@/lib/storefront/catalog'
import { toMediaItem } from '@/lib/storefront/mappers'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params
  const found = await getCategoryBySlug(slug)
  if (!found) return {}
  const { category } = found
  const filtered = Object.keys(await searchParams).length > 0
  const image = toMediaItem(category.meta?.image ?? category.image, 'og')?.src
  const title = category.meta?.title ?? category.title
  const description = category.meta?.description ?? category.description ?? `Shop ${category.title} from COCO: premium scents and accessories, delivered across Pakistan with Cash on Delivery.`

  return {
    title,
    description,
    alternates: { canonical: `/collections/${slug}` },
    // Filtered/sorted variants are useful for shoppers but duplicate the canonical page for search engines.
    robots: filtered ? { index: false, follow: true } : undefined,
    ...socialCard({ title, description, url: `/collections/${slug}`, image }),
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const found = await getCategoryBySlug(slug)
  if (!found) return redirectOrNotFound(`/collections/${slug}`)
  const { category, parent, children } = found

  const crumbs = [
    { href: '/', label: 'Home' },
    { href: '/collections', label: 'Shop' },
    ...(parent ? [{ href: `/collections/${parent.slug}`, label: parent.title }] : []),
    { href: `/collections/${slug}`, label: category.title },
  ]

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <CollectionView
        basePath={`/collections/${slug}`}
        title={category.title}
        description={category.description}
        categoryIds={found.ids}
        subcategories={children.map((c) => ({ title: c.title, slug: c.slug ?? '' }))}
        crumbs={crumbs}
        searchParams={await searchParams}
      />
    </>
  )
}
