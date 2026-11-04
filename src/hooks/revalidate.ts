import { revalidatePath } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from 'payload'

/**
 * On-demand ISR: when the owner edits something in the admin, the affected storefront pages
 * refresh on their next visit instead of waiting for the 5-minute revalidation window.
 * Outside a Next.js request (seed scripts, tests) revalidatePath throws; that is safe to ignore.
 */
function safeRevalidate(paths: [string, ('page' | 'layout')?][]) {
  for (const [path, type] of paths) {
    try {
      revalidatePath(path, type)
    } catch {
      // Not running inside Next.js.
    }
  }
}

const everything = () => safeRevalidate([['/', 'layout']])

export const revalidateProduct: CollectionAfterChangeHook = ({ doc, previousDoc }) => {
  const slugs = new Set([doc.slug, previousDoc?.slug].filter(Boolean))
  safeRevalidate([
    ...[...slugs].map((slug) => [`/products/${slug}`] as [string]),
    ['/'],
    ['/collections'],
    ['/collections/[slug]', 'page'],
  ])
  return doc
}

export const revalidateProductDelete: CollectionAfterDeleteHook = ({ doc }) => {
  safeRevalidate([[`/products/${doc.slug}`], ['/'], ['/collections/[slug]', 'page']])
  return doc
}

/** Categories, banners, fragrances and reviews appear in shared layout/navigation: refresh all pages. */
export const revalidateAll: CollectionAfterChangeHook = ({ doc }) => {
  everything()
  return doc
}

export const revalidateAllOnDelete: CollectionAfterDeleteHook = ({ doc }) => {
  everything()
  return doc
}

export const revalidateGlobal: GlobalAfterChangeHook = ({ doc }) => {
  everything()
  return doc
}
