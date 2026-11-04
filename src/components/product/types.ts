import type { StockLevel } from '@/components/ui/StockStatus'

/**
 * Storefront view models. Kept separate from Payload's generated types so UI components
 * stay simple to render and test; mapping from Payload docs happens in lib/storefront/catalog.ts.
 */
export type MediaItem = {
  type: 'image' | 'video'
  src: string
  alt: string
  /** Poster frame for videos. */
  poster?: string
}

/** A selectable option on a product card: a variant (usually a fragrance). */
export type ProductOption = {
  /** Variant id for variable products. */
  id: string
  name: string
  swatch?: string | null
  mood?: string | null
  available?: boolean
  price?: number
  salePrice?: number | null
  stock?: number
  image?: string
}

export type ProductCardData = {
  id: string
  slug: string
  title: string
  subtitle?: string
  price: number
  salePrice?: number | null
  stock: StockLevel
  /** Units available for simple products and bundles (caps the quantity stepper). */
  stockQuantity?: number
  isNew?: boolean
  media: MediaItem[]
  rating?: { average: number; count: number }
  /** Variants (fragrances) the customer chooses between. */
  fragrances?: ProductOption[]
  /** True when a fragrance/option must be chosen before adding to cart. */
  requiresOption?: boolean
}
