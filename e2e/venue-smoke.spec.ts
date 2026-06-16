import { test } from '@playwright/test'

/**
 * Legacy venue / social shell smoke tests (AppRoutes / AppShell).
 *
 * Skipped in default CI (Signal mode). Re-enable with `VITE_APP_MODE=venue` in Playwright webServer env.
 * See ARCHITECTURE.md — App entry and routing.
 */
test.describe.skip('Venue shell (AppRoutes — not mounted)', () => {
  test('placeholder — run against AppRoutes entry', () => {})
})
