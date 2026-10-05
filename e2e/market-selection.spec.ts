import { expect, test } from '@playwright/test'
import { completeOnboarding } from './fixtures/onboarding'

test('selects one West Coast city and preserves it across refresh and tabs', async ({ page }) => {
  await page.goto('/')
  await completeOnboarding(page)
  const seattle = page.getByRole('button', { name: 'Seattle', exact: true })
  const portland = page.getByRole('button', { name: 'Portland', exact: true })
  await expect(seattle).toHaveAttribute('aria-pressed', 'true')
  await portland.click()
  await expect(portland).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(portland).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('tab-Tonight').click()
  await expect(page.getByRole('heading', { name: 'Tonight', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Portland', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'United States', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Seattle', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Seattle', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

for (const width of [390, 1440]) {
  test(`market control and navigation fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await completeOnboarding(page)
    await expect(page.getByRole('group', { name: 'West Coast cities' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Launch 33' }).first()).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/market-${width}.png`, fullPage: true })
  })
}
