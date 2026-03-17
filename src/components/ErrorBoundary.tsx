import { Component, type ErrorInfo, type ReactNode } from 'react'
import { captureException, addBreadcrumb } from '@/lib/error-tracking'
import { logger } from '@/lib/logger'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * Application-level error boundary that catches render errors,
 * reports them to the centralized error tracker, and displays
 * a user-friendly recovery screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })

    captureException(error, {
      componentStack: errorInfo.componentStack ?? undefined,
      boundary: 'ErrorBoundary',
    })

    logger.error('Uncaught render error', 'ErrorBoundary', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    })

    addBreadcrumb('error', 'Error boundary caught a render error', {
      errorMessage: error.message,
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const { error, errorInfo } = this.state
      const isDev = import.meta.env.DEV

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            background: '#0a0a0b',
            color: '#e4e4e7',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div style={{ maxWidth: '28rem', width: '100%', textAlign: 'center' }}>
            {/* Icon */}
            <div
              style={{
                width: '4rem',
                height: '4rem',
                margin: '0 auto 1.5rem',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                marginBottom: '0.75rem',
                color: '#fafafa',
              }}
            >
              Something went wrong
            </h1>

            <p
              style={{
                fontSize: '0.95rem',
                color: '#a1a1aa',
                marginBottom: '2rem',
                lineHeight: 1.6,
              }}
            >
              An unexpected error occurred. You can try reloading the app to
              continue.
            </p>

            {/* Dev-only error details */}
            {isDev && error && (
              <div
                style={{
                  textAlign: 'left',
                  marginBottom: '1.5rem',
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  maxHeight: '16rem',
                  overflow: 'auto',
                }}
              >
                <p
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#71717a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.5rem',
                  }}
                >
                  Error Details (dev only)
                </p>
                <pre
                  style={{
                    fontSize: '0.8rem',
                    color: '#ef4444',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                  }}
                >
                  {error.message}
                </pre>
                {error.stack && (
                  <pre
                    style={{
                      fontSize: '0.7rem',
                      color: '#71717a',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      marginTop: '0.75rem',
                    }}
                  >
                    {error.stack}
                  </pre>
                )}
                {errorInfo?.componentStack && (
                  <pre
                    style={{
                      fontSize: '0.7rem',
                      color: '#71717a',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      marginTop: '0.75rem',
                    }}
                  >
                    {errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <button
              onClick={this.handleReset}
              style={{
                width: '100%',
                padding: '0.75rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#fafafa',
                background: '#7c3aed',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseOver={(e) =>
                ((e.target as HTMLButtonElement).style.background = '#6d28d9')
              }
              onMouseOut={(e) =>
                ((e.target as HTMLButtonElement).style.background = '#7c3aed')
              }
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
