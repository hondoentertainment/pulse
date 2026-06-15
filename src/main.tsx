import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import '@github/spark/spark'

import App from './App.tsx'
import { AppBootstrap } from './AppBootstrap.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import './main.css'

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

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient, queryPersister } from './lib/query-client'

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <AppBootstrap>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister }}>
        <App />
        {!isLocalPreviewHost() && (
          <Suspense fallback={null}>
            <Analytics />
            <SpeedInsights />
          </Suspense>
        )}
      </PersistQueryClientProvider>
    </AppBootstrap>
  </ErrorBoundary>,
)
