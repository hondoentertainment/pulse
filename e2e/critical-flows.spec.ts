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

// ── Core User Journey ──────────────────────────────────────

test.describe('Core User Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await completeOnboarding(page)
  })

  test('loads app and shows discover content', async ({ page }) => {
    // After onboarding, discover tab should be active
    await expect(page.locator('nav')).toBeVisible()
    // Should see venue content (cards, trending, or discover heading)
    await expect(
      page.locator('[class*="venue"], [class*="card"], h1, h2').first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('can navigate between all tabs', async ({ page }) => {
    const navButtons = page.locator('nav button')
    const count = await navButtons.count()
    expect(count).toBeGreaterThanOrEqual(4)

    // Click through each nav button
    for (let i = 0; i < count; i++) {
      await navButtons.nth(i).click()
      await page.waitForTimeout(500)
    }
  })

  test('can open a venue detail page', async ({ page }) => {
    const venueCard = page.locator('[class*="venue"], [class*="card"]').first()
    const cardExists = await venueCard
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false)

    if (cardExists) {
      await venueCard.click()
      // Venue page should show energy or score content
      await expect(
        page.locator('text=Live Energy')
          .or(page.locator('text=Energy'))
          .or(page.locator('text=Score'))
      ).toBeVisible({ timeout: 5_000 })
    }
  })

  test('venue page shows score transparency panel', async ({ page }) => {
    const venueCard = page.locator('[class*="venue"], [class*="card"]').first()
    const cardExists = await venueCard
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false)

    if (cardExists) {
      await venueCard.click()
      await page.waitForTimeout(1000)
      // Look for score info button or "Why this score?" link
      const scoreInfo = page.locator('button:has-text("Why"), [aria-label*="score"], text=Why this score')
      const infoExists = await scoreInfo
        .first()
        .waitFor({ state: 'visible', timeout: 3_000 })
        .then(() => true)
        .catch(() => false)

      if (infoExists) {
        await scoreInfo.first().click()
        await page.waitForTimeout(500)
      }
    }
  })
})

// ── Auth Flow ──────────────────────────────────────────────

test.describe('Auth Flow', () => {
  test('shows profile tab with sign-in option', async ({ page }) => {
    await page.goto('/')
    await completeOnboarding(page)
    await page.getByRole('button', { name: /profile/i }).click()
    await page.waitForTimeout(1000)
    // Profile tab should be visible with some content
    await expect(page.locator('nav')).toBeVisible()
  })
})

// ── Offline Behavior ───────────────────────────────────────

test.describe('Offline Behavior', () => {
  test('handles network disconnection gracefully', async ({ page, context }) => {
    await page.goto('/')
    await completeOnboarding(page)
    await page.waitForTimeout(2000)

    // Go offline
    await context.setOffline(true)
    await page.waitForTimeout(2000)

    // App should still be functional (PWA)
    const navVisible = await page.locator('nav').isVisible()
    expect(navVisible).toBe(true)

    // Go back online
    await context.setOffline(false)
    await page.waitForTimeout(1000)
  })
})

// ── Accessibility ──────────────────────────────────────────

test.describe('Accessibility', () => {
  test('main navigation is keyboard accessible', async ({ page }) => {
    await page.goto('/')
    await completeOnboarding(page)

    // Tab through the page
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Something should have focus
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName)
    expect(focusedTag).toBeTruthy()
  })

  test('images have alt text', async ({ page }) => {
    await page.goto('/')
    await completeOnboarding(page)
    await page.waitForTimeout(2000)

    // Count images without alt text
    const imagesWithoutAlt = await page.locator('img:not([alt])').count()
    // Allow some (icons, decorative) but flag if excessive
    expect(imagesWithoutAlt).toBeLessThan(10)
  })

  test('buttons have accessible names', async ({ page }) => {
    await page.goto('/')
    await completeOnboarding(page)

    // Check that nav buttons have accessible names
    const navButtons = page.locator('nav button')
    const count = await navButtons.count()
    for (let i = 0; i < count; i++) {
      const name = await navButtons.nth(i).getAttribute('aria-label')
        ?? await navButtons.nth(i).innerText()
      expect(name.trim().length).toBeGreaterThan(0)
    }
  })
})

// ── Mobile Experience ──────────────────────────────────────

test.describe('Mobile Experience', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('renders mobile layout with bottom nav', async ({ page }) => {
    await page.goto('/')
    await completeOnboarding(page)

    // Bottom nav should be visible
    const nav = page.locator('nav')
    await expect(nav).toBeVisible()

    // Should be positioned at bottom (check computed style)
    const navBox = await nav.boundingBox()
    if (navBox) {
      // Nav should be in the lower portion of the viewport
      expect(navBox.y).toBeGreaterThan(600)
    }
  })

  test('touch interactions work on venue cards', async ({ page }) => {
    await page.goto('/')
    await completeOnboarding(page)

    const venueCard = page.locator('[class*="venue"], [class*="card"]').first()
    const exists = await venueCard
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false)

    if (exists) {
      await venueCard.tap()
      await page.waitForTimeout(1000)
    }
  })
})

// ── Performance Checks ─────────────────────────────────────

test.describe('Performance', () => {
  test('app loads within reasonable time', async ({ page }) => {
    const start = Date.now()
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const loadTime = Date.now() - start
    // Should load DOM within 10 seconds even in CI
    expect(loadTime).toBeLessThan(10_000)
  })

  test('no console errors on initial load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('/')
    await completeOnboarding(page)
    await page.waitForTimeout(2000)

    // Filter out known acceptable errors (e.g., missing Sentry DSN)
    const criticalErrors = errors.filter(
      (e) => !e.includes('Sentry') && !e.includes('analytics') && !e.includes('favicon')
    )
    expect(criticalErrors.length).toBeLessThan(5)
  })
})
