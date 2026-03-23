import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark"
import { trackError } from "./lib/analytics"
import * as Sentry from '@sentry/react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

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
      <Analytics />
      <SpeedInsights />
    </PersistQueryClientProvider>
  </ErrorBoundary>
)
