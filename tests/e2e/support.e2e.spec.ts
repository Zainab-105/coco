import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'
import sharp from 'sharp'

import { hashLoginCode } from '../../src/lib/account/session.js'
import config from '../../src/payload.config.js'

/**
 * Review, contact and account journeys on a phone viewport, against a dev server with the sample
 * catalogue. Test data is removed afterwards.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
test.describe.configure({ mode: 'serial' })
// Dev servers compile pages on first visit.
test.setTimeout(120_000)

const run = Date.now()
const author = `E2E Reviewer ${run}`
const contactName = `E2E Contact ${run}`
const email = `e2e-${run}@example.com`
const client = () => getPayload({ config })

test.afterAll(async () => {
  const payload = await client()
  await payload.delete({ collection: 'reviews', where: { authorName: { equals: author } } })
  await payload.delete({ collection: 'support-tickets', where: { name: { equals: contactName } } })
  await payload.delete({ collection: 'customer-accounts', where: { email: { equals: email } } })
  await payload.delete({ collection: 'subscribers', where: { email: { equals: email } } })
})

test('a review stays hidden, with a private photo, until staff approve it', async ({ page, request }) => {
  await page.goto('/products/smokeless-car-ashtray')
  await page.getByRole('button', { name: 'Write a review' }).click()

  // Field errors first.
  await page.getByRole('button', { name: 'Submit review' }).click()
  await expect(page.getByText('Please choose a star rating.')).toBeVisible()

  await page.locator('label', { has: page.getByRole('radio', { name: /^5 stars/ }) }).click()
  await page.getByLabel('Your name').fill(author)
  await page.getByLabel('Your review').fill('Sits perfectly in the cup holder and looks premium.')
  const png = await sharp({ create: { width: 60, height: 60, channels: 3, background: '#6b1f2a' } }).png().toBuffer()
  await page.locator('#support-files').setInputFiles({ name: 'my-photo.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByText('my-photo.png')).toBeVisible()
  await page.getByRole('button', { name: 'Submit review' }).click()
  await expect(page.getByText(/Your review will appear here/)).toBeVisible({ timeout: 30_000 })

  const payload = await client()
  const { docs } = await payload.find({ collection: 'reviews', where: { authorName: { equals: author } }, depth: 1 })
  expect(docs).toHaveLength(1)
  expect(docs[0]).toMatchObject({ status: 'pending', verifiedPurchase: false })
  const upload = docs[0].attachments![0] as { url: string }
  const path = new URL(upload.url, 'http://localhost:3000').pathname

  // Anonymous visitors cannot fetch the file or see the review yet.
  expect((await request.get(path)).status()).toBeGreaterThanOrEqual(400)
  await page.reload()
  await expect(page.getByText(author)).toHaveCount(0)

  await payload.update({ collection: 'reviews', id: docs[0].id, data: { status: 'approved' } })
  expect((await request.get(path)).status()).toBe(200)
  await page.goto('/products/smokeless-car-ashtray')
  await expect(page.getByText(author)).toBeVisible()
  await expect(page.getByRole('img', { name: `Photo from ${author}` })).toBeVisible()
})

test('the contact form creates a support ticket', async ({ page }) => {
  await page.goto('/contact?order=COCO-TEST-1')
  await expect(page.getByLabel('Order number (optional)')).toHaveValue('COCO-TEST-1')

  await page.getByLabel('Your name').fill(contactName)
  await page.getByLabel('Your message').fill('My parcel arrived with a cracked bottle.')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('Please give a mobile number or email so we can reply.')).toBeVisible()

  await page.getByLabel('What is this about?').selectOption('complaint')
  await page.getByLabel('Mobile number').fill('0300 1234567')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText(/We received your message \(reference #\d+\)/)).toBeVisible({ timeout: 30_000 })

  const payload = await client()
  const { docs } = await payload.find({ collection: 'support-tickets', where: { name: { equals: contactName } } })
  expect(docs[0]).toMatchObject({ type: 'complaint', priority: 'high', status: 'open', phone: '+923001234567', orderReference: 'COCO-TEST-1' })
})

test('an autofilled hidden field does not lose a complaint or a review', async ({ page }) => {
  await page.goto('/contact')
  const contact = page.locator('form', { has: page.getByRole('button', { name: 'Send message' }) })
  await contact.getByLabel('Your name').fill(contactName)
  await contact.getByLabel('Your message').fill('Filled in by my autofill tool, please still read this.')
  await contact.getByLabel('Mobile number').fill('0300 1234568')
  await contact.getByLabel('Leave this field empty').fill('Acme Ltd', { force: true })
  await contact.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText(/We received your message \(reference #\d+\)/)).toBeVisible({ timeout: 30_000 })

  const payload = await client()
  const tickets = await payload.find({ collection: 'support-tickets', where: { phone: { equals: '+923001234568' } }, sort: '-createdAt', limit: 1 })
  expect(tickets.docs[0].resolutionNotes).toMatch(/anti-bot field/)

  await page.goto('/products/smokeless-car-ashtray')
  await page.getByRole('button', { name: 'Write a review' }).click()
  const review = page.locator('form', { has: page.getByRole('button', { name: 'Submit review' }) })
  await page.locator('label', { has: page.getByRole('radio', { name: /^4 stars/ }) }).click()
  await review.getByLabel('Your name').fill(author)
  await review.getByLabel('Your review').fill('Filled in by my autofill tool and still worth reading.')
  await review.getByLabel('Leave this field empty').fill('Acme Ltd', { force: true })
  await review.getByRole('button', { name: 'Submit review' }).click()
  await expect(page.getByText(/Your review will appear here/)).toBeVisible({ timeout: 30_000 })
  const reviews = await payload.find({ collection: 'reviews', where: { and: [{ authorName: { equals: author } }, { status: { equals: 'pending' } }] } })
  expect(reviews.docs).toHaveLength(1)
})

test('sign in with an emailed code, save details, use them at checkout, sign out', async ({ page }) => {
  await page.goto('/account')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await expect(page.getByText(/We sent a 6-digit code/)).toBeVisible({ timeout: 30_000 })

  // The real code goes to the mail server, so swap in one this test knows.
  const payload = await client()
  await payload.update({
    collection: 'login-codes',
    where: { email: { equals: email } },
    data: { codeHash: hashLoginCode(email, '424242') },
    overrideAccess: true,
  })

  await page.getByLabel('6-digit code').fill('000000')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText(/not correct or has expired/)).toBeVisible()
  await page.getByLabel('6-digit code').fill('424242')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible({ timeout: 30_000 })

  // The session cookie is not readable by page scripts.
  const cookies = await page.context().cookies()
  expect(cookies.find((c) => c.name === 'coco_session')?.httpOnly).toBe(true)

  await page.getByLabel('Full name').fill('E2E Shopper')
  await page.getByLabel('Mobile number').fill('0300 7654321')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()

  await page.getByLabel('City').fill('Lahore')
  await page.getByLabel('Complete address').fill('House 9, Street 4, Gulberg')
  await page.getByRole('button', { name: 'Add address' }).click()
  await expect(page.getByText('House 9, Street 4, Gulberg')).toBeVisible()

  // Wishlist follows the account.
  await page.goto('/products/smokeless-car-ashtray')
  await page.getByRole('button', { name: 'Add to wishlist', exact: true }).first().click()
  await expect
    .poll(async () => (await payload.find({ collection: 'customer-accounts', where: { email: { equals: email } }, depth: 0 })).docs[0].wishlist?.length ?? 0, { timeout: 15_000 })
    .toBe(1)

  await page.getByRole('button', { name: 'Add to cart' }).first().click()
  await page.getByRole('dialog', { name: /Your cart/ }).getByRole('link', { name: 'Checkout' }).click()
  await expect(page.getByLabel('Full name')).toHaveValue('E2E Shopper', { timeout: 30_000 })
  await expect(page.getByLabel('Mobile number')).toHaveValue('+923007654321')
  await expect(page.getByLabel('Complete address')).toHaveValue('House 9, Street 4, Gulberg')

  await page.goto('/account')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('button', { name: 'Email me a code' })).toBeVisible({ timeout: 30_000 })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Email me a code' })).toBeVisible()
})
