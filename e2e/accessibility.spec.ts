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
  await clickButton(page, /Last step/i)
  await clickButton(page, /Save today's signal/i)

  const firstWin = page.getByRole('button', { name: /See my dashboard/i })
  if (await firstWin.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await firstWin.evaluate((element: HTMLElement) => element.click())
  }

  await expect(onboarding).toBeHidden({ timeout: 15_000 })
}

test.describe('Signal shell accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await resetSignalState(page)
    await completeSignalOnboarding(page)
  })

  test('primary navigation is a labeled landmark with page context', async ({ page }) => {
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Trends — Chart and pattern/i })).toBeVisible()
  })

  test('trends chart exposes a text summary for screen readers', async ({ page }) => {
    await clickLink(page, /Trends — Chart and pattern/i)
    await expect(page.getByRole('img', { name: /Seven-day signal chart/i })).toBeVisible()
  })

  test('onboarding dialog is keyboard-dismissible with Escape on later steps', async ({ page }) => {
    await resetSignalState(page)
    await clickButton(page, /^Continue$/i)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: /Pick your daily signal/i })).toBeVisible()
  })
})
