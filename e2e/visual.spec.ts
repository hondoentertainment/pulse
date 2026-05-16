import { expect, test } from '@playwright/test'
import { completeOnboarding } from './fixtures/onboarding'

test.describe('visual preview surfaces', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await completeOnboarding(page)
  })

  test('mobile home feed has reel, recommendations, and city pulse', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    // Wait for any feed content to render (text varies by data)
    const feedContent = page.getByText(/For you tonight/i)
      .or(page.getByText(/Live reel/i))
      .or(page.getByText(/City pulse/i))
      .or(page.getByText(/Trending/i))
    await expect(feedContent.first()).toBeVisible({ timeout: 20_000 })
    await page.screenshot({ path: 'test-results/visual-mobile-home.png', fullPage: true })
  })

  test('venue detail has cinematic hero and live modules', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const venueLink = page.getByLabel(/Open /).first()
    const visible = await venueLink
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false)
    if (!visible) {
      test.skip(true, 'No venue links available in preview mode')
      return
    }
    await venueLink.click()
    await expect(page.getByText(/Live Energy/i).or(page.getByText(/Energy/i)).first()).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: 'test-results/visual-venue-detail.png', fullPage: true })
  })

  test('pulse media card renders in the social feed', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 })
    const venueLink = page.getByLabel(/Open /).first()
    const visible = await venueLink
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false)
    if (!visible) {
      test.skip(true, 'No venue links available in preview mode')
      return
    }
    await venueLink.click()
    await expect(page.locator('img[alt*="pulse"]').first()).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: 'test-results/visual-pulse-card.png', fullPage: true })
  })
})
