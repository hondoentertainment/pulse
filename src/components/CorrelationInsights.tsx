import { PulseCorrelation, Venue, CorrelationInsight } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  TrendUp, 
  TrendDown, 
  ArrowRight, 
  ArrowLeft, 
  Lightning,
  Clock
} from '@phosphor-icons/react'

interface CorrelationInsightsProps {
  correlations: PulseCorrelation[]
  venues: Venue[]
}

export function CorrelationInsights({ correlations, venues }: CorrelationInsightsProps) {
  const insights: CorrelationInsight[] = venues
    .map(venue => {
      const venueCorrelations = correlations.filter(c => c.venueId === venue.id)
      const correlation60 = venueCorrelations.find(c => c.windowSize === '60min')
      const correlation120 = venueCorrelations.find(c => c.windowSize === '120min')

      if (!correlation60 && !correlation120) return null

      const primaryCorrelation = correlation60 || correlation120!
      
      return {
        venueId: venue.id,
        venueName: venue.name,
        correlation60: correlation60?.correlationCoefficient || 0,
        correlation120: correlation120?.correlationCoefficient || 0,
        lag: primaryCorrelation.lag,
        strength: primaryCorrelation.strength,
        hasSocialBuzz: Math.abs(primaryCorrelation.correlationCoefficient) >= 0.6,
        socialPulseScore: primaryCorrelation.socialPulseScore,
        venuePulseScore: primaryCorrelation.venuePulseScore
      }
    })
    .filter((insight): insight is CorrelationInsight => insight !== null)
    .sort((a, b) => Math.abs(b.correlation60) - Math.abs(a.correlation60))

  const getStrengthColor = (strength: 'low' | 'medium' | 'high') => {
    switch (strength) {
      case 'high': return 'text-accent bg-accent/20'
      case 'medium': return 'text-primary bg-primary/20'
      case 'low': return 'text-muted-foreground bg-muted'
    }
  }

  const getStrengthLabel = (strength: 'low' | 'medium' | 'high') => {
    switch (strength) {
      case 'high': return 'Strong'
      case 'medium': return 'Moderate'
      case 'low': return 'Weak'
    }
  }

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Correlation Insights</CardTitle>
          <CardDescription>No correlation data available yet</CardDescription>
        </CardHeader>
        <CardContent className="h-48 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">
            Tracking correlations between social and venue activity...
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Correlation Insights</CardTitle>
        <CardDescription>
          How social media activity correlates with venue check-ins
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.map((insight) => (
          <div
            key={insight.venueId}
            className="p-4 rounded-lg border border-border bg-card/50 space-y-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold truncate">{insight.venueName}</h4>
                  {insight.hasSocialBuzz && (
                    <Badge className="bg-accent text-accent-foreground">
                      <Lightning size={12} weight="fill" className="mr-1" />
                      Social Buzz
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {insight.correlation60 > 0 
                    ? 'Social activity correlates with venue energy'
                    : 'Inverse correlation detected'
                  }
                </p>
              </div>
              <Badge className={getStrengthColor(insight.strength)}>
                {getStrengthLabel(insight.strength)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">60-min Correlation</div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={Math.abs(insight.correlation60) * 100} 
                    className="flex-1"
                  />
                  <span className="text-sm font-bold font-mono min-w-[3ch]">
                    {(insight.correlation60 * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">120-min Correlation</div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={Math.abs(insight.correlation120) * 100} 
                    className="flex-1"
                  />
                  <span className="text-sm font-bold font-mono min-w-[3ch]">
                    {(insight.correlation120 * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Social Pulse</div>
                  <div className="text-lg font-bold text-accent">
                    {insight.socialPulseScore}
                  </div>
                </div>
                
                {insight.lag !== 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {insight.lag > 0 ? (
                      <>
                        <ArrowRight size={16} weight="bold" />
                        <Clock size={14} />
                        <span>{Math.abs(insight.lag)}m</span>
                      </>
                    ) : (
                      <>
                        <ArrowLeft size={16} weight="bold" />
                        <Clock size={14} />
                        <span>{Math.abs(insight.lag)}m</span>
                      </>
                    )}
                  </div>
                )}

                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Venue Pulse</div>
                  <div className="text-lg font-bold text-primary">
                    {insight.venuePulseScore}
                  </div>
                </div>
              </div>

              {insight.lag !== 0 && (
                <div className="text-xs text-muted-foreground text-right">
                  {insight.lag > 0 
                    ? 'Social leads venue'
                    : 'Venue leads social'
                  }
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
