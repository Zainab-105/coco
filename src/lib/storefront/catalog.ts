import 'server-only'

import { getPayload, type Where } from 'payload'
import { cache } from 'react'

import type { ProductCardData } from '@/components/product/types'
import type { Banner, Category, CustomerUpload, Fragrance, Product, Review } from '@/payload-types'
import config from '@/payload.config'

import { SORTS, type SortKey } from './filters'
import { isDoc, relativeMediaUrl, toMediaItem, toProductCard } from './mappers'

export const PAGE_SIZE = 12


export type ProductFilters = {
  categoryIds?: number[]
  fragranceIds?: number[]
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  sort?: SortKey
  /** Number of pages to return cumulatively ("Load more"). */
  page?: number
}

const payload = () => getPayload({ config })
const published: Where = { status: { equals: 'published' } }

export async function listProducts(filters: ProductFilters = {}) {
  const and: Where[] = [published]
  if (filters.categoryIds?.length) and.push({ category: { in: filters.categoryIds } })
  if (filters.fragranceIds?.length) and.push({ fragrances: { in: filters.fragranceIds } })
  if (filters.minPrice != null) and.push({ effectivePrice: { greater_than_equal: filters.minPrice } })
  if (filters.maxPrice != null) and.push({ effectivePrice: { less_than_equal: filters.maxPrice } })
  if (filters.inStock) and.push({ stockStatus: { not_equals: 'out_of_stock' } })

  const pages = Math.max(1, Math.min(filters.page ?? 1, 20))
  const result = await (await payload()).find({
    collection: 'products',
    where: { and },
    sort: [...SORTS[filters.sort ?? 'featured'].sort],
    limit: PAGE_SIZE * pages,
    depth: 2,
  })

  return {
    products: result.docs.map(toProductCard),
    total: result.totalDocs,
    hasMore: result.totalDocs > result.docs.length,
  }
}

export const getCategories = cache(async () => {
  const { docs } = await (await payload()).find({ collection: 'categories', sort: 'sortOrder', depth: 1, limit: 100 })
  return docs
})

/** Category plus the ids of itself and its sub-categories (a parent shows all child products). */
export const getCategoryBySlug = cache(async (slug: string) => {
  const categories = await getCategories()
  const category = categories.find((c) => c.slug === slug)
  if (!category) return null
  const children = categories.filter((c) => (isDoc<Category>(c.parent) ? c.parent.id : c.parent) === category.id)
  const parent = isDoc<Category>(category.parent) ? category.parent : null
  return { category, parent, children, ids: [category.id, ...children.map((c) => c.id)] }
})

export const getFragrances = cache(async () => {
  const { docs } = await (await payload()).find({ collection: 'fragrances', sort: 'name', depth: 0, limit: 100 })
  return docs as Fragrance[]
})

export const getProductBySlug = cache(async (slug: string) => {
  const { docs } = await (await payload()).find({
    collection: 'products',
    where: { and: [published, { slug: { equals: slug } }] },
    depth: 2,
    limit: 1,
  })
  return (docs[0] as Product | undefined) ?? null
})

export async function getProductCardsByIds(ids: number[]): Promise<ProductCardData[]> {
  if (!ids.length) return []
  const { docs } = await (await payload()).find({
    collection: 'products',
    where: { and: [published, { id: { in: ids } }] },
    depth: 2,
    limit: ids.length,
  })
  const byId = new Map(docs.map((d) => [d.id, toProductCard(d)]))
  return ids.map((id) => byId.get(id)).filter((p): p is ProductCardData => Boolean(p))
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<ProductCardData[]> {
  const picked = (product.relatedProducts ?? []).filter(isDoc<Product>).filter((p) => p.status === 'published')
  if (picked.length >= limit) return picked.slice(0, limit).map(toProductCard)

  const categoryId = isDoc<Category>(product.category) ? product.category.id : product.category
  const { docs } = await (await payload()).find({
    collection: 'products',
    where: { and: [published, { id: { not_in: [product.id, ...picked.map((p) => p.id)] } }, { category: { not_equals: categoryId } }] },
    sort: '-salesCount',
    depth: 2,
    limit: limit - picked.length,
  })
  return [...picked, ...docs].map(toProductCard)
}

export async function searchProducts(query: string, limit = 24): Promise<ProductCardData[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const { docs } = await (await payload()).find({
    collection: 'products',
    where: {
      and: [
        published,
        {
          or: [
            { title: { like: q } },
            { shortDescription: { like: q } },
            { sku: { like: q } },
            { 'variants.label': { like: q } },
            { 'fragrances.name': { like: q } },
            { 'category.title': { like: q } },
          ],
        },
      ],
    },
    sort: '-salesCount',
    depth: 2,
    limit,
  })
  return docs.map(toProductCard)
}

export async function listByFlag(flag: 'featured' | 'isNewArrival' | 'bestselling', limit = 8) {
  const where: Where =
    flag === 'bestselling' ? published : { and: [published, { [flag]: { equals: true } }] }
  const { docs } = await (await payload()).find({
    collection: 'products',
    where,
    sort: '-salesCount',
    depth: 2,
    limit,
  })
  return docs.map(toProductCard)
}

export async function listGiftSets(limit = 4) {
  const { docs } = await (await payload()).find({
    collection: 'products',
    where: { and: [published, { productType: { equals: 'bundle' } }] },
    sort: '-featured',
    depth: 2,
    limit,
  })
  return docs.map(toProductCard)
}

export type HeroSlide = {
  id: number
  title: string
  subtitle?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
  desktop?: string
  mobile?: string
}

export async function getHeroSlides(): Promise<HeroSlide[]> {
  const now = new Date().toISOString()
  const { docs } = await (await payload()).find({
    collection: 'banners',
    where: {
      and: [
        { placement: { equals: 'hero' } },
        { active: { equals: true } },
        { or: [{ startsAt: { exists: false } }, { startsAt: { less_than_equal: now } }] },
        { or: [{ endsAt: { exists: false } }, { endsAt: { greater_than: now } }] },
      ],
    },
    sort: 'sortOrder',
    depth: 1,
  })
  return (docs as Banner[]).map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    ctaLabel: b.ctaLabel,
    ctaUrl: b.ctaUrl,
    desktop: toMediaItem(b.desktopImage, 'large')?.src,
    mobile: toMediaItem(b.mobileImage ?? b.desktopImage, 'large')?.src,
  }))
}

export type ReviewView = {
  id: number
  authorName: string
  rating: number
  title?: string | null
  body?: string | null
  verified: boolean
  date: string
  productTitle?: string
  productSlug?: string
  photos: string[]
  videos: string[]
  adminReply?: string | null
}

const reviewUploads = (r: Review) => (r.attachments ?? []).filter((a): a is CustomerUpload => isDoc<CustomerUpload>(a) && Boolean(a.url))

const toReview = (r: Review): ReviewView => ({
  id: r.id,
  authorName: r.authorName,
  rating: r.rating,
  title: r.title,
  body: r.body,
  verified: Boolean(r.verifiedPurchase),
  date: r.createdAt,
  productTitle: isDoc<Product>(r.product) ? r.product.title : undefined,
  productSlug: isDoc<Product>(r.product) ? (r.product.slug ?? undefined) : undefined,
  photos: reviewUploads(r)
    .filter((u) => u.kind === 'image')
    .map((u) => relativeMediaUrl(u.sizes?.card?.url ?? u.url!)),
  videos: reviewUploads(r)
    .filter((u) => u.kind === 'video')
    .map((u) => relativeMediaUrl(u.url!)),
  adminReply: r.adminReply,
})

/** Approved reviews per star rating. The list on the page is limited, so this is counted separately. */
export async function getRatingDistribution(productId: number) {
  const { docs } = await (await payload()).find({
    collection: 'reviews',
    where: { and: [{ status: { equals: 'approved' } }, { product: { equals: productId } }] },
    pagination: false,
    depth: 0,
    select: { rating: true },
  })
  return [5, 4, 3, 2, 1].map((stars) => ({ stars, n: docs.filter((r) => r.rating === stars).length }))
}

export async function getApprovedReviews(productId?: number, limit = 20): Promise<ReviewView[]> {
  const and: Where[] = [{ status: { equals: 'approved' } }]
  if (productId) and.push({ product: { equals: productId } })
  const { docs } = await (await payload()).find({
    collection: 'reviews',
    where: { and },
    sort: '-createdAt',
    depth: 1,
    limit,
  })
  return docs.map(toReview)
}
