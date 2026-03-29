import { useState, useCallback } from 'react'
import { useMapbox } from '@/hooks/use-mapbox'

/**
 * Renders a Mapbox GL map as the base tile layer behind the existing
 * canvas heatmap and SVG marker overlays.
 *
 * HOW TO ENABLE:
 *   Set VITE_MAPBOX_TOKEN in your .env (or .env.local) to a valid
 *   Mapbox access token (https://account.mapbox.com/access-tokens/).
 *   The map tiles will appear automatically. When no token is provided
 *   the component renders nothing and the app uses the original
 *   canvas-only dark-gradient background.
 */

// Import Mapbox CSS — tree-shaken when component is never rendered
// CSS is loaded dynamically in use-mapbox.ts when the token is present

interface MapboxBaseLayerProps {
  center: { lat: number; lng: number }
  zoom: number
  onMove?: (center: { lat: number; lng: number }) => void
  onZoom?: (zoom: number) => void
}

export function MapboxBaseLayer({ center, zoom, onMove, onZoom }: MapboxBaseLayerProps) {
  // Use callback-ref so the hook receives a non-null container after mount
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainer(node)
  }, [])

  const { hasToken } = useMapbox({
    container,
    center,
    zoom,
    onMove,
    onZoom
  })

  if (!hasToken) return null

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 0 }}
    />
  )
}
