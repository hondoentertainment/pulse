import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { engagementFlagRegistry, type EngagementFlag } from '@/lib/feature-flags'
import { useFeatureFlagAdmin } from '@/hooks/use-feature-flag'
import { SlidersHorizontal, X } from '@phosphor-icons/react'

const ALL_FLAGS = Object.keys(engagementFlagRegistry) as EngagementFlag[]

export function FeatureFlagPanel() {
  // Hooks must be called unconditionally — guard rendering below
  const { overrides, setOverride, clearOverrides } = useFeatureFlagAdmin()

  // Only render in dev mode
  if (!import.meta.env.DEV) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={20} weight="fill" className="text-accent" />
          <h3 className="text-lg font-bold">Feature Flags</h3>
          <Badge variant="outline" className="text-xs">Dev Only</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearOverrides}
          className="text-xs text-muted-foreground"
        >
          <X size={14} className="mr-1" />
          Clear overrides
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Toggle flags below to override rollout percentages. Overrides are stored in
        localStorage and take priority over user bucketing.
      </p>

      <div className="space-y-2">
        {ALL_FLAGS.map((flagName, index) => {
          const config = engagementFlagRegistry[flagName]
          const hasOverride = flagName in overrides
          // Effective value: override wins, else derive from global enabled + 100% rollout assumption
          const effectiveEnabled = hasOverride
            ? overrides[flagName]
            : config.enabled && config.rolloutPercentage === 100

          return (
            <Card key={flagName}>
              <CardContent className="px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold">{flagName}</span>
                      {hasOverride && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          override
                        </Badge>
                      )}
                      <Badge
                        variant={config.enabled ? 'outline' : 'destructive'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {config.rolloutPercentage}% rollout
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {config.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={effectiveEnabled}
                      onCheckedChange={(checked) => setOverride(flagName, checked)}
                      aria-label={`Toggle ${flagName}`}
                    />
                  </div>
                </div>
              </CardContent>
              {index < ALL_FLAGS.length - 1 && <Separator className="hidden" />}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
