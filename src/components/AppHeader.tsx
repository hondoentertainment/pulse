import { MapPin, Clock, MagnifyingGlass } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useCurrentTime } from '@/hooks/use-current-time'

interface AppHeaderProps {
  locationName: string
  isTracking: boolean
  hasRealtimeLocation: boolean
  locationPermissionDenied: boolean
  queuedPulseCount?: number
  onSearchClick?: () => void
}

export function AppHeader({
  locationName,
  isTracking,
  hasRealtimeLocation,
  locationPermissionDenied,
  queuedPulseCount = 0,
  onSearchClick,
}: AppHeaderProps) {
  const currentTime = useCurrentTime()

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-background/82 backdrop-blur-xl">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Pulse
              </span>
            </h1>
            <p className="text-sm text-foreground/80 mt-1">
              Pick a spot with fresh crowd, line, and vibe intel.
            </p>
          </div>
          {onSearchClick && (
            <button
              onClick={onSearchClick}
              className="min-h-11 min-w-11 p-2.5 rounded-xl bg-secondary/50 hover:bg-secondary active:scale-[0.98] touch-manipulation transition-colors"
              aria-label="Search venues and cities"
            >
              <MagnifyingGlass size={22} weight="bold" className="text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {locationName && (
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-2.5 py-1">
              <MapPin size={14} weight="fill" className={cn(
                "transition-colors",
                isTracking ? "text-accent motion-safe:animate-pulse" : "text-muted-foreground"
              )} />
              <span>{locationName}</span>
              {hasRealtimeLocation && (
                <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-md uppercase font-bold">
                  LIVE
                </span>
              )}
            </div>
          )}
          {locationPermissionDenied && (
            <button
              onClick={() => {
                toast.info('Enable Location', {
                  description: 'Please enable location in your browser settings and refresh the page'
                })
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
            >
              <MapPin size={14} weight="fill" />
              <span>Enable Location</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-2.5 py-1">
            <Clock size={14} weight="fill" className="text-accent" />
            <span>{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {queuedPulseCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/15 px-2.5 py-1 text-accent" aria-live="polite">
              <span className="text-[10px] uppercase font-bold tracking-wide">Queued</span>
              <span>{queuedPulseCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
