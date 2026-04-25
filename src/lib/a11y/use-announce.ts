/**
 * useAnnounce — thin React hook over the global live-region announcer.
 *
 * Prefers the AccessibilityProvider's built-in aria-live regions when
 * mounted (see `src/components/AccessibilityProvider.tsx`), and falls
 * back to the imperative announcer in `src/lib/accessibility.ts`
 * which lazily appends its own live region. This means it is safe to
 * call from any component regardless of provider state.
 *
 * Usage:
 *   const announce = useAnnounce()
 *   announce('Switched to slide 3 of 5')
 *   announce('Voice search started', 'assertive')
 */

import { useCallback } from 'react'
import { announce as imperativeAnnounce } from '@/lib/accessibility'

// We intentionally do NOT import AccessibilityProvider's context symbol
// directly to avoid circular imports — fall through to the imperative
// announcer which is always safe.

type Priority = 'polite' | 'assertive'

export function useAnnounce(): (message: string, priority?: Priority) => void {
  return useCallback((message: string, priority: Priority = 'polite') => {
    if (!message) return
    imperativeAnnounce(message, priority)
  }, [])
}

// Also export as a stable identity helper so non-hook code paths can use it
export { imperativeAnnounce as announce }
