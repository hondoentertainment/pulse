/**
 * use-deep-links — handle `pulse://` custom-scheme opens and Universal Links.
 *
 * Web is a no-op. On native, listens to Capacitor's App plugin for url-open
 * events and routes via react-router.
 *
 * Supported paths:
 *   pulse://venue/:id          → /venue/:id
 *   pulse://pulse/:id          → /?pulse=:id (trending tab highlighted)
 *   pulse://crew/:id           → /crews?crew=:id
 *   pulse://event/:id          → /events?event=:id
 *   pulse://safety/session/:id → /?safety=:id
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isNative, loadNativeModule } from '@/lib/platform'

interface AppModule {
  App: {
    addListener: (
      evt: string,
      cb: (event: { url: string }) => void,
    ) => Promise<{ remove?: () => void }>
  }
}

type UnsubscribeFn = () => void

export function useDeepLinks(): void {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isNative()) return

    let cleanup: UnsubscribeFn | null = null
    let cancelled = false

    ;(async () => {
      try {
        const { App } = await loadNativeModule<AppModule>('@capacitor/app')
        const handler = await App.addListener('appUrlOpen', (event) => {
          const target = resolveDeepLink(event.url)
          if (target) navigate(target, { replace: false })
        })
        if (cancelled) {
          handler.remove?.()
          return
        }
        cleanup = () => {
          handler.remove?.()
        }
      } catch (err) {
        console.warn('[deep-links] listener setup failed', err)
      }
    })()

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [navigate])
}

/**
 * Resolve a deep link URL to an internal router path.
 * Exposed for unit tests.
 */
export function resolveDeepLink(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    const scheme = url.protocol.replace(':', '').toLowerCase()
    const host = url.hostname.toLowerCase()
    // pulse://venue/123  → URL parses host=venue, path=/123
    // pulse://safety/session/abc → host=safety, path=/session/abc
    // https://app.pulse.nightlife/venue/123 → host=app.pulse.nightlife, path=/venue/123
    const isCustomScheme = scheme === 'pulse'
    const segments = isCustomScheme
      ? [host, ...url.pathname.split('/').filter(Boolean)]
      : url.pathname.split('/').filter(Boolean)

    const [root, ...rest] = segments
    switch (root) {
      case 'venue': {
        const id = rest[0]
        if (!id) return null
        return `/venue/${encodeURIComponent(id)}`
      }
      case 'pulse': {
        const id = rest[0]
        if (!id) return null
        return `/?pulse=${encodeURIComponent(id)}`
      }
      case 'crew': {
        const id = rest[0]
        if (!id) return null
        return `/crews?crew=${encodeURIComponent(id)}`
      }
      case 'event': {
        const id = rest[0]
        if (!id) return null
        return `/events?event=${encodeURIComponent(id)}`
      }
      case 'safety': {
        if (rest[0] !== 'session' || !rest[1]) return null
        return `/?safety=${encodeURIComponent(rest[1])}`
      }
      default:
        return null
    }
  } catch {
    return null
  }
}
