import { useEffect, useRef, useState, useCallback } from 'react'
import type mapboxgl from 'mapbox-gl'

interface UseMapboxOptions {
  container: HTMLDivElement | null
  center: { lat: number; lng: number }
  zoom: number
  onMove?: (center: { lat: number; lng: number }) => void
  onZoom?: (zoom: number) => void
}

/**
 * Hook that initialises and manages a Mapbox GL map instance.
 *
 * The Mapbox token is read from `import.meta.env.VITE_MAPBOX_TOKEN`.
 * When no token is present the hook returns `hasToken: false` and the
 * map is never created, allowing the app to fall back to the existing
 * canvas-only renderer.
 */
export function useMapbox({ container, center, zoom, onMove, onZoom }: UseMapboxOptions) {
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [isReady, setIsReady] = useState(false)
  const hasToken = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)

  // Keep callbacks in refs so the effect doesn't re-run on every render
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove
  const onZoomRef = useRef(onZoom)
  onZoomRef.current = onZoom

  // Track whether the parent is driving the move (to avoid echo loops)
  const suppressSync = useRef(false)

  useEffect(() => {
    if (!hasToken || !container) return

    let cancelled = false

    // Inject Mapbox CSS via <link> so Vite doesn't try to resolve it at build time
    if (!document.getElementById('mapbox-gl-css')) {
      const link = document.createElement('link')
      link.id = 'mapbox-gl-css'
      link.rel = 'stylesheet'
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css'
      document.head.appendChild(link)
    }

    // Dynamic import so mapbox-gl is never bundled when the token is absent
    import('mapbox-gl').then((mapboxglModule) => {
      if (cancelled) return
      const mapboxgl = mapboxglModule.default ?? mapboxglModule

      ;(mapboxgl as typeof import('mapbox-gl').default).accessToken =
        import.meta.env.VITE_MAPBOX_TOKEN as string

      const map = new mapboxgl.Map({
        container,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [center.lng, center.lat],
        zoom: mapboxZoomFromCustom(zoom),
        attributionControl: false,
        logoPosition: 'bottom-left',
        fadeDuration: 0
      })

      mapRef.current = map

      map.on('load', () => {
        if (!cancelled) setIsReady(true)
      })

      map.on('moveend', () => {
        if (suppressSync.current) return
        const c = map.getCenter()
        onMoveRef.current?.({ lat: c.lat, lng: c.lng })
      })

      map.on('zoomend', () => {
        if (suppressSync.current) return
        onZoomRef.current?.(customZoomFromMapbox(map.getZoom()))
      })

      // Disable Mapbox's own interaction — the parent canvas handles it
      map.scrollZoom.disable()
      map.boxZoom.disable()
      map.dragRotate.disable()
      map.dragPan.disable()
      map.keyboard.disable()
      map.doubleClickZoom.disable()
      map.touchZoomRotate.disable()
      map.touchPitch.disable()
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      setIsReady(false)
    }
    // Only run on mount / container change — center & zoom synced below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken, container])

  // Sync center / zoom from parent into Mapbox
  const syncView = useCallback(
    (c: { lat: number; lng: number }, z: number) => {
      const map = mapRef.current
      if (!map) return
      suppressSync.current = true
      map.jumpTo({
        center: [c.lng, c.lat],
        zoom: mapboxZoomFromCustom(z)
      })
      // Release on next tick so the moveend/zoomend events from jumpTo are swallowed
      requestAnimationFrame(() => {
        suppressSync.current = false
      })
    },
    []
  )

  useEffect(() => {
    syncView(center, zoom)
  }, [center, zoom, syncView])

  return { mapRef, isReady, hasToken }
}

// ---- Zoom mapping helpers ----
// The custom map uses a linear zoom factor (1 = default, 0.3–8 range).
// Mapbox uses an exponential zoom level (0–22).
// We map custom zoom 1 -> Mapbox zoom 13 (city level) with log scaling.

function mapboxZoomFromCustom(customZoom: number): number {
  return 13 + Math.log2(customZoom)
}

function customZoomFromMapbox(mapboxZoom: number): number {
  return Math.pow(2, mapboxZoom - 13)
}
