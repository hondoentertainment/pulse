#!/usr/bin/env node
/**
 * Lightweight uptime probe for `GET /api/health`.
 *
 * Usage:
 *   HEALTH_URL=https://pulse.example.com node scripts/check-health.mjs
 *   node scripts/check-health.mjs https://pulse.example.com
 */

const base = (process.env.HEALTH_URL || process.argv[2] || '').replace(/\/$/, '')

if (!base) {
  console.error('Usage: HEALTH_URL=<origin> node scripts/check-health.mjs')
  console.error('   or: node scripts/check-health.mjs <origin>')
  process.exit(2)
}

const url = `${base}/api/health`
const timeoutMs = Number.parseInt(process.env.HEALTH_TIMEOUT_MS ?? '15000', 10)

const controller = new AbortController()
const timer = setTimeout(() => controller.abort(), timeoutMs)

try {
  const res = await fetch(url, { signal: controller.signal })
  const body = await res.text()
  let json
  try {
    json = JSON.parse(body)
  } catch {
    console.error(`[health] Non-JSON response (${res.status}) from ${url}`)
    process.exit(1)
  }

  if (!res.ok || json?.status !== 'ok') {
    console.error(`[health] Unhealthy (${res.status}) from ${url}:`, json)
    process.exit(1)
  }

  console.log(`[health] OK ${url}`, json)
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[health] Request failed for ${url}: ${message}`)
  process.exit(1)
} finally {
  clearTimeout(timer)
}
