import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { motion, useInView, type Transition } from 'framer-motion'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// 1. ConfettiExplosion
// ---------------------------------------------------------------------------

interface ConfettiExplosionProps {
  trigger: boolean
  colors?: string[]
  particleCount?: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  rotationSpeed: number
  opacity: number
}

const DEFAULT_CONFETTI_COLORS = [
  '#ff6b6b',
  '#feca57',
  '#48dbfb',
  '#ff9ff3',
  '#54a0ff',
  '#5f27cd',
  '#01a3a4',
  '#f368e0',
]

export function ConfettiExplosion({
  trigger,
  colors = DEFAULT_CONFETTI_COLORS,
  particleCount = 50,
}: ConfettiExplosionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])

  const createParticles = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: centerX,
      y: centerY,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * -14 - 4,
      size: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
    }))
  }, [colors, particleCount])

  const animate = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    let alive = false

    for (const p of particlesRef.current) {
      if (p.opacity <= 0) continue
      alive = true

      p.vy += 0.35 // gravity
      p.x += p.vx
      p.y += p.vy
      p.rotation += p.rotationSpeed
      p.opacity -= 0.012
      p.vx *= 0.99 // air resistance

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.globalAlpha = Math.max(0, p.opacity)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      ctx.restore()
    }

    if (alive) {
      animationRef.current = requestAnimationFrame(animate)
    }
  }, [])

  useEffect(() => {
    if (!trigger) return

    createParticles()
    cancelAnimationFrame(animationRef.current)
    animationRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [trigger, createParticles, animate])

  // Resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        canvas.width = width
        canvas.height = height
      }
    })

    const parent = canvas.parentElement
    if (parent) {
      resizeObserver.observe(parent)
      canvas.width = parent.clientWidth
      canvas.height = parent.clientHeight
    }

    return () => resizeObserver.disconnect()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-50"
      aria-hidden="true"
    />
  )
}

// ---------------------------------------------------------------------------
// 2. AnimatedCounter
// ---------------------------------------------------------------------------

interface AnimatedCounterProps {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
  className?: string
}

function formatWithCommas(n: number): string {
  return Math.round(n).toLocaleString()
}

export function AnimatedCounter({
  value,
  duration = 600,
  prefix = '',
  suffix = '',
  className,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(value)
  const prevValueRef = useRef(value)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const from = prevValueRef.current
    const to = value
    prevValueRef.current = value

    if (from === to) return

    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = from + (to - from) * eased

      setDisplay(current)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(tick)
      }
    }

    cancelAnimationFrame(animationRef.current)
    animationRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [value, duration])

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}
      {formatWithCommas(display)}
      {suffix}
    </span>
  )
}

// ---------------------------------------------------------------------------
// 3. SpringButton
// ---------------------------------------------------------------------------

interface SpringButtonProps {
  children: ReactNode
  haptic?: 'light' | 'medium'
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  'aria-label'?: string
}

const SPRING_TRANSITION: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 17,
}

export function SpringButton({
  children,
  haptic,
  className,
  onClick,
  ...rest
}: SpringButtonProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (haptic && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(haptic === 'light' ? 10 : 25)
      }
      onClick?.(e)
    },
    [haptic, onClick],
  )

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      transition={SPRING_TRANSITION}
      onClick={handleClick}
      className={className}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

// ---------------------------------------------------------------------------
// 4. PulseGlow
// ---------------------------------------------------------------------------

interface PulseGlowProps {
  children: ReactNode
  color?: string
  active?: boolean
  className?: string
}

export function PulseGlow({
  children,
  color = '#a855f7',
  active = true,
  className,
}: PulseGlowProps) {
  return (
    <div className={cn('relative inline-flex', className)}>
      {active && (
        <span
          className="absolute inset-0 -z-10 animate-pulse-glow rounded-[inherit]"
          style={
            {
              '--glow-color': color,
              boxShadow: `0 0 12px 4px ${color}`,
            } as React.CSSProperties
          }
          aria-hidden="true"
        />
      )}
      {children}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. SlideReveal
// ---------------------------------------------------------------------------

interface SlideRevealProps {
  children: ReactNode
  delay?: number
  direction?: 'up' | 'left' | 'right'
  className?: string
}

const DIRECTION_OFFSETS = {
  up: { x: 0, y: 30 },
  left: { x: 30, y: 0 },
  right: { x: -30, y: 0 },
} as const

export function SlideReveal({
  children,
  delay = 0,
  direction = 'up',
  className,
}: SlideRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const offset = DIRECTION_OFFSETS[direction]

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      animate={inView ? { opacity: 1, x: 0, y: 0 } : undefined}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// 6. ShimmerText
// ---------------------------------------------------------------------------

interface ShimmerTextProps {
  children: string
  className?: string
}

export function ShimmerText({ children, className }: ShimmerTextProps) {
  return (
    <>
      <span
        className={cn('shimmer-text inline-block bg-clip-text', className)}
        style={{
          backgroundImage:
            'linear-gradient(90deg, currentColor 0%, currentColor 40%, #fff 50%, currentColor 60%, currentColor 100%)',
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        }}
      >
        {children}
      </span>
      <style>{`
        @keyframes shimmer-sweep {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        .shimmer-text {
          animation: shimmer-sweep 3s ease-in-out infinite;
        }
      `}</style>
    </>
  )
}

// ---------------------------------------------------------------------------
// 7. FloatingEmoji
// ---------------------------------------------------------------------------

interface FloatingEmojiProps {
  emoji: string
  onComplete?: () => void
}

export function FloatingEmoji({ emoji, onComplete }: FloatingEmojiProps) {
  return (
    <motion.span
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -100, scale: [1, 1.4, 0.8] }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
      onAnimationComplete={onComplete}
      className="pointer-events-none inline-block text-2xl"
      aria-hidden="true"
    >
      {emoji}
    </motion.span>
  )
}
