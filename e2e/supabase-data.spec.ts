import { test, expect } from '@playwright/test'
import { completeOnboarding } from './fixtures/onboarding'

const hasSupabaseEnv = !!(
  process.env.VITE_SUPABASE_URL &&
  process.env.VITE_SUPABASE_ANON_KEY &&
  process.env.E2E_SUPABASE === '1'
)

test.describe('Supabase data path (live backend)', () => {
  test.skip(!hasSupabaseEnv, 'Set E2E_SUPABASE=1 plus VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')

  test('venue shell boots against Supabase without crashing', async ({ page }) => {
    await page.goto('/')
    await completeOnboarding(page)
    await expect(page.locator('#main-content')).toBeVisible()
    // Should not show the infinite-update React error overlay.
    await expect(page.getByText('Maximum update depth exceeded')).toHaveCount(0)
  })
})
