import { expect, test } from '@playwright/test'
import { completeSignalOnboarding, resetSignalState } from './fixtures/signal-onboarding'

test.describe.configure({ timeout: 60_000, mode: 'serial' })

/**
 * Smoke tests for the default production entry (Pulse Signal).
 */
test.beforeEach(async ({ page }) => {
  await resetSignalState(page)
  await completeSignalOnboarding(page)
})

test('loads signal shell with navigation', async ({ page }) => {
  await expect(page).toHaveTitle(/Pulse/i)
  await expect(page.getByRole('link', { name: /Home — Today's check-in/i })).toBeVisible({ timeout: 25_000 })
  await expect(page.getByRole('link', { name: /Trends — Chart and pattern/i })).toBeVisible()
})

test('can navigate between signal tabs', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Home — Today's check-in/i })).toBeVisible({ timeout: 25_000 })

  const trends = page.getByRole('link', { name: /Trends — Chart and pattern/i })
  await trends.scrollIntoViewIfNeeded()
  await trends.evaluate((element: HTMLElement) => element.click())
  await expect(trends).toHaveAttribute('aria-current', 'page')

  const settings = page.getByRole('link', { name: /Settings — Preferences/i })
  await settings.scrollIntoViewIfNeeded()
  await settings.evaluate((element: HTMLElement) => element.click())
  await expect(settings).toHaveAttribute('aria-current', 'page')
})
