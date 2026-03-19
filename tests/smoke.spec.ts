import { test, expect } from '@playwright/test';

test('has title and renders the onboarding flow', async ({ page }) => {
  await page.goto('/');

  // Check the title
  await expect(page).toHaveTitle(/Pulse/i);

  // By default, the app starts with the Onboarding flow for new users
  await expect(page.locator('text=Welcome to Pulse')).toBeVisible();
});

test('can complete onboarding and see main shell', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Step 1: Welcome
  await expect(page.locator('text=Welcome to Pulse')).toBeVisible();
  await page.click('button:has-text("Get Started")');

  // Step 2: Categories (Need to select at least 1)
  await expect(page.locator('text=What\'s your scene?')).toBeVisible();
  await page.locator('button.p-4', { hasText: 'Bars & Pubs' }).click();
  await page.click('button:has-text("Continue")');

  // Step 3: Times (Optional)
  await expect(page.locator('text=When do you go out?')).toBeVisible();
  await page.click('button:has-text("Skip")');

  // Step 4: Permissions (Optional)
  await expect(page.locator('text=Enable permissions')).toBeVisible();
  await page.click('button:has-text("Continue")');

  // Step 5: Ready
  await expect(page.locator('text=You\'re all set!')).toBeVisible();
  await page.click('button:has-text("Start Exploring")');

  // Check that the shell nav/header exists after onboarding
  const tabNav = page.locator('nav');
  await expect(tabNav).toBeVisible();
});
