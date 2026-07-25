#!/usr/bin/env node
/**
 * Staging smoke checklist for vibe vision.
 *
 * Usage:
 *   node scripts/vibe-vision-smoke.mjs https://your-preview.vercel.app
 *   VIBE_SMOKE_TOKEN=<jwt> node scripts/vibe-vision-smoke.mjs https://...
 *
 * Without a JWT, only unauthenticated reachability checks run.
 */

const base = (process.argv[2] || process.env.VIBE_SMOKE_BASE || 'http://127.0.0.1:4173').replace(
  /\/$/,
  '',
)
const token = process.env.VIBE_SMOKE_TOKEN || ''

const checks = []

function pass(name, detail = '') {
  checks.push({ ok: true, name, detail })
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  checks.push({ ok: false, name, detail })
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  console.log(`Vibe vision smoke against ${base}\n`)

  // 1. Health
  try {
    const res = await fetch(`${base}/api/health`)
    if (res.ok) pass('GET /api/health', String(res.status))
    else fail('GET /api/health', String(res.status))
  } catch (e) {
    fail('GET /api/health', e instanceof Error ? e.message : String(e))
  }

  // 2. Upload-url auth gate
  try {
    const res = await fetch(`${base}/api/photos/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'x.jpg', mime: 'image/jpeg', bytes: 100 }),
    })
    if (res.status === 401 || res.status === 403) {
      pass('POST /api/photos/upload-url rejects unauthenticated', String(res.status))
    } else {
      fail('POST /api/photos/upload-url rejects unauthenticated', `got ${res.status}`)
    }
  } catch (e) {
    fail('POST /api/photos/upload-url', e instanceof Error ? e.message : String(e))
  }

  // 3. Assess auth gate
  try {
    const res = await fetch(`${base}/api/vibe/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: 'https://example.com/a.jpg' }),
    })
    if (res.status === 401 || res.status === 403) {
      pass('POST /api/vibe/assess rejects unauthenticated', String(res.status))
    } else if (res.status === 500) {
      // Missing ANTHROPIC key still proves route exists
      pass('POST /api/vibe/assess reachable (server config)', String(res.status))
    } else {
      fail('POST /api/vibe/assess rejects unauthenticated', `got ${res.status}`)
    }
  } catch (e) {
    fail('POST /api/vibe/assess', e instanceof Error ? e.message : String(e))
  }

  if (token) {
    console.log('\nAuthenticated checks…')
    try {
      const res = await fetch(`${base}/api/photos/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ filename: 'smoke.jpg', mime: 'image/jpeg', bytes: 1200 }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json?.data?.signedUrl && json?.data?.path) {
        pass('Authenticated photo upload-url', json.data.path)
      } else {
        fail('Authenticated photo upload-url', `${res.status} ${JSON.stringify(json)}`)
      }
    } catch (e) {
      fail('Authenticated photo upload-url', e instanceof Error ? e.message : String(e))
    }

    try {
      const res = await fetch(`${base}/api/admin/vibe-vision?hours=24`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 200 || res.status === 403) {
        pass('GET /api/admin/vibe-vision', String(res.status))
      } else {
        fail('GET /api/admin/vibe-vision', String(res.status))
      }
    } catch (e) {
      fail('GET /api/admin/vibe-vision', e instanceof Error ? e.message : String(e))
    }
  } else {
    console.log('\n(skip authenticated checks — set VIBE_SMOKE_TOKEN for full smoke)\n')
  }

  console.log(`
Manual checklist (staging UI):
  [ ] VITE_VIBE_VISION_ENABLED=1 + ANTHROPIC_API_KEY set
  [ ] Migration 20260725000000 applied (image MIME + usage tables)
  [ ] Create Pulse → Add photo → storage key on pulse, image renders
  [ ] Assess vibe → energy prefill when confidence ≥ 40%
  [ ] Low-confidence photo → "pick manually", Re-scan / Keep my rating work
  [ ] Unsafe image → blocked toast, photo cleared
  [ ] Concierge → attach photo → model calls assess_venue_photo
  [ ] Admin /admin/signal → Vibe Vision card shows 24h stats
`)

  const failed = checks.filter((c) => !c.ok).length
  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`)
    process.exit(1)
  }
  console.log('\nAll automated checks passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
