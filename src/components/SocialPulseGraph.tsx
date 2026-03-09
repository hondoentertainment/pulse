import { SocialPulseWindow } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendUp, TrendDown, Hash, ChatCircle, Heart } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface SocialPulseGraphProps {
  windows: SocialPulseWindow[]
  hashtag?: string
  windowSize: '5min' | '15min' | '60min'
}

export function SocialPulseGraph({ windows, hashtag, windowSize }: SocialPulseGraphProps) {
  const filteredWindows = windows
    .filter(w => w.windowSize === windowSize)
    .filter(w => !hashtag || w.hashtag === hashtag)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(-12)

  const latestWindow = filteredWindows[filteredWindows.length - 1]
  const previousWindow = filteredWindows[filteredWindows.length - 2]

  const scoreChange = latestWindow && previousWindow
    ? latestWindow.normalizedScore - previousWindow.normalizedScore
    : 0

  const maxScore = Math.max(...filteredWindows.map(w => w.normalizedScore), 100)

  if (filteredWindows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash size={24} weight="bold" className="text-accent" />
            Social Pulse
          </CardTitle>
          <CardDescription>No data available yet</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">
            Waiting for social media data...
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Hash size={24} weight="bold" className="text-accent" />
              Social Pulse Score
              {hashtag && (
                <Badge variant="secondary" className="font-mono">
                  #{hashtag}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Real-time social media activity</CardDescription>
          </div>
          {latestWindow && (
            <div className="text-right">
              <div className="text-3xl font-bold">
                {latestWindow.normalizedScore}
              </div>
              {scoreChange !== 0 && (
                <div className={`flex items-center gap-1 text-sm ${
                  scoreChange > 0 ? 'text-accent' : 'text-destructive'
                }`}>
                  {scoreChange > 0 ? (
                    <TrendUp size={16} weight="bold" />
                  ) : (
                    <TrendDown size={16} weight="bold" />
                  )}
                  <span>{Math.abs(scoreChange).toFixed(1)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-48 flex items-end gap-1">
          {filteredWindows.map((window, index) => {
            const heightPercent = (window.normalizedScore / maxScore) * 100
            const isLatest = index === filteredWindows.length - 1

            return (
              <motion.div
                key={window.id}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: `${heightPercent}%`, opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="flex-1 relative group cursor-pointer"
              >
                <div
                  className={`w-full rounded-t-lg transition-all ${
                    isLatest
                      ? 'bg-accent shadow-lg shadow-accent/50'
                      : 'bg-accent/60 hover:bg-accent/80'
                  }`}
                  style={{ height: '100%' }}
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="bg-popover border border-border rounded-lg p-2 shadow-xl whitespace-nowrap">
                    <div className="text-xs font-bold">{window.normalizedScore}</div>
                    <div className="text-xs text-muted-foreground">
                      {window.postCount} posts
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(window.startTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {latestWindow && (
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ChatCircle size={16} weight="fill" />
                <span className="text-xs font-medium">Posts</span>
              </div>
              <div className="text-2xl font-bold">{latestWindow.postCount}</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Heart size={16} weight="fill" />
                <span className="text-xs font-medium">Engagement</span>
              </div>
              <div className="text-2xl font-bold">{latestWindow.totalEngagement}</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendUp size={16} weight="fill" />
                <span className="text-xs font-medium">Velocity</span>
              </div>
              <div className="text-2xl font-bold">
                {latestWindow.velocity > 0 ? '+' : ''}{latestWindow.velocity}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
