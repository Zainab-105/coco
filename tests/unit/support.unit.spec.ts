import { beforeAll, describe, expect, it } from 'vitest'

import { createSessionToken, generateLoginCode, hashLoginCode, readSessionToken, sameLoginCode, SESSION_DAYS } from '@/lib/account/session'
import { sniffUpload, UPLOAD_LIMITS, uploadProblem } from '@/lib/support/uploads'
import { validateReview, validateTicket } from '@/lib/support/validate'

const bytes = (...values: number[]) => new Uint8Array(values)
const text = (s: string) => new TextEncoder().encode(s)

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0)
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a)
const WEBP = text('RIFF\0\0\0\0WEBPVP8 ')
const MP4 = text('\0\0\0\x18ftypisom\0\0')
const MOV = text('\0\0\0\x14ftypqt  \0\0')
const WEBM = bytes(0x1a, 0x45, 0xdf, 0xa3, 0, 0)

describe('customer uploads', () => {
  it('recognises allowed files from their content, not their name', () => {
    expect(sniffUpload(JPEG)?.mimeType).toBe('image/jpeg')
    expect(sniffUpload(PNG)?.mimeType).toBe('image/png')
    expect(sniffUpload(WEBP)?.mimeType).toBe('image/webp')
    expect(sniffUpload(MP4)?.mimeType).toBe('video/mp4')
    expect(sniffUpload(WEBM)?.mimeType).toBe('video/webm')
  })

  it('rejects everything else, including web pages, SVGs and iPhone .mov files', () => {
    expect(sniffUpload(text('<html><script>alert(1)</script>'))).toBeNull()
    expect(sniffUpload(text('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
    expect(sniffUpload(MOV)).toBeNull()
    expect(sniffUpload(new Uint8Array())).toBeNull()
  })

  it('enforces count, per-type size and total size', () => {
    const photo = { size: 1000, bytes: JPEG }
    expect(uploadProblem([])).toBeNull()
    expect(uploadProblem([photo, { size: 1000, bytes: MP4 }])).toBeNull()
    expect(uploadProblem(Array(UPLOAD_LIMITS.files + 1).fill(photo))).toMatch(/up to 4/)
    expect(uploadProblem([{ size: UPLOAD_LIMITS.image + 1, bytes: JPEG }])).toMatch(/8 MB/)
    expect(uploadProblem([{ size: UPLOAD_LIMITS.video + 1, bytes: MP4 }])).toMatch(/25 MB/)
    expect(uploadProblem([{ size: UPLOAD_LIMITS.video, bytes: MP4 }, { size: UPLOAD_LIMITS.video, bytes: MP4 }])).toMatch(/too large/)
    expect(uploadProblem([{ size: 10, bytes: text('<html>') }])).toMatch(/JPG/)
  })
})

describe('review form', () => {
  const valid = { productId: '5', rating: '4', authorName: 'Ayesha', body: 'Lovely scent, lasts for weeks.' }

  it('accepts a valid review and normalises the optional order details', () => {
    const { data } = validateReview({ ...valid, orderNumber: 'coco-1', phone: '0300 1234567' })
    expect(data).toMatchObject({ productId: 5, rating: 4, orderNumber: 'COCO-1', phone: '+923001234567' })
  })

  it('reports each missing or invalid field', () => {
    expect(validateReview({ productId: 'x', rating: '6', authorName: 'A', body: 'short' }).errors).toEqual({
      form: expect.any(String),
      rating: expect.any(String),
      authorName: expect.any(String),
      body: expect.any(String),
    })
    expect(validateReview({ ...valid, phone: '123' }).errors.phone).toBeTruthy()
  })

  it('needs the phone or order-link token with an order number', () => {
    expect(validateReview({ ...valid, orderNumber: 'COCO-1' }).errors.phone).toBeTruthy()
    expect(validateReview({ ...valid, orderNumber: 'COCO-1', orderToken: 'abc' }).data?.orderToken).toBe('abc')
  })
})

describe('contact form', () => {
  const valid = { name: 'Hamza', message: 'My parcel arrived damaged.' }

  it('needs a way to reply', () => {
    expect(validateTicket(valid).errors.phone).toBeTruthy()
    expect(validateTicket({ ...valid, email: 'a@b.pk' }).data?.email).toBe('a@b.pk')
    expect(validateTicket({ ...valid, phone: '03001234567' }).data?.phone).toBe('+923001234567')
  })

  it('falls back to an enquiry for unknown types and rejects bad contact details', () => {
    expect(validateTicket({ ...valid, email: 'a@b.pk', type: 'hack' }).data?.type).toBe('enquiry')
    expect(validateTicket({ ...valid, email: 'nope' }).errors.email).toBeTruthy()
    expect(validateTicket({ ...valid, phone: '12' }).errors.phone).toBeTruthy()
  })
})

describe('customer sessions', () => {
  beforeAll(() => {
    process.env.PAYLOAD_SECRET ||= 'unit-test-secret'
  })

  it('round-trips a signed token', () => {
    expect(readSessionToken(createSessionToken(7, 2))).toMatchObject({ id: 7, version: 2 })
  })

  it('rejects tampered, malformed and expired tokens', () => {
    const token = createSessionToken(7, 2)
    const [, signature] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ id: 1, version: 1, expires: Date.now() + 1e9 })).toString('base64url')
    expect(readSessionToken(`${forged}.${signature}`)).toBeNull()
    expect(readSessionToken(`${token}x`)).toBeNull()
    expect(readSessionToken('garbage')).toBeNull()
    expect(readSessionToken(undefined)).toBeNull()
    expect(readSessionToken(token, Date.now() + (SESSION_DAYS + 1) * 86_400_000)).toBeNull()
  })

  it('generates six-digit codes and ties each hash to its email', () => {
    expect(generateLoginCode()).toMatch(/^\d{6}$/)
    const hash = hashLoginCode('a@b.pk', '123456')
    expect(hash).not.toContain('123456')
    expect(sameLoginCode(hash, 'a@b.pk', '123456')).toBe(true)
    expect(sameLoginCode(hash, 'a@b.pk', '654321')).toBe(false)
    expect(sameLoginCode(hash, 'c@d.pk', '123456')).toBe(false)
  })
})
