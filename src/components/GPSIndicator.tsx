import { NavigationArrow } from '@phosphor-icons/react'
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
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent/10 border border-accent/20",
      className
    )}>
      <NavigationArrow 
        size={12} 
        weight="fill" 
        className="text-accent animate-pulse" 
      />
      <span className="text-[10px] font-mono text-accent font-medium">
        LIVE
      </span>
      {accuracy !== undefined && (
        <span className="text-[10px] text-muted-foreground font-mono">
          ±{accuracy.toFixed(0)}m
        </span>
      )}
      <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-glow" />
    </div>
  )
}
