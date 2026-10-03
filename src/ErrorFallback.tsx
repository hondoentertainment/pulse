import { useEffect } from 'react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { trackError } from '@/lib/analytics'
import { AlertTriangleIcon, RefreshCwIcon } from 'lucide-react'

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  // In development, rethrow so the overlay / console stays primary for debugging.
  if (import.meta.env.DEV) throw error

  useEffect(() => {
    trackError(error, 'ErrorBoundary')
  }, [error])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md" role="alert" aria-live="assertive">
        <Alert variant="destructive" className="mb-6">
          <AlertTriangleIcon aria-hidden />
          <AlertTitle>Pulse hit a problem</AlertTitle>
          <AlertDescription>
            Something went wrong while loading the app. You can try again. If this keeps happening, refresh the page or come back later.
          </AlertDescription>
        </Alert>

        <div className="mb-6 rounded-lg border bg-card p-4">
          <h1 className="mb-2 text-sm font-semibold text-muted-foreground">Details</h1>
          <pre className="max-h-32 overflow-auto rounded border bg-muted/50 p-3 text-xs text-destructive">
            {error.message}
          </pre>
        </div>

        <Button
          onClick={resetErrorBoundary}
          className="h-12 w-full touch-manipulation active:scale-[0.98]"
          variant="outline"
          aria-label="Try again"
        >
          <RefreshCwIcon aria-hidden />
          Try again
        </Button>
      </div>
    </main>
  )
}
