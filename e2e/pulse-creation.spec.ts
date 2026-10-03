import { expect, test } from '@playwright/test'
import { completeOnboarding } from './fixtures/onboarding'

test.describe('Venue discovery and pulse creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await completeOnboarding(page)
    await page.getByRole('combobox', { name: 'Select U.S. market' }).click()
    await page.getByRole('option', { name: /Miami, FL/ }).click()
    await page.getByRole('button', { name: 'Open LIV', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Back to venues' }).first()).toBeVisible()
  })

  test('opens a pulse for the selected venue', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Pulse', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Create Pulse at LIV' })).toBeVisible()
  })

  test('accepts a caption and cancels without submitting', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Pulse', exact: true }).first().click()
    const caption = page.getByPlaceholder("What's the vibe?")
    await caption.fill('Testing the vibe')
    await expect(caption).toHaveValue('Testing the vibe')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Create Pulse at LIV' })).toBeHidden()
  })

  test('persists the chosen market after refresh', async ({ page }) => {
    await page.getByRole('button', { name: 'Back to venues' }).first().click()
    await page.reload()
    await expect(page.getByRole('combobox', { name: 'Select U.S. market' })).toContainText('Miami, FL')
    await expect(page.getByRole('button', { name: 'Open LIV', exact: true })).toBeVisible()
  })

  test('opens the map from the selected market', async ({ page }) => {
    await page.getByRole('button', { name: 'Back to venues' }).first().click()
    await page.getByRole('button', { name: 'Map', exact: true }).click()
    await expect(page).toHaveURL(/\/map$/)
    await expect(page.locator('canvas').first()).toBeVisible()
  })
})
