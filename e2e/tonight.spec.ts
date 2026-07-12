import { expect, test } from '@playwright/test'
import { completeOnboarding } from './fixtures/onboarding'

test.describe('Tonight golden path', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await completeOnboarding(page)
  })

  test('shows vibe picker and recommendation cards', async ({ page }) => {
    await expect(page.getByTestId('tonight-tab')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /^Tonight$/i })).toBeVisible()
    await page.getByTestId('vibe-buzzing').click()
    await expect(page.getByTestId('tonight-pick-card').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('tonight-go').first()).toBeVisible()
  })

  test('venue detail shows Worth going summary after Go', async ({ page }) => {
    await expect(page.getByTestId('tonight-tab')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('vibe-any').click()
    await page.getByTestId('tonight-go').first().click()
    await expect(page.getByTestId('worth-going-panel')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Worth going\?/i)).toBeVisible()
  })
})
