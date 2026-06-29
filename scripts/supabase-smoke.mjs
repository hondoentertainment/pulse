#!/usr/bin/env node
/**
 * Production Supabase data-path smoke test (launch checklist item #3).
 *
 * Validates that the live data path the app depends on actually works against a
 * real Supabase project — without booting the front-end. It exercises, in order:
 *
 *   1. Env presence (URL + a key)
 *   2. REST reachability + auth (PostgREST root)
 *   3. `get_live_venue_intelligence` RPC (primary venue read path)
 *   4. `venues` table read (fallback venue path)
 *   5. `pulses` table read with the live filters (deleted_at / expires_at)
 *   6. `push_tokens` table presence (push delivery prerequisite)
 *
 * Read-only: it never writes. Safe to run against production.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/supabase-smoke.mjs
 *   # service-role key also works and additionally clears RLS for push_tokens
 *
 * Recognised env (first match wins):
 *   URL  : SUPABASE_URL | VITE_SUPABASE_URL
 *   KEY  : SUPABASE_SERVICE_ROLE | SUPABASE_SERVICE_ROLE_KEY |
 *          SUPABASE_ANON_KEY | VITE_SUPABASE_ANON_KEY
 *
 * Exit code: 0 if all required checks pass, 1 otherwise.
 */

const URL_VAR = ['SUPABASE_URL', 'VITE_SUPABASE_URL']
const KEY_VAR = [
  'SUPABASE_SERVICE_ROLE',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
]

const pick = (names) => {
  for (const n of names) {
    if (process.env[n]) return { name: n, value: process.env[n] }
  }
  return null
}

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
}

const results = []
const record = (name, status, detail) => {
  results.push({ name, status, detail })
  const icon =
    status === 'pass' ? `${C.green}PASS${C.reset}` : status === 'warn' ? `${C.yellow}WARN${C.reset}` : `${C.red}FAIL${C.reset}`
  console.log(`  [${icon}] ${name}${detail ? ` ${C.dim}— ${detail}${C.reset}` : ''}`)
}

async function restGet(base, key, path) {
  const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { ok: res.ok, status: res.status, json, text }
}

async function restPost(base, key, path, body) {
  const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { ok: res.ok, status: res.status, json, text }
}

async function main() {
  console.log(`\n${C.dim}Pulse · Supabase data-path smoke${C.reset}\n`)

  const url = pick(URL_VAR)
  const key = pick(KEY_VAR)

  if (!url || !key) {
    record('env present', 'fail', `set ${URL_VAR.join('|')} and one of ${KEY_VAR.join('|')}`)
    summarize()
    process.exit(1)
  }
  record('env present', 'pass', `${url.name} + ${key.name}`)

  const base = url.value
  const k = key.value

  // 2. REST reachability + auth
  try {
    const root = await restGet(base, k, '/rest/v1/')
    if (root.status === 401) {
      record('rest auth', 'fail', 'key rejected (401) — check anon/service-role key')
    } else if (root.status >= 500) {
      record('rest reachability', 'fail', `server error ${root.status}`)
    } else {
      record('rest reachability', 'pass', `status ${root.status}`)
    }
  } catch (err) {
    record('rest reachability', 'fail', String(err?.message || err))
    summarize()
    process.exit(1)
  }

  // 3. Primary venue read path (RPC)
  try {
    const rpc = await restPost(base, k, '/rest/v1/rpc/get_live_venue_intelligence', { max_pulses: 5 })
    if (rpc.ok && Array.isArray(rpc.json)) {
      record('venue rpc', 'pass', `${rpc.json.length} rows`)
    } else if (rpc.status === 404) {
      record('venue rpc', 'warn', 'get_live_venue_intelligence not found — app falls back to table read')
    } else {
      record('venue rpc', 'warn', `status ${rpc.status} ${rpc.text.slice(0, 120)}`)
    }
  } catch (err) {
    record('venue rpc', 'warn', String(err?.message || err))
  }

  // 4. Fallback venue table read
  try {
    const venues = await restGet(base, k, '/rest/v1/venues?select=id,name,pulse_score&limit=5')
    if (venues.ok && Array.isArray(venues.json)) {
      record('venues table', 'pass', `${venues.json.length} rows`)
    } else {
      record('venues table', 'fail', `status ${venues.status} ${venues.text.slice(0, 120)}`)
    }
  } catch (err) {
    record('venues table', 'fail', String(err?.message || err))
  }

  // 5. Live pulses read path (mirrors fetchPulsesFromSupabase filters)
  try {
    const nowIso = new Date().toISOString()
    const pulses = await restGet(
      base,
      k,
      `/rest/v1/pulses?select=id,venue_id,expires_at&deleted_at=is.null&expires_at=gt.${encodeURIComponent(nowIso)}&limit=5`,
    )
    if (pulses.ok && Array.isArray(pulses.json)) {
      record('pulses table', 'pass', `${pulses.json.length} live rows`)
    } else {
      record('pulses table', 'fail', `status ${pulses.status} ${pulses.text.slice(0, 120)}`)
    }
  } catch (err) {
    record('pulses table', 'fail', String(err?.message || err))
  }

  // 6. push_tokens table presence (push delivery prerequisite)
  try {
    const tokens = await restGet(base, k, '/rest/v1/push_tokens?select=user_id&limit=1')
    if (tokens.ok) {
      record('push_tokens table', 'pass', `reachable (${Array.isArray(tokens.json) ? tokens.json.length : 0} sample rows)`)
    } else if (tokens.status === 401 || tokens.status === 403) {
      record('push_tokens table', 'warn', 'present but RLS-protected from this key (expected with anon key)')
    } else if (tokens.status === 404) {
      record('push_tokens table', 'fail', 'table missing — run the push_tokens migration before enabling push')
    } else {
      record('push_tokens table', 'warn', `status ${tokens.status}`)
    }
  } catch (err) {
    record('push_tokens table', 'warn', String(err?.message || err))
  }

  summarize()
  const failed = results.some((r) => r.status === 'fail')
  process.exit(failed ? 1 : 0)
}

function summarize() {
  const pass = results.filter((r) => r.status === 'pass').length
  const warn = results.filter((r) => r.status === 'warn').length
  const fail = results.filter((r) => r.status === 'fail').length
  console.log(
    `\n${C.dim}────────${C.reset}\n` +
      `${C.green}${pass} passed${C.reset}, ${C.yellow}${warn} warnings${C.reset}, ${C.red}${fail} failed${C.reset}\n`,
  )
}

main().catch((err) => {
  console.error('smoke crashed:', err)
  process.exit(1)
})
