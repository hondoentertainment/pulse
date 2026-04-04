import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark"
import { trackError } from "./lib/analytics"
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// Lazy-load Sentry after first render to reduce initial bundle size (~257 KB)
if (typeof window !== 'undefined') {
  const initSentry = () => {
    import('@sentry/react').then(Sentry => {
      Sentry.init({
        // Use a placeholder if no DSN is provided
        dsn: import.meta.env.VITE_SENTRY_DSN || '',
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration(),
        ],
        tracesSampleRate: 1.0,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
      })
    })
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(initSentry)
  } else {
    setTimeout(initSentry, 1)
  }
}

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
import { queryClient, queryPersister, CACHE_MAX_AGE } from './lib/query-client'
import { BrowserRouter } from 'react-router-dom'

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister, maxAge: CACHE_MAX_AGE }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Analytics />
      <SpeedInsights />
    </PersistQueryClientProvider>
  </ErrorBoundary>
)
