/**
 * RouteErrorBoundary — Per-route error containment
 *
 * Wraps individual tabs/routes so a crash in one section never takes down
 * the entire app. Reports errors to Sentry with route context and provides
 * a friendly recovery UI with retry and problem-reporting options.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangleIcon, RefreshCwIcon, MessageSquareIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { captureError, addBreadcrumb } from '@/lib/sentry'
import { trackError } from '@/lib/analytics'

// ── Props & State ──────────────────────────────────────────────────────────

interface RouteErrorBoundaryProps {
  /** Human-readable route name shown in error messages and sent to Sentry */
  routeName: string
  children: ReactNode
  /** Optional custom fallback to render instead of the default error UI */
  fallback?: (props: FallbackProps) => ReactNode
}

interface FallbackProps {
  error: Error
  routeName: string
  reset: () => void
}

interface RouteErrorBoundaryState {
  error: Error | null
  eventId: string | null
}

// ── Error Boundary class component ────────────────────────────────────────
// React error boundaries must be class components (as of React 19)

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props)
    this.state = { error: null, eventId: null }
  }

  static getDerivedStateFromError(error: Error): Partial<RouteErrorBoundaryState> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    const { routeName } = this.props

    addBreadcrumb(
      `Route "${routeName}" crashed`,
      'error',
      { componentStack: info.componentStack ?? undefined }
    )

    // Report to Sentry with route context
    captureError(error, {
      route: routeName,
      componentStack: info.componentStack ?? undefined,
    })

    // Also track via the analytics pipeline for funnel analysis
    trackError(error, `RouteErrorBoundary:${routeName}`)
  }

  reset = (): void => {
    addBreadcrumb(`User retried route "${this.props.routeName}"`, 'ui')
    this.setState({ error: null, eventId: null })
  }

  override render(): ReactNode {
    const { error } = this.state
    const { routeName, children, fallback } = this.props

    if (!error) return children

    if (fallback) {
      return fallback({ error, routeName, reset: this.reset })
    }

    return (
      <RouteErrorFallback
        error={error}
        routeName={routeName}
        reset={this.reset}
      />
    )
  }
}

// ── Default fallback UI ────────────────────────────────────────────────────

function RouteErrorFallback({ error, routeName, reset }: FallbackProps) {
  // In development, rethrow so the browser's error overlay is shown instead
  if (import.meta.env.DEV) throw error

  const reportUrl = buildReportUrl(routeName, error)

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 gap-4">
      <div className="w-full max-w-sm space-y-4">
        <Alert variant="destructive">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Something went wrong in {routeName}</AlertTitle>
          <AlertDescription>
            This section ran into an unexpected error. The rest of the app is still
            working — tap &quot;Try Again&quot; to reload just this part.
          </AlertDescription>
        </Alert>

        {/* Collapsed error detail for power users */}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium mb-1">
            Error details
          </summary>
          <pre className="bg-muted/60 rounded p-3 overflow-auto max-h-32 whitespace-pre-wrap break-words">
            {error.message}
          </pre>
        </details>

        <div className="flex flex-col gap-2">
          <Button onClick={reset} variant="default" className="w-full gap-2">
            <RefreshCwIcon className="h-4 w-4" />
            Try Again
          </Button>

          <Button
            asChild
            variant="outline"
            className="w-full gap-2"
          >
            <a href={reportUrl} target="_blank" rel="noopener noreferrer">
              <MessageSquareIcon className="h-4 w-4" />
              Report Problem
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildReportUrl(routeName: string, error: Error): string {
  const body = encodeURIComponent(
    `**Route:** ${routeName}\n**Error:** ${error.message}\n\n_Please describe what you were doing when this happened:_\n\n`
  )
  const subject = encodeURIComponent(`[Pulse] Error in ${routeName}`)
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'support@usepulse.app'
  return `mailto:${supportEmail}?subject=${subject}&body=${body}`
}
