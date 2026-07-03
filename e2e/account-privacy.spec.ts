import { expect, test } from '@playwright/test'
import { completeOnboarding } from './fixtures/onboarding'

/**
 * Account privacy controls (export / delete) in the venue shell.
 * Runs with `npm run test:e2e:venue`.
 */
test.describe('Account privacy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await completeOnboarding(page)
  })

  test('settings shows export and delete controls', async ({ page }) => {
    await expect(page.getByTestId('account-privacy-panel')).toBeVisible()
    await expect(page.getByTestId('export-account-data')).toBeVisible()
    await expect(page.getByTestId('delete-account-trigger')).toBeVisible()
    await expect(page.getByRole('link', { name: /Privacy Policy/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Terms of Service/i })).toBeVisible()
  })

  test('export surfaces user feedback', async ({ page }) => {
    await page.getByTestId('export-account-data').click()
    await expect(
      page.getByText(/Local data exported|Export failed|Full account export downloaded/i),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('delete confirmation surfaces server or auth feedback', async ({ page }) => {
    await page.getByTestId('delete-account-trigger').click()
    await page.getByRole('button', { name: /Delete permanently/i }).click()
    await expect(
      page.getByText(/Sign in required|Could not delete account|Account deleted/i),
    ).toBeVisible({ timeout: 10_000 })
  })
})
