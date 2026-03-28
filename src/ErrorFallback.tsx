import { useEffect } from "react";
import { Alert, AlertTitle, AlertDescription } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import { trackError } from "./lib/analytics";
import { captureError, addBreadcrumb } from "./lib/sentry";

import { AlertTriangleIcon, RefreshCwIcon, MessageSquareIcon } from "lucide-react";

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

export const ErrorFallback = ({ error, resetErrorBoundary }: ErrorFallbackProps) => {
  // In development, rethrow so Vite's error overlay is shown instead.
  if (import.meta.env.DEV) throw error;

  useEffect(() => {
    addBreadcrumb("App-level error boundary triggered", "error");
    captureError(error, { boundary: "AppRoot" });
    trackError(error, "ErrorBoundary");
  }, [error]);

  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@usepulse.app";
  const reportBody = encodeURIComponent(
    `**Error:** ${error.message}\n\n_Please describe what you were doing when this happened:_\n\n`
  );
  const reportSubject = encodeURIComponent("[Pulse] App crash report");
  const reportUrl = `mailto:${supportEmail}?subject=${reportSubject}&body=${reportBody}`;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Alert variant="destructive">
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            The app encountered an unexpected error. Your data has been saved.
            Try reloading — if the problem persists, tap &quot;Report Problem&quot; below.
          </AlertDescription>
        </Alert>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium mb-1">
            Error details
          </summary>
          <div className="bg-card border rounded-lg p-3">
            <pre className="text-xs text-destructive bg-muted/50 p-2 rounded border overflow-auto max-h-32 whitespace-pre-wrap break-words">
              {error.message}
            </pre>
          </div>
        </details>

        <div className="flex flex-col gap-2">
          <Button
            onClick={resetErrorBoundary}
            className="w-full gap-2"
            variant="default"
          >
            <RefreshCwIcon className="h-4 w-4" />
            Try Again
          </Button>

          <Button asChild variant="outline" className="w-full gap-2">
            <a href={reportUrl} target="_blank" rel="noopener noreferrer">
              <MessageSquareIcon className="h-4 w-4" />
              Report Problem
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};
