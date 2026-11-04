import { test, expect, Page } from '@playwright/test'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

test.describe('Admin Panel', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()

    const context = await browser.newContext()
    page = await context.newPage()

    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('can navigate to dashboard', async () => {
    await page.goto('http://localhost:3000/admin')
    await expect(page).toHaveURL('http://localhost:3000/admin')
    const dashboardArtifact = page.locator('span[title="Dashboard"]').first()
    await expect(dashboardArtifact).toBeVisible()
  })

  test('can navigate to list view', async () => {
    await page.goto('http://localhost:3000/admin/collections/users')
    await expect(page).toHaveURL('http://localhost:3000/admin/collections/users')
    const listViewArtifact = page.locator('h1', { hasText: 'Users' }).first()
    await expect(listViewArtifact).toBeVisible()
  })

  test('can navigate to edit view', async () => {
    await page.goto('http://localhost:3000/admin/collections/users/create')
    await expect(page).toHaveURL(/\/admin\/collections\/users\/[a-zA-Z0-9-_]+/)
    const editViewArtifact = page.locator('input[name="email"]')
    await expect(editViewArtifact).toBeVisible()
  })

  test('dashboard shows the last 30 days with a comparison', async () => {
    await page.goto('http://localhost:3000/admin')
    await expect(page.getByText('Last 30 days')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Net sales per day, last 30 days' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open reports' })).toBeVisible()
  })

  test('dashboard offers today, yearly and custom dates, with store totals', async () => {
    await page.goto('http://localhost:3000/admin?period=ytd')
    await expect(page.getByRole('heading', { name: 'This year' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Net sales per week, this year' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Total customers/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Live products/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Top categories' })).toBeVisible()

    await page.getByRole('link', { name: 'Today', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()

    await page.getByLabel('From').fill('2026-01-01')
    await page.getByLabel('To', { exact: true }).fill('2026-03-31')
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page).toHaveURL(/period=custom/)
    await expect(page.getByRole('heading', { name: '1 Jan 2026 – 31 Mar 2026' })).toBeVisible()
  })

  test('reports group by year and suggest what to restock', async () => {
    await page.goto('http://localhost:3000/admin/reports?range=ytd&compare=none')
    await page.getByLabel('Group by').selectOption('year')
    await expect(page).toHaveURL(/group=year/)
    await expect(page.getByLabel('Group by')).toHaveValue('year')
    await expect(page.getByRole('img', { name: 'Net sales over time' })).toContainText('2026')

    await page.getByRole('link', { name: 'Inventory' }).click()
    await expect(page).toHaveURL(/group=year/)
    await expect(page.getByText('Consider restocking')).toBeVisible()
    await expect(page.getByText('Consider promoting')).toBeVisible()
  })

  test('reviews and support tickets have status queues', async () => {
    await page.goto('http://localhost:3000/admin/collections/reviews')
    await expect(page.getByRole('navigation', { name: 'Filter by status' }).getByRole('link', { name: /Pending/ })).toBeVisible()
    await page.goto('http://localhost:3000/admin/collections/support-tickets')
    await expect(page.getByRole('navigation', { name: 'Filter by status' }).getByRole('link', { name: /In progress/ })).toBeVisible()
    await page.goto('http://localhost:3000/admin')
    await expect(page.getByRole('link', { name: /Reviews to moderate/ })).toBeVisible()
  })

  test('reports switch tabs and ranges', async () => {
    await page.goto('http://localhost:3000/admin/reports?range=90d&compare=previous')
    await expect(page.locator('h1', { hasText: 'Reports' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Net sales over time' })).toBeVisible()
    await expect(page.getByText('Sales by product').first()).toBeVisible()

    await page.getByRole('link', { name: 'Finance' }).click()
    await expect(page.getByText('Finance summary')).toBeVisible()
    await expect(page).toHaveURL(/tab=finance/)

    await page.getByLabel('Period', { exact: true }).selectOption('custom')
    await expect(page).toHaveURL(/range=custom/)
    await expect(page.getByLabel('From')).toBeVisible()
  })
})
