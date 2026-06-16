import { expect, test } from '@playwright/test'

test.describe.configure({ timeout: 60_000 })

/**
 * Smoke tests for the default production entry (Pulse Signal).
 * Run with default Playwright env — do NOT set VITE_APP_MODE=venue.
 */
test('loads signal shell with navigation', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Pulse/i)
  await expect(page.getByRole('link', { name: /Home — Today's check-in/i })).toBeVisible({ timeout: 25_000 })
  await expect(page.getByRole('link', { name: /Trends — Chart and pattern/i })).toBeVisible()
})

test('can navigate between signal tabs', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Home — Today's check-in/i })).toBeVisible({ timeout: 25_000 })

  await page.getByRole('link', { name: /Trends — Chart and pattern/i }).click()
  await expect(page.getByRole('link', { name: /Trends — Chart and pattern/i })).toHaveAttribute('aria-current', 'page')

  await page.getByRole('link', { name: /Settings — Preferences/i }).click()
  await expect(page.getByRole('link', { name: /Settings — Preferences/i })).toHaveAttribute('aria-current', 'page')
})
