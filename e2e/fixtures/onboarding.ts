import type { Page } from '@playwright/test'

/** Mirrors WELCOME_SEEN_KEY in src/lib/welcome-gate.ts. */
const WELCOME_SEEN_KEY = 'pulse-welcome-seen'

/**
 * `/` sends first-time visitors to the Seattle landing page, which renders no
 * bottom nav. Every E2E run starts from a fresh profile, so without this the
 * app shell is unreachable and each suite times out waiting for navigation.
 */
async function markWelcomeSeen(page: Page): Promise<void> {
  const seed = (key: string) => {
    try {
      localStorage.setItem(key, '1')
    } catch {
      /* storage unavailable — nothing to seed */
    }
  }

  // Covers this document plus any later navigation or reload.
  await page.addInitScript(seed, WELCOME_SEEN_KEY)
  await page.evaluate(seed, WELCOME_SEEN_KEY).catch(() => undefined)

  if (new URL(page.url()).pathname === '/welcome') {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  }
}

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
  await markWelcomeSeen(page)

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
