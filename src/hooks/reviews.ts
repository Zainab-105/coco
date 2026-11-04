import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

import type { CustomerUpload, Review, SupportTicket } from '@/payload-types'

const productIdOf = (value: Review['product'] | undefined) =>
  typeof value === 'object' && value !== null ? value.id : value

/** Keeps a product's ratingAverage / ratingCount equal to its approved reviews. */
async function recompute(req: PayloadRequest, productId: number) {
  const { docs } = await req.payload.find({
    collection: 'reviews',
    where: { and: [{ product: { equals: productId } }, { status: { equals: 'approved' } }] },
    select: { rating: true },
    pagination: false,
    depth: 0,
    req,
  })
  const count = docs.length
  const average = count ? Math.round((docs.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0
  await req.payload.update({
    collection: 'products',
    id: productId,
    data: { ratingAverage: average, ratingCount: count },
    req,
  })
}

export const updateProductRating: CollectionAfterChangeHook<Review> = async ({ doc, previousDoc, req }) => {
  const ids = new Set([productIdOf(doc.product), productIdOf(previousDoc?.product)].filter((id): id is number => typeof id === 'number'))
  for (const id of ids) await recompute(req, id)
  return doc
}

export const updateProductRatingOnDelete: CollectionAfterDeleteHook<Review> = async ({ doc, req }) => {
  const id = productIdOf(doc.product)
  if (typeof id === 'number') await recompute(req, id)
  return doc
}

const uploadIds = (value: (number | CustomerUpload)[] | null | undefined) =>
  (value ?? []).map((u) => (typeof u === 'object' ? u.id : u))

/** Customer files are public only while attached to an approved review. */
export const syncReviewMedia: CollectionAfterChangeHook<Review> = async ({ doc, previousDoc, req }) => {
  const current = uploadIds(doc.attachments)
  const removed = uploadIds(previousDoc?.attachments).filter((id) => !current.includes(id))
  const setPublic = async (ids: number[], isPublic: boolean) => {
    if (!ids.length) return
    await req.payload.update({ collection: 'customer-uploads', where: { id: { in: ids } }, data: { isPublic }, overrideAccess: true, req })
  }
  await setPublic(current, doc.status === 'approved')
  await setPublic(removed, false)
  return doc
}

/** Deleting a review or ticket also deletes the files the customer sent with it. */
export const deleteUploadsWithDoc: CollectionAfterDeleteHook<Review | SupportTicket> = async ({ doc, req }) => {
  const ids = uploadIds(doc.attachments)
  if (ids.length) await req.payload.delete({ collection: 'customer-uploads', where: { id: { in: ids } }, overrideAccess: true, req })
  return doc
}
