import { expect, test } from '@playwright/test'
import { completeOnboarding } from './fixtures/onboarding'

test.describe('Venue nightlife shell (Figma Enhanced)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await completeOnboarding(page)
  })

  test('map is home with Pulse title, energy pills, and nav', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Tonight ·|Where the energy is/i }).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Launch 33' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'All Seattle' }).first()).toBeVisible()
    await expect(page.getByPlaceholder(/Search venues/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Electric' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Buzzing' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Near me/i }).first()).toBeVisible()

    const nav = page.getByRole('navigation', { name: 'Primary' })
    await expect(nav.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('button', { name: 'Trending' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Pulse' })).toBeVisible()
    await expect(nav.getByRole('button', { name: /^Friends/ })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'You' })).toBeVisible()
  })

  test('trending tab uses Just popped / Gaining / Hot now copy', async ({ page }) => {
    await page.getByTestId('tab-Trending').evaluate((el) => (el as HTMLButtonElement).click())
    await expect(page.getByRole('heading', { name: 'Trending' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Just popped · Gaining · Hot now')).toBeVisible()
  })
})
