#!/usr/bin/env bun
/**
 * scripts/load-test.ts
 *
 * Lightweight load test for Pulse's API surface. Uses global `fetch` and a
 * small worker pool — no runtime dependencies. Runs equally well under Bun
 * (`bun run scripts/load-test.ts`) and Node ≥ 18 (`node --experimental-strip-types`).
 *
 * Targets:
 *   POST /api/moderation/check   — moderation SLO p95 ≤ 400 ms
 *   POST /api/pulses/create      — pulse-create SLO p95 ≤ 300 ms
 *
 * Usage:
 *   LOAD_TARGET_URL=https://staging.pulseapp.example bun run load-test
 *   LOAD_TARGET_RPS=50 LOAD_DURATION_S=60 bun run load-test
 *
 * Fails with a non-zero exit if p95 for any target exceeds its SLO. This
 * script must run against a staging environment — do not point it at prod.
 */

// ---------- configuration ----------

type EnergyRating = 'dead' | 'chill' | 'buzzing' | 'electric'

const TARGET_URL = process.env.LOAD_TARGET_URL ?? 'http://localhost:5000'
const TARGET_RPS = Number(process.env.LOAD_TARGET_RPS ?? '25')
const DURATION_S = Number(process.env.LOAD_DURATION_S ?? '30')
const RAMP_S = Number(process.env.LOAD_RAMP_S ?? '10')
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? '20')

// SLO gates from docs/slos.md (p95, ms). Bump these only if the SLO itself is raised.
const SLO_P95_MS: Record<string, number> = {
  '/api/moderation/check': 400,
  '/api/pulses/create': 300,
}

// Safety: refuse to aim at a production-looking host.
if (/\bpulseapp\.example\b/.test(TARGET_URL) && !/\bstaging\b/.test(TARGET_URL)) {
  console.error(`Refusing to run load test against ${TARGET_URL} — staging only.`)
  process.exit(2)
}

// ---------- scenarios ----------

type Scenario = {
  name: string
  path: string
  method: 'GET' | 'POST'
  body: () => unknown
}

const ENERGY: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']
const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const uuid = (): string =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `load-${Date.now()}-${Math.random().toString(16).slice(2)}`

const SCENARIOS: Scenario[] = [
  {
    name: 'moderation',
    path: '/api/moderation/check',
    method: 'POST',
    body: () => ({
      text: rand([
        'great vibes tonight!',
        'place is dead',
        'too loud, my ears',
        'best night ever',
        'not my scene',
      ]),
      userId: `loadtest-${uuid().slice(0, 8)}`,
    }),
  },
  {
    name: 'pulse-create',
    path: '/api/pulses/create',
    method: 'POST',
    body: () => ({
      id: uuid(),
      userId: `loadtest-${uuid().slice(0, 8)}`,
      venueId: rand(['venue-1', 'venue-2', 'venue-3', 'venue-4', 'venue-5']),
      energyRating: rand(ENERGY),
      caption: 'load test',
      createdAt: new Date().toISOString(),
    }),
  },
]

// ---------- latency bookkeeping ----------

type Bucket = {
  samples: number[]
  ok: number
  err: number
  started: number
}

const buckets: Record<string, Bucket> = Object.fromEntries(
  SCENARIOS.map((s) => [s.path, { samples: [], ok: 0, err: 0, started: 0 }])
)

const percentile = (arr: number[], p: number): number => {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

// ---------- request helpers ----------

const fireOne = async (s: Scenario): Promise<void> => {
  const bucket = buckets[s.path]
  bucket.started += 1
  const t0 = performance.now()
  try {
    const res = await fetch(`${TARGET_URL}${s.path}`, {
      method: s.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s.body()),
    })
    const dt = performance.now() - t0
    bucket.samples.push(dt)
    if (res.ok) bucket.ok += 1
    else bucket.err += 1
    // Drain body so the connection returns to the pool.
    await res.arrayBuffer().catch(() => void 0)
  } catch {
    const dt = performance.now() - t0
    bucket.samples.push(dt)
    bucket.err += 1
  }
}

// ---------- pacing: token bucket ----------

class TokenBucket {
  private tokens = 0
  private lastRefill = performance.now()
  constructor(private ratePerSec: () => number) {}
  async take(): Promise<void> {
    for (;;) {
      const now = performance.now()
      const elapsed = (now - this.lastRefill) / 1000
      const rate = Math.max(0.0001, this.ratePerSec())
      this.tokens = Math.min(rate, this.tokens + elapsed * rate)
      this.lastRefill = now
      if (this.tokens >= 1) {
        this.tokens -= 1
        return
      }
      const waitMs = ((1 - this.tokens) / rate) * 1000
      await new Promise((r) => setTimeout(r, Math.max(5, waitMs)))
    }
  }
}

// ---------- main ----------

const main = async (): Promise<void> => {
  const startedAt = performance.now()
  const endAt = startedAt + DURATION_S * 1000

  console.log('--- Pulse load test ---')
  console.log(`target:       ${TARGET_URL}`)
  console.log(`target rps:   ${TARGET_RPS} (ramped over ${RAMP_S}s)`)
  console.log(`duration:     ${DURATION_S}s`)
  console.log(`concurrency:  ${CONCURRENCY}`)
  console.log(`scenarios:    ${SCENARIOS.map((s) => s.name).join(', ')}`)
  console.log('')

  // Ramp: linear from 1 RPS up to TARGET_RPS over RAMP_S seconds.
  const bucket = new TokenBucket(() => {
    const elapsed = (performance.now() - startedAt) / 1000
    if (elapsed >= RAMP_S) return TARGET_RPS
    const frac = Math.max(0, elapsed / Math.max(1, RAMP_S))
    return 1 + (TARGET_RPS - 1) * frac
  })

  // Dispatcher: pulls a token, picks a scenario, dispatches to a free worker.
  let workerInFlight = 0
  const workerSlot = async (): Promise<void> => {
    while (performance.now() < endAt) {
      await bucket.take()
      if (performance.now() >= endAt) break
      workerInFlight += 1
      const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)]
      await fireOne(scenario)
      workerInFlight -= 1
    }
  }

  // Periodic progress print.
  const progress = setInterval(() => {
    const elapsed = ((performance.now() - startedAt) / 1000).toFixed(0)
    const line = SCENARIOS.map((s) => {
      const b = buckets[s.path]
      const p95 = percentile(b.samples.slice(-500), 95).toFixed(0)
      return `${s.name} n=${b.started} p95=${p95}ms err=${b.err}`
    }).join(' | ')
    console.log(`[${elapsed}s] in-flight=${workerInFlight} ${line}`)
  }, 5_000)

  await Promise.all(Array.from({ length: CONCURRENCY }, () => workerSlot()))
  clearInterval(progress)

  // ---------- report ----------
  console.log('')
  console.log('--- results ---')
  let failed = false
  for (const s of SCENARIOS) {
    const b = buckets[s.path]
    const p50 = percentile(b.samples, 50)
    const p95 = percentile(b.samples, 95)
    const p99 = percentile(b.samples, 99)
    const slo = SLO_P95_MS[s.path] ?? Number.POSITIVE_INFINITY
    const errRate = b.started > 0 ? (b.err / b.started) * 100 : 0
    const passed = p95 <= slo && errRate < 5
    if (!passed) failed = true
    console.log(
      `${s.name.padEnd(14)} n=${String(b.started).padStart(5)}  ` +
        `ok=${b.ok}  err=${b.err} (${errRate.toFixed(2)}%)  ` +
        `p50=${p50.toFixed(0)}ms  p95=${p95.toFixed(0)}ms  p99=${p99.toFixed(0)}ms  ` +
        `slo(p95)=${slo}ms  ${passed ? 'PASS' : 'FAIL'}`
    )
  }

  if (failed) {
    console.error('\nSLO violated or error rate > 5%. See docs/slos.md.')
    process.exit(1)
  }
  console.log('\nAll targets within SLO.')
}

main().catch((err) => {
  console.error('load-test crashed:', err)
  process.exit(1)
})
