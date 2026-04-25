#!/usr/bin/env node
/**
 * Bundle-size budget check.
 *
 * Runs after `vite build`. Reads every JS chunk in `dist/assets/`, gzips
 * each, and compares against per-chunk and per-category budgets.
 * Exits non-zero on breach so CI can fail the build.
 *
 * Budgets are intentionally generous today to establish a *regression gate*
 * rather than an aggressive optimisation target. Tighten over time.
 *
 * See docs/bundle-budget.md for rationale and raise procedure.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DIST_DIR = join(__dirname, '..', 'dist', 'assets')

/** Budgets in bytes (gzipped). Keep aligned with docs/bundle-budget.md. */
const BUDGETS = {
  // Application entry ("main") — user-facing shell on first load.
  main: { pattern: /^index-.*\.js$/, maxGzipBytes: 300 * 1024, label: 'main (index)' },

  // React vendor chunk — React + ReactDOM + Router + related.
  reactVendor: { pattern: /^react-vendor-.*\.js$/, maxGzipBytes: 250 * 1024, label: 'react-vendor' },

  // Heavy third-party chunks we know about and have accepted.
  // Mapbox is huge but lazy-loaded on /map route only.
  mapboxGl: { pattern: /^mapbox-gl-.*\.js$/, maxGzipBytes: 500 * 1024, label: 'mapbox-gl' },
  sentry: { pattern: /^sentry-.*\.js$/, maxGzipBytes: 120 * 1024, label: 'sentry' },
  supabase: { pattern: /^supabase-.*\.js$/, maxGzipBytes: 80 * 1024, label: 'supabase' },
  framerMotion: { pattern: /^framer-motion-.*\.js$/, maxGzipBytes: 60 * 1024, label: 'framer-motion' },
}

/** Every other JS chunk must be under this (a cheap regression trip-wire). */
const PER_CHUNK_DEFAULT_MAX_GZIP = 120 * 1024 // 120 KB gzip

/** Total gzip-summed budget across all JS. Soft upper bound. */
const TOTAL_GZIP_MAX = 1600 * 1024 // 1.6 MB gzip

function fmt(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return bytes + ' B'
}

function listJsChunks() {
  try {
    return readdirSync(DIST_DIR)
      .filter((f) => f.endsWith('.js'))
      .map((f) => ({ name: f, full: join(DIST_DIR, f) }))
  } catch (err) {
    console.error(`[bundle-size] Cannot read ${DIST_DIR}. Did you run \`bun run build\` first?`)
    console.error(err.message)
    process.exit(2)
  }
}

function main() {
  const chunks = listJsChunks()
  if (chunks.length === 0) {
    console.error('[bundle-size] No JS chunks found in dist/assets.')
    process.exit(2)
  }

  const violations = []
  let totalGzip = 0

  console.log('Bundle-size budget report')
  console.log('--------------------------')

  for (const chunk of chunks) {
    const raw = readFileSync(chunk.full)
    const gz = gzipSync(raw).length
    totalGzip += gz

    // Find a named budget that matches this filename, otherwise use the default.
    const named = Object.values(BUDGETS).find((b) => b.pattern.test(chunk.name))
    const max = named ? named.maxGzipBytes : PER_CHUNK_DEFAULT_MAX_GZIP
    const label = named ? named.label : chunk.name

    const status = gz <= max ? 'OK ' : 'OVER'
    console.log(
      `  ${status}  ${label.padEnd(24)} raw ${fmt(raw.length).padStart(9)}  gz ${fmt(gz).padStart(9)}  budget ${fmt(max)}`,
    )

    if (gz > max) {
      violations.push({
        file: chunk.name,
        label,
        gz,
        max,
      })
    }
  }

  console.log('--------------------------')
  console.log(`  total gzipped: ${fmt(totalGzip)}  budget ${fmt(TOTAL_GZIP_MAX)}`)

  if (totalGzip > TOTAL_GZIP_MAX) {
    violations.push({
      file: '<total>',
      label: 'total-gzipped',
      gz: totalGzip,
      max: TOTAL_GZIP_MAX,
    })
  }

  if (violations.length > 0) {
    console.error('')
    console.error(`[bundle-size] ${violations.length} budget violation(s):`)
    for (const v of violations) {
      console.error(`  - ${v.label}: ${fmt(v.gz)} > ${fmt(v.max)} (${v.file})`)
    }
    console.error('')
    console.error('See docs/bundle-budget.md for how to address or raise a budget.')
    process.exit(1)
  }

  console.log('')
  console.log('[bundle-size] All budgets OK.')
}

main()
