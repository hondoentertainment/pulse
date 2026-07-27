import { expect, test } from '@playwright/test'
import { completeOnboarding } from './fixtures/onboarding'
import { openCreatePulseDialog } from './fixtures/navigation'

test.describe('Pulse creation flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await completeOnboarding(page)
  })

  test('opens the create-pulse dialog from a venue', async ({ page }) => {
    await openCreatePulseDialog(page)
  })

  test('can fill caption and select energy', async ({ page }) => {
    await openCreatePulseDialog(page)

    const caption = page.getByRole('textbox', { name: /Caption/i })
    await expect(caption).toBeVisible({ timeout: 5_000 })
    await caption.fill('Testing the vibe')

    await expect(page.getByRole('slider', { name: /Energy level/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Post live review/i })).toBeVisible()
  })

  test('cancel closes the dialog without submitting', async ({ page }) => {
    await openCreatePulseDialog(page)

    const cancel = page.getByRole('button', { name: /^Cancel$/i })
    await expect(cancel).toBeVisible({ timeout: 5_000 })
    await cancel.click()

    await expect(page.getByRole('heading', { name: /Photo review at/i })).not.toBeVisible({
      timeout: 5_000,
    })
  })

  // TODO: requires Supabase credentials + a seeded venue to exercise the
  // full post-to-backend round trip. Skip until the E2E env is wired up.
  test.skip('submits a pulse and shows it in the feed (requires backend)', async () => {
    // Left intentionally empty.
  })
})
