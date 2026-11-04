import type { MediaItem, ProductCardData, ProductOption } from '@/components/product/types'
import type { Category, Fragrance, Media, Product } from '@/payload-types'

type Rel<T> = T | number | string | null | undefined

export const isDoc = <T extends object>(value: Rel<T>): value is T => typeof value === 'object' && value !== null

/** Same-origin upload URLs are made relative so next/image serves them as local files. */
export function relativeMediaUrl(url: string): string {
  const origin = process.env.NEXT_PUBLIC_SERVER_URL?.replace(/\/$/, '')
  return origin && url.startsWith(`${origin}/`) ? url.slice(origin.length) : url
}

/** Converts a Payload media doc to a storefront media item, preferring a resized rendition for images. */
export function toMediaItem(media: Rel<Media>, size: 'card' | 'large' | 'og' = 'card'): MediaItem | null {
  if (!isDoc(media) || !media.url) return null
  if (media.mimeType?.startsWith('video/')) {
    return {
      type: 'video',
      src: relativeMediaUrl(media.url),
      alt: media.alt,
      poster: isDoc(media.poster) ? relativeMediaUrl(media.poster.sizes?.[size]?.url ?? media.poster.url ?? '') || undefined : undefined,
    }
  }
  if (!media.mimeType?.startsWith('image/')) return null
  return { type: 'image', src: relativeMediaUrl(media.sizes?.[size]?.url ?? media.url), alt: media.alt }
}

export function galleryOf(product: Product, size: 'card' | 'large' = 'card'): MediaItem[] {
  return (product.gallery ?? []).map((g) => toMediaItem(g.media, size)).filter((m): m is MediaItem => m !== null)
}

export function optionsOf(product: Product): ProductOption[] {
  if (product.productType !== 'variable') return []
  return (product.variants ?? []).map((v) => {
    const fragrance = isDoc<Fragrance>(v.fragrance) ? v.fragrance : null
    const stock = v.stock ?? 0
    return {
      id: v.id ?? v.label,
      name: v.label,
      swatch: fragrance?.swatch,
      mood: fragrance?.mood,
      available: stock > 0,
      price: v.price ?? product.price,
      salePrice: v.price != null ? v.salePrice : (v.salePrice ?? product.salePrice),
      stock,
      image: toMediaItem(v.image, 'card')?.src,
    }
  })
}

export function toProductCard(product: Product): ProductCardData {
  const category = isDoc<Category>(product.category) ? product.category : null
  const options = optionsOf(product)
  const media = galleryOf(product)

  return {
    id: String(product.id),
    slug: product.slug ?? String(product.id),
    title: product.title,
    subtitle: options.length > 1 ? `${options.length} fragrances` : (category?.title ?? undefined),
    price: product.price,
    salePrice: product.salePrice,
    stock: product.stockStatus ?? 'in_stock',
    stockQuantity: product.productType === 'variable' ? undefined : (product.stock ?? 0),
    isNew: Boolean(product.isNewArrival),
    media: media.length ? media : [{ type: 'image', src: '/brand/coco-logo-full.png', alt: product.title }],
    rating: product.ratingCount ? { average: product.ratingAverage ?? 0, count: product.ratingCount } : undefined,
    fragrances: options.length ? options : undefined,
    requiresOption: options.length > 0,
  }
}
