import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark"
import { trackError } from "./lib/analytics"

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"

const Analytics = lazy(() => import('@vercel/analytics/react').then(module => ({ default: module.Analytics })))
const SpeedInsights = lazy(() => import('@vercel/speed-insights/react').then(module => ({ default: module.SpeedInsights })))

function isLocalPreviewHost() {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

function scheduleIdle(callback: () => void) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout: 3000 })
    return
  }
  window.setTimeout(callback, 1500)
}

function initializeSentryWhenIdle() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn || typeof window === 'undefined') return

  scheduleIdle(() => {
    import('@sentry/react')
      .then((Sentry) => {
        Sentry.init({
          dsn,
          integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration(),
          ],
          tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
          replaysSessionSampleRate: import.meta.env.PROD ? 0.01 : 0.1,
          replaysOnErrorSampleRate: 1.0,
        })
      })
      .catch((error) => {
        trackError(error instanceof Error ? error : String(error), 'sentry_init')
      })
  })
}

initializeSentryWhenIdle()

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    if (event.error instanceof Error) {
      trackError(event.error, "window.onerror")
      return
    }
    trackError(String(event.message || "Unknown runtime error"), "window.onerror")
  })

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason
    if (reason instanceof Error) {
      trackError(reason, "window.unhandledrejection")
      return
    }
    trackError(String(reason || "Unknown promise rejection"), "window.unhandledrejection")
  })
}

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient, queryPersister } from './lib/query-client'

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister }}>
      <App />
      {!isLocalPreviewHost() && (
        <Suspense fallback={null}>
          <Analytics />
          <SpeedInsights />
        </Suspense>
      )}
    </PersistQueryClientProvider>
  </ErrorBoundary>
)
