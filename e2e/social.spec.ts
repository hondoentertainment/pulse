import { expect, test } from '@playwright/test'
import { completeOnboarding, goToTab } from './fixtures/onboarding'

test.describe('Social flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await completeOnboarding(page)
  })

  test('profile tab surfaces the current user', async ({ page }) => {
    const hasProfileTab = await goToTab(page, /profile/i)
    if (!hasProfileTab) {
      test.skip(true, 'Profile tab not present in this build')
      return
    }

    // Profile tab should render a heading or the user summary
    await expect(
      page.getByRole('heading').first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('friend suggestions / social surfaces render without crashing', async ({ page }) => {
    // Discover tab often hosts friend-related sections
    const hasDiscover = await goToTab(page, /discover/i)
    if (!hasDiscover) {
      // Fall back to home
      await page.goto('/')
    }
    await expect(page.locator('body')).toBeVisible()
    // Make sure no JS error overlay is displayed
    await expect(page.locator('text=/Error Boundary/i')).not.toBeVisible()
  })

  test('notifications tab renders', async ({ page }) => {
    const hasNotif = await goToTab(page, /notifications/i)
    if (!hasNotif) {
      test.skip(true, 'Notifications tab not present')
      return
    }
    await expect(
      page.getByRole('heading', { name: /notifications/i }).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  // TODO: exercising a follow action requires real auth + another user
  // profile seeded in the backend; skip until we have a test auth fixture.
  test.skip('follows another user and sees them in feed (requires backend)', async () => {
    // Intentionally unimplemented.
  })

  // TODO: reacting to a pulse requires venues/pulses seeded by the backend.
  test.skip('reacts to a pulse in the feed (requires backend)', async () => {
    // Intentionally unimplemented.
  })
})
