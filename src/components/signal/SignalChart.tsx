interface SignalChartProps {
  data: Array<{ label: string; score: number; seeded: boolean }>
}

export function SignalChart({ data }: SignalChartProps) {
  const width = 320
  const height = 128
  const padding = 18
  const points = data.map((item, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1)
    const y = height - padding - (item.score / 100) * (height - padding * 2)
    return { ...item, x, y }
  })
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">7-day signal</p>
          <p className="text-xs text-muted-foreground">Dotted points are baseline estimates until you log more days.</p>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full overflow-visible" role="img" aria-label="Seven day signal trend chart">
        <defs>
          <linearGradient id="signalLine" x1="0" x2="1">
            <stop offset="0%" stopColor="oklch(0.62 0.19 255)" />
            <stop offset="100%" stopColor="oklch(0.7 0.18 165)" />
          </linearGradient>
        </defs>
        {[25, 50, 75].map((value) => (
          <line
            key={value}
            x1={padding}
            x2={width - padding}
            y1={height - padding - (value / 100) * (height - padding * 2)}
            y2={height - padding - (value / 100) * (height - padding * 2)}
            stroke="currentColor"
            className="text-border"
            strokeDasharray="4 8"
          />
        ))}
        <path d={path} fill="none" stroke="url(#signalLine)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={`${point.label}-${point.score}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r={point.seeded ? 4 : 6}
              className={point.seeded ? 'fill-muted stroke-muted-foreground' : 'fill-primary stroke-background'}
              strokeWidth="3"
              opacity={point.seeded ? 0.65 : 1}
            />
            <text x={point.x} y={height - 2} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
