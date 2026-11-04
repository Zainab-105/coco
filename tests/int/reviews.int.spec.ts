// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

import { assertTestDatabase } from '../helpers/testDb'

let payload: Payload
let productId: number

const rating = async () => {
  const p = await payload.findByID({ collection: 'products', id: productId, depth: 0 })
  return { average: p.ratingAverage, count: p.ratingCount }
}

describe('review ratings', () => {
  beforeAll(async () => {
    assertTestDatabase()
    payload = await getPayload({ config: await config })
    const category = await payload.create({ collection: 'categories', data: { title: 'Review Test Cat' } })
    productId = (
      await payload.create({
        collection: 'products',
        data: { title: 'Review Test Product', category: category.id, productType: 'simple', price: 1000, stock: 5, status: 'published' },
      })
    ).id
  })

  afterAll(async () => {
    await payload.delete({ collection: 'reviews', where: { product: { equals: productId } } })
    await payload.delete({ collection: 'products', where: { id: { equals: productId } } })
    await payload.delete({ collection: 'categories', where: { title: { equals: 'Review Test Cat' } } })
  })

  it('only approved reviews count towards the product rating', async () => {
    await payload.create({ collection: 'reviews', data: { product: productId, authorName: 'A', rating: 5, status: 'approved' } })
    const pending = await payload.create({ collection: 'reviews', data: { product: productId, authorName: 'B', rating: 2 } })
    expect(await rating()).toEqual({ average: 5, count: 1 })

    await payload.update({ collection: 'reviews', id: pending.id, data: { status: 'approved' } })
    expect(await rating()).toEqual({ average: 3.5, count: 2 })

    await payload.delete({ collection: 'reviews', id: pending.id })
    expect(await rating()).toEqual({ average: 5, count: 1 })
  })

  it('sets the price customers pay for sorting and filters', async () => {
    const p = await payload.update({ collection: 'products', id: productId, data: { salePrice: 800 } })
    expect(p.effectivePrice).toBe(800)
    const back = await payload.update({ collection: 'products', id: productId, data: { salePrice: null } })
    expect(back.effectivePrice).toBe(1000)
  })
})
