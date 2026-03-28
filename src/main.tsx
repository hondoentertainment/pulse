import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark"
import { trackError } from "./lib/analytics"
import { initWebVitals } from "./lib/performance"
import { registerSentry } from "./lib/sentry"
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// Defer Sentry until the browser is idle so it doesn't block first paint.
// Falls back to setTimeout on browsers without requestIdleCallback (Safari <16).
if (typeof window !== 'undefined') {
  const initSentry = () => {
    if (!import.meta.env.VITE_SENTRY_DSN) return
    import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN as string,
        environment: import.meta.env.MODE,
        release: (import.meta.env.VITE_APP_VERSION as string | undefined) || '0.0.0',
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
        ],
        tracePropagationTargets: ['localhost', /^\//],
        // Full traces in dev; 10% in prod to control costs
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        beforeSend(event) {
          // Strip PII before events leave the browser
          if (event.user) {
            delete event.user.email
            delete event.user.ip_address
          }
          return event
        },
      });
      // Register SDK reference so lib/sentry.ts helpers work throughout the app
      registerSentry(Sentry);
    });
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(initSentry, { timeout: 5000 });
  } else {
    setTimeout(initSentry, 3000);
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
import { queryClient, queryPersister } from './lib/query-client'

// Start collecting Web Vitals immediately after first paint
initWebVitals()

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister }}>
      <App />
      <Analytics />
      <SpeedInsights />
    </PersistQueryClientProvider>
  </ErrorBoundary>
)
