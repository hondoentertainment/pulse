import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import { useReducedMotion } from '@/components/ReducedMotionWrapper'
import type { OnboardingStep } from '@/lib/progressive-onboarding'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

interface TooltipPosition {
  top: number
  left: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTO_DISMISS_MS = 10_000
const PADDING = 8 // px gap between tooltip and target
const TOOLTIP_WIDTH = 280

function getTargetRect(selector: string): TargetRect | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector(selector)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height,
  }
}

function calcTooltipPosition(
  rect: TargetRect,
  position: OnboardingStep['position'],
): TooltipPosition {
  const vw = window.innerWidth
  const pos = position ?? 'bottom'

  let top = 0
  let left = 0

  switch (pos) {
    case 'bottom':
      top = rect.top + rect.height + PADDING
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
      break
    case 'top':
      top = rect.top - PADDING - 120 // estimated tooltip height
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
      break
    case 'left':
      top = rect.top + rect.height / 2 - 60
      left = rect.left - TOOLTIP_WIDTH - PADDING
      break
    case 'right':
      top = rect.top + rect.height / 2 - 60
      left = rect.left + rect.width + PADDING
      break
  }

  // Clamp horizontally so tooltip stays on-screen
  left = Math.max(12, Math.min(left, vw - TOOLTIP_WIDTH - 12))

  return { top, left }
}

// ---------------------------------------------------------------------------
// Spotlight cutout SVG overlay
// ---------------------------------------------------------------------------

interface SpotlightOverlayProps {
  rect: TargetRect | null
}

function SpotlightOverlay({ rect }: SpotlightOverlayProps) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 375
  const vh = typeof window !== 'undefined' ? document.documentElement.scrollHeight : 800

  if (!rect) {
    // Full darkened overlay with no cutout
    return (
      <div
        className="fixed inset-0 z-40 bg-black/60"
        style={{ pointerEvents: 'none' }}
      />
    )
  }

  const RADIUS = 10
  const r = rect

  // SVG clip-path: rectangle with a rounded cutout punched out
  const path = [
    `M0,0 H${vw} V${vh} H0 Z`,
    `M${r.left - PADDING},${r.top - PADDING}`,
    `Q${r.left - PADDING},${r.top - PADDING - RADIUS} ${r.left - PADDING + RADIUS},${r.top - PADDING - RADIUS}`,
    `H${r.left + r.width + PADDING - RADIUS}`,
    `Q${r.left + r.width + PADDING},${r.top - PADDING - RADIUS} ${r.left + r.width + PADDING},${r.top - PADDING}`,
    `V${r.top + r.height + PADDING - RADIUS}`,
    `Q${r.left + r.width + PADDING},${r.top + r.height + PADDING} ${r.left + r.width + PADDING - RADIUS},${r.top + r.height + PADDING}`,
    `H${r.left - PADDING + RADIUS}`,
    `Q${r.left - PADDING},${r.top + r.height + PADDING} ${r.left - PADDING},${r.top + r.height + PADDING - RADIUS}`,
    'Z',
  ].join(' ')

  return (
    <svg
      className="fixed inset-0 z-40"
      width={vw}
      height={vh}
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <path d={path} fill="rgba(0,0,0,0.65)" fillRule="evenodd" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Progress ring
// ---------------------------------------------------------------------------

function AutoDismissRing({ durationMs }: { durationMs: number }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      className="text-primary"
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.25"
      />
      <motion.circle
        cx="10"
        cy="10"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={`${2 * Math.PI * 8}`}
        strokeDashoffset={0}
        animate={{ strokeDashoffset: 2 * Math.PI * 8 }}
        transition={{ duration: durationMs / 1000, ease: 'linear' }}
        style={{ rotate: '-90deg', originX: '10px', originY: '10px' }}
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface FeatureTooltipProps {
  step: OnboardingStep
  onDismiss: () => void
}

export function FeatureTooltip({ step, onDismiss }: FeatureTooltipProps) {
  const reducedMotion = useReducedMotion()
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resolve target element position
  useEffect(() => {
    if (!step.targetSelector) {
      setTargetRect(null)
      return
    }

    const resolve = () => {
      const rect = getTargetRect(step.targetSelector!)
      setTargetRect(rect)
    }

    resolve()

    // Re-measure if layout shifts
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(resolve)
        : null

    const el = step.targetSelector
      ? document.querySelector(step.targetSelector)
      : null
    if (el && observer) observer.observe(el)

    return () => {
      observer?.disconnect()
    }
  }, [step.targetSelector])

  // Auto-dismiss after AUTO_DISMISS_MS
  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    onDismiss()
  }, [onDismiss])

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [dismiss, step.id])

  const tooltipPos =
    targetRect
      ? calcTooltipPosition(targetRect, step.position)
      : { top: '50%' as unknown as number, left: '50%' as unknown as number }

  const isCentered = !targetRect

  // Animation variants — respect prefers-reduced-motion
  const variants = reducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        hidden: { opacity: 0, scale: 0.85 },
        visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 320, damping: 22 } },
        exit: { opacity: 0, scale: 0.9, transition: { duration: 0.15 } },
      }

  return (
    <AnimatePresence>
      {/* Backdrop overlay */}
      <motion.div
        key={`overlay-${step.id}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
        className="fixed inset-0 z-40"
        onClick={dismiss}
        aria-hidden="true"
      >
        <SpotlightOverlay rect={targetRect} />
      </motion.div>

      {/* Tooltip card */}
      <motion.div
        key={`tooltip-${step.id}`}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        variants={variants}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={
          isCentered
            ? {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: TOOLTIP_WIDTH,
                zIndex: 50,
              }
            : {
                position: 'absolute',
                top: tooltipPos.top,
                left: tooltipPos.left,
                width: TOOLTIP_WIDTH,
                zIndex: 50,
              }
        }
        className="rounded-2xl bg-card border border-border shadow-2xl p-4 select-none"
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="font-semibold text-sm leading-tight text-foreground flex-1">
            {step.title}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <AutoDismissRing durationMs={AUTO_DISMISS_MS} />
            <button
              onClick={dismiss}
              aria-label="Dismiss tip"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          {step.description}
        </p>

        {/* Got it button */}
        <button
          onClick={dismiss}
          className="w-full text-xs font-medium py-2 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Got it
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
