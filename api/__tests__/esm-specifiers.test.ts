import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const apiRoot = join(dirnameFromMeta(import.meta.url), '..')

function dirnameFromMeta(metaUrl: string): string {
  return fileURLToPath(new URL('.', metaUrl))
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue
      out.push(...walkTsFiles(full))
      continue
    }
    if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

function relativeSpecifiers(source: string): string[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  return [...withoutComments.matchAll(/from\s+['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)]
    .map((match) => match[1] ?? match[2])
}

describe('api/ ESM relative specifiers', () => {
  it('production handlers and _lib use explicit .js/.ts relative specifiers', () => {
    const files = walkTsFiles(apiRoot)
    expect(files.length).toBeGreaterThan(20)

    const offenders: string[] = []
    for (const file of files) {
      const specs = relativeSpecifiers(readFileSync(file, 'utf8'))
      for (const spec of specs) {
        if (!spec.endsWith('.js') && !spec.endsWith('.ts')) {
          offenders.push(`${relative(apiRoot, file)} → ${spec}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
