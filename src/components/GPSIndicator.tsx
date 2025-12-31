import { NavigationArrow } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface GPSIndicatorProps {
  isTracking: boolean
  accuracy?: number
  className?: string
}

export function GPSIndicator({ isTracking, accuracy, className }: GPSIndicatorProps) {
  if (!isTracking) {
    return null
  }

  return (
    <Card className={cn(
      "bg-card/95 backdrop-blur-sm border-border px-3 py-2 flex items-center gap-2",
      className
    )}>
      <NavigationArrow 
        size={16} 
        weight="fill" 
        className="text-accent animate-pulse" 
      />
      <div className="flex flex-col">
        <span className="text-xs font-mono text-foreground font-medium">
          Live Tracking
        </span>
        {accuracy !== undefined && (
          <span className="text-[10px] text-muted-foreground font-mono">
            ±{accuracy.toFixed(0)}m accuracy
          </span>
        )}
      </div>
      <div className="w-2 h-2 rounded-full bg-accent animate-pulse-glow ml-1" />
    </Card>
  )
}
