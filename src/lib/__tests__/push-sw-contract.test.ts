import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('push service worker glance contract', () => {
  it.each(['public/push-sw.js', 'public/sw.js'])('%s honors kind, tag, renotify, icon, and click', (path) => {
    const js = source(path)
    expect(js).toContain('extra.kind')
    expect(js).toContain('extra.tag')
    expect(js).toContain('extra.renotify === true')
    expect(js).toContain("icon: '/icons/icon-192.png'")
    expect(js).toContain("badge: '/icons/badge-72.png'")
    expect(js).toContain('showNotification')
    expect(js).toContain('openWindow')
    expect(js).toContain('indexOf(url)')
  })
})
