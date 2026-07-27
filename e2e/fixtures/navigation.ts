import { expect, type Page } from '@playwright/test'
import { completeOnboarding } from './onboarding'

export type AppTab = 'tonight' | 'discover' | 'map' | 'notifications' | 'profile'

const TAB_PATHS: Record<AppTab, string> = {
  tonight: '/',
  discover: '/discover',
  map: '/map',
  notifications: '/notifications',
  profile: '/profile',
}

/** Nav labels differ from tab ids — `discover` is presented as "Explore". */
const TAB_LABELS: Record<AppTab, string> = {
  tonight: 'Tonight',
  discover: 'Explore',
  map: 'Map',
  notifications: 'Notifications',
  profile: 'Profile',
}

/** Navigate via URL — more reliable than synthetic tab clicks in CI. */
export async function gotoTab(page: Page, tab: AppTab): Promise<void> {
  await page.goto(TAB_PATHS[tab])
  await page.waitForLoadState('domcontentloaded')
  // Onboarding state does not survive a full page load, so the gate reappears on
  // every URL navigation and hides the bottom nav. The helper is idempotent.
  await completeOnboarding(page)
  await expect(page.getByTestId(`tab-${TAB_LABELS[tab]}`)).toBeVisible({ timeout: 15_000 })
}

/**
 * Open the global create-pulse FAB and wait for the dialog.
 *
 * With more than one venue available the FAB opens global search in "create"
 * mode so the user can pick a venue; with exactly one it opens the dialog
 * directly. This helper handles both paths.
 */
export async function openCreatePulseDialog(page: Page): Promise<void> {
  const fab = page.getByTestId('create-pulse-fab')
  await expect(fab).toBeVisible({ timeout: 15_000 })
  // The FAB sits above the bottom nav; click via DOM to avoid viewport/overlap
  // flakiness in headless CI.
  await fab.evaluate((el) => {
    if (el instanceof HTMLElement) el.click()
  })

  const dialogHeading = page.getByRole('heading', { name: /Photo review at/i })
  const search = page.getByPlaceholder(/Search venues, cities, categories/i)

  // Either the dialog opened directly (single venue) or search opened (multi).
  await expect(dialogHeading.or(search)).toBeVisible({ timeout: 10_000 })

  if (await search.isVisible().catch(() => false)) {
    await search.fill('bar')
    const firstResult = page.locator('[data-result-index]').first()
    await expect(firstResult).toBeVisible({ timeout: 10_000 })
    // Results are framer-motion elements whose residual transforms make Playwright
    // read them as outside the viewport, so dispatch the click directly.
    await firstResult.evaluate((el) => {
      if (el instanceof HTMLElement) el.click()
    })
  }

  await expect(dialogHeading).toBeVisible({ timeout: 10_000 })
}
