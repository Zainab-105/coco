import { expect, test, type Page } from '@playwright/test'

/**
 * Storefront journey against a dev server with the sample catalogue (`npm run seed:sample`).
 * Runs on a phone viewport because most COCO customers shop on mobile.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('home shows categories and best sellers', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/COCO/)
  await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Best sellers' })).toBeVisible()
})

test('browse, filter, choose a fragrance and add to cart', async ({ page }) => {
  await page.goto('/collections/car-scents')
  await expect(page.getByRole('heading', { level: 1, name: 'Car Scents' })).toBeVisible()

  await page.getByRole('button', { name: /^Filter/ }).click()
  await page.getByRole('dialog').getByLabel('Sweet Rose').check()
  await expect(page).toHaveURL(/fragrance=sweet-rose/)
  await page.getByRole('button', { name: /^Show \d+ product/ }).click()

  await page.getByRole('link', { name: 'Hanging Car Diffuser', exact: true }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Hanging Car Diffuser', exact: true })).toBeVisible()

  await page.getByRole('radio', { name: 'Cool Ice' }).check({ force: true })
  await page.getByRole('button', { name: 'Add to cart' }).first().click()

  const drawer = page.getByRole('dialog', { name: /Your cart/ })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('Fragrance: Cool Ice')).toBeVisible()
  await expect(drawer.getByRole('link', { name: 'Checkout' })).toBeVisible()
})

test('sold-out fragrances cannot be selected', async ({ page }) => {
  await page.goto('/products/hanging-car-diffuser')
  await expect(page.getByRole('radio', { name: 'Forest Pine' })).toBeDisabled()
})

test('search suggests products', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByRole('searchbox', { name: 'Search products' }).fill('vanilla')
  await expect(page.getByRole('link', { name: /Hanging Car Diffuser/ })).toBeVisible()
})

test('wishlist keeps saved products', async ({ page }) => {
  await page.goto('/collections/gift-sets')
  await page.getByRole('button', { name: /Add Signature Gift Set to wishlist/ }).click()
  await page.goto('/wishlist')
  await expect(page.getByRole('link', { name: 'Signature Gift Set' })).toBeVisible()
})

/** A real finger swipe (touch events through the browser), right to left. */
async function swipeLeft(page: Page, box: { x: number; y: number; width: number; height: number }) {
  const client = await page.context().newCDPSession(page)
  const y = box.y + box.height / 2
  const point = (x: number) => [{ x, y }]
  const startX = box.x + box.width * 0.85
  const endX = box.x + box.width * 0.1
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(startX) })
  for (let step = 1; step <= 8; step++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(startX + ((endX - startX) * step) / 8) })
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

const diffuserCard = (page: Page) => page.getByRole('article').filter({ has: page.getByRole('link', { name: 'Hanging Car Diffuser', exact: true }) }).first()

test('swiping a product card shows its video without leaving the page', async ({ page }) => {
  await page.goto('/collections/car-scents')
  const card = diffuserCard(page)
  const video = card.locator('video')
  await expect(video).toHaveAttribute('poster', /.+/)
  await expect(video).toHaveJSProperty('paused', true)

  const carousel = card.locator('[aria-roledescription="carousel"]')
  await carousel.scrollIntoViewIfNeeded()
  const box = (await carousel.boundingBox())!

  // A swipe does nothing until client-side code is running, so repeat it only while still on slide 1.
  await expect(async () => {
    const first = (await card.getByRole('group', { name: /^1 of / }).boundingBox())!
    if (Math.abs(first.x - box.x) < 1) await swipeLeft(page, box)
    const slide = (await card.getByRole('group', { name: /^2 of / }).boundingBox())!
    expect(Math.abs(slide.x - box.x)).toBeLessThan(5)
  }).toPass({ timeout: 15_000 })

  await expect(video).toHaveJSProperty('paused', false)
  await expect(page).toHaveURL(/\/collections\/car-scents$/)
})

test('Quick View opens from a product card on a phone and adds to the cart', async ({ page }) => {
  await page.goto('/collections/gift-sets')
  await page.getByRole('button', { name: 'Quick view Signature Gift Set' }).click()

  const dialog = page.getByRole('dialog', { name: 'Signature Gift Set' })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(/\/collections\/gift-sets$/)

  await dialog.getByRole('button', { name: /add to cart/i }).click()
  await expect(page.getByRole('dialog', { name: /Your cart/ }).getByText('Signature Gift Set')).toBeVisible()
})

test('Quick Add puts a simple product straight in the cart', async ({ page }) => {
  await page.goto('/collections/gift-sets')
  await page.getByRole('button', { name: 'Add to cart: Signature Gift Set' }).click()
  await expect(page.getByRole('dialog', { name: /Your cart/ }).getByText('Signature Gift Set')).toBeVisible()
})

test('Quick Add asks for a fragrance first when the product needs one', async ({ page }) => {
  await page.goto('/collections/car-scents')
  await page.getByRole('button', { name: 'Choose fragrance: Hanging Car Diffuser' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Hanging Car Diffuser' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('radio', { name: 'Cool Ice' })).toBeVisible()
})

test.describe('on desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false })

  test('arrows browse a product card, and Quick View opens on hover', async ({ page }) => {
    await page.goto('/collections/car-scents')
    const card = diffuserCard(page)
    await card.hover()

    const carousel = card.locator('[aria-roledescription="carousel"]')
    const box = (await carousel.boundingBox())!
    await expect(async () => {
      await card.getByRole('button', { name: 'Show video 2' }).click()
      const slide = (await card.getByRole('group', { name: /^2 of / }).boundingBox())!
      expect(Math.abs(slide.x - box.x)).toBeLessThan(5)
    }).toPass({ timeout: 15_000 })

    await card.getByRole('button', { name: 'Next image' }).click()
    await expect(async () => {
      const slide = (await card.getByRole('group', { name: /^3 of / }).boundingBox())!
      expect(Math.abs(slide.x - box.x)).toBeLessThan(5)
    }).toPass()

    await card.getByRole('button', { name: 'Quick view Hanging Car Diffuser' }).click()
    await expect(page.getByRole('dialog', { name: 'Hanging Car Diffuser' })).toBeVisible()
  })
})

test('unknown products return the 404 page', async ({ page }) => {
  const response = await page.goto('/products/does-not-exist')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: /drifted away/ })).toBeVisible()
})

test('guest checkout with Cash on Delivery and a discount code', async ({ page }) => {
  await page.goto('/products/smokeless-car-ashtray')
  await page.getByRole('button', { name: 'Add to cart' }).first().click()
  await page.getByRole('dialog', { name: /Your cart/ }).getByRole('link', { name: 'Checkout' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible()
  await page.getByLabel('Full name').fill('E2E Tester')
  // Unique phone per run: WELCOME10 is limited to one use per customer.
  await page.getByLabel('Mobile number').fill(`0300${String(Date.now()).slice(-7)}`)
  await page.getByLabel('City').fill('Lahore')
  await page.getByLabel('Complete address').fill('House 1, Street 1, Model Town')

  await page.getByRole('button', { name: /order summary/ }).click()
  await page.getByRole('textbox', { name: 'Discount code' }).first().fill('welcome10')
  await page.getByRole('button', { name: 'Apply' }).first().click()
  await expect(page.getByText('10% off applied.').first()).toBeVisible()

  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page).toHaveURL(/\/order\/COCO-\d{6}-[A-Z0-9]{4}\?t=[a-f0-9]{32}/)
  await expect(page.getByRole('heading', { name: 'Thank you, E2E!' })).toBeVisible()
  await expect(page.getByText(/Cash on Delivery\./)).toBeVisible()
})

test('an autofilled hidden field does not stop a real customer ordering', async ({ page }) => {
  await page.goto('/products/smokeless-car-ashtray')
  await page.getByRole('button', { name: 'Add to cart' }).first().click()
  await page.getByRole('dialog', { name: /Your cart/ }).getByRole('link', { name: 'Checkout' }).click()

  await page.getByLabel('Full name').fill('Autofill Tester')
  await page.getByLabel('Mobile number').fill(`0301${String(Date.now()).slice(-7)}`)
  await page.getByLabel('City').fill('Lahore')
  await page.getByLabel('Complete address').fill('House 2, Street 2, Model Town')
  const checkout = page.locator('form', { has: page.getByRole('button', { name: /Place order/ }) })
  await checkout.getByLabel('Leave this field empty').fill('https://example.com', { force: true })

  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page).toHaveURL(/\/order\/COCO-\d{6}-[A-Z0-9]{4}\?t=[a-f0-9]{32}/)
})

test('checkout shows field errors', async ({ page }) => {
  await page.goto('/products/smokeless-car-ashtray')
  await page.getByRole('button', { name: 'Add to cart' }).first().click()
  await page.goto('/checkout')
  await page.getByLabel('Mobile number').fill('12345')
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByText('Enter a valid Pakistani mobile number, e.g. 0300 1234567.')).toBeVisible()
  await expect(page.getByText('Please enter your full name.')).toBeVisible()
})

test('footer newsletter sign-up confirms the subscription', async ({ page }) => {
  await page.goto('/')
  const footer = page.locator('footer')
  await footer.getByLabel(/New scents and offers/).fill(`e2e-${Date.now()}@example.com`)
  await footer.getByRole('button', { name: 'Join' }).click()
  await expect(footer.getByText('Thank you! New scents and offers will reach your inbox.')).toBeVisible()
})

test('newsletter says so when an autofilled hidden field stops a sign-up', async ({ page }) => {
  await page.goto('/')
  const footer = page.locator('footer')
  await footer.getByLabel(/New scents and offers/).fill(`e2e-autofill-${Date.now()}@example.com`)
  await footer.getByLabel('Leave this field empty').fill('Acme Ltd', { force: true })
  await footer.getByRole('button', { name: 'Join' }).click()
  await expect(footer.getByText(/turn off autofill/)).toBeVisible()
})
