import { expect, test } from '@playwright/test'

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

test('app shell and map controls load', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  await expect(page).toHaveTitle(/Pulse/i)
  await expect(page.getByRole('button', { name: /zoom in/i })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: /zoom out/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /center map on my location/i })).toBeVisible()
})

test('smart route card appears and can trigger route', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  await expect(page.getByText(/Smart Route/i)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: /Take Me/i })).toBeVisible()
  await page.getByRole('button', { name: /Take Me/i }).click()
})

test('bottom navigation remains interactive', async ({ page }) => {
  await page.goto('/')
  await completeOnboardingIfPresent(page)

  await page.getByRole('button', { name: /profile/i }).click()
  await expect(page.getByText(/Switched to Profile tab/i)).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: /^map$/i }).click()
  await expect(page.getByRole('button', { name: /zoom in/i })).toBeVisible()
})
