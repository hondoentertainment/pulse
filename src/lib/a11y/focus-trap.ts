/**
 * Focus trap + focus-restoration utilities.
 *
 * Most dialogs in this app use Radix (@radix-ui/react-dialog), which
 * already implements a robust focus trap + Escape + restore-focus.
 * These helpers are for the few custom overlays/sheets that don't use
 * Radix (e.g. StoryViewer, MapVenueSheet), and for imperative flows.
 *
 * Usage:
 *   const cleanup = trapFocus(containerEl)
 *   // ...when closing:
 *   cleanup()
 *   restoreFocus(previouslyFocusedEl)
 */

import { trapFocus as baseTrapFocus } from '@/lib/accessibility'

/**
 * Re-export the existing trapFocus helper so components can import from
 * a single `@/lib/a11y` namespace.
 */
export const trapFocus = baseTrapFocus

/**
 * Capture the currently-focused element so it can be restored when a
 * modal/overlay closes. Returns a function that restores focus.
 *
 * Typical usage inside a modal component:
 *   useEffect(() => {
 *     if (!open) return
 *     const restore = saveFocus()
 *     return () => restore()
 *   }, [open])
 */
export function saveFocus(): () => void {
  if (typeof document === 'undefined') return () => {}
  const previous = document.activeElement as HTMLElement | null
  return () => {
    if (previous && typeof previous.focus === 'function') {
      // Use rAF so restoration runs after the overlay has torn down
      requestAnimationFrame(() => {
        try {
          previous.focus()
        } catch {
          /* element may be gone */
        }
      })
    }
  }
}

/**
 * Manually restore focus to a given element. Useful when the caller
 * already has a ref to the trigger.
 */
export function restoreFocus(element: HTMLElement | null | undefined): void {
  if (!element || typeof element.focus !== 'function') return
  requestAnimationFrame(() => {
    try {
      element.focus()
    } catch {
      /* element may be gone */
    }
  })
}

/**
 * Bind Escape-to-close onto a container. Returns cleanup.
 */
export function onEscape(
  container: HTMLElement | Document,
  onClose: () => void
): () => void {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }
  container.addEventListener('keydown', handler as EventListener)
  return () => container.removeEventListener('keydown', handler as EventListener)
}
