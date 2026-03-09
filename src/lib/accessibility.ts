/**
 * Accessibility Engine
 *
 * ARIA helpers, keyboard navigation, focus management,
 * screen reader announcements, and high contrast mode.
 */

/**
 * Live announce a message to screen readers.
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  if (typeof document === 'undefined') return

  let announcer = document.getElementById(`sr-announcer-${priority}`)
  if (!announcer) {
    announcer = document.createElement('div')
    announcer.id = `sr-announcer-${priority}`
    announcer.setAttribute('role', 'status')
    announcer.setAttribute('aria-live', priority)
    announcer.setAttribute('aria-atomic', 'true')
    Object.assign(announcer.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      margin: '-1px',
      padding: '0',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0',
    })
    document.body.appendChild(announcer)
  }

  // Clear and set to force re-announcement
  announcer.textContent = ''
  requestAnimationFrame(() => {
    announcer!.textContent = message
  })
}

/**
 * Generate ARIA label for venue energy score.
 */
export function getEnergyAriaLabel(score: number, label: string, venueName: string): string {
  return `${venueName} energy level: ${label}, score ${score} out of 100`
}

/**
 * Generate ARIA label for pulse reactions.
 */
export function getReactionAriaLabel(
  reactions: Record<string, number>,
  userHasReacted: Record<string, boolean>
): string {
  const parts: string[] = []
  for (const [type, count] of Object.entries(reactions)) {
    if (count > 0) {
      const reacted = userHasReacted[type] ? ', you reacted' : ''
      parts.push(`${count} ${type} reaction${count !== 1 ? 's' : ''}${reacted}`)
    }
  }
  return parts.length > 0 ? parts.join(', ') : 'No reactions yet'
}

/**
 * Generate ARIA label for notification badge.
 */
export function getNotificationAriaLabel(count: number): string {
  if (count === 0) return 'Notifications, no unread'
  return `Notifications, ${count} unread`
}

/**
 * Trap focus within a container (for modals/dialogs).
 * Returns cleanup function.
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusable = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
  }

  container.addEventListener('keydown', handler)
  first?.focus()

  return () => container.removeEventListener('keydown', handler)
}

/**
 * Handle roving tabindex for arrow key navigation in groups.
 * Commonly used for tab bars, radio groups, etc.
 */
export function rovingTabIndex(
  container: HTMLElement,
  selector: string,
  orientation: 'horizontal' | 'vertical' = 'horizontal'
): () => void {
  const items = container.querySelectorAll<HTMLElement>(selector)
  if (items.length === 0) return () => {}

  // Initialize tabindex
  items.forEach((item, i) => {
    item.setAttribute('tabindex', i === 0 ? '0' : '-1')
  })

  const handler = (e: KeyboardEvent) => {
    const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
    const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'

    if (e.key !== nextKey && e.key !== prevKey && e.key !== 'Home' && e.key !== 'End') return

    e.preventDefault()
    const currentIndex = Array.from(items).indexOf(e.target as HTMLElement)
    if (currentIndex === -1) return

    let nextIndex: number
    if (e.key === nextKey) {
      nextIndex = (currentIndex + 1) % items.length
    } else if (e.key === prevKey) {
      nextIndex = (currentIndex - 1 + items.length) % items.length
    } else if (e.key === 'Home') {
      nextIndex = 0
    } else {
      nextIndex = items.length - 1
    }

    items[currentIndex].setAttribute('tabindex', '-1')
    items[nextIndex].setAttribute('tabindex', '0')
    items[nextIndex].focus()
  }

  container.addEventListener('keydown', handler)
  return () => container.removeEventListener('keydown', handler)
}

/**
 * Skip-to-content link helper.
 */
export function createSkipLink(targetId: string, text: string = 'Skip to main content'): HTMLElement {
  const link = document.createElement('a')
  link.href = `#${targetId}`
  link.textContent = text
  link.className = 'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:bg-background focus:text-foreground focus:px-4 focus:py-2 focus:rounded-md focus:ring-2 focus:ring-accent'
  return link
}

export type HighContrastMode = 'off' | 'high' | 'increased'

const HIGH_CONTRAST_KEY = 'pulse_high_contrast'

/**
 * Get current high contrast setting.
 */
export function getHighContrastMode(): HighContrastMode {
  try {
    return (localStorage.getItem(HIGH_CONTRAST_KEY) as HighContrastMode) ?? 'off'
  } catch {
    return 'off'
  }
}

/**
 * Set high contrast mode and apply CSS class.
 */
export function setHighContrastMode(mode: HighContrastMode): void {
  try {
    localStorage.setItem(HIGH_CONTRAST_KEY, mode)
  } catch { /* localStorage may not be available */ }

  const root = document.documentElement
  root.classList.remove('high-contrast', 'increased-contrast')
  if (mode === 'high') root.classList.add('high-contrast')
  else if (mode === 'increased') root.classList.add('increased-contrast')
}

/**
 * Initialize high contrast mode from stored preference.
 */
export function initHighContrast(): void {
  const mode = getHighContrastMode()
  if (mode !== 'off') setHighContrastMode(mode)

  // Also check system preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-contrast: more)')
    if (mq.matches && mode === 'off') {
      setHighContrastMode('increased')
    }
  }
}

/**
 * Check if reduced motion is preferred.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
