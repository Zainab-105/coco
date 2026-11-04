// @vitest-environment node
import path from 'node:path'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

import { assertTestDatabase } from '../helpers/testDb'

let payload: Payload
const sample = path.resolve('public/mock/diffuser-bottle.webp')

describe('media rules', () => {
  beforeAll(async () => {
    assertTestDatabase()
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    await payload.delete({ collection: 'media', where: { alt: { like: 'TEST ' } } })
  })

  it('classifies images and generates the configured sizes', async () => {
    const doc = await payload.create({ collection: 'media', data: { alt: 'TEST image' }, filePath: sample })
    expect(doc.kind).toBe('image')
    expect(doc.mimeType).toBe('image/webp')
    expect(Object.keys(doc.sizes ?? {})).toEqual(expect.arrayContaining(['thumbnail', 'card', 'large', 'og']))
  })
})
