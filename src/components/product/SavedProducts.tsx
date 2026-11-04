'use client'

import { useEffect, useState } from 'react'

import { SectionHeading, Skeleton } from '@/components/ui/Layout'

import { ProductGrid } from './ProductGrid'
import type { ProductCardData } from './types'

/** Fetches cards for ids stored on the device (wishlist / recently viewed). */
export function useProductCards(ids: number[]) {
  const key = ids.join(',')
  const [state, setState] = useState<{ key: string; products: ProductCardData[] } | null>(null)

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    fetch(`/api/storefront/products?ids=${key}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((products: ProductCardData[]) => setState({ key, products }))
      .catch(() => {})
    return () => controller.abort()
  }, [key])

  if (!key) return { products: [], loading: false }
  return { products: state?.key === key ? state.products : [], loading: state?.key !== key }
}

export function RecentlyViewedRow({ ids, excludeId }: { ids: number[]; excludeId?: number }) {
  const visible = ids.filter((id) => id !== excludeId).slice(0, 4)
  const { products, loading } = useProductCards(visible)
  if (!visible.length) return null

  return (
    <section aria-label="Recently viewed">
      <SectionHeading eyebrow="Your picks" title="Recently viewed" />
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {visible.map((id) => (
            <Skeleton key={id} className="aspect-[4/5]" />
          ))}
        </div>
      ) : (
        <ProductGrid products={products} layout="row" priorityCount={0} />
      )}
    </section>
  )
}
