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
    <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Pulse
              </span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Where the energy is — right now
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
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground font-mono">
          {locationName && (
            <div className="flex items-center gap-1.5">
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
          <div className="flex items-center gap-1.5">
            <Clock size={14} weight="fill" className="text-accent" />
            <span>{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {queuedPulseCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent/15 text-accent">
              <span className="text-[10px] uppercase font-bold">Queued</span>
              <span>{queuedPulseCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
