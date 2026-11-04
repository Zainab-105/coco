import 'server-only'

import { getPayload } from 'payload'
import { cache } from 'react'

import config from '@/payload.config'

export type NavCategory = { title: string; slug: string; children: { title: string; slug: string }[] }

export type StorefrontSettings = {
  storeName: string
  tagline: string
  whatsappNumber?: string
  supportEmail?: string
  supportPhone?: string
  social: { instagram?: string; facebook?: string; tiktok?: string }
  shipping: { flatRate: number; freeShippingThreshold: number | null; deliveryEstimate: string }
  announcement?: string
}

/** Launch defaults (see docs/ASSUMPTIONS.md). Used when the database is unreachable or not yet seeded. */
export const DEFAULT_SETTINGS: StorefrontSettings = {
  storeName: 'COCO',
  tagline: 'Little Scents. Big Vibes.',
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || undefined,
  social: {},
  shipping: { flatRate: 250, freeShippingThreshold: 3000, deliveryEstimate: '2-5 working days' },
  announcement: 'Free delivery on orders over Rs 3,000  |  Cash on Delivery nationwide',
}

export const DEFAULT_NAV: NavCategory[] = [
  { title: 'Car Scents', slug: 'car-scents', children: [{ title: 'Hanging Car Diffusers', slug: 'hanging-car-diffusers' }] },
  {
    title: 'Car Accessories',
    slug: 'car-accessories',
    children: [
      { title: 'Car Ashtrays', slug: 'car-ashtrays' },
      { title: 'Car Front Showpieces', slug: 'car-front-showpieces' },
    ],
  },
  { title: 'Home Scents', slug: 'home-scents', children: [{ title: 'Room Diffusers', slug: 'room-diffusers' }] },
  { title: 'Gift Sets', slug: 'gift-sets', children: [] },
]

async function safely<T>(load: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await load()
  } catch (error) {
    console.warn(`[storefront] ${label} unavailable, using defaults:`, (error as Error).message)
    return fallback
  }
}

export const getStorefrontSettings = cache(() =>
  safely(
    async (): Promise<StorefrontSettings> => {
      const payload = await getPayload({ config })
      const [s, banners] = await Promise.all([
        payload.findGlobal({ slug: 'store-settings', depth: 0 }),
        payload.find({
          collection: 'banners',
          where: {
            and: [
              { placement: { equals: 'announcement' } },
              { active: { equals: true } },
              { or: [{ startsAt: { exists: false } }, { startsAt: { less_than_equal: new Date().toISOString() } }] },
              { or: [{ endsAt: { exists: false } }, { endsAt: { greater_than: new Date().toISOString() } }] },
            ],
          },
          sort: 'sortOrder',
          limit: 1,
          depth: 0,
        }),
      ])
      return {
        storeName: s.storeName ?? DEFAULT_SETTINGS.storeName,
        tagline: s.tagline ?? DEFAULT_SETTINGS.tagline,
        whatsappNumber: s.whatsappNumber ?? DEFAULT_SETTINGS.whatsappNumber,
        supportEmail: s.supportEmail ?? undefined,
        supportPhone: s.supportPhone ?? undefined,
        social: {
          instagram: s.social?.instagram ?? undefined,
          facebook: s.social?.facebook ?? undefined,
          tiktok: s.social?.tiktok ?? undefined,
        },
        shipping: {
          flatRate: s.shipping?.flatRate ?? DEFAULT_SETTINGS.shipping.flatRate,
          freeShippingThreshold: s.shipping?.freeShippingThreshold ?? null,
          deliveryEstimate: s.shipping?.deliveryEstimate ?? DEFAULT_SETTINGS.shipping.deliveryEstimate,
        },
        announcement: banners.docs[0]?.title ?? DEFAULT_SETTINGS.announcement,
      }
    },
    DEFAULT_SETTINGS,
    'store settings',
  ),
)

export const getNavCategories = cache(() =>
  safely(
    async (): Promise<NavCategory[]> => {
      const payload = await getPayload({ config })
      const { docs } = await payload.find({
        collection: 'categories',
        where: { showInMenu: { equals: true } },
        sort: 'sortOrder',
        depth: 0,
        limit: 100,
      })
      if (docs.length === 0) return DEFAULT_NAV
      const top = docs.filter((c) => !c.parent)
      return top.map((c) => ({
        title: c.title,
        slug: c.slug ?? '',
        children: docs.filter((d) => d.parent === c.id).map((d) => ({ title: d.title, slug: d.slug ?? '' })),
      }))
    },
    DEFAULT_NAV,
    'categories',
  ),
)

/** Policy pages and FAQs (rich text) from Store Settings. */
export const getPolicies = cache(async () => {
  const payload = await getPayload({ config })
  const s = await payload.findGlobal({ slug: 'store-settings', depth: 0 })
  return {
    shipping: s.shippingPolicy ?? null,
    returns: s.returnPolicy ?? null,
    privacy: s.privacyPolicy ?? null,
    terms: s.terms ?? null,
    faqs: s.faqs ?? [],
  }
})
