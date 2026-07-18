import { useMemo, useId, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { Pulse } from '@/lib/types'
import {
  buildEnergyTimelineFromPulses,
  ENERGY_TIMELINE_WINDOW_HOURS,
} from '@/lib/energy-timeline'

interface VenueEnergyTimelineProps {
  venueId: string
  currentScore: number
  /** Recent venue pulses — when present, timeline uses real report history. */
  pulses?: Pulse[]
}

function getEnergyColor(score: number): { line: string; fill: string; glow: string } {
  if (score >= 80) return { line: '#ef4444', fill: '#ef4444', glow: 'rgba(239,68,68,0.3)' }
  if (score >= 60) return { line: '#f97316', fill: '#f97316', glow: 'rgba(249,115,22,0.3)' }
  if (score >= 40) return { line: '#eab308', fill: '#eab308', glow: 'rgba(234,179,8,0.3)' }
  if (score >= 20) return { line: '#22c55e', fill: '#22c55e', glow: 'rgba(34,197,94,0.3)' }
  return { line: '#3b82f6', fill: '#3b82f6', glow: 'rgba(59,130,246,0.3)' }
}

function buildSmoothPath(
  data: number[],
  width: number,
  height: number,
  padding: { top: number; bottom: number; left: number; right: number },
): string {
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom
  const maxVal = 100
  const minVal = 0

  const points = data.map((val, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - ((val - minVal) / (maxVal - minVal)) * chartH,
  }))

  if (points.length < 2) return ''

  let d = `M ${points[0].x},${points[0].y}`

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    const tension = 0.3
    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension

    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }

  return d
}

export function VenueEnergyTimeline({ venueId, currentScore, pulses = [] }: VenueEnergyTimelineProps) {
  const uniqueId = useId()
  const gradientId = `energy-gradient-${uniqueId}`
  const glowFilterId = `glow-${uniqueId}`

  const summary = useMemo(
    () => buildEnergyTimelineFromPulses(venueId, pulses, currentScore),
    [venueId, pulses, currentScore],
  )
  const data = summary.points
  const colors = getEnergyColor(currentScore)

  const width = 360
  const height = 80
  const padding = useMemo(() => ({ top: 8, bottom: 20, left: 30, right: 10 }), [])

  const linePath = useMemo(() => buildSmoothPath(data, width, height, padding), [data, padding])

  const fillPath = useMemo(() => {
    if (!linePath) return ''
    const chartBottom = height - padding.bottom
    const firstX = padding.left
    const lastX = width - padding.right
    return `${linePath} L ${lastX},${chartBottom} L ${firstX},${chartBottom} Z`
  }, [linePath, padding.bottom, padding.left, padding.right])

  const peakIndex = summary.peakIndex

  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const getX = useCallback((i: number) => padding.left + (i / (data.length - 1)) * chartW, [chartW, data.length, padding.left])
  const getY = useCallback((val: number) => padding.top + chartH - (val / 100) * chartH, [chartH, padding.top])

  const currentX = getX(data.length - 1)
  const currentY = getY(currentScore)
  const peakX = getX(peakIndex)
  const peakY = getY(data[peakIndex] ?? 0)

  const pathLength = useMemo(() => {
    let len = 0
    for (let i = 1; i < data.length; i++) {
      const dx = getX(i) - getX(i - 1)
      const dy = getY(data[i]) - getY(data[i - 1])
      len += Math.sqrt(dx * dx + dy * dy)
    }
    return Math.ceil(len)
  }, [data, getX, getY])

  const halfWindow = ENERGY_TIMELINE_WINDOW_HOURS / 2
  const timeLabels = [
    { label: `${ENERGY_TIMELINE_WINDOW_HOURS}h ago`, x: padding.left },
    { label: `${halfWindow}h ago`, x: padding.left + chartW / 2 },
    { label: 'Now', x: width - padding.right },
  ]

  if (!summary.hasLiveHistory) {
    return (
      <section aria-label="Live review energy over the last 6 hours" className="w-full space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Energy from live reviews</h3>
          <span className="text-xs text-muted-foreground">{summary.trendLabel}</span>
        </div>
        <div
          className="flex min-h-[80px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-center"
          role="status"
        >
          <p className="text-sm font-medium">Awaiting live reviews</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            No live reviews in the last {ENERGY_TIMELINE_WINDOW_HOURS} hours.
            Leave a review to start a real energy curve — we will not invent one.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section aria-label="Live review energy over the last 6 hours" className="w-full space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Energy from live reviews</h3>
        <span className="text-xs text-muted-foreground">{summary.trendLabel}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: 80 }}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Energy trend: ${summary.trendLabel}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.fill} stopOpacity={0.3} />
            <stop offset="100%" stopColor={colors.fill} stopOpacity={0.02} />
          </linearGradient>
          <filter id={glowFilterId}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <motion.path
          d={fillPath}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        />

        <motion.path
          d={linePath}
          fill="none"
          stroke={colors.line}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${glowFilterId})`}
          initial={{ strokeDasharray: pathLength, strokeDashoffset: pathLength }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />

        {peakIndex !== data.length - 1 && (data[peakIndex] ?? 0) > 0 && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.4 }}
          >
            <text
              x={peakX}
              y={peakY - 8}
              textAnchor="middle"
              fill={colors.line}
              fontSize={8}
              fontWeight="600"
              fontFamily="monospace"
            >
              Peak
            </text>
            <circle cx={peakX} cy={peakY} r={2.5} fill={colors.line} opacity={0.7} />
          </motion.g>
        )}

        <motion.circle
          cx={currentX}
          cy={currentY}
          r={4}
          fill={colors.line}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2, type: 'spring', stiffness: 200 }}
        />
        <motion.circle
          cx={currentX}
          cy={currentY}
          r={4}
          fill="none"
          stroke={colors.line}
          strokeWidth={1.5}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0.6, 0, 0.6],
            r: [4, 10, 4],
          }}
          transition={{
            delay: 1.4,
            repeat: Infinity,
            duration: 2,
            ease: 'easeInOut',
          }}
        />

        {timeLabels.map(({ label, x }) => (
          <text
            key={label}
            x={x}
            y={height - 4}
            textAnchor={label === 'Now' ? 'end' : label.includes('6h') ? 'start' : 'middle'}
            fill="currentColor"
            className="text-muted-foreground"
            fontSize={8}
            fontFamily="monospace"
            opacity={0.5}
          >
            {label}
          </text>
        ))}
      </svg>
    </section>
  )
}
