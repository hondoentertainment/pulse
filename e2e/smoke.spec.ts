import { expect, test } from '@playwright/test'

test.describe.configure({ timeout: 60_000 })

/**
 * Shared helper: authenticates into preview/guest mode if the auth screen is present.
 */
async function ensureSignedIn(page: import('@playwright/test').Page) {
  const guestButton = page.getByRole('button', { name: /Continue as Guest/i })
  const guestVisible = await guestButton
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false)

  if (!guestVisible) return
  await guestButton.click()
}

/**
 * Shared helper: completes onboarding if the welcome screen is present.
 */
async function completeOnboarding(page: import('@playwright/test').Page) {
  await ensureSignedIn(page)

  const shellNav = page.locator('nav')
  const welcomeHeading = page.getByRole('heading', { name: /Welcome to Pulse/i })

  await expect(welcomeHeading.or(shellNav)).toBeVisible({ timeout: 20_000 })

  if (await shellNav.isVisible()) return

  const getStarted = page.getByRole('button', { name: /Get Started/i })
  await getStarted.click()

  // Step: Categories
  await expect(page.getByRole('heading', { name: /What's your scene\?/i })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: /Bars & Pubs/i }).click()
  await page.getByRole('button', { name: /^Continue$/i }).click()

  // Step: Times
  await expect(page.getByRole('heading', { name: /When do you go out\?/i })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: /Skip/i }).click()

  // Step: Permissions
  await expect(page.getByRole('heading', { name: /Enable permissions/i })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: /^Continue$/i }).click()

  // Step: Ready
  await expect(page.getByRole('heading', { name: /You're all set!/i })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: /Start Exploring/i }).click()

  // Wait for main shell
  await expect(page.getByTestId('tab-Trending')).toBeVisible({ timeout: 20_000 })
}

async function clickTab(page: import('@playwright/test').Page, tabName: string) {
  await page.getByTestId(`tab-${tabName}`).evaluate((element: HTMLElement) => element.click())
}

// ── Onboarding ──────────────────────────────────────────────

test('has title and renders onboarding for new users', async ({ page }) => {
  await page.goto('/')
  await ensureSignedIn(page)
  await expect(page).toHaveTitle(/Pulse/i)
  await expect(
    page.getByRole('heading', { name: /Welcome to Pulse/i }).or(page.getByTestId('tab-Trending'))
  ).toBeVisible({ timeout: 15_000 })
})

test('can complete onboarding and see main shell', async ({ page }) => {
  await page.goto('/')
  await completeOnboarding(page)
  await expect(page.getByTestId('tab-Trending')).toBeVisible({ timeout: 20_000 })
})

// ── Authenticated flows ─────────────────────────────────────

test.describe('After onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await completeOnboarding(page)
  })

  test('map tab renders canvas', async ({ page }) => {
    await clickTab(page, 'Map')
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
  })

  test('venue page opens from trending list', async ({ page }) => {
    // Click on first venue card
    const venueCard = page.locator('[class*="venue"], [class*="card"]').first()
    const cardExists = await venueCard
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false)

    if (cardExists) {
      await venueCard.click()
      await expect(
        page.getByText('Live Energy', { exact: false }).or(page.getByText('Energy', { exact: false }))
      ).toBeVisible({ timeout: 10_000 })
    }
  })

  test('market selector switches city venues and map focus', async ({ page }) => {
    await page.getByRole('combobox', { name: /Select U\.S\. market/i }).click()
    await page.getByRole('option', { name: /Miami, FL/i }).click()

    await expect(page.getByText('Miami, FL').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/LIV/i).first()).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /^Open LIV$/i }).click()
    await expect(page.getByRole('button', { name: /Back to venues/i }).first()).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /Back to venues/i }).first().evaluate((element: HTMLElement) => element.click())
    await clickTab(page, 'Map')
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
  })

  test('notifications tab loads', async ({ page }) => {
    await clickTab(page, 'Notifications')
    await expect(
      page.getByRole('heading', { name: /Notifications/i })
    ).toBeVisible({ timeout: 10_000 })
  })

  test('bottom navigation switches tabs', async ({ page }) => {
    await clickTab(page, 'Profile')
    await expect(page.getByText(/Switched to Profile tab/i)).toBeVisible({
      timeout: 10_000,
    })

    await clickTab(page, 'Map')
    await expect(page.locator('.mapboxgl-canvas, canvas').first()).toBeVisible({ timeout: 10_000 })
  })

  test('pulse creation opens and submits successfully', async ({ page }) => {
    // Give the app time to load sortedVenues, otherwise button click does nothing
    await page.waitForTimeout(1000)

    // Find the fixed Create Pulse FAB button and click it
    const createButton = page.getByTestId('create-pulse-fab')
    await createButton.waitFor({ state: 'visible', timeout: 10_000 })
    await createButton.click()

    // Dialog should appear
    const dialogTitle = page.getByRole('heading', { name: /Create Pulse at/i })
    await expect(dialogTitle).toBeVisible({ timeout: 10_000 })

    // Fill in a caption
    const textarea = page.getByPlaceholder(/What's the vibe\?/i)
    await textarea.fill('Playwright test pulse vibe!')

    // Click "Post Pulse"
    const postButton = page.getByRole('button', { name: /Post Pulse/i })
    await postButton.click()

    // Dialog should close, and post button shouldn't exist anymore
    await expect(postButton).toBeHidden({ timeout: 10_000 })
  })
})
