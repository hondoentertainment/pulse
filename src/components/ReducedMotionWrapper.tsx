import { useState, useEffect, type ReactNode } from 'react'
import type { Transition, MotionProps } from 'framer-motion'

// ---------------------------------------------------------------------------
// Hook: useReducedMotion
// ---------------------------------------------------------------------------

/**
 * Detect the `prefers-reduced-motion` media query.
 *
 * Tries the AccessibilityProvider context first (via a safe import) but
 * falls back to a standalone media query listener so the hook works even
 * outside the provider tree.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mql.matches)

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return reducedMotion
}

// ---------------------------------------------------------------------------
// Utility: getTransition
// ---------------------------------------------------------------------------

const INSTANT_TRANSITION: Transition = { duration: 0 }
const DEFAULT_TRANSITION: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 25,
}

/**
 * Return either a normal spring transition or an instant one depending on
 * the user's motion preference.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getTransition(
  reducedMotion: boolean,
  custom?: Transition
): Transition {
  if (reducedMotion) return INSTANT_TRANSITION
  return custom ?? DEFAULT_TRANSITION
}

// ---------------------------------------------------------------------------
// Utility: getMotionProps
// ---------------------------------------------------------------------------

/**
 * Strip timing from Framer Motion animation props when reduced motion is
 * preferred. The element will still reach its target state — it just skips
 * the animation.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getMotionProps(
  reducedMotion: boolean,
  animationProps: Partial<MotionProps>
): Partial<MotionProps> {
  if (!reducedMotion) return animationProps

  // Keep the final visual state but remove transitions / intermediate frames
  const { transition: _transition, ...rest } = animationProps

  return {
    ...rest,
    transition: INSTANT_TRANSITION,
    // Collapse initial → animate so there is no visible tween
    ...(rest.initial && rest.animate ? { initial: rest.animate } : {}),
  }
}

// ---------------------------------------------------------------------------
// Component: ReducedMotionWrapper
// ---------------------------------------------------------------------------

interface ReducedMotionWrapperProps {
  children: (reducedMotion: boolean) => ReactNode
  /** Force a value instead of reading from the media query. */
  forceReducedMotion?: boolean
}

/**
 * Render-prop wrapper that provides the current `reducedMotion` flag to its
 * children. When reduced motion is preferred, children can skip or simplify
 * their Framer Motion animations.
 *
 * @example
 * ```tsx
 * <ReducedMotionWrapper>
 *   {(reducedMotion) => (
 *     <motion.div {...getMotionProps(reducedMotion, { initial: { opacity: 0 }, animate: { opacity: 1 } })} />
 *   )}
 * </ReducedMotionWrapper>
 * ```
 */
export function ReducedMotionWrapper({
  children,
  forceReducedMotion,
}: ReducedMotionWrapperProps) {
  const detected = useReducedMotion()
  const reducedMotion = forceReducedMotion ?? detected

  return <>{children(reducedMotion)}</>
}
