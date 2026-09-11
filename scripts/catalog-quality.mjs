/**
 * Catalog quality report — no prod mutations.
 *
 * Prints Launch 33 neighborhood coverage and reminds operators that
 * Tonight ranking hides bad / OSM-duplicate pins in UI (`src/lib/catalog-quality.ts`)
 * instead of deleting rows from xeldqwhztcnnvazmshzh.
 *
 * Usage: node scripts/catalog-quality.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const curatedPath = resolve(ROOT, 'src/lib/seattle-launch-venues.ts')
const source = readFileSync(curatedPath, 'utf8')
const names = [...source.matchAll(/name:\s*'([^']+)'/g)].map((match) => match[1])
const hoods = [...source.matchAll(/neighborhood:\s*'([^']+)'/g)].map((match) => match[1])

const counts = {}
for (const hood of hoods) counts[hood] = (counts[hood] ?? 0) + 1

console.log('Pulse catalog quality (report only — no writes)')
console.log(`Launch 33 names parsed: ${names.length}`)
console.log('Neighborhood tags:')
for (const [hood, count] of Object.entries(counts).sort()) {
  console.log(`  ${hood}: ${count}`)
}
console.log('')
console.log('Tonight ranking hides:')
console.log('  - pins outside Seattle bounds or 0,0')
console.log('  - generic names (bar/pub/club)')
console.log('  - OSM rows within ~40m of a curated Launch 33 name')
console.log('See src/lib/catalog-quality.ts and docs/next-steps.md.')
