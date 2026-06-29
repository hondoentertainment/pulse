import { spawnSync } from 'node:child_process'

process.env.VITE_APP_MODE = 'venue'

const result = spawnSync(
  'npx',
  ['playwright', 'test', 'e2e/venue-smoke.spec.ts', 'e2e/pulse-creation.spec.ts', 'e2e/search.spec.ts'],
  { stdio: 'inherit', shell: true, env: process.env },
)

process.exit(result.status ?? 1)
