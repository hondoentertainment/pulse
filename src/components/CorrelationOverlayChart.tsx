import { SocialPulseWindow, VenuePulseWindow } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { motion } from 'framer-motion'

interface CorrelationOverlayChartProps {
  socialWindows: SocialPulseWindow[]
  venueWindows: VenuePulseWindow[]
  venueId?: string
}

export function CorrelationOverlayChart({
  socialWindows,
  venueWindows,
  venueId
}: CorrelationOverlayChartProps) {
  const filteredSocialWindows = socialWindows
    .filter(w => w.windowSize === '5min')
    .filter(w => !venueId || w.venueId === venueId)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(-12)

  const filteredVenueWindows = venueWindows
    .filter(w => w.windowSize === '5min')
    .filter(w => !venueId || w.venueId === venueId)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(-12)

  const maxScore = Math.max(
    ...filteredSocialWindows.map(w => w.normalizedScore),
    ...filteredVenueWindows.map(w => w.pulseScore),
    100
  )

  if (filteredSocialWindows.length === 0 && filteredVenueWindows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Social vs Venue Pulse</CardTitle>
          <CardDescription>No correlation data available yet</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">
            Waiting for data from both sources...
          </p>
        </CardContent>
      </Card>
    )
  }

  const timeLabels = filteredSocialWindows.map(w =>
    new Date(w.startTime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social vs Venue Pulse Overlay</CardTitle>
        <CardDescription>
          Comparing social media activity with venue check-ins
        </CardDescription>
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-accent" />
            <span className="text-sm">Social Pulse</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-primary" />
            <span className="text-sm">Venue Pulse</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative h-64">
          <svg width="100%" height="100%" className="overflow-visible">
            <defs>
              <linearGradient id="socialGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="oklch(0.75 0.18 195)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="oklch(0.75 0.18 195)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="venueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="oklch(0.65 0.25 300)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="oklch(0.65 0.25 300)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {filteredSocialWindows.length > 1 && (
              <>
                <motion.path
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1, ease: 'easeInOut' }}
                  d={(() => {
                    const points = filteredSocialWindows.map((w, i) => {
                      const x = (i / (filteredSocialWindows.length - 1)) * 100
                      const y = 100 - (w.normalizedScore / maxScore) * 100
                      return `${x},${y}`
                    })
                    return `M ${points.join(' L ')}`
                  })()}
                  fill="none"
                  stroke="oklch(0.75 0.18 195)"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
                <motion.path
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 0.3 }}
                  d={(() => {
                    const points = filteredSocialWindows.map((w, i) => {
                      const x = (i / (filteredSocialWindows.length - 1)) * 100
                      const y = 100 - (w.normalizedScore / maxScore) * 100
                      return `${x},${y}`
                    })
                    return `M ${points.join(' L ')} L 100,100 L 0,100 Z`
                  })()}
                  fill="url(#socialGradient)"
                />
              </>
            )}

            {filteredVenueWindows.length > 1 && (
              <>
                <motion.path
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1, ease: 'easeInOut', delay: 0.2 }}
                  d={(() => {
                    const points = filteredVenueWindows.map((w, i) => {
                      const x = (i / (filteredVenueWindows.length - 1)) * 100
                      const y = 100 - (w.pulseScore / maxScore) * 100
                      return `${x},${y}`
                    })
                    return `M ${points.join(' L ')}`
                  })()}
                  fill="none"
                  stroke="oklch(0.65 0.25 300)"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
                <motion.path
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1, delay: 0.5 }}
                  d={(() => {
                    const points = filteredVenueWindows.map((w, i) => {
                      const x = (i / (filteredVenueWindows.length - 1)) * 100
                      const y = 100 - (w.pulseScore / maxScore) * 100
                      return `${x},${y}`
                    })
                    return `M ${points.join(' L ')} L 100,100 L 0,100 Z`
                  })()}
                  fill="url(#venueGradient)"
                />
              </>
            )}
          </svg>
        </div>

        <div className="flex justify-between text-xs text-muted-foreground font-mono">
          {timeLabels.length > 0 && (
            <>
              <span>{timeLabels[0]}</span>
              {timeLabels.length > 2 && (
                <span>{timeLabels[Math.floor(timeLabels.length / 2)]}</span>
              )}
              <span>{timeLabels[timeLabels.length - 1]}</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
