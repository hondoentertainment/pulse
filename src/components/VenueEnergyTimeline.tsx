import { useMemo, useId } from 'react'
import { motion } from 'framer-motion'

interface VenueEnergyTimelineProps {
  venueId: string
  currentScore: number
}

function getEnergyColor(score: number): { line: string; fill: string; glow: string } {
  if (score >= 80) return { line: '#ef4444', fill: '#ef4444', glow: 'rgba(239,68,68,0.3)' }
  if (score >= 60) return { line: '#f97316', fill: '#f97316', glow: 'rgba(249,115,22,0.3)' }
  if (score >= 40) return { line: '#eab308', fill: '#eab308', glow: 'rgba(234,179,8,0.3)' }
  if (score >= 20) return { line: '#22c55e', fill: '#22c55e', glow: 'rgba(34,197,94,0.3)' }
  return { line: '#3b82f6', fill: '#3b82f6', glow: 'rgba(59,130,246,0.3)' }
}

function generateHistoricalData(venueId: string, currentScore: number): number[] {
  // Seeded random based on venueId for consistency
  let seed = 0
  for (let i = 0; i < venueId.length; i++) {
    seed = ((seed << 5) - seed + venueId.charCodeAt(i)) | 0
  }
  const seededRandom = () => {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed & 0x7fffffff) / 2147483647
  }

  const points = 12
  const data: number[] = []

  // Start low, build up to current score to simulate buildup
  const baseStart = Math.max(5, currentScore * 0.15)

  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1)
    // Exponential buildup curve with random noise
    const base = baseStart + (currentScore - baseStart) * Math.pow(progress, 1.5)
    const noise = (seededRandom() - 0.5) * currentScore * 0.2
    data.push(Math.max(0, Math.min(100, Math.round(base + noise))))
  }

  // Ensure last point is exactly the current score
  data[data.length - 1] = currentScore

  return data
}

function buildSmoothPath(
  data: number[],
  width: number,
  height: number,
  padding: { top: number; bottom: number; left: number; right: number }
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

export function VenueEnergyTimeline({ venueId, currentScore }: VenueEnergyTimelineProps) {
  const uniqueId = useId()
  const gradientId = `energy-gradient-${uniqueId}`
  const glowFilterId = `glow-${uniqueId}`

  const data = useMemo(() => generateHistoricalData(venueId, currentScore), [venueId, currentScore])
  const colors = getEnergyColor(currentScore)

  const width = 360
  const height = 80
  const padding = { top: 8, bottom: 20, left: 30, right: 10 }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const linePath = useMemo(() => buildSmoothPath(data, width, height, padding), [data])

  // Build fill path (line + close at bottom)
  const fillPath = useMemo(() => {
    if (!linePath) return ''
    const chartBottom = height - padding.bottom
    const firstX = padding.left
    const lastX = width - padding.right
    return `${linePath} L ${lastX},${chartBottom} L ${firstX},${chartBottom} Z`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linePath])

  // Find peak point
  const peakIndex = useMemo(() => {
    let maxI = 0
    for (let i = 1; i < data.length; i++) {
      if (data[i] > data[maxI]) maxI = i
    }
    return maxI
  }, [data])

  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const getX = (i: number) => padding.left + (i / (data.length - 1)) * chartW
  const getY = (val: number) => padding.top + chartH - (val / 100) * chartH

  const currentX = getX(data.length - 1)
  const currentY = getY(currentScore)
  const peakX = getX(peakIndex)
  const peakY = getY(data[peakIndex])

  // Calculate approximate path length for animation
  const pathLength = useMemo(() => {
    let len = 0
    for (let i = 1; i < data.length; i++) {
      const dx = getX(i) - getX(i - 1)
      const dy = getY(data[i]) - getY(data[i - 1])
      len += Math.sqrt(dx * dx + dy * dy)
    }
    return Math.ceil(len)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const timeLabels = [
    { label: '6h ago', x: padding.left },
    { label: '3h ago', x: padding.left + chartW / 2 },
    { label: 'Now', x: width - padding.right },
  ]

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: 80 }}
        preserveAspectRatio="none"
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

        {/* Fill under curve */}
        <motion.path
          d={fillPath}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        />

        {/* Animated line */}
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

        {/* Peak label */}
        {peakIndex !== data.length - 1 && (
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

        {/* Current point - pulsing */}
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

        {/* Time labels */}
        {timeLabels.map(({ label, x }) => (
          <text
            key={label}
            x={x}
            y={height - 4}
            textAnchor={label === 'Now' ? 'end' : label === '6h ago' ? 'start' : 'middle'}
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
    </div>
  )
}
