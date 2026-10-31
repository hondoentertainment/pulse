#!/usr/bin/env node
/**
 * Fail when bun.lock's requested ranges or overrides drift from package.json.
 *
 * Dependabot updates the npm lockfile only. Native Sync installs with
 * `bun install --frozen-lockfile` on Bun 1.4.4, so a stale bun.lock fails
 * that job later. This check runs in CI without Bun installed.
 *
 * Regenerate with Bun 1.4.4: `bun install --lockfile-only`.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')

function parseJsonc(text) {
  let out = ''
  let inString = false
  let escape = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    const next = text[i + 1]
    if (inString) {
      out += c
      if (escape) escape = false
      else if (c === '\\') escape = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      out += c
      continue
    }
    if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1
      continue
    }
    if (c === '/' && next === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1
      i += 1
      continue
    }
    if ((c === '}' || c === ']') && /,\s*$/.test(out)) {
      out = out.replace(/,\s*$/, '')
    }
    out += c
  }
  return JSON.parse(out)
}

function collectRanges(manifest) {
  const ranges = new Map()
  const conflicts = []
  for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, range] of Object.entries(manifest[group] ?? {})) {
      const previous = ranges.get(name)
      if (previous !== undefined && previous !== range) {
        conflicts.push(`${name} is ${previous} in one section and ${range} in ${group}`)
      } else {
        ranges.set(name, range)
      }
    }
  }
  return { ranges, conflicts }
}

function lockRanges(workspace) {
  const ranges = new Map()
  const conflicts = []
  for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, range] of Object.entries(workspace?.[group] ?? {})) {
      const previous = ranges.get(name)
      if (previous !== undefined && previous !== range) {
        conflicts.push(`bun.lock lists ${name} as both ${previous} and ${range}`)
      } else {
        ranges.set(name, range)
      }
    }
  }
  return { ranges, conflicts }
}

function diffRanges(label, expected, actual, problems) {
  for (const [name, range] of expected) {
    if (!actual.has(name)) {
      problems.push(`${label}: ${name}@${range} is missing from bun.lock`)
      continue
    }
    if (actual.get(name) !== range) {
      problems.push(`${label}: ${name} is ${range} in package.json and ${actual.get(name)} in bun.lock`)
    }
  }
  for (const [name, range] of actual) {
    if (!expected.has(name)) problems.push(`${label}: bun.lock has extra ${name}@${range}`)
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
  }
  return value
}

function workspaceManifests(rootManifest) {
  const patterns = Array.isArray(rootManifest.workspaces)
    ? rootManifest.workspaces
    : rootManifest.workspaces?.packages ?? []
  const manifests = []
  for (const pattern of patterns) {
    if (!pattern.endsWith('/*')) continue
    const dir = join(rootDir, pattern.slice(0, -2))
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const manifestPath = join(dir, entry.name, 'package.json')
      if (!existsSync(manifestPath)) continue
      manifests.push(JSON.parse(readFileSync(manifestPath, 'utf8')))
    }
  }
  return manifests
}

function check() {
  const rootManifest = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))
  const lock = parseJsonc(readFileSync(join(rootDir, 'bun.lock'), 'utf8'))
  const problems = []

  const rootExpected = collectRanges(rootManifest)
  problems.push(...rootExpected.conflicts)
  const rootActual = lockRanges(lock.workspaces?.[''])
  problems.push(...rootActual.conflicts.map((line) => `root ${line}`))
  diffRanges('root', rootExpected.ranges, rootActual.ranges, problems)

  const expectedOverrides = rootManifest.overrides ?? {}
  const actualOverrides = lock.overrides ?? {}
  if (JSON.stringify(stable(expectedOverrides)) !== JSON.stringify(stable(actualOverrides))) {
    problems.push('overrides in bun.lock do not match package.json overrides')
  }

  for (const manifest of workspaceManifests(rootManifest)) {
    const name = manifest.name
    if (!name) {
      problems.push('a workspace package.json is missing a name')
      continue
    }
    const expected = collectRanges(manifest)
    problems.push(...expected.conflicts.map((line) => `${name}: ${line}`))
    const actual = lockRanges(lock.workspaces?.[name])
    if (!lock.workspaces?.[name]) {
      problems.push(`workspace ${name} is missing from bun.lock`)
      continue
    }
    problems.push(...actual.conflicts.map((line) => `${name}: ${line}`))
    diffRanges(name, expected.ranges, actual.ranges, problems)
  }

  if (problems.length === 0) return
  console.error('bun.lock does not match package.json.')
  console.error('Regenerate it with Bun 1.4.4: bun install --lockfile-only')
  for (const problem of problems) console.error(`- ${problem}`)
  process.exit(1)
}

check()
