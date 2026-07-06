import { expect, test } from '@playwright/test'
import { completeOnboarding } from './fixtures/onboarding'
import { gotoTab } from './fixtures/navigation'

/**
 * Notification feed mark-read UX in the venue shell.
 * Requires `VITE_E2E_SEED_NOTIFICATIONS=true` (set in Playwright webServer env).
 */
test.describe('Notifications feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await completeOnboarding(page)
  })

  test('mark all read clears unread state', async ({ page }) => {
    await gotoTab(page, 'notifications')

    await expect(page.getByRole('heading', { name: /^Notifications$/i })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText(/unread notification/i)).toBeVisible({ timeout: 10_000 })

    await page.getByTestId('notification-mark-all-read').click()

    await expect(page.getByText(/unread notification/i)).toHaveCount(0)
    await page.getByRole('button', { name: /^Unread/i }).click()
    await expect(page.getByText(/No unread notifications/i)).toBeVisible()
  })
})
