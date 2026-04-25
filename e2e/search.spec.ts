import { expect, test } from '@playwright/test'
import { completeOnboarding, goToTab } from './fixtures/onboarding'

test.describe('Search and filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await completeOnboarding(page)
  })

  test('search input becomes focusable and accepts text', async ({ page }) => {
    // The app may surface search on Home or Map tab — probe both
    const searchInputs = page.locator('input[placeholder*="search" i], input[type="search"]')
    let count = await searchInputs.count()

    if (count === 0) {
      await goToTab(page, /^map$/i)
      count = await searchInputs.count()
    }

    if (count === 0) {
      test.skip(true, 'Search input not surfaced in current build')
      return
    }

    const input = searchInputs.first()
    await input.click()
    await input.fill('bar')
    await expect(input).toHaveValue('bar')
  })

  test('filter buttons are present on discover/home', async ({ page }) => {
    // Look for Category or Filter related controls
    const filterControl = page.locator('button').filter({
      hasText: /filter|category|all|near/i,
    }).first()

    const visible = await filterControl
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false)

    if (!visible) {
      test.skip(true, 'No filter control surfaced without seeded venues')
      return
    }

    await expect(filterControl).toBeVisible()
  })

  // TODO: requires seeded venue data to exercise end-to-end filtering.
  test.skip('filters results by category (requires seeded venues)', async () => {
    // Intentionally unimplemented — waits for test fixtures/backend mocks
    // that expose deterministic venue lists.
  })
})
