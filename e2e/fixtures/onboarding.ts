import type { Page } from '@playwright/test'

/**
 * Completes the onboarding flow for new users. Idempotent — if onboarding is
 * already complete (no Welcome screen), returns immediately.
 *
 * This matches the heuristic in smoke.spec.ts, but is parameterized so that
 * E2E suites for pulse creation, search, and social flows can reuse it.
 */
export async function completeOnboarding(page: Page, options?: {
  category?: RegExp
  timePreference?: 'skip' | RegExp
  locationEnabled?: boolean
  notificationsEnabled?: boolean
}): Promise<void> {
  const getStarted = page.getByRole('button', { name: /Get Started/i })
  const visible = await getStarted
    .waitFor({ state: 'visible', timeout: 6_000 })
    .then(() => true)
    .catch(() => false)
  if (!visible) return

  const category = options?.category ?? /Bars\s*&\s*Pubs/i
  const timePref = options?.timePreference ?? 'skip'

  await getStarted.click()
  await page.getByRole('button', { name: category }).click()
  await page.getByRole('button', { name: /^Continue$/i }).click()

  if (timePref === 'skip') {
    await page.getByRole('button', { name: /Skip|Continue/i }).click({ timeout: 10_000 })
  } else {
    await page.getByRole('button', { name: timePref }).click()
    await page.getByRole('button', { name: /^Continue$/i }).click()
  }

  if (options?.locationEnabled) {
    await page.getByRole('button', { name: /Location Access/i }).click()
  }
  if (options?.notificationsEnabled) {
    await page.getByRole('button', { name: /Notifications/i }).click()
  }
  await page.getByRole('button', { name: /^Continue$/i }).click()

  await page.getByRole('button', { name: /Start Exploring/i }).click()
  await page.locator('nav').waitFor({ state: 'visible', timeout: 15_000 })
}

/**
 * Navigates to a tab in the bottom nav. Safe for tabs that may not exist.
 */
export async function goToTab(page: Page, tabName: RegExp): Promise<boolean> {
  const tab = page.getByRole('button', { name: tabName })
  const visible = await tab
    .waitFor({ state: 'visible', timeout: 3_000 })
    .then(() => true)
    .catch(() => false)
  if (!visible) return false
  await tab.click()
  return true
}
