import { spawnSync } from 'node:child_process'

process.env.VITE_APP_MODE = 'venue'
process.env.VITE_ALLOW_VENUE_SHELL = 'true'

const result = spawnSync(
  'npx',
  ['playwright', 'test', 'e2e/venue-smoke.spec.ts', 'e2e/pulse-creation.spec.ts', 'e2e/search.spec.ts', 'e2e/account-privacy.spec.ts', 'e2e/notifications.spec.ts'],
  { stdio: 'inherit', shell: true, env: process.env },
)

process.exit(result.status ?? 1)
