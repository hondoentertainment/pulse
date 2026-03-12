import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccessibilityContextValue {
  /** User prefers reduced motion (OS-level setting). */
  reducedMotion: boolean
  /** System color scheme preference. */
  prefersColorScheme: 'light' | 'dark'
  /** User has high-contrast or increased-contrast enabled. */
  highContrast: boolean
  /** Push a message into the aria-live region for screen readers. */
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null)

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Consume the accessibility context.
 * Must be used within an `<AccessibilityProvider>`.
 */
export function useAccessibility(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext)
  if (!ctx) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider')
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Media query helper
// ---------------------------------------------------------------------------

function useMediaQuery(query: string, defaultValue: boolean = false): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultValue
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)

    // Set initial value (in case SSR default was wrong)
    setMatches(mql.matches)

    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface AccessibilityProviderProps {
  children: ReactNode
}

/**
 * Wraps the application with accessibility preferences derived from
 * OS-level media queries. Also renders a hidden aria-live region for
 * screen reader announcements.
 */
export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', true)
  const highContrast = useMediaQuery('(prefers-contrast: more)')

  const prefersColorScheme: 'light' | 'dark' = prefersDark ? 'dark' : 'light'

  // Announcement refs — we keep two regions (polite + assertive)
  const politeRef = useRef<HTMLDivElement>(null)
  const assertiveRef = useRef<HTMLDivElement>(null)

  const announceToScreenReader = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      const target = priority === 'assertive' ? assertiveRef.current : politeRef.current
      if (!target) return

      // Clear and re-set to force re-announcement in assistive tech
      target.textContent = ''
      requestAnimationFrame(() => {
        target.textContent = message
      })
    },
    []
  )

  const value: AccessibilityContextValue = {
    reducedMotion,
    prefersColorScheme,
    highContrast,
    announceToScreenReader,
  }

  // Visually-hidden styles (same pattern as existing accessibility.ts)
  const srOnlyStyle: React.CSSProperties = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '-1px',
    padding: 0,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  }

  return (
    <AccessibilityContext.Provider value={value}>
      {children}

      {/* Aria-live regions for screen reader announcements */}
      <div
        ref={politeRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={srOnlyStyle}
      />
      <div
        ref={assertiveRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        style={srOnlyStyle}
      />
    </AccessibilityContext.Provider>
  )
}
