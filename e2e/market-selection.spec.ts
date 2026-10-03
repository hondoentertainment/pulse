import { expect, test } from '@playwright/test'
import { completeOnboarding } from './fixtures/onboarding'

test('selects a U.S. market and preserves it across refresh and tabs', async ({ page }) => {
  await page.goto('/')
  await completeOnboarding(page)
  const selector = page.getByRole('combobox', { name: 'Select U.S. market' })
  await selector.click()
  await page.getByRole('option', { name: /Miami, FL/ }).click()
  await expect(selector).toContainText('Miami, FL')
  await page.reload()
  await expect(selector).toContainText('Miami, FL')
  await page.getByTestId('tab-Tonight').click()
  await expect(page.getByRole('heading', { name: 'Tonight', exact: true })).toBeVisible()
  await expect(selector).toHaveCount(1)
  await expect(selector).toContainText('Miami, FL')
  await selector.click()
  await page.getByRole('option', { name: 'United States', exact: true }).click()
  await expect(selector).toContainText('United States')
})

for (const width of [390, 1440]) {
  test(`market control and navigation fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await completeOnboarding(page)
    await expect(page.getByRole('combobox', { name: 'Select U.S. market' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Launch 33' }).first()).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/market-${width}.png`, fullPage: true })
  })
}
