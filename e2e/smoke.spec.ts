import { expect, test } from '@playwright/test'

test.describe.configure({ timeout: 60_000 })

const SIGNAL_STORE_KEY = 'pulse-signal-store-v1'

async function clickButton(page: import('@playwright/test').Page, name: RegExp) {
  const button = page.getByRole('button', { name })
  await button.scrollIntoViewIfNeeded()
  await button.evaluate((element: HTMLElement) => element.click())
}

async function clickLink(page: import('@playwright/test').Page, name: RegExp) {
  const link = page.getByRole('link', { name })
  await link.scrollIntoViewIfNeeded()
  await link.evaluate((element: HTMLElement) => element.click())
}

async function resetSignalState(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate((key) => localStorage.removeItem(key), SIGNAL_STORE_KEY)
  await page.reload()
}

async function completeSignalOnboarding(page: import('@playwright/test').Page) {
  const onboarding = page.getByRole('dialog', { name: /Step 1 of 3/i })
  const hasOnboarding = await onboarding.isVisible({ timeout: 15_000 }).catch(() => false)

  if (!hasOnboarding) {
    await expect(page.getByRole('heading', { name: /^Today$/i })).toBeVisible({ timeout: 10_000 })
    return
  }

  await clickButton(page, /^Continue$/i)
  await expect(page.getByRole('heading', { name: /Choose the outcome/i })).toBeVisible({ timeout: 10_000 })
  await clickButton(page, /Last step/i)
  await clickButton(page, /Save today's signal/i)

  const firstWin = page.getByRole('button', { name: /See my dashboard/i })
  if (await firstWin.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await firstWin.evaluate((element: HTMLElement) => element.click())
  }

  await expect(onboarding).toBeHidden({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /^Today$/i })).toBeVisible({ timeout: 15_000 })
}

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
