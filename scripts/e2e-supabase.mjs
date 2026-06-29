import { spawnSync } from 'node:child_process'

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  console.error('E2E Supabase profile requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

process.env.E2E_SUPABASE = '1'
process.env.VITE_APP_MODE = 'venue'
process.env.VITE_E2E_AUTH_BYPASS = 'true'
delete process.env.VITE_VISUAL_PREVIEW

const smoke = spawnSync('npm', ['run', 'smoke:supabase'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
})
if ((smoke.status ?? 1) !== 0) {
  process.exit(smoke.status ?? 1)
}

const e2e = spawnSync('npx', ['playwright', 'test', 'e2e/supabase-data.spec.ts'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

process.exit(e2e.status ?? 1)
