import { describe, expect, it, vi } from 'vitest'

import { logActivity } from '@/hooks/logActivity'

const run = async (doc: Record<string, unknown>, previousDoc: Record<string, unknown>) => {
  const create = vi.fn()
  await logActivity('products')({
    doc,
    previousDoc,
    operation: 'update',
    req: { user: { id: 1, collection: 'users' }, payload: { create } },
  } as never)
  return create.mock.calls[0]?.[0]?.data?.summary as string | undefined
}

describe('logActivity', () => {
  it('ignores populated vs id-only relationships and computed fields', async () => {
    const summary = await run(
      { category: { id: 3, title: 'X', updatedAt: 'a' }, gallery: [{ id: 'g1', media: { id: 9, createdAt: 'b' } }], price: 10, totalStock: 4 },
      { category: 3, gallery: [{ id: 'g1', media: 9 }], price: 10, totalStock: 5 },
    )
    expect(summary).toBeUndefined()
  })

  it('reports real edits', async () => {
    expect(await run({ category: 4, price: 12 }, { category: 3, price: 10 })).toBe('Changed: category, price')
  })
})
