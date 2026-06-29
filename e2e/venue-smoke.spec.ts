import { expect, test } from '@playwright/test'
import { completeOnboarding } from './fixtures/onboarding'

/**
 * Venue / social shell smoke tests.
 * Run with `VITE_APP_MODE=venue`, or via `npm run test:e2e:venue`.
 */
test.describe('Venue shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await completeOnboarding(page)
  })

  test('surfaces core navigation and global search', async ({ page }) => {
    await expect(page.locator('nav')).toBeVisible()
    await expect(page.locator('#main-content')).toBeVisible()

    await page.getByRole('button', { name: /Search venues and cities/i }).click()
    await expect(page.getByPlaceholder(/Search venues, cities, categories/i)).toBeFocused()
  })

  test('renders deterministic seeded venues on trending', async ({ page }) => {
    // The visual-preview/E2E build loads a fixed venue seed; assert a known
    // venue surfaces so the feed isn't silently empty.
    await page.getByRole('button', { name: /Search venues and cities/i }).click()
    const search = page.getByPlaceholder(/Search venues, cities, categories/i)
    await search.fill('Neon')
    await expect(page.getByText(/The Neon Room/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('renders direct sub-page routes without blank screens', async ({ page }) => {
    await page.goto('/integrations')
    await completeOnboarding(page)
    await expect(page.getByText(/Pick a venue first|Integrations are not available/i)).toBeVisible()

    await page.goto('/safety/contacts')
    await completeOnboarding(page)
    await expect(page.getByRole('heading', { name: /Emergency Contacts/i })).toBeVisible()
  })
})
