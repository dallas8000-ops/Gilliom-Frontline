import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/accounts/login/')
  await page.getByLabel('Username').fill(process.env.FRONTLINE_E2E_USERNAME ?? 'dba-demo')
  await page.getByLabel('Password').fill(process.env.FRONTLINE_E2E_PASSWORD ?? 'FrontlineDemo2026!')
  await page.locator('form').evaluate((form: HTMLFormElement) => form.submit())
  await expect(page.getByRole('heading', { name: 'Incident command' })).toBeVisible()
})

test('dashboard is responsive and opens incident composer', async ({ page }) => {
  await expect(page.locator('.live-state')).not.toHaveClass(/offline/)
  await expect(page.getByRole('button', { name: 'New incident' })).toBeVisible()

  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth)
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBe(viewportWidth)

  await page.getByRole('button', { name: 'New incident' }).click()
  await expect(page.getByRole('heading', { name: 'File an incident' })).toBeVisible()
  await expect(page.getByLabel('Title')).toBeFocused()
})