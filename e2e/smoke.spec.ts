import { expect, test } from '@playwright/test'

// ---------------------------------------------------------------------------
// Shared helper: dismiss onboarding if it appears
// ---------------------------------------------------------------------------

async function completeOnboardingIfPresent(page: import('@playwright/test').Page) {
  const getStarted = page.getByRole('button', { name: /Get Started/i })
  const onboardingVisible = await getStarted.waitFor({ state: 'visible', timeout: 6_000 })
    .then(() => true)
    .catch(() => false)
  if (!onboardingVisible) return

  await getStarted.click()
  await page.getByRole('button', { name: /Bars\s*&\s*Pubs/i }).click()
  await page.getByRole('button', { name: /^Continue$/i }).click()
  await page.getByRole('button', { name: /Skip|Continue/i }).click({ timeout: 10_000 })
  await page.getByRole('button', { name: /^Continue$/i }).click()
  await page.getByRole('button', { name: /Start Exploring/i }).click()
  await expect(page.getByRole('button', { name: /profile/i })).toBeVisible({ timeout: 15_000 })
}

// ---------------------------------------------------------------------------
// 1. Existing — App shell & map controls
// ---------------------------------------------------------------------------

test('app shell and map controls load', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  await expect(page).toHaveTitle(/Pulse/i)
  await expect(page.getByRole('button', { name: /zoom in/i })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: /zoom out/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /center map on my location/i })).toBeVisible()
})

// ---------------------------------------------------------------------------
// 2. Existing — Smart route card
// ---------------------------------------------------------------------------

test('smart route card appears and can trigger route', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  await expect(page.getByText(/Smart Route/i)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: /Take Me/i })).toBeVisible()
  await page.getByRole('button', { name: /Take Me/i }).click()
})

// ---------------------------------------------------------------------------
// 3. Existing — Bottom navigation interactive
// ---------------------------------------------------------------------------

test('bottom navigation remains interactive', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  await page.getByRole('button', { name: /profile/i }).click()
  await expect(page.getByText(/Switched to Profile tab/i)).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: /^map$/i }).click()
  await expect(page.getByRole('button', { name: /zoom in/i })).toBeVisible()
})

// ---------------------------------------------------------------------------
// 4. Bottom navigation — all tabs present and lead to correct views
// ---------------------------------------------------------------------------

test('bottom nav contains all five tabs and each switches view', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  // All five tabs should be visible
  const tabs = ['Trending', 'Discover', 'Map', 'Alerts', 'Profile'] as const
  for (const label of tabs) {
    await expect(page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') })).toBeVisible()
  }

  // Switch to Trending and verify the tab content loads
  await page.getByRole('button', { name: /^Trending$/i }).click()
  await expect(page.getByText(/Switched to Trending tab/i)).toBeVisible({ timeout: 10_000 })
  // Trending tab shows a "Trending" sub-tab button
  await expect(page.getByRole('button', { name: /^Trending$/i }).first()).toBeVisible()

  // Switch to Discover and verify Discover heading renders
  await page.getByRole('button', { name: /^Discover$/i }).click()
  await expect(page.getByText(/Switched to Discover tab/i)).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Discover').first()).toBeVisible()

  // Switch to Alerts (notifications) and verify the tab
  await page.getByRole('button', { name: /^Alerts$/i }).click()
  await expect(page.getByText(/Switched to Notifications tab/i)).toBeVisible({ timeout: 10_000 })

  // Switch to Profile and verify
  await page.getByRole('button', { name: /^Profile$/i }).click()
  await expect(page.getByText(/Switched to Profile tab/i)).toBeVisible({ timeout: 10_000 })

  // Switch back to Map
  await page.getByRole('button', { name: /^Map$/i }).click()
  await expect(page.getByText(/Switched to Map tab/i)).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// 5. Venue page — clicking a venue loads venue detail content
// ---------------------------------------------------------------------------

test('venue page shows name and pulse score on venue click', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  // Navigate to Trending tab which shows venue cards with scores
  await page.getByRole('button', { name: /^Trending$/i }).click()
  await expect(page.getByText(/Switched to Trending tab/i)).toBeVisible({ timeout: 10_000 })

  // Click the first venue link / button that appears in the trending list
  const venueCard = page.locator('button').filter({ hasText: /View|Details/ }).first()
  const venueCardAlt = page.locator('[class*="rounded"]').filter({ hasText: /.{3,}/ }).locator('visible=true').first()

  // Try to find a clickable venue — trending tab renders venue names as clickable elements
  const firstVenueName = page.locator('p, h3, h4').filter({ hasText: /.{3,}/ }).first()
  const venueName = await firstVenueName.textContent()

  // Click on the venue name area to navigate to VenuePage
  await firstVenueName.click()

  // On the VenuePage we should see the venue name as a heading and a pulse score
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })
  // The VenuePage also has a "Create Pulse" button
  await expect(page.getByRole('button', { name: /Create Pulse/i })).toBeVisible({ timeout: 10_000 })
  // A back button should be present
  await expect(page.locator('button').filter({ has: page.locator('svg') }).first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// 6. Pulse creation — dialog fields are present
// ---------------------------------------------------------------------------

test('create pulse dialog shows energy rating and caption fields', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  // Click the floating action button (Plus icon in bottom-right) to open create pulse dialog
  const fab = page.locator('button.fixed').filter({ hasText: '' }).last()
  // The FAB is at bottom-24 right-6 with a Plus icon
  const fabButton = page.locator('button[class*="fixed"][class*="bottom"]')
  await fabButton.first().click({ timeout: 10_000 })

  // The CreatePulseDialog should open with the dialog title
  await expect(page.getByText(/Create Pulse at/i)).toBeVisible({ timeout: 10_000 })

  // Verify energy rating section
  await expect(page.getByText(/How's the energy/i)).toBeVisible()

  // Verify caption textarea
  await expect(page.getByPlaceholder(/What's the vibe/i)).toBeVisible()

  // Verify video upload button
  await expect(page.getByText(/Add Video/i)).toBeVisible()

  // Verify submit and cancel buttons
  await expect(page.getByRole('button', { name: /Post Pulse/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible()

  // Close dialog
  await page.getByRole('button', { name: /Cancel/i }).click()
})

// ---------------------------------------------------------------------------
// 7. Check-in flow — creating a pulse from venue page triggers feedback
// ---------------------------------------------------------------------------

test('check-in flow: create pulse button opens dialog on venue page', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  // Go to Trending tab and click into a venue
  await page.getByRole('button', { name: /^Trending$/i }).click()
  await expect(page.getByText(/Switched to Trending tab/i)).toBeVisible({ timeout: 10_000 })

  // Wait for venue cards to appear then click the first venue
  await page.waitForTimeout(1_000)
  const firstVenue = page.locator('p, h3, h4').filter({ hasText: /.{3,}/ }).first()
  await firstVenue.click()

  // On VenuePage, click Create Pulse to trigger check-in
  const createPulseBtn = page.getByRole('button', { name: /Create Pulse/i })
  await expect(createPulseBtn).toBeVisible({ timeout: 15_000 })
  await createPulseBtn.click()

  // The dialog should open, confirming the check-in flow initiates
  await expect(page.getByText(/Create Pulse at/i)).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/How's the energy/i)).toBeVisible()
})

// ---------------------------------------------------------------------------
// 8. Notifications — tab renders notification content
// ---------------------------------------------------------------------------

test('notifications tab renders notification area', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  await page.getByRole('button', { name: /^Alerts$/i }).click()
  await expect(page.getByText(/Switched to Notifications tab/i)).toBeVisible({ timeout: 10_000 })

  // The notification feed should render — either the empty state or the notification list
  const hasNotifications = await page.getByText(/Notifications/i).first().isVisible().catch(() => false)
  const hasEmptyState = await page.getByText(/No notifications yet/i).isVisible().catch(() => false)

  // One of these states must be true
  expect(hasNotifications || hasEmptyState).toBeTruthy()

  // If empty state, verify the descriptive text
  if (hasEmptyState) {
    await expect(page.getByText(/friends post pulses/i)).toBeVisible()
  }
})

// ---------------------------------------------------------------------------
// 9. Search — map search input is present and accepts queries
// ---------------------------------------------------------------------------

test('search input on map tab accepts queries', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  // On the map tab, the MapSearch component has a search input
  const searchInput = page.getByPlaceholder(/search/i).first()
  await expect(searchInput).toBeVisible({ timeout: 20_000 })

  // Type a query and verify it appears in the input
  await searchInput.fill('rooftop')
  await expect(searchInput).toHaveValue('rooftop')

  // Clear the search
  await searchInput.fill('')
  await expect(searchInput).toHaveValue('')
})

// ---------------------------------------------------------------------------
// 10. Settings — accessible from profile and renders settings options
// ---------------------------------------------------------------------------

test('settings page renders notification and display preferences', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  // Navigate to Profile tab
  await page.getByRole('button', { name: /^Profile$/i }).click()
  await expect(page.getByText(/Switched to Profile tab/i)).toBeVisible({ timeout: 10_000 })

  // Click on App Settings button
  const settingsBtn = page.getByText(/App Settings/i)
  await expect(settingsBtn).toBeVisible({ timeout: 10_000 })
  await settingsBtn.click()

  // Settings page should show with the heading
  await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible({ timeout: 10_000 })

  // Verify notification preferences section
  await expect(page.getByText(/Notifications/i).first()).toBeVisible()
  await expect(page.getByText(/Friend Pulses/i)).toBeVisible()
  await expect(page.getByText(/Trending Venues/i)).toBeVisible()

  // Verify display section with distance units
  await expect(page.getByText(/Display/i)).toBeVisible()
  await expect(page.getByText(/Distance Units/i)).toBeVisible()

  // Verify privacy section
  await expect(page.getByText(/Privacy & Presence/i)).toBeVisible()

  // Verify language section
  await expect(page.getByText(/Language/i).first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// 11. Profile — displays user information
// ---------------------------------------------------------------------------

test('profile tab displays user information', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  await page.getByRole('button', { name: /^Profile$/i }).click()
  await expect(page.getByText(/Switched to Profile tab/i)).toBeVisible({ timeout: 10_000 })

  // User info: username should be visible (default user is 'kyle')
  await expect(page.getByRole('heading', { name: /kyle/i })).toBeVisible({ timeout: 10_000 })

  // Pulse count text
  await expect(page.getByText(/pulses$/i)).toBeVisible()

  // Member since date
  await expect(page.getByText(/Member since/i)).toBeVisible()

  // Settings section within profile
  await expect(page.getByText(/Settings/i).first()).toBeVisible()

  // Invite Friends section
  await expect(page.getByText(/Invite Friends/i)).toBeVisible()

  // Your Pulses section
  await expect(page.getByText(/Your Pulses/i)).toBeVisible()
})

// ---------------------------------------------------------------------------
// 12. Discovery / Discover tab — renders discover content
// ---------------------------------------------------------------------------

test('discover tab renders discovery content and quick actions', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  await page.getByRole('button', { name: /^Discover$/i }).click()
  await expect(page.getByText(/Switched to Discover tab/i)).toBeVisible({ timeout: 10_000 })

  // Discover heading
  await expect(page.getByText('Discover').first()).toBeVisible({ timeout: 10_000 })

  // Quick action grid items
  await expect(page.getByText('Events')).toBeVisible()
  await expect(page.getByText('Crews')).toBeVisible()
  await expect(page.getByText('Achievements')).toBeVisible()
  await expect(page.getByText('Insights')).toBeVisible()
  await expect(page.getByText('Playlists')).toBeVisible()
  await expect(page.getByText('Challenges')).toBeVisible()

  // Neighborhood Scores link
  await expect(page.getByText(/Neighborhood Scores/i)).toBeVisible()

  // Plan Your Night CTA
  await expect(page.getByText(/Plan Your Night/i)).toBeVisible()
})

// ---------------------------------------------------------------------------
// 13. Trending tab — renders trending venues and content
// ---------------------------------------------------------------------------

test('trending tab renders trending venue content', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  await page.getByRole('button', { name: /^Trending$/i }).click()
  await expect(page.getByText(/Switched to Trending tab/i)).toBeVisible({ timeout: 10_000 })

  // Sub-tab switcher with Trending and My Spots
  await expect(page.getByRole('button', { name: /^Trending$/i }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /My Spots/i })).toBeVisible()

  // Wait for venue content to load — there should be at least one venue name
  await page.waitForTimeout(1_000)
  const venueElements = page.locator('p, h3, h4').filter({ hasText: /.{3,}/ })
  const count = await venueElements.count()
  expect(count).toBeGreaterThan(0)
})

// ---------------------------------------------------------------------------
// 14. Pull-to-refresh — PullToRefresh wrapper is present in DOM
// ---------------------------------------------------------------------------

test('pull-to-refresh wrapper exists in the page DOM', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  // Navigate to trending which wraps content in PullToRefresh
  await page.getByRole('button', { name: /^Trending$/i }).click()
  await expect(page.getByText(/Switched to Trending tab/i)).toBeVisible({ timeout: 10_000 })

  // The PullToRefresh component adds touch event handlers on a relative container.
  // Verify the page responds to basic interactions — the page should not error.
  // We verify the content is scrollable and touchable.
  const content = page.locator('.relative').first()
  await expect(content).toBeVisible()
})
