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
