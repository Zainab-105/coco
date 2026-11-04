import type { Metadata } from 'next'

import { CollectionView } from '@/components/collection/CollectionView'
import { getCategories } from '@/lib/storefront/catalog'

export const metadata: Metadata = {
  title: 'Shop all',
  description: 'Hanging car diffusers, room diffusers, car accessories and gift sets by COCO.',
  alternates: { canonical: '/collections' },
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function ShopAllPage({ searchParams }: Props) {
  const categories = await getCategories()
  const topLevel = categories.filter((c) => !c.parent && c.showInMenu !== false)

  return (
    <CollectionView
      basePath="/collections"
      title="Shop all"
      subcategories={topLevel.map((c) => ({ title: c.title, slug: c.slug ?? '' }))}
      crumbs={[
        { href: '/', label: 'Home' },
        { href: '/collections', label: 'Shop' },
      ]}
      searchParams={await searchParams}
    />
  )
}
