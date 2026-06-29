#!/usr/bin/env node
/**
 * Apply recommended branch protection on `main` via GitHub API.
 * Requires: `gh auth login` with admin access on the repo.
 *
 * Usage: node scripts/setup-branch-protection.mjs
 */
import { spawnSync } from 'node:child_process'

const REQUIRED_CHECKS = [
  'lint',
  'test',
  'build',
  'bundle-size',
  'smoke-preview',
  'e2e-signal',
  'lighthouse',
]

const ghBin = process.env.GH_CLI_PATH
  ?? (process.platform === 'win32'
    ? `${process.env.ProgramFiles ?? 'C:\\Program Files'}\\GitHub CLI\\gh.exe`
    : 'gh')

function gh(args) {
  const result = spawnSync(ghBin, args, { encoding: 'utf8' })
  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout)
    process.exit(result.status ?? 1)
  }
  return result.stdout.trim()
}

const repo = gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'])
console.log(`Configuring branch protection for ${repo} (branch: main)…`)

const payload = {
  required_status_checks: {
    strict: true,
    contexts: REQUIRED_CHECKS,
  },
  enforce_admins: true,
  required_pull_request_reviews: {
    required_approving_review_count: 1,
    dismiss_stale_reviews: true,
  },
  restrictions: null,
  required_linear_history: false,
  allow_force_pushes: false,
  allow_deletions: false,
}

const result = spawnSync(
  ghBin,
  ['api', `repos/${repo}/branches/main/protection`, '--method', 'PUT', '--input', '-'],
  { input: JSON.stringify(payload), encoding: 'utf8' },
)

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

if (result.status !== 0) {
  console.error(result.stderr || result.stdout)
  console.error('\nIf you lack admin access, configure manually — see docs/branch-protection.md')
  process.exit(result.status ?? 1)
}

console.log('Branch protection applied. Required checks:')
for (const check of REQUIRED_CHECKS) {
  console.log(`  - ${check}`)
}
