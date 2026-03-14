import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark"
import { trackError } from "./lib/analytics"

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

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

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
   </ErrorBoundary>
)
