import type { ProductCardData } from '@/components/product/types'

/**
 * Design-review mock data built from the client's brand boards (public/mock).
 * Not used by real pages; delete once the launch catalogue is loaded.
 */
const fragrances = [
  { id: 'sweet-rose', name: 'Sweet Rose', swatch: '#7A1F2B', mood: 'Floral & Romantic' },
  { id: 'citrus-mint', name: 'Citrus Mint', swatch: '#C9DDA8', mood: 'Fresh & Energizing' },
  { id: 'forest-pine', name: 'Forest Pine', swatch: '#1F3D2E', mood: 'Woody & Fresh' },
  { id: 'vanilla-oud', name: 'Vanilla Oud', swatch: '#E8D6BC', mood: 'Warm & Luxurious' },
  { id: 'lavender-bliss', name: 'Lavender Bliss', swatch: '#B9A6D9', mood: 'Calm & Relaxing' },
  { id: 'cool-ice', name: 'Cool Ice', swatch: '#6FA8D6', mood: 'Icy & Refreshing' },
]

const img = (name: string, alt: string) => ({ type: 'image' as const, src: `/mock/${name}.webp`, alt })

export const mockProducts: ProductCardData[] = [
  {
    id: 'p1',
    slug: 'hanging-car-diffuser',
    title: 'Hanging Car Diffuser',
    subtitle: 'Car Scents',
    price: 1450,
    salePrice: 1199,
    stock: 'in_stock',
    isNew: true,
    requiresOption: true,
    rating: { average: 4.7, count: 128 },
    fragrances: fragrances.map((f) => ({ ...f, available: f.id !== 'forest-pine' })),
    media: [
      img('diffuser-bottle', 'COCO hanging car diffuser, round bottle with wooden cap'),
      img('sweet-rose-label', 'Sweet Rose fragrance label'),
      img('cool-ice-label', 'Cool Ice fragrance label'),
      img('citrus-mint-label', 'Citrus Mint fragrance label'),
    ],
  },
  {
    id: 'p2',
    slug: 'sweet-rose-car-diffuser',
    title: 'Sweet Rose',
    subtitle: 'Floral & Romantic',
    price: 1450,
    stock: 'low_stock',
    rating: { average: 4.9, count: 54 },
    media: [img('sweet-rose-label', 'Sweet Rose label'), img('diffuser-bottle', 'Diffuser bottle')],
  },
  {
    id: 'p3',
    slug: 'coco-signature-gift-set',
    title: 'Signature Gift Set',
    subtitle: 'Gift Sets',
    price: 4200,
    salePrice: 3490,
    stock: 'in_stock',
    rating: { average: 5, count: 21 },
    media: [
      img('packaging-box', 'COCO gift box with diffuser'),
      img('shopping-bag', 'COCO burgundy shopping bag'),
      img('butter-paper', 'COCO branded wrapping paper'),
      img('business-card', 'COCO thank-you card'),
    ],
  },
  {
    id: 'p4',
    slug: 'forest-pine-car-diffuser',
    title: 'Forest Pine',
    subtitle: 'Woody & Fresh',
    price: 1450,
    stock: 'out_of_stock',
    media: [img('forest-pine-label', 'Forest Pine label')],
  },
  {
    id: 'p5',
    slug: 'vanilla-oud-car-diffuser',
    title: 'Vanilla Oud',
    subtitle: 'Warm & Luxurious',
    price: 1650,
    stock: 'in_stock',
    isNew: true,
    rating: { average: 4.6, count: 37 },
    media: [img('vanilla-oud-label', 'Vanilla Oud label'), img('diffuser-bottle', 'Diffuser bottle')],
  },
  {
    id: 'p6',
    slug: 'lavender-bliss-car-diffuser',
    title: 'Lavender Bliss',
    subtitle: 'Calm & Relaxing',
    price: 1450,
    salePrice: 1290,
    stock: 'in_stock',
    media: [img('lavender-bliss-label', 'Lavender Bliss label'), img('diffuser-bottle', 'Diffuser bottle')],
  },
  {
    id: 'p7',
    slug: 'cool-ice-car-diffuser',
    title: 'Cool Ice',
    subtitle: 'Icy & Refreshing',
    price: 1450,
    stock: 'in_stock',
    rating: { average: 4.4, count: 18 },
    media: [img('cool-ice-label', 'Cool Ice label'), img('diffuser-bottle', 'Diffuser bottle')],
  },
  {
    id: 'p8',
    slug: 'citrus-mint-car-diffuser',
    title: 'Citrus Mint',
    subtitle: 'Fresh & Energizing',
    price: 1450,
    stock: 'in_stock',
    media: [img('citrus-mint-label', 'Citrus Mint label'), img('diffuser-bottle', 'Diffuser bottle')],
  },
]

export const mockFragrances = fragrances
