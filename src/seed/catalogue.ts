import path from 'node:path'
import type { Payload } from 'payload'

import { ensure, type SeededBase } from './base'
import { richText } from './richText'

/**
 * Sample catalogue for design, demos and testing. Uses crops of the client's brand boards
 * (public/mock) as stand-in photography. Prices and stock are illustrative only (A11).
 */
const mockFile = (name: string, extension = 'webp') => path.resolve('public/mock', `${name}.${extension}`)

async function ensureMedia(payload: Payload, file: string, alt: string): Promise<number> {
  const found = await payload.find({ collection: 'media', where: { alt: { equals: alt } }, limit: 1, depth: 0 })
  if (found.docs[0]) return found.docs[0].id
  return (await payload.create({ collection: 'media', data: { alt }, filePath: mockFile(file), depth: 0 })).id
}

/** A short placeholder clip, so swiping to a video on product cards can be seen and tested. */
async function ensureSampleVideo(payload: Payload, poster: number): Promise<number> {
  const alt = 'COCO sample product video'
  const found = await payload.find({ collection: 'media', where: { alt: { equals: alt } }, limit: 1, depth: 0 })
  if (found.docs[0]) return found.docs[0].id
  return (await payload.create({ collection: 'media', data: { alt, poster }, filePath: mockFile('sample-video', 'webm'), depth: 0 })).id
}

const labelFile: Record<string, string> = {
  'sweet-rose': 'sweet-rose-label',
  'citrus-mint': 'citrus-mint-label',
  'forest-pine': 'forest-pine-label',
  'vanilla-oud': 'vanilla-oud-label',
  'lavender-bliss': 'lavender-bliss-label',
  'cool-ice': 'cool-ice-label',
}

const fragranceNames: Record<string, string> = {
  'sweet-rose': 'Sweet Rose',
  'citrus-mint': 'Citrus Mint',
  'forest-pine': 'Forest Pine',
  'vanilla-oud': 'Vanilla Oud',
  'lavender-bliss': 'Lavender Bliss',
  'cool-ice': 'Cool Ice',
}

// Varied stock so low-stock and sold-out states show up in the admin and storefront.
const diffuserStock: Record<string, number> = {
  'sweet-rose': 42,
  'citrus-mint': 35,
  'forest-pine': 0,
  'vanilla-oud': 4,
  'lavender-bliss': 28,
  'cool-ice': 31,
}

export async function seedCatalogue(payload: Payload, { categoryIds, fragranceIds }: SeededBase) {
  const media = {
    bottle: await ensureMedia(payload, 'diffuser-bottle', 'COCO hanging car diffuser, round glass bottle with wooden cap'),
    box: await ensureMedia(payload, 'packaging-box', 'COCO gift box with car diffuser'),
    bag: await ensureMedia(payload, 'shopping-bag', 'COCO burgundy shopping bag'),
    paper: await ensureMedia(payload, 'butter-paper', 'COCO branded wrapping paper'),
    card: await ensureMedia(payload, 'business-card', 'COCO thank-you card'),
    flatlay: await ensureMedia(payload, 'brand-flatlay', 'COCO packaging flat lay'),
    heroPackaging: await ensureMedia(payload, 'hero-packaging', 'COCO packaging collection'),
    heroFragrances: await ensureMedia(payload, 'hero-fragrances', 'COCO hanging car diffuser fragrance range'),
  }
  const labels: Record<string, number> = {}
  for (const [slug, file] of Object.entries(labelFile)) {
    labels[slug] = await ensureMedia(payload, file, `${fragranceNames[slug]} fragrance label`)
  }
  const video = await ensureSampleVideo(payload, media.bottle)
  const fragranceSlugs = Object.keys(labelFile)
  const allFragrances = fragranceSlugs.map((s) => fragranceIds[s])

  const products: { slug: string; data: Record<string, unknown> }[] = [
    {
      slug: 'hanging-car-diffuser',
      data: {
        title: 'Hanging Car Diffuser',
        productType: 'variable',
        category: categoryIds['hanging-car-diffusers'],
        status: 'published',
        featured: true,
        isNewArrival: true,
        price: 1450,
        salePrice: 1199,
        costPrice: 520,
        sku: 'CS-HCD',
        lowStockThreshold: 5,
        shortDescription: 'A hand-finished glass diffuser that keeps your car smelling fresh for weeks.',
        description: richText(
          'Our signature hanging car diffuser pairs a clear round glass bottle with a natural wooden cap and a braided cord that fits every rear-view mirror.',
          'Loosen the cap to release the fragrance gradually; tighten it to slow it down. One bottle lasts around 30-45 days.',
        ),
        features: [{ text: 'Long lasting: 30-45 days' }, { text: 'Premium fragrance oils' }, { text: 'Leak-proof design' }, { text: 'Fits all cars' }],
        specifications: [
          { label: 'Volume', value: '8 ml' },
          { label: 'Material', value: 'Glass bottle, wooden cap, braided cord' },
          { label: 'Usage', value: 'Hang on rear-view mirror' },
        ],
        gallery: [media.bottle, video, ...fragranceSlugs.map((s) => labels[s])].map((m) => ({ media: m })),
        fragrances: allFragrances,
        variants: fragranceSlugs.map((s) => ({
          label: fragranceNames[s],
          fragrance: fragranceIds[s],
          sku: `CS-HCD-${s.toUpperCase().slice(0, 3)}`,
          stock: diffuserStock[s],
          costPrice: 520,
          image: labels[s],
        })),
        deliveryNote: 'Delivered in 2-5 working days',
      },
    },
    {
      slug: 'reed-room-diffuser',
      data: {
        title: 'Reed Room Diffuser 100 ml',
        productType: 'variable',
        category: categoryIds['room-diffusers'],
        status: 'published',
        featured: true,
        price: 2950,
        costPrice: 1100,
        sku: 'HS-RRD',
        shortDescription: 'Fragrance for your living room, bedroom or office, with natural rattan reeds.',
        description: richText('Place the reeds in the bottle and flip them once a week for a stronger scent. Lasts up to 3 months.'),
        features: [{ text: 'Lasts up to 3 months' }, { text: '8 natural rattan reeds' }, { text: 'Alcohol-free formula' }],
        specifications: [
          { label: 'Volume', value: '100 ml' },
          { label: 'Reeds', value: '8 x 25 cm rattan' },
        ],
        gallery: [media.box, media.paper, labels['vanilla-oud'], labels['lavender-bliss']].map((m) => ({ media: m })),
        fragrances: [fragranceIds['vanilla-oud'], fragranceIds['lavender-bliss'], fragranceIds['sweet-rose']],
        variants: ['vanilla-oud', 'lavender-bliss', 'sweet-rose'].map((s) => ({
          label: fragranceNames[s],
          fragrance: fragranceIds[s],
          sku: `HS-RRD-${s.toUpperCase().slice(0, 3)}`,
          stock: s === 'sweet-rose' ? 2 : 18,
          costPrice: 1100,
          image: labels[s],
        })),
      },
    },
    {
      slug: 'smokeless-car-ashtray',
      data: {
        title: 'Smokeless Car Ashtray',
        productType: 'simple',
        category: categoryIds['car-ashtrays'],
        status: 'published',
        price: 1800,
        salePrice: 1590,
        costPrice: 700,
        sku: 'CA-ASH-01',
        stock: 25,
        shortDescription: 'Lidded ashtray with LED light that fits standard cup holders.',
        gallery: [media.flatlay, media.card].map((m) => ({ media: m })),
        specifications: [{ label: 'Fits', value: 'Standard car cup holders' }],
      },
    },
    {
      slug: 'dashboard-showpiece',
      data: {
        title: 'Dashboard Showpiece',
        productType: 'simple',
        category: categoryIds['car-front-showpieces'],
        status: 'published',
        isNewArrival: true,
        price: 2200,
        costPrice: 850,
        sku: 'CA-SHW-01',
        stock: 4,
        shortDescription: 'A gold-finished ornament with a built-in fragrance pad for your dashboard.',
        gallery: [media.bag, media.flatlay].map((m) => ({ media: m })),
      },
    },
  ]

  const ids: Record<string, number> = {}
  for (const p of products) {
    ids[p.slug] = (await ensure(payload, 'products', { slug: { equals: p.slug } }, { ...p.data, slug: p.slug })).id
  }

  // Databases seeded before the sample video existed get it on the next seed.
  const diffuser = await payload.findByID({ collection: 'products', id: ids['hanging-car-diffuser'], depth: 0 })
  const gallery = diffuser.gallery ?? []
  if (!gallery.some((g) => g.media === video)) {
    const [first, ...rest] = gallery.map((g) => ({ media: g.media }))
    await payload.update({ collection: 'products', id: diffuser.id, data: { gallery: [first, { media: video }, ...rest].filter(Boolean) }, depth: 0 })
  }

  const bundles = [
    {
      slug: 'signature-gift-set',
      data: {
        title: 'Signature Gift Set',
        price: 4200,
        salePrice: 3490,
        costPrice: 1500,
        sku: 'GS-SIG',
        stock: 15,
        featured: true,
        giftWrapAvailable: true,
        shortDescription: 'Two hanging car diffusers in the COCO gift box with a handwritten note.',
        gallery: [media.box, media.bag, media.paper, media.card].map((m) => ({ media: m })),
        bundleItems: [{ product: ids['hanging-car-diffuser'], quantity: 2 }],
      },
    },
    {
      slug: 'car-and-home-duo',
      data: {
        title: 'Car & Home Duo',
        price: 4400,
        costPrice: 1620,
        sku: 'GS-DUO',
        stock: 9,
        giftWrapAvailable: true,
        shortDescription: 'One hanging car diffuser and one reed room diffuser in a matching scent.',
        gallery: [media.flatlay, media.box].map((m) => ({ media: m })),
        bundleItems: [
          { product: ids['hanging-car-diffuser'], quantity: 1 },
          { product: ids['reed-room-diffuser'], quantity: 1 },
        ],
      },
    },
  ]
  for (const b of bundles) {
    ids[b.slug] = (
      await ensure(payload, 'products', { slug: { equals: b.slug } }, {
        ...b.data,
        slug: b.slug,
        productType: 'bundle',
        category: categoryIds['gift-sets'],
        status: 'published',
      })
    ).id
  }

  await payload.update({
    collection: 'products',
    id: ids['hanging-car-diffuser'],
    data: { relatedProducts: [ids['signature-gift-set'], ids['reed-room-diffuser'], ids['dashboard-showpiece']] },
  })

  await ensure(payload, 'banners', { title: { equals: 'Little Scents. Big Vibes.' } }, {
    title: 'Little Scents. Big Vibes.',
    subtitle: 'Premium car and home fragrance',
    placement: 'hero',
    desktopImage: media.heroPackaging,
    mobileImage: media.box,
    ctaLabel: 'Shop car scents',
    ctaUrl: '/collections/car-scents',
    sortOrder: 1,
  })
  await ensure(payload, 'banners', { title: { equals: 'Six signature scents' } }, {
    title: 'Six signature scents',
    subtitle: 'Find the one that makes every journey better',
    placement: 'hero',
    desktopImage: media.heroFragrances,
    mobileImage: labels['sweet-rose'],
    ctaLabel: 'Find your scent',
    ctaUrl: '/collections/hanging-car-diffusers',
    sortOrder: 2,
  })
  await ensure(payload, 'banners', { placement: { equals: 'announcement' } }, {
    title: 'Free delivery on orders over Rs 3,000  |  Cash on Delivery nationwide',
    placement: 'announcement',
  })

  await ensure(payload, 'coupons', { code: { equals: 'WELCOME10' } }, {
    code: 'WELCOME10',
    description: '10% off the first order (max Rs 500)',
    type: 'percentage',
    value: 10,
    maxDiscount: 500,
    perCustomerLimit: 1,
  })
  await ensure(payload, 'coupons', { code: { equals: 'FREESHIP' } }, {
    code: 'FREESHIP',
    description: 'Free delivery on orders over Rs 2,000',
    type: 'free_shipping',
    minOrderAmount: 2000,
  })

  // Sample approved reviews (fictitious) so ratings and review sections render.
  if ((await payload.count({ collection: 'reviews' })).totalDocs === 0) {
    const sample: [string, string, number, string, string][] = [
      ['hanging-car-diffuser', 'Ayesha K.', 5, 'My car smells amazing', 'Sweet Rose is soft and lasts for weeks. Lovely packaging too.'],
      ['hanging-car-diffuser', 'Hamza A.', 5, 'Best car scent I have tried', 'Cool Ice is fresh without being overpowering. Ordering again.'],
      ['hanging-car-diffuser', 'Sana I.', 4, 'Beautiful bottle', 'Looks premium on my mirror. Vanilla Oud is a bit strong at first, then perfect.'],
      ['signature-gift-set', 'Mariam S.', 5, 'Perfect gift', 'Gifted this to my sister and she loved the box and the note.'],
      ['reed-room-diffuser', 'Bilal A.', 4, 'Living room favourite', 'Lavender Bliss makes the room feel calm. Flip the reeds for more scent.'],
    ]
    for (const [slug, authorName, rating, title, body] of sample) {
      await payload.create({
        collection: 'reviews',
        data: { product: ids[slug], authorName, rating, title, body, status: 'approved', verifiedPurchase: true },
      })
    }
  }

  return ids
}
