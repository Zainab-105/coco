import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import { totpCode, totpCounter } from '../../src/lib/security/totp.js'
import config from '../../src/payload.config.js'

/**
 * Security and SEO behaviour only a real server and browser can show: headers, policy violations
 * on real pages, redirects, structured data, and the two-factor journey through the admin UI.
 * Needs the sample catalogue. Test data is removed afterwards.
 */
test.describe.configure({ mode: 'serial' })
// Dev servers compile pages on first visit.
test.setTimeout(120_000)

const run = Date.now()
const email = `e2e-2fa-${run}@example.com`
const password = 'E2e-Passw0rd!x'
const from = `/e2e-old-${run}`
const client = () => getPayload({ config })

test.afterAll(async () => {
  const payload = await client()
  await payload.delete({ collection: 'users', where: { email: { equals: email } } })
  await payload.delete({ collection: 'redirects', where: { from: { equals: from } } })
})

/** Fails the test if the browser blocked anything under the Content-Security-Policy. */
function watchPolicy(page: Page) {
  const blocked: string[] = []
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) blocked.push(m.text().slice(0, 300))
  })
  return blocked
}

test('every page sends the security headers', async ({ request }) => {
  for (const path of ['/', '/admin/login']) {
    const headers = (await request.get(path)).headers()
    expect(headers['content-security-policy']).toContain("object-src 'none'")
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('SAMEORIGIN')
    expect(headers['x-powered-by']).toBeUndefined()
  }
  expect((await request.get('/')).headers()['content-security-policy']).not.toContain('cdn.jsdelivr.net')
  expect((await request.get('/admin/login')).headers()['content-security-policy']).toContain('cdn.jsdelivr.net')
})

test('shoppers are not made to reload for the admin theme hint', async ({ request }) => {
  const store = (await request.get('/')).headers()
  expect(store['critical-ch']).toBeUndefined()
  expect(store['accept-ch']).toBeUndefined()
  expect((await request.get('/admin/login')).headers()['critical-ch']).toBeTruthy()
})

test('storefront pages load with nothing blocked by the policy', async ({ page }) => {
  const blocked = watchPolicy(page)
  for (const path of ['/', '/collections/car-scents', '/products/hanging-car-diffuser', '/contact', '/account', '/track-order', '/faq']) {
    await page.goto(path, { waitUntil: 'networkidle' })
  }
  expect(blocked).toEqual([])
})

test('product pages carry structured data and a social card', async ({ page }) => {
  await page.goto('/products/hanging-car-diffuser')
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
  const [product, breadcrumb] = JSON.parse(blocks[0])
  expect(product['@type']).toBe('Product')
  expect(product.image.length).toBeGreaterThan(0)
  for (const image of product.image) expect(image).toMatch(/^https?:\/\//)
  expect(product.offers.priceCurrency).toBe('PKR')
  expect(breadcrumb['@type']).toBe('BreadcrumbList')

  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'COCO')
  await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute('content', /^https?:\/\//)
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/products\/hanging-car-diffuser$/)
})

test('robots and sitemap are served', async ({ request }) => {
  expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap:')
  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).toContain('/products/hanging-car-diffuser')
  expect(sitemap).toContain('/contact')
})

test('old addresses redirect, and unknown ones are a real 404', async ({ request }) => {
  const payload = await client()
  await payload.create({ collection: 'redirects', data: { from, to: '/collections/car-scents' } })

  const moved = await request.get(from, { maxRedirects: 0 })
  expect(moved.status()).toBe(308)
  expect(moved.headers()['location']).toBe('/collections/car-scents')

  expect((await request.get(`/e2e-nothing-here-${run}`)).status()).toBe(404)
  expect((await request.get(`/products/e2e-nothing-here-${run}`)).status()).toBe(404)
})

test('two-factor: set up in the admin, then required at login', async ({ page, context }) => {
  const payload = await client()
  await payload.create({ collection: 'users', data: { email, password, name: 'E2E Security', roles: ['manager'] } })
  const blocked = watchPolicy(page)

  const logIn = async () => {
    await page.goto('/admin/login')
    await page.fill('#field-email', email)
    await page.fill('#field-password', password)
    await page.getByRole('button', { name: 'Login' }).click()
  }

  await logIn()
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  await expect(page.getByRole('heading', { level: 1, name: /Good (morning|afternoon|evening)/ })).toBeVisible()
  await page.getByRole('link', { name: /Protect your account/ }).click()

  await page.getByRole('button', { name: 'Turn on' }).click()
  await expect(page.getByTestId('tf-qr').locator('svg')).toBeVisible()
  const secret = (await page.getByTestId('tf-secret').textContent())!

  await page.getByLabel('6-digit code from the app').fill('000000')
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByText(/That code is not correct/)).toBeVisible()

  await page.getByLabel('6-digit code from the app').fill(totpCode(secret, totpCounter()))
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('heading', { name: 'Save your recovery codes' })).toBeVisible()
  const recovery = await page.getByTestId('tf-recovery').locator('li').first().textContent()
  expect(recovery).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/)
  await page.getByRole('button', { name: 'I have saved them' }).click()
  await expect(page.getByText(/recovery codes left/)).toBeVisible()

  // A new login needs the code, and no session exists until it is given.
  await context.clearCookies()
  await logIn()
  await expect(page.getByLabel(/Code from your authenticator app/)).toBeVisible()
  expect((await context.cookies()).some((c) => c.name === 'payload-token')).toBe(false)

  await page.getByLabel(/Code from your authenticator app/).fill('000000')
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByText('That code is not correct.')).toBeVisible()
  expect((await context.cookies()).some((c) => c.name === 'payload-token')).toBe(false)

  await page.getByLabel(/Code from your authenticator app/).fill(recovery!)
  await page.getByRole('button', { name: 'Verify' }).click()
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
  await expect(page.getByRole('link', { name: /Protect your account/ })).toHaveCount(0)
  expect(blocked).toEqual([])
})

test('the reset-password route gives no session', async ({ request }) => {
  const payload = await client()
  const token = await payload.forgotPassword({ collection: 'users', data: { email }, disableEmail: true })
  const res = await request.post('/api/users/reset-password', { data: { token, password: 'E2e-N3w-Passw0rd!' } })
  expect(res.status()).toBe(200)
  expect(res.headers()['set-cookie']).toBeUndefined()
})

test('the public API does not expose private collections', async ({ request }) => {
  for (const slug of ['orders', 'customers', 'users', 'carts', 'customer-accounts', 'login-codes', 'support-tickets']) {
    expect((await request.get(`/api/${slug}`)).status(), slug).toBe(403)
  }
  expect((await request.post('/api/graphql', { data: { query: '{__typename}' } })).ok()).toBe(false)
})
