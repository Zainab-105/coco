'use client'

import { Heart } from 'lucide-react'

import { ButtonLink } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Layout'
import { useWishlist } from '@/lib/stores/lists'

import { ProductGrid } from './ProductGrid'
import { RecentlyViewed } from './RecentlyViewed'
import { useProductCards } from './SavedProducts'

export function WishlistView() {
  const ids = useWishlist()
  const { products, loading } = useProductCards(ids)

  return (
    <div className="mt-8 space-y-20">
      {ids.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Heart size={40} strokeWidth={1} className="text-rose-400" />
          <p className="font-display text-3xl text-burgundy-700">Your wishlist is empty</p>
          <p className="text-sm text-muted">Tap the heart on any product to save it here.</p>
          <ButtonLink href="/collections" variant="outline">
            Browse products
          </ButtonLink>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ids.slice(0, 4).map((id) => (
            <Skeleton key={id} className="aspect-[4/5]" />
          ))}
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
      <RecentlyViewed />
    </div>
  )
}
