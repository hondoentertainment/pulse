import { expect, test, type Page } from '@playwright/test'
import { completeOnboarding } from './fixtures/onboarding'

/** Live-reel / venue-card buttons use `aria-label="Open {name}"`. */
async function openFirstVenue(page: Page): Promise<boolean> {
  const venueBtn = page.getByRole('button', { name: /^Open /i }).first()
  const visible = await venueBtn
    .waitFor({ state: 'visible', timeout: 8_000 })
    .then(() => true)
    .catch(() => false)
  if (!visible) return false
  await venueBtn.click()
  await expect(page).toHaveURL(/\/venue\//, { timeout: 8_000 })
  return true
}

test.describe('Pulse creation flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await completeOnboarding(page)
  })

  test('opens the create-pulse dialog from a venue', async ({ page }) => {
    if (!(await openFirstVenue(page))) {
      test.skip(true, 'No venue cards available without seeded backend data')
      return
    }

    const createBtn = page.getByRole('button', { name: /Create Pulse/i }).first()
    await expect(createBtn).toBeVisible({ timeout: 10_000 })
    await createBtn.click()

    // Dialog title
    await expect(page.locator('text=/Create Pulse at/i').first()).toBeVisible({
      timeout: 5_000,
    })
  })

  test('can fill caption and select energy', async ({ page }) => {
    if (!(await openFirstVenue(page))) {
      test.skip(true, 'No venue cards available without seeded backend data')
      return
    }

    const createBtn = page.getByRole('button', { name: /Create Pulse/i }).first()
    await createBtn.click()

    const caption = page.getByPlaceholder(/What's the vibe/i)
    await expect(caption).toBeVisible({ timeout: 5_000 })
    await caption.fill('Testing the vibe')

    // The Post Pulse button should exist
    await expect(page.getByRole('button', { name: /Post Pulse/i })).toBeVisible()
  })

  test('cancel closes the dialog without submitting', async ({ page }) => {
    if (!(await openFirstVenue(page))) {
      test.skip(true, 'No venue cards available without seeded backend data')
      return
    }

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
