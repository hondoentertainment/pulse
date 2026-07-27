import { expect, test } from '@playwright/test'
import { completeOnboarding } from './fixtures/onboarding'

test.describe('Search and filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await completeOnboarding(page)
  })

  test('search input becomes focusable and accepts text', async ({ page }) => {
    // Global search lives behind the header button and opens an overlay input.
    const searchButton = page.getByRole('button', { name: /Search venues and cities/i })
    await expect(searchButton).toBeVisible({ timeout: 15_000 })

    await searchButton.click()
    const input = page.getByPlaceholder(/Search venues, cities, categories/i)
    await expect(input).toBeFocused()
    await input.fill('bar')
    await expect(input).toHaveValue('bar')
  })

  test('vibe filter controls are present on home', async ({ page }) => {
    // Home filters by desired energy rather than the category buttons this
    // suite originally looked for.
    const vibeFilter = page.getByRole('radiogroup', { name: /Desired energy level/i })
    await expect(vibeFilter).toBeVisible({ timeout: 15_000 })
    await expect(vibeFilter.getByRole('radio', { name: /Any vibe/i })).toBeVisible()
  })

  // TODO: requires seeded venue data to exercise end-to-end filtering.
  test.skip('filters results by category (requires seeded venues)', async () => {
    // Intentionally unimplemented — waits for test fixtures/backend mocks
    // that expose deterministic venue lists.
  })
})
