#!/usr/bin/env node
/**
 * Public production checks for Pulse Signal.
 *
 * Does not apply migrations or require a Vercel token. Use this after a
 * human applies schema + env (see docs/runbooks/signal-launch.md).
 *
 *   SIGNAL_PROD_URL=https://pulse-chi-nine.vercel.app npm run verify:signal-prod
 *   CRON_SECRET=... npm run verify:signal-prod   # optional dispatch probe
 */
const url = (process.env.SIGNAL_PROD_URL || 'https://pulse-chi-nine.vercel.app').replace(/\/$/, '')
const cronSecret = process.env.CRON_SECRET

const failures = []

function assert(condition, message) {
  if (!condition) failures.push(message)
}

async function fetchText(path, init) {
  const response = await fetch(`${url}${path}`, init)
  const text = await response.text()
  return { response, text }
}

const html = await fetchText('/')
assert(html.response.ok, `GET / returned ${html.response.status}`)
assert(/Pulse Signal/i.test(html.text), 'Production HTML title/copy is not Pulse Signal')
assert(!/Real-time venue energy discovery/i.test(html.text), 'Production HTML still leads with venue discovery copy')

const unauth = await fetchText('/api/signal/reminders/dispatch')
assert(
  unauth.response.status === 401 || unauth.response.status === 403,
  `Dispatch without CRON_SECRET returned ${unauth.response.status}, expected 401/403`,
)

if (cronSecret) {
  const dispatch = await fetchText('/api/signal/reminders/dispatch', {
    headers: { Authorization: `Bearer ${cronSecret}` },
  })
  assert(dispatch.response.ok, `Authorized dispatch returned ${dispatch.response.status}: ${dispatch.text.slice(0, 240)}`)
  let body = null
  try {
    body = JSON.parse(dispatch.text)
  } catch {
    failures.push('Authorized dispatch did not return JSON')
  }
  const data = body?.data ?? body
  assert(typeof data?.candidates === 'number', 'Dispatch JSON missing candidates')
  assert(Array.isArray(data?.results), 'Dispatch JSON missing results[]')
} else {
  console.log('CRON_SECRET unset — skipped authorized dispatch probe')
}

if (failures.length > 0) {
  console.error(`Signal production checks failed against ${url}`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Signal production checks passed against ${url}`)
console.log('- HTML is Pulse Signal')
console.log('- Reminder dispatch rejects missing CRON_SECRET')
if (cronSecret) console.log('- Authorized dispatch returned candidates/results')
console.log('Still required (manual): apply Supabase migrations, two-device persist, closed-app Web Push.')
