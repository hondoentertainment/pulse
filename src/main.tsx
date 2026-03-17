import { createRoot } from 'react-dom/client'
import "@github/spark/spark"

import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { initErrorTracking } from './lib/error-tracking.ts'
import { initPerformanceMonitoring } from './lib/performance-monitor.ts'
import { logger, setCorrelationId, generateCorrelationId } from './lib/logger.ts'
import { startSession, trackFunnelStep } from './lib/analytics.ts'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// ---------------------------------------------------------------------------
// Bootstrap observability
// ---------------------------------------------------------------------------

// Assign a correlation ID for this page load
setCorrelationId(generateCorrelationId())

// Initialize error tracking (console-based by default; swap for Sentry later)
initErrorTracking({
  environment: import.meta.env.MODE ?? 'development',
  release: import.meta.env.VITE_APP_VERSION as string | undefined,
  sampleRate: 1.0,
})

// Start web-vitals collection
initPerformanceMonitoring()

// Begin an analytics session and record the app-open funnel step
startSession()
trackFunnelStep('app_open')

logger.info('Application starting', 'main')

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
