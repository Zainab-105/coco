import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

/** Replaces populated relationship docs with their ids so depth differences don't look like edits. */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if ('id' in obj && ('createdAt' in obj || 'updatedAt' in obj)) return obj.id
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, normalize(v)]))
  }
  return value
}

const IGNORED = new Set(['updatedAt', 'createdAt', 'totalStock', 'stockStatus', 'effectivePrice', 'salesCount', 'statusHistory'])

/** Records admin-made changes in the `activity-logs` collection. */
export const logActivity =
  (collection: string): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, operation, req }) => {
    if (!req.user || req.user.collection !== 'users') return doc

    const changedFields =
      operation === 'update' && previousDoc
        ? Object.keys(doc).filter(
            (key) => !IGNORED.has(key) && JSON.stringify(normalize(doc[key])) !== JSON.stringify(normalize(previousDoc[key])),
          )
        : []

    await req.payload.create({
      collection: 'activity-logs',
      data: {
        user: req.user.id,
        action: operation,
        targetCollection: collection,
        targetId: String(doc.id),
        summary: changedFields.length ? `Changed: ${changedFields.join(', ')}` : undefined,
      },
      req,
    })

    return doc
  }

export const logDeletion =
  (collection: string): CollectionAfterDeleteHook =>
  async ({ id, req }) => {
    if (!req.user || req.user.collection !== 'users') return

    await req.payload.create({
      collection: 'activity-logs',
      data: {
        user: req.user.id,
        action: 'delete',
        targetCollection: collection,
        targetId: String(id),
      },
      req,
    })
  }
