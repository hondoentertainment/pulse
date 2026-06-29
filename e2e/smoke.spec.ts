import { expect, test } from '@playwright/test'
import {
  clickButton,
  clickLink,
  completeSignalOnboarding,
  resetSignalState,
} from './fixtures/signal-onboarding'

test.describe.configure({ timeout: 60_000, mode: 'serial' })

test('has Pulse Signal title and global toast host', async ({ page }) => {
  await resetSignalState(page)
  await expect(page).toHaveTitle(/Pulse Signal/i)
  await expect(page.locator('section[aria-label*="Notifications"], [data-sonner-toaster]').first()).toBeAttached()
})

test('completes Signal onboarding and lands on Today', async ({ page }) => {
  await resetSignalState(page)
  await completeSignalOnboarding(page)
  await expect(page.getByText(/Good (morning|afternoon|evening)/i)).toBeVisible()
})

test.describe('Signal shell', () => {
  test.beforeEach(async ({ page }) => {
    await resetSignalState(page)
    await completeSignalOnboarding(page)
  })

  test('bottom nav switches Trends and History with distinct copy', async ({ page }) => {
    await clickLink(page, /Trends — Chart and pattern/i)
    await expect(page.getByRole('heading', { name: /Your state over time/i })).toBeVisible()
    await expect(page.getByText(/Chart and pattern — see how your signal moves/i)).toBeVisible()

    await clickLink(page, /History — Daily log/i)
    await expect(page.getByRole('heading', { name: /Past signals/i })).toBeVisible()
    await expect(page.getByText(/Daily log — every check-in/i)).toBeVisible()
  })

  test('can save a daily check-in from Home', async ({ page }) => {
    await clickLink(page, /Home — Today's check-in/i)
    const saveButton = page.getByRole('button', { name: /Save today's signal/i })
    if (await saveButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await clickButton(page, /Save today's signal/i)
      await expect(page.getByText(/Today is logged/i)).toBeVisible({ timeout: 10_000 })
    } else {
      await expect(page.getByText(/Today is logged/i)).toBeVisible()
    }
  })

  test('Settings shows honest reminder copy', async ({ page }) => {
    await clickLink(page, /Settings — Preferences/i)
    await expect(page.getByText(/push notifications coming soon/i)).toBeVisible()
  })
})
