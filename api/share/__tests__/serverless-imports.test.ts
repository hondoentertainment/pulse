import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

const ENTRYPOINTS = [
  'api/share/venue.ts',
  'api/share/og.ts',
  'api/_lib/share-og-lookup.ts',
]

function relativeSpecifiers(source: string): string[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const withoutTypeOnly = withoutComments.replace(/import\s+type\s+[\s\S]*?\sfrom\s+['"][^'"]+['"]/g, '')
  return [...withoutTypeOnly.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((match) => match[1])
}

function resolveModule(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec)
  const candidates = spec.endsWith('.js')
    ? [base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx'), base]
    : [base]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

describe('share serverless import graph', () => {
  it('stays on explicit .js/.ts specifiers so Node ESM can load the handler', () => {
    const offenders: string[] = []
    const seen = new Set<string>()
    const queue = ENTRYPOINTS.map((entry) => resolve(repoRoot, entry))

    while (queue.length > 0) {
      const file = queue.pop()
      if (!file || seen.has(file)) continue
      seen.add(file)
      for (const spec of relativeSpecifiers(readFileSync(file, 'utf8'))) {
        const label = `${file.slice(repoRoot.length + 1)} → ${spec}`
        if (!spec.endsWith('.js') && !spec.endsWith('.ts') && !spec.endsWith('.tsx')) {
          offenders.push(label)
          continue
        }
        const next = resolveModule(file, spec)
        if (!next) {
          offenders.push(`${label} (unresolved)`)
          continue
        }
        queue.push(next)
      }
    }

    expect(offenders).toEqual([])
    expect([...seen].some((file) => file.endsWith('neighborhood-slugs.ts'))).toBe(true)
    expect([...seen].some((file) => file.endsWith('neighborhood-pages.ts'))).toBe(false)
    expect([...seen].some((file) => file.endsWith('neighborhood-share.ts'))).toBe(false)
  })
})
