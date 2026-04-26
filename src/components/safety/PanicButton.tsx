import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Warning, ShieldWarning } from '@phosphor-icons/react'

import { cn } from '@/lib/utils'

export interface PanicButtonProps {
  /** Milliseconds the user must hold the button. Default 3000. */
  holdDurationMs?: number
  /** Fired when the hold completes successfully. */
  onTrigger: () => void
  /** Optional disabled state e.g. while a previous trigger is in flight. */
  disabled?: boolean
  /** Custom label for the resting state. */
  label?: string
}

/**
 * Large hold-to-fire button. 3-second hold defeats pocket dials. The component
 * never fires on a single tap - the user must maintain press for the full
 * duration. Releasing early cancels cleanly.
 */
export function PanicButton(props: PanicButtonProps) {
  const holdDurationMs = props.holdDurationMs ?? 3000
  const [progress, setProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const [fired, setFired] = useState(false)
  const frameRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)
  const firedRef = useRef<boolean>(false)

  const clearFrame = useCallback(() => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const onDown = useCallback(() => {
    if (props.disabled || firedRef.current) return
    setIsHolding(true)
    setProgress(0)
    startRef.current = performance.now()
    const step = () => {
      const elapsed = performance.now() - startRef.current
      const next = Math.min(1, elapsed / holdDurationMs)
      setProgress(next)
      if (next >= 1) {
        firedRef.current = true
        setFired(true)
        setIsHolding(false)
        props.onTrigger()
        return
      }
      frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
  }, [holdDurationMs, props])

  const onUp = useCallback(() => {
    if (firedRef.current) return
    setIsHolding(false)
    setProgress(0)
    clearFrame()
  }, [clearFrame])

  useEffect(() => () => clearFrame(), [clearFrame])

  useEffect(() => {
    if (!fired) return
    const t = setTimeout(() => {
      firedRef.current = false
      setFired(false)
    }, 2500)
    return () => clearTimeout(t)
  }, [fired])

  const secondsRemaining = Math.max(0, Math.ceil((holdDurationMs * (1 - progress)) / 1000))

  return (
    <button
      type="button"
      disabled={props.disabled}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
      aria-label="Panic button. Hold to alert your emergency contacts."
      aria-pressed={isHolding}
      aria-disabled={props.disabled}
      className={cn(
        'relative w-full h-20 rounded-xl font-semibold text-base overflow-hidden',
        'bg-destructive text-white shadow-lg',
        'active:scale-[0.99] transition-transform',
        'disabled:opacity-50 disabled:pointer-events-none',
      )}
      data-testid="panic-button"
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 bg-white/25 transition-none"
        style={{ width: `${progress * 100}%` }}
      />
      <div className="relative flex items-center justify-center gap-3">
        <AnimatePresence mode="wait" initial={false}>
          {fired ? (
            <motion.div
              key="fired"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <ShieldWarning size={22} weight="fill" />
              Alert sent
            </motion.div>
          ) : isHolding ? (
            <motion.div
              key="holding"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <Warning size={22} weight="fill" />
              Keep holding… {secondsRemaining}s
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <Warning size={22} weight="fill" />
              {props.label ?? 'Hold 3s to alert contacts'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </button>
  )
}
