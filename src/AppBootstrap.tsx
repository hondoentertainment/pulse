import { useEffect, type ReactNode } from 'react'

import { trackError } from '@/lib/analytics'

/**
 * Lazily initialise Sentry **after** first paint.
 *
 * We deliberately avoid eager `import * as Sentry from '@sentry/react'` at module
 * load: the Sentry SDK is ~250 KB gzipped and delays Time-to-Interactive. We
 * schedule the dynamic import using `requestIdleCallback` (falling back to
 * `setTimeout` in browsers that don't support it). If the user is offline / the
 * import fails we silently fall back to the global-error listeners below.
 */
function scheduleSentryInit() {
  if (typeof window === 'undefined') return

  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return // No DSN configured → never pull in the SDK.

  const init = () => {
    // `sentry-lazy` is a narrow wrapper around `@sentry/react` that uses
    // named imports so Rollup can tree-shake the unused portions of the SDK
    // when this chunk is emitted.
    import('@/lib/sentry-lazy')
      .then((m) => m.initSentry(dsn))
      .catch(() => {
        /* Sentry is optional telemetry — a load failure should never break the
         * app. Errors keep flowing through the native listeners below. */
      })
  }

  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
  if (typeof ric === 'function') {
    ric(init, { timeout: 4000 })
  } else {
    setTimeout(init, 2000)
  }
}

/**
 * Register global error listeners — these run regardless of whether Sentry is
 * loaded. They funnel everything through `trackError()` which buffers to our
 * in-memory log and (if/when Sentry initialises) forwards to Sentry too.
 */
function registerGlobalErrorHandlers() {
  if (typeof window === 'undefined') return

  const onError = (event: ErrorEvent) => {
    if (event.error instanceof Error) {
      trackError(event.error, 'window.onerror')
      return
    }
    trackError(String(event.message || 'Unknown runtime error'), 'window.onerror')
  }

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason
    if (reason instanceof Error) {
      trackError(reason, 'window.unhandledrejection')
      return
    }
    trackError(String(reason || 'Unknown promise rejection'), 'window.unhandledrejection')
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onUnhandledRejection)

  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onUnhandledRejection)
  }
}

/**
 * AppBootstrap — performs one-shot app-level initialisation after the first
 * paint. Keeps `App.tsx` free of side-effects and avoids eager Sentry / global
 * listener registration before the React tree mounts.
 *
 * Runs once per app lifetime (strict-mode double-invocation is idempotent
 * thanks to DSN de-dup inside `scheduleSentryInit`).
 */
export function AppBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    const cleanup = registerGlobalErrorHandlers()
    scheduleSentryInit()
    return cleanup
  }, [])

  return <>{children}</>
}
