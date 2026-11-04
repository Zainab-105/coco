'use client'

import { createPersistentStore } from './persistent'

/** Wishlist and recently viewed: product ids, newest first. Saved on the device for guests. */
const wishlistStore = createPersistentStore<number[]>('coco.wishlist.v1', [])
const recentStore = createPersistentStore<number[]>('coco.recent.v1', [])

export const useWishlist = wishlistStore.useStore
export const useRecentlyViewed = recentStore.useStore

export const wishlist = {
  toggle(id: number) {
    wishlistStore.set((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids].slice(0, 100)))
  },
  get: wishlistStore.get,
  /** Replaces the list with the account's saved one. */
  replace: (ids: number[]) => wishlistStore.set(ids),
  subscribe: wishlistStore.subscribe,
}

export const recentlyViewed = {
  add(id: number) {
    recentStore.set((ids) => [id, ...ids.filter((x) => x !== id)].slice(0, 12))
  },
}
