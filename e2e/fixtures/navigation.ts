import { expect, type Page } from '@playwright/test'

export type AppTab = 'trending' | 'discover' | 'map' | 'notifications' | 'profile'

const TAB_PATHS: Record<AppTab, string> = {
  trending: '/',
  discover: '/discover',
  map: '/map',
  notifications: '/notifications',
  profile: '/profile',
}

/** Navigate via URL — more reliable than synthetic tab clicks in CI. */
export async function gotoTab(page: Page, tab: AppTab): Promise<void> {
  await page.goto(TAB_PATHS[tab])
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByTestId(`tab-${tabLabel(tab)}`)).toBeVisible({ timeout: 15_000 })
}

function tabLabel(tab: AppTab): string {
  return tab.charAt(0).toUpperCase() + tab.slice(1)
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

  const dialogHeading = page.getByRole('heading', { name: /Create Pulse at/i })
  const search = page.getByPlaceholder(/Search venues, cities, categories/i)

  // Either the dialog opened directly (single venue) or search opened (multi).
  await expect(dialogHeading.or(search)).toBeVisible({ timeout: 10_000 })

  if (await search.isVisible().catch(() => false)) {
    await search.fill('bar')
    const firstResult = page.locator('[data-result-index]').first()
    await firstResult.click({ timeout: 10_000 })
  }

  await expect(dialogHeading).toBeVisible({ timeout: 10_000 })
}
