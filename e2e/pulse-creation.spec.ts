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

    const createBtn = page.getByRole('button', { name: /Check in · Create live review/i }).first()
    await expect(createBtn).toBeVisible({ timeout: 10_000 })
    await createBtn.click()

    await expect(page.getByRole('heading', { name: /Quick pulse/i })).toBeVisible({
      timeout: 5_000,
    })
  })

  test('can fill caption and select energy', async ({ page }) => {
    if (!(await openFirstVenue(page))) {
      test.skip(true, 'No venue cards available without seeded backend data')
      return
    }

    const createBtn = page.getByRole('button', { name: /Check in · Create live review/i }).first()
    await createBtn.click()

    const caption = page.getByPlaceholder(/What's the vibe/i)
    await expect(caption).toBeVisible({ timeout: 5_000 })
    await caption.fill('Testing the vibe')

    await expect(page.getByRole('button', { name: /Post · 1 tap/i }).last()).toBeVisible()
  })

  test('cancel closes the dialog without submitting', async ({ page }) => {
    if (!(await openFirstVenue(page))) {
      test.skip(true, 'No venue cards available without seeded backend data')
      return
    }

    const createBtn = page.getByRole('button', { name: /Check in · Create live review/i }).first()
    await createBtn.click()

    await expect(page.getByRole('heading', { name: /Quick pulse/i })).toBeVisible({
      timeout: 5_000,
    })
    await page.keyboard.press('Escape')

    await expect(page.getByRole('heading', { name: /Quick pulse/i })).not.toBeVisible({
      timeout: 5_000,
    })
  })

  // TODO: requires Supabase credentials + a seeded venue to exercise the
  // full post-to-backend round trip. Skip until the E2E env is wired up.
  test.skip('submits a pulse and shows it in the feed (requires backend)', async () => {
    // Left intentionally empty.
  })
})
