import { expect, test } from '@playwright/test'

/**
 * Shared helper: completes onboarding if the welcome screen is present.
 */
async function completeOnboarding(page: import('@playwright/test').Page) {
  const getStarted = page.getByRole('button', { name: /Get Started/i })
  const visible = await getStarted
    .waitFor({ state: 'visible', timeout: 6_000 })
    .then(() => true)
    .catch(() => false)
  if (!visible) return

  await getStarted.click()
  await page.getByRole('button', { name: /Bars\s*&\s*Pubs/i }).click()
  await page.getByRole('button', { name: /^Continue$/i }).click()
  await page.getByRole('button', { name: /Skip|Continue/i }).click({ timeout: 10_000 })
  await page.getByRole('button', { name: /^Continue$/i }).click()
  await page.getByRole('button', { name: /Start Exploring/i }).click()
  await expect(page.locator('nav')).toBeVisible({ timeout: 15_000 })
}

// ── Onboarding ──────────────────────────────────────────────

test('has title and renders onboarding for new users', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Pulse/i)
  await expect(page.locator('text=Welcome to Pulse')).toBeVisible()
})

test('can complete onboarding and see main shell', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await expect(page.locator('text=Welcome to Pulse')).toBeVisible()
  await page.click('button:has-text("Get Started")')

  await expect(page.locator("text=What's your scene?")).toBeVisible()
  await page.locator('button.p-4', { hasText: 'Bars & Pubs' }).click()
  await page.click('button:has-text("Continue")')

  await expect(page.locator('text=When do you go out?')).toBeVisible()
  await page.click('button:has-text("Skip")')

  await expect(page.locator('text=Enable permissions')).toBeVisible()
  await page.click('button:has-text("Continue")')

  await expect(page.locator("text=You're all set!")).toBeVisible()
  await page.click('button:has-text("Start Exploring")')

  await expect(page.locator('nav')).toBeVisible()
})

// ── Authenticated flows ─────────────────────────────────────

test.describe('After onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await completeOnboarding(page)
  })

  test('map tab renders canvas', async ({ page }) => {
    await page.click('nav button:has-text("Map")')
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 })
  })

  test('venue page opens from trending list', async ({ page }) => {
    // Click on first venue card
    const venueCard = page.locator('[class*="venue"], [class*="card"]').first()
    const cardExists = await venueCard
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false)

    if (cardExists) {
      await venueCard.click()
      await expect(
        page.locator('text=Live Energy').or(page.locator('text=Energy'))
      ).toBeVisible({ timeout: 5_000 })
    }
  })

  test('notifications tab loads', async ({ page }) => {
    await page.click('nav button:has-text("Notifications")')
    await expect(
      page
        .getByRole('heading', { name: 'Notifications' })
        .or(page.locator('h1:has-text("Notifications"), h2:has-text("Notifications")'))
    ).toBeVisible()
  })

  test('bottom navigation switches tabs', async ({ page }) => {
    await page.getByRole('button', { name: /profile/i }).click()
    await expect(page.getByText(/Switched to Profile tab/i)).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('button', { name: /^map$/i }).click()
    await expect(page.locator('.mapboxgl-canvas, canvas').first()).toBeVisible({ timeout: 15_000 })
  })
})
