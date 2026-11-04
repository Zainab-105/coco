import type { CollectionAfterChangeHook } from 'payload'

/**
 * When a product or category URL changes, its old address redirects to the new one, so shared
 * links and Google results keep working. Earlier redirects are updated to avoid chains, and any
 * redirect from the new address is removed because that address is now a real page.
 */
export const redirectOldSlug =
  (base: '/products' | '/collections'): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, operation, req }) => {
    if (operation !== 'update' || !previousDoc?.slug || !doc.slug || previousDoc.slug === doc.slug) return doc
    const from = `${base}/${previousDoc.slug}`
    const to = `${base}/${doc.slug}`
    const common = { overrideAccess: true, req } as const

    await req.payload.delete({ collection: 'redirects', where: { from: { in: [from, to] } }, ...common })
    await req.payload.update({ collection: 'redirects', where: { to: { equals: from } }, data: { to }, ...common })
    await req.payload.create({ collection: 'redirects', data: { from, to, note: 'Added automatically when the URL changed' }, ...common })
    return doc
  }
