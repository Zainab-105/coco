import type { Payload } from 'payload'

import { slugify } from '@/fields/slug'

import { richText } from './richText'

type Upsertable = 'categories' | 'fragrances' | 'products' | 'banners' | 'coupons'

/** Finds a document by a unique field or creates it. Makes every seed step safe to re-run. */
export async function ensure(
  payload: Payload,
  collection: Upsertable,
  where: Record<string, { equals: unknown }>,
  data: Record<string, unknown>,
): Promise<{ id: number }> {
  const found = await payload.find({ collection, where, limit: 1, depth: 0 })
  if (found.docs[0]) return found.docs[0] as { id: number }
  return (await payload.create({ collection, data: data as never, depth: 0 })) as { id: number }
}

const categories = [
  { title: 'Car Scents', sortOrder: 1, children: ['Hanging Car Diffusers'] },
  { title: 'Car Accessories', sortOrder: 2, children: ['Car Ashtrays', 'Car Front Showpieces'] },
  { title: 'Home Scents', sortOrder: 3, children: ['Room Diffusers'] },
  { title: 'Gift Sets', sortOrder: 4, children: [] },
]

// Notes are sample copy for design and testing; the client confirms final fragrance notes (A10).
export const launchFragrances = [
  { name: 'Sweet Rose', family: 'floral', mood: 'Floral & Romantic', swatch: '#7A1F2B', topNotes: 'Pink pepper, lychee', heartNotes: 'Damask rose, peony', baseNotes: 'White musk, amber' },
  { name: 'Citrus Mint', family: 'citrus', mood: 'Fresh & Energizing', swatch: '#C9DDA8', topNotes: 'Lemon, bergamot', heartNotes: 'Spearmint, basil', baseNotes: 'Vetiver' },
  { name: 'Forest Pine', family: 'woody', mood: 'Woody & Fresh', swatch: '#1F3D2E', topNotes: 'Pine needle, juniper', heartNotes: 'Cypress, fir balsam', baseNotes: 'Cedarwood, moss' },
  { name: 'Vanilla Oud', family: 'oriental', mood: 'Warm & Luxurious', swatch: '#E8D6BC', topNotes: 'Saffron', heartNotes: 'Bourbon vanilla, tonka', baseNotes: 'Oud, sandalwood' },
  { name: 'Lavender Bliss', family: 'floral', mood: 'Calm & Relaxing', swatch: '#B9A6D9', topNotes: 'Bergamot', heartNotes: 'French lavender, chamomile', baseNotes: 'Soft musk' },
  { name: 'Cool Ice', family: 'aquatic', mood: 'Icy & Refreshing', swatch: '#6FA8D6', topNotes: 'Frosted mint, ozone', heartNotes: 'Sea salt, cucumber', baseNotes: 'Driftwood' },
] as const

export type SeededBase = {
  categoryIds: Record<string, number>
  fragranceIds: Record<string, number>
}

/** Categories, launch fragrances and Store Settings defaults (see docs/ASSUMPTIONS.md). */
export async function seedBase(payload: Payload): Promise<SeededBase> {
  const categoryIds: Record<string, number> = {}
  for (const { children, ...parent } of categories) {
    const slug = slugify(parent.title)
    const created = await ensure(payload, 'categories', { slug: { equals: slug } }, { ...parent, slug })
    categoryIds[slug] = created.id
    for (const [i, title] of children.entries()) {
      const childSlug = slugify(title)
      const child = await ensure(payload, 'categories', { slug: { equals: childSlug } }, {
        title,
        slug: childSlug,
        parent: created.id,
        sortOrder: i,
      })
      categoryIds[childSlug] = child.id
    }
  }

  const fragranceIds: Record<string, number> = {}
  for (const fragrance of launchFragrances) {
    const slug = slugify(fragrance.name)
    fragranceIds[slug] = (await ensure(payload, 'fragrances', { slug: { equals: slug } }, { ...fragrance, slug })).id
  }

  const settings = await payload.findGlobal({ slug: 'store-settings', depth: 0 })
  if (!settings.faqs?.length) {
    await payload.updateGlobal({
      slug: 'store-settings',
      data: {
        storeName: 'COCO',
        tagline: 'Little Scents. Big Vibes.',
        shipping: { flatRate: 250, freeShippingThreshold: 3000, deliveryEstimate: '2-5 working days' },
        payments: {
          codEnabled: true,
          codMaxOrderValue: 25000,
        },
        giftWrap: { enabled: true, price: 150 },
        faqs: [
          { question: 'How long does a hanging car diffuser last?', answer: 'Around 30-45 days depending on temperature and airflow.' },
          { question: 'Do you offer Cash on Delivery?', answer: 'Yes, Cash on Delivery is available across Pakistan.' },
          { question: 'How long does delivery take?', answer: 'Orders are delivered in 2-5 working days.' },
          { question: 'Can I exchange a fragrance?', answer: 'Unopened products can be exchanged within 7 days of delivery.' },
        ],
        shippingPolicy: richText('Delivery charges are Rs 250 nationwide. Orders over Rs 3,000 ship free. Delivery takes 2-5 working days.'),
        returnPolicy: richText('Unopened products can be exchanged within 7 days of delivery. Damaged items are replaced free of charge.'),
      },
    })
  }

  return { categoryIds, fragranceIds }
}
