import { describe, expect, it } from 'vitest'

import type { Media, Product } from '@/payload-types'
import { filtersToSearch, parseFilters, priceBounds } from '@/lib/storefront/filters'
import { toMediaItem, toProductCard } from '@/lib/storefront/mappers'

describe('listing filters', () => {
  it('parses and validates URL params', () => {
    const state = parseFilters({ sort: 'price-asc', fragrance: 'sweet-rose,cool-ice', price: '1500-3000', stock: 'in', page: '3' })
    expect(state).toEqual({ sort: 'price-asc', fragrances: ['sweet-rose', 'cool-ice'], price: '1500-3000', inStock: true, page: 3 })
  })

  it('ignores unknown or hostile values', () => {
    const state = parseFilters({ sort: 'drop table', price: 'free', page: '-4', stock: 'yes' })
    expect(state).toEqual({ sort: 'featured', fragrances: [], price: undefined, inStock: false, page: 1 })
    expect(parseFilters({ page: '999' }).page).toBe(20)
  })

  it('round-trips through the URL and omits defaults', () => {
    expect(filtersToSearch({ sort: 'featured', fragrances: [], inStock: false, page: 1 })).toBe('')
    const search = filtersToSearch({ sort: 'newest', fragrances: ['sweet-rose'], price: 'over-5000', inStock: true, page: 2 })
    expect(parseFilters(Object.fromEntries(new URLSearchParams(search)))).toEqual({
      sort: 'newest',
      fragrances: ['sweet-rose'],
      price: 'over-5000',
      inStock: true,
      page: 2,
    })
  })

  it('maps price ranges to bounds', () => {
    expect(priceBounds('1500-3000')).toEqual({ minPrice: 1500, maxPrice: 3000 })
    expect(priceBounds(undefined)).toEqual({ minPrice: undefined, maxPrice: undefined })
  })
})

const image = (id: number, name: string): Media =>
  ({
    id,
    alt: name,
    url: `/api/media/file/${name}.webp`,
    mimeType: 'image/webp',
    sizes: { card: { url: `/api/media/file/${name}-640x800.webp` } },
    updatedAt: '',
    createdAt: '',
  }) as Media

describe('product mapping', () => {
  it('prefers resized images and maps videos with posters', () => {
    expect(toMediaItem(image(1, 'bottle'))?.src).toBe('/api/media/file/bottle-640x800.webp')
    const video = { id: 2, alt: 'Clip', url: '/v.mp4', mimeType: 'video/mp4', poster: image(3, 'poster') } as Media
    expect(toMediaItem(video)).toEqual({ type: 'video', src: '/v.mp4', alt: 'Clip', poster: '/api/media/file/poster-640x800.webp' })
    expect(toMediaItem(5)).toBeNull()
  })

  it('maps a variable product to a card with selectable fragrances', () => {
    const product = {
      id: 7,
      slug: 'hanging-car-diffuser',
      title: 'Hanging Car Diffuser',
      productType: 'variable',
      price: 1450,
      salePrice: 1199,
      stockStatus: 'in_stock',
      ratingAverage: 4.7,
      ratingCount: 3,
      gallery: [{ media: image(1, 'bottle') }],
      variants: [
        { id: 'v1', label: 'Sweet Rose', stock: 10, fragrance: { id: 1, name: 'Sweet Rose', swatch: '#7A1F2B', mood: 'Floral' } },
        { id: 'v2', label: 'Forest Pine', stock: 0, price: 1650 },
      ],
    } as unknown as Product

    const card = toProductCard(product)
    expect(card).toMatchObject({ id: '7', subtitle: '2 fragrances', requiresOption: true, rating: { average: 4.7, count: 3 } })
    expect(card.fragrances?.[0]).toMatchObject({ id: 'v1', swatch: '#7A1F2B', available: true, price: 1450, salePrice: 1199 })
    // A variant with its own price does not inherit the product's sale price.
    expect(card.fragrances?.[1]).toMatchObject({ id: 'v2', available: false, price: 1650, salePrice: undefined })
  })

  it('falls back to the brand logo when a product has no media', () => {
    const card = toProductCard({ id: 1, title: 'X', price: 100, productType: 'simple', stock: 3 } as Product)
    expect(card.media[0].src).toBe('/brand/coco-logo-full.png')
    expect(card.stockQuantity).toBe(3)
    expect(card.requiresOption).toBe(false)
  })
})

describe('relativeMediaUrl', () => {
  it('strips the site origin so uploads are served as local images', async () => {
    const { relativeMediaUrl } = await import('@/lib/storefront/mappers')
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://coco.pk/'
    expect(relativeMediaUrl('https://coco.pk/api/media/file/a.webp')).toBe('/api/media/file/a.webp')
    expect(relativeMediaUrl('https://media.coco.pk/media/a.webp')).toBe('https://media.coco.pk/media/a.webp')
    delete process.env.NEXT_PUBLIC_SERVER_URL
  })
})
