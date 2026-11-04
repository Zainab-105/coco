// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import type { Order, Product } from '@/payload-types'
import {
  accountFromToken,
  accountOrders,
  addAddress,
  endSessions,
  removeAddress,
  requestLoginCode,
  saveProfile,
  saveWishlist,
  verifyLoginCode,
} from '@/lib/account/core'
import { submitReview, submitTicket } from '@/lib/support/server'
import { validateReview } from '@/lib/support/validate'

import { assertTestDatabase } from '../helpers/testDb'

/** Reviews with private customer media, support tickets, and email-code customer accounts. */
let payload: Payload
let product: Product
let unpublished: Product
let sentEmails: { to: string; subject: string; text: string }[]
let photo: { size: number; bytes: Uint8Array }

const collections = ['reviews', 'support-tickets', 'customer-uploads', 'customer-accounts', 'login-codes', 'orders', 'customers', 'inventory-adjustments', 'products', 'categories'] as const

const review = (over: Record<string, unknown> = {}) => validateReview({ productId: product.id, rating: 5, authorName: 'Sana', body: 'Lovely scent, lasts for weeks.', ...over }).data!

async function createOrder(status: Order['status'], phone: string, email?: string) {
  const order = await payload.create({
    collection: 'orders',
    data: {
      items: [{ product: product.id, title: product.title, unitPrice: 1000, quantity: 1 }],
      shippingAddress: { fullName: 'Sana', phone, city: 'Lahore', address: 'House 1' },
      payment: { method: 'cod', status: 'pending' },
      email,
    } as Omit<Order, 'id' | 'createdAt' | 'updatedAt'>,
  })
  return status === 'new' ? order : payload.update({ collection: 'orders', id: order.id, data: { status } })
}

const publicUploads = async (ids: number[]) =>
  (await payload.find({ collection: 'customer-uploads', where: { id: { in: ids } }, overrideAccess: false, user: null })).docs.length

const lastCode = () => /\b(\d{6})\b/.exec(sentEmails.at(-1)!.subject)![1]

describe('reviews, support and accounts', () => {
  beforeAll(async () => {
    assertTestDatabase()
    payload = await getPayload({ config: await config })
    for (const c of collections) await payload.delete({ collection: c, where: { id: { exists: true } }, overrideAccess: true })
    await payload.updateGlobal({ slug: 'store-settings', data: { supportEmail: 'help@coco.test', inventory: { deductStockOn: 'placed', allowBackorders: true } } })

    vi.spyOn(payload, 'sendEmail').mockImplementation(async (message) => {
      sentEmails.push(message as (typeof sentEmails)[number])
    })
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#6b1f2a' } }).png().toBuffer()
    photo = { size: png.length, bytes: new Uint8Array(png) }

    const cat = await payload.create({ collection: 'categories', data: { title: 'Support Cat' } })
    product = await payload.create({ collection: 'products', data: { title: 'Support Scent', category: cat.id, productType: 'simple', price: 1000, stock: 50, status: 'published' } })
    unpublished = await payload.create({ collection: 'products', data: { title: 'Hidden Scent', category: cat.id, productType: 'simple', price: 1000, stock: 5, status: 'draft' } })
  })

  beforeEach(() => {
    sentEmails = []
  })

  afterAll(async () => {
    for (const c of collections) await payload.delete({ collection: c, where: { id: { exists: true } }, overrideAccess: true })
    await payload.updateGlobal({ slug: 'store-settings', data: { supportEmail: null, inventory: { allowBackorders: false } } })
    vi.restoreAllMocks()
  })

  describe('reviews', () => {
    it('saves as pending, with media private until approved and private again if hidden', async () => {
      const result = await submitReview(review({ authorName: 'First' }), [photo])
      if (!result.ok) throw new Error(JSON.stringify(result.errors))
      const doc = await payload.findByID({ collection: 'reviews', id: result.id, depth: 0 })
      expect(doc).toMatchObject({ status: 'pending', verifiedPurchase: false })
      const ids = doc.attachments as number[]
      expect(ids).toHaveLength(1)

      // Not visible to the public yet, and not counted in the rating.
      expect(await publicUploads(ids)).toBe(0)
      expect((await payload.find({ collection: 'reviews', where: { id: { equals: doc.id } }, overrideAccess: false, user: null })).totalDocs).toBe(0)
      expect((await payload.findByID({ collection: 'products', id: product.id, depth: 0 })).ratingCount ?? 0).toBe(0)

      await payload.update({ collection: 'reviews', id: doc.id, data: { status: 'approved' } })
      expect(await publicUploads(ids)).toBe(1)
      expect((await payload.findByID({ collection: 'products', id: product.id, depth: 0 })).ratingCount).toBe(1)

      await payload.update({ collection: 'reviews', id: doc.id, data: { status: 'hidden' } })
      expect(await publicUploads(ids)).toBe(0)

      // Staff removing a photo from an approved review takes it off public view.
      await payload.update({ collection: 'reviews', id: doc.id, data: { status: 'approved' } })
      await payload.update({ collection: 'reviews', id: doc.id, data: { attachments: [] } })
      expect(await publicUploads(ids)).toBe(0)
    })

    it('re-encodes images under a random name, and deletes files with the review', async () => {
      const result = await submitReview(review({ authorName: 'Second' }), [photo])
      if (!result.ok) throw new Error('failed')
      const doc = await payload.findByID({ collection: 'reviews', id: result.id, depth: 1 })
      const upload = doc.attachments![0] as { id: number; filename: string; mimeType: string }
      expect(upload.mimeType).toBe('image/webp')
      expect(upload.filename).toMatch(/^[0-9a-f-]{36}/)

      await payload.delete({ collection: 'reviews', id: doc.id })
      expect((await payload.find({ collection: 'customer-uploads', where: { id: { equals: upload.id } } })).totalDocs).toBe(0)
    })

    it('rejects disguised files and leaves nothing behind', async () => {
      const before = (await payload.count({ collection: 'customer-uploads' })).totalDocs
      const html = new TextEncoder().encode('<html><script>alert(1)</script></html>')
      expect(await submitReview(review(), [{ size: html.length, bytes: html }])).toMatchObject({ ok: false, errors: { files: expect.stringMatching(/JPG/) } })

      // Valid first bytes but not a real image: the good file before it must be removed too.
      const fake = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3, 4, 5])
      expect(await submitReview(review(), [photo, { size: fake.length, bytes: fake }])).toMatchObject({ ok: false, errors: { files: expect.any(String) } })
      expect((await payload.count({ collection: 'customer-uploads' })).totalDocs).toBe(before)
    })

    it('refuses products that are not published', async () => {
      expect(await submitReview(review({ productId: unpublished.id }), [])).toMatchObject({ ok: false })
    })

    it('gives the verified badge only for a matching delivered order, once', async () => {
      const phone = '03001230001'
      const order = await createOrder('delivered', phone)
      const undelivered = await createOrder('shipped', phone)

      // Wrong phone and undelivered orders are not proof.
      expect(await submitReview(review({ orderNumber: order.orderNumber, phone: '03009999999' }), [])).toMatchObject({ ok: false, errors: { orderNumber: expect.any(String) } })
      expect(await submitReview(review({ orderNumber: undelivered.orderNumber, phone }), [])).toMatchObject({ ok: false, errors: { orderNumber: expect.any(String) } })

      const result = await submitReview(review({ orderNumber: order.orderNumber, phone }), [])
      if (!result.ok) throw new Error(JSON.stringify(result.errors))
      expect(await payload.findByID({ collection: 'reviews', id: result.id, depth: 0 })).toMatchObject({ verifiedPurchase: true, order: order.id, status: 'pending' })

      expect(await submitReview(review({ orderNumber: order.orderNumber, orderToken: order.accessToken }), [])).toMatchObject({ ok: false, errors: { form: expect.stringMatching(/already/) } })
    })

    it('verifies by order link token, and for a signed-in customer by their email', async () => {
      const viaLink = await createOrder('delivered', '03001230002')
      const linked = await submitReview(review({ orderNumber: viaLink.orderNumber, orderToken: viaLink.accessToken }), [])
      expect(linked.ok).toBe(true)

      await createOrder('delivered', '03001230003', 'buyer@support.test')
      await requestLoginCode(payload, 'buyer@support.test')
      const buyer = await verifyLoginCode(payload, 'buyer@support.test', lastCode())
      await requestLoginCode(payload, 'stranger@support.test')
      const stranger = await verifyLoginCode(payload, 'stranger@support.test', lastCode())
      if (!buyer.ok || !stranger.ok) throw new Error('sign-in failed')

      const mine = await submitReview(review(), [], buyer.account)
      const theirs = await submitReview(review(), [], stranger.account)
      if (!mine.ok || !theirs.ok) throw new Error('review failed')
      expect((await payload.findByID({ collection: 'reviews', id: mine.id })).verifiedPurchase).toBe(true)
      expect((await payload.findByID({ collection: 'reviews', id: theirs.id })).verifiedPurchase).toBe(false)
    })
  })

  describe('support tickets', () => {
    it('creates a ticket, links the order only when the phone matches, and sends both emails', async () => {
      const phone = '03001230010'
      const order = await createOrder('delivered', phone)
      const result = await submitTicket({ type: 'complaint', name: 'Hamza', phone: '+923001230010', email: 'hamza@support.test', orderNumber: order.orderNumber!, message: 'My parcel <b>arrived</b> damaged.' }, [photo])
      if (!result.ok) throw new Error(JSON.stringify(result.errors))

      const ticket = await payload.findByID({ collection: 'support-tickets', id: result.id, depth: 0 })
      expect(ticket).toMatchObject({ type: 'complaint', priority: 'high', status: 'open', order: order.id, orderReference: order.orderNumber })
      expect(ticket.customer).toBeTruthy()
      // Attachments never become public.
      expect(await publicUploads(ticket.attachments as number[])).toBe(0)

      await vi.waitFor(() => expect(sentEmails.map((e) => e.to).sort()).toEqual(['hamza@support.test', 'help@coco.test']))
      const receipt = sentEmails.find((e) => e.to === 'hamza@support.test')!
      expect(receipt.text).not.toContain('parcel')

      const other = await submitTicket({ type: 'enquiry', name: 'Eve', phone: '+923009998877', orderNumber: order.orderNumber!, message: 'Tell me about this order.' }, [])
      if (!other.ok) throw new Error('failed')
      expect(await payload.findByID({ collection: 'support-tickets', id: other.id, depth: 0 })).toMatchObject({ order: null, priority: 'normal', orderReference: order.orderNumber })
      // Emails are sent in the background: let them land before the next test.
      await vi.waitFor(() => expect(sentEmails.filter((e) => e.to === 'help@coco.test')).toHaveLength(2))
    })

    it('is not readable by the public', async () => {
      await expect(payload.find({ collection: 'support-tickets', overrideAccess: false, user: null })).rejects.toThrow()
    })
  })

  describe('accounts', () => {
    it('signs in with the emailed code and stores only a hash', async () => {
      const email = 'Login@Support.Test'
      expect((await requestLoginCode(payload, email)).ok).toBe(true)
      expect(sentEmails[0].to).toBe('login@support.test')
      const code = lastCode()
      const { docs } = await payload.find({ collection: 'login-codes', where: { email: { equals: 'login@support.test' } } })
      expect(JSON.stringify(docs)).not.toContain(code)

      const result = await verifyLoginCode(payload, email, ` ${code} `)
      if (!result.ok) throw new Error(result.message)
      expect(result.account.email).toBe('login@support.test')
      expect((await accountFromToken(payload, result.token))?.id).toBe(result.account.id)

      // A code works once.
      expect((await verifyLoginCode(payload, email, code)).ok).toBe(false)
    })

    it('locks a code after repeated wrong guesses and creates no account', async () => {
      const email = 'guess@support.test'
      await requestLoginCode(payload, email)
      const code = lastCode()
      const wrong = code === '000000' ? '000001' : '000000'
      for (let i = 0; i < 5; i++) expect((await verifyLoginCode(payload, email, wrong)).ok).toBe(false)
      expect((await verifyLoginCode(payload, email, code)).ok).toBe(false)
      expect((await payload.count({ collection: 'customer-accounts', where: { email: { equals: email } } })).totalDocs).toBe(0)
    })

    it('rejects a code for a different email, and an expired code', async () => {
      await requestLoginCode(payload, 'one@support.test')
      const code = lastCode()
      await requestLoginCode(payload, 'two@support.test')
      expect((await verifyLoginCode(payload, 'two@support.test', code)).ok).toBe(code === lastCode())

      await payload.update({ collection: 'login-codes', where: { email: { equals: 'one@support.test' } }, data: { expiresAt: new Date(Date.now() - 1000).toISOString() }, overrideAccess: true })
      expect((await verifyLoginCode(payload, 'one@support.test', code)).ok).toBe(false)
    })

    it('replaces older codes and limits how many a mailbox can get', async () => {
      const email = 'bomb@support.test'
      await requestLoginCode(payload, email)
      const first = lastCode()
      await requestLoginCode(payload, email)
      const second = lastCode()
      if (first !== second) expect((await verifyLoginCode(payload, email, first)).ok).toBe(false)
      await requestLoginCode(payload, email)
      sentEmails = []
      expect((await requestLoginCode(payload, email)).ok).toBe(false)
      expect(sentEmails).toHaveLength(0)
      expect((await requestLoginCode(payload, 'not-an-email')).ok).toBe(false)
    })

    it('ends sessions on sign-out, and blocks disabled accounts', async () => {
      await requestLoginCode(payload, 'session@support.test')
      const result = await verifyLoginCode(payload, 'session@support.test', lastCode())
      if (!result.ok) throw new Error(result.message)
      await endSessions(payload, result.account)
      expect(await accountFromToken(payload, result.token)).toBeNull()

      await requestLoginCode(payload, 'session@support.test')
      const again = await verifyLoginCode(payload, 'session@support.test', lastCode())
      if (!again.ok) throw new Error(again.message)
      expect(await accountFromToken(payload, again.token)).not.toBeNull()
      await payload.update({ collection: 'customer-accounts', id: again.account.id, data: { disabled: true } })
      expect(await accountFromToken(payload, again.token)).toBeNull()

      await requestLoginCode(payload, 'session@support.test')
      expect((await verifyLoginCode(payload, 'session@support.test', lastCode())).ok).toBe(false)
    })

    it('shows only orders placed with the verified email, matching case-insensitively', async () => {
      await createOrder('new', '03001230020', 'History@Support.Test')
      await createOrder('new', '03001230021', 'someone-else@support.test')
      await requestLoginCode(payload, 'history@support.test')
      const result = await verifyLoginCode(payload, 'history@support.test', lastCode())
      if (!result.ok) throw new Error(result.message)
      const orders = await accountOrders(payload, result.account)
      expect(orders.map((o) => o.email)).toEqual(['history@support.test'])
    })

    it('manages profile, addresses and wishlist, ignoring bad input', async () => {
      await requestLoginCode(payload, 'profile@support.test')
      const result = await verifyLoginCode(payload, 'profile@support.test', lastCode())
      if (!result.ok) throw new Error(result.message)
      const reload = () => payload.findByID({ collection: 'customer-accounts', id: result.account.id, depth: 0 })

      expect(await saveProfile(payload, result.account, { name: 'Hira', phone: 'nope' })).toMatch(/valid/)
      expect(await saveProfile(payload, result.account, { name: 'Hira', phone: '0300 1112223' })).toBeNull()
      expect(await reload()).toMatchObject({ name: 'Hira', phone: '+923001112223' })

      expect(await addAddress(payload, await reload(), { city: '', address: 'x' })).toBeTruthy()
      expect(await addAddress(payload, await reload(), { label: 'Home', city: 'Lahore', address: 'House 5, Gulberg' })).toBeNull()
      const [address] = (await reload()).addresses!
      await removeAddress(payload, await reload(), address.id!)
      expect((await reload()).addresses).toHaveLength(0)

      // Merge keeps saved items; unpublished and unknown products are dropped; replace can remove.
      await saveWishlist(payload, await reload(), [product.id])
      expect(await saveWishlist(payload, await reload(), [unpublished.id, 999999, 'x'], { merge: true })).toEqual([product.id])
      expect(await saveWishlist(payload, await reload(), [])).toEqual([])
    })

    it('does not expose accounts or codes through public access', async () => {
      await expect(payload.find({ collection: 'customer-accounts', overrideAccess: false, user: null })).rejects.toThrow()
      await expect(payload.find({ collection: 'login-codes', overrideAccess: false, user: null })).rejects.toThrow()
    })
  })
})
