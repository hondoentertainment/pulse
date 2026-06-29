import { expect, type Page } from '@playwright/test'

export const SIGNAL_STORE_KEY = 'pulse-signal-store-v1'

export async function clickButton(page: Page, name: RegExp) {
  const button = page.getByRole('button', { name })
  await button.scrollIntoViewIfNeeded()
  await button.evaluate((element: HTMLElement) => element.click())
}

export async function clickLink(page: Page, name: RegExp) {
  const link = page.getByRole('link', { name })
  await link.scrollIntoViewIfNeeded()
  await link.evaluate((element: HTMLElement) => element.click())
}

export async function resetSignalState(page: Page) {
  await page.goto('/')
  await page.evaluate((key) => localStorage.removeItem(key), SIGNAL_STORE_KEY)
  await page.reload()
  await page.waitForLoadState('networkidle')
}

/**
 * Completes Pulse Signal onboarding when shown. Idempotent when profile already exists.
 */
export async function completeSignalOnboarding(page: Page): Promise<void> {
  const onboarding = page.getByRole('dialog', { name: /Step 1 of 3/i })
  const todayHeading = page.getByRole('heading', { name: /^Today$/i })

  const landed = await Promise.race([
    onboarding.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'onboarding' as const),
    todayHeading.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'home' as const),
  ]).catch(() => null)

  if (landed === 'home') return
  if (landed !== 'onboarding') {
    throw new Error('Signal shell did not show onboarding or Today within 20s')
  }

  // Scope clicks to the onboarding dialog: the home screen renders behind it and
  // shares button labels (e.g. "Save today's signal"), which would otherwise
  // trigger strict-mode violations.
  const dialog = page.getByRole('dialog')
  const clickInDialog = async (name: RegExp) => {
    const button = dialog.getByRole('button', { name })
    await button.scrollIntoViewIfNeeded()
    await button.evaluate((element: HTMLElement) => element.click())
  }

  await clickInDialog(/^Continue$/i)
  await expect(page.getByRole('heading', { name: /Choose the outcome/i })).toBeVisible({
    timeout: 10_000,
  })
  await clickInDialog(/Last step/i)
  await clickInDialog(/Save today's signal/i)

  const firstWin = page.getByRole('button', { name: /See my dashboard/i })
  if (await firstWin.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await firstWin.evaluate((element: HTMLElement) => element.click())
  }

  await expect(onboarding).toBeHidden({ timeout: 15_000 })
  await expect(todayHeading).toBeVisible({ timeout: 15_000 })
}
