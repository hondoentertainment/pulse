import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import { QueryClientProvider } from '@tanstack/react-query'

import App from './App.tsx'
import { AppBootstrap } from './AppBootstrap.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { queryClient } from './lib/query-client'

import './main.css'

// Spark workbench runtime is serve-only. Production Signal must not pull it
// onto first paint. Venue persist lives in AppProviders, not this entry.
if (import.meta.env.DEV) {
  void import('@github/spark/spark')
}

const Analytics = lazy(() =>
  import('@vercel/analytics/react').then((module) => ({ default: module.Analytics })),
)
const SpeedInsights = lazy(() =>
  import('@vercel/speed-insights/react').then((module) => ({ default: module.SpeedInsights })),
)

function isLocalPreviewHost() {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <AppBootstrap>
      <QueryClientProvider client={queryClient}>
        <App />
        {!isLocalPreviewHost() && (
          <Suspense fallback={null}>
            <Analytics />
            <SpeedInsights />
          </Suspense>
        )}
      </QueryClientProvider>
    </AppBootstrap>
  </ErrorBoundary>,
)
