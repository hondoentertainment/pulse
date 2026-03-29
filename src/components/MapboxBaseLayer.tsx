import { useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { useMapbox } from '@/hooks/use-mapbox'

/**
 * Renders a Mapbox GL map as the base tile layer.
 *
 * When `interactive` is true, Mapbox handles all pan/zoom/rotate natively
 * for an Uber-quality experience with 3D buildings and smooth animations.
 *
 * HOW TO ENABLE:
 *   Set VITE_MAPBOX_TOKEN in your .env (or .env.local) to a valid
 *   Mapbox access token (https://account.mapbox.com/access-tokens/).
 */

export interface MapboxBaseLayerHandle {
  flyTo: (target: { lat: number; lng: number }, zoom?: number, options?: {
    pitch?: number
    bearing?: number
    duration?: number
  }) => void
  easeTo: (target: { lat: number; lng: number }, zoom?: number, duration?: number) => void
}

interface MapboxBaseLayerProps {
  center: { lat: number; lng: number }
  zoom: number
  onMove?: (center: { lat: number; lng: number }) => void
  onZoom?: (zoom: number) => void
  interactive?: boolean
  pitch?: number
  bearing?: number
}

export const MapboxBaseLayer = forwardRef<MapboxBaseLayerHandle, MapboxBaseLayerProps>(
  function MapboxBaseLayer({ center, zoom, onMove, onZoom, interactive = false, pitch, bearing }, ref) {
    // Use callback-ref so the hook receives a non-null container after mount
    const [container, setContainer] = useState<HTMLDivElement | null>(null)
    const containerRef = useCallback((node: HTMLDivElement | null) => {
      setContainer(node)
    }, [])

    const { hasToken, flyTo, easeTo } = useMapbox({
      container,
      center,
      zoom,
      onMove,
      onZoom,
      interactive,
      pitch,
      bearing,
    })

    // Expose flyTo/easeTo to parent via ref
    useImperativeHandle(ref, () => ({
      flyTo,
      easeTo,
    }), [flyTo, easeTo])

    if (!hasToken) return null

    return (
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 0 }}
      />
    )
  }
)
