import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4176'
const previewPort = new URL(baseURL).port || '4176'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${previewPort}`,
    url: baseURL,
    reuseExistingServer: false,
    env: {
      ...process.env,
      VITE_E2E_AUTH_BYPASS: 'true',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
  },
});
