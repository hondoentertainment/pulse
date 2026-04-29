import { expect, test } from '@playwright/test'

test.describe('visual preview surfaces', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/Live reel/i)).toBeVisible({ timeout: 20_000 })
  })

  test('mobile home feed has reel, recommendations, and city pulse', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByText(/For you tonight/i)).toBeVisible()
    await expect(page.getByText(/City pulse/i)).toBeVisible()
    await page.screenshot({ path: 'test-results/visual-mobile-home.png', fullPage: true })
  })

  test('venue detail has cinematic hero and live modules', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByLabel(/Open /).first().click()
    await expect(page.getByText(/Live Energy/i)).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: 'test-results/visual-venue-detail.png', fullPage: true })
  })

  test('pulse media card renders in the social feed', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 })
    await page.getByLabel(/Open /).first().click()
    await expect(page.locator('img[alt*="pulse"]').first()).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: 'test-results/visual-pulse-card.png', fullPage: true })
  })
})
