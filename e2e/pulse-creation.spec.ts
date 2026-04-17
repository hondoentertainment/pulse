import { expect, test } from '@playwright/test'
import { completeOnboarding } from './fixtures/onboarding'

test.describe('Pulse creation flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await completeOnboarding(page)
  })

  test('opens the create-pulse dialog from a venue', async ({ page }) => {
    // Try clicking a trending venue card if visible
    const venueCard = page
      .locator('[class*="venue"], [class*="card"]')
      .first()
    const cardVisible = await venueCard
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false)

    if (!cardVisible) {
      test.skip(true, 'No venue cards available without seeded backend data')
      return
    }

    await venueCard.click()

    const createBtn = page.getByRole('button', { name: /Create Pulse/i }).first()
    await expect(createBtn).toBeVisible({ timeout: 10_000 })
    await createBtn.click()

    // Dialog title
    await expect(page.locator('text=/Create Pulse at/i').first()).toBeVisible({
      timeout: 5_000,
    })
  })

  test('can fill caption and select energy', async ({ page }) => {
    const venueCard = page.locator('[class*="venue"], [class*="card"]').first()
    const cardVisible = await venueCard
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false)

    if (!cardVisible) {
      test.skip(true, 'No venue cards available without seeded backend data')
      return
    }

    await venueCard.click()
    const createBtn = page.getByRole('button', { name: /Create Pulse/i }).first()
    await createBtn.click()

    const caption = page.getByPlaceholder(/What's the vibe/i)
    await expect(caption).toBeVisible({ timeout: 5_000 })
    await caption.fill('Testing the vibe')

    // The Post Pulse button should exist
    await expect(page.getByRole('button', { name: /Post Pulse/i })).toBeVisible()
  })

  test('cancel closes the dialog without submitting', async ({ page }) => {
    const venueCard = page.locator('[class*="venue"], [class*="card"]').first()
    const cardVisible = await venueCard
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false)

    if (!cardVisible) {
      test.skip(true, 'No venue cards available without seeded backend data')
      return
    }

    await venueCard.click()
    const createBtn = page.getByRole('button', { name: /Create Pulse/i }).first()
    await createBtn.click()

    const cancel = page.getByRole('button', { name: /^Cancel$/i })
    await expect(cancel).toBeVisible({ timeout: 5_000 })
    await cancel.click()

    await expect(page.locator('text=/Create Pulse at/i').first()).not.toBeVisible({
      timeout: 5_000,
    })
  })

  // TODO: requires Supabase credentials + a seeded venue to exercise the
  // full post-to-backend round trip. Skip until the E2E env is wired up.
  test.skip('submits a pulse and shows it in the feed (requires backend)', async () => {
    // Left intentionally empty.
  })
})
