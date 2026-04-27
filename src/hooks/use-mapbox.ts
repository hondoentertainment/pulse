import { useEffect, useRef, useState, useCallback } from 'react'
import type mapboxgl from 'mapbox-gl'

interface UseMapboxOptions {
  container: HTMLDivElement | null
  center: { lat: number; lng: number }
  zoom: number
  onMove?: (center: { lat: number; lng: number }) => void
  onZoom?: (zoom: number) => void
  interactive?: boolean
  pitch?: number
  bearing?: number
}

/**
 * Hook that initialises and manages a Mapbox GL map instance.
 *
 * The Mapbox token is read from `import.meta.env.VITE_MAPBOX_TOKEN`.
 * When no token is present the hook returns `hasToken: false` and the
 * map is never created, allowing the app to fall back to the existing
 * canvas-only renderer.
 *
 * When `interactive` is true (default), native Mapbox interactions are
 * enabled for an Uber-quality pan/zoom/rotate experience.
 */
export function useMapbox({
  container,
  center,
  zoom,
  onMove,
  onZoom,
  interactive = true,
  pitch = 45,
  bearing = 0,
}: UseMapboxOptions) {
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
        pitch: interactive ? pitch : 0,
        bearing,
        attributionControl: false,
        logoPosition: 'bottom-left',
        fadeDuration: 0,
        maxPitch: 60,
        // Uber-style smooth animations
        ...(interactive ? {
          dragRotate: true,
          touchPitch: true,
        } : {}),
      })

      mapRef.current = map

      map.on('load', () => {
        if (!cancelled) {
          setIsReady(true)

          // Add 3D building layer for Uber-like depth
          if (interactive) {
            const layers = map.getStyle()?.layers
            let labelLayerId: string | undefined
            if (layers) {
              for (const layer of layers) {
                if (layer.type === 'symbol' && (layer.layout as Record<string, unknown>)?.['text-field']) {
                  labelLayerId = layer.id
                  break
                }
              }
            }

            map.addLayer(
              {
                id: '3d-buildings',
                source: 'composite',
                'source-layer': 'building',
                filter: ['==', 'extrude', 'true'],
                type: 'fill-extrusion',
                minzoom: 12,
                paint: {
                  'fill-extrusion-color': '#1a1a2e',
                  'fill-extrusion-height': ['get', 'height'],
                  'fill-extrusion-base': ['get', 'min_height'],
                  'fill-extrusion-opacity': 0.6,
                },
              },
              labelLayerId
            )
          }
        }
      })

      // Sync camera state back to parent on move/zoom
      map.on('moveend', () => {
        if (suppressSync.current) return
        const c = map.getCenter()
        onMoveRef.current?.({ lat: c.lat, lng: c.lng })
      })

      map.on('zoomend', () => {
        if (suppressSync.current) return
        onZoomRef.current?.(customZoomFromMapbox(map.getZoom()))
      })

      // Real-time camera sync for smoother overlay tracking during drag
      map.on('move', () => {
        if (suppressSync.current) return
        const c = map.getCenter()
        onMoveRef.current?.({ lat: c.lat, lng: c.lng })
      })

      map.on('zoom', () => {
        if (suppressSync.current) return
        onZoomRef.current?.(customZoomFromMapbox(map.getZoom()))
      })

      if (!interactive) {
        // When not interactive, disable all Mapbox interactions
        map.scrollZoom.disable()
        map.boxZoom.disable()
        map.dragRotate.disable()
        map.dragPan.disable()
        map.keyboard.disable()
        map.doubleClickZoom.disable()
        map.touchZoomRotate.disable()
        map.touchPitch.disable()
      }
      // When interactive, all interactions are enabled by default
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      setIsReady(false)
    }
    // Only run on mount / container change — center & zoom synced below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken, container, interactive])

  // Sync center / zoom from parent into Mapbox (only when NOT interactive, or for programmatic moves)
  const syncView = useCallback(
    (c: { lat: number; lng: number }, z: number) => {
      const map = mapRef.current
      if (!map) return
      suppressSync.current = true
      map.jumpTo({
        center: [c.lng, c.lat],
        zoom: mapboxZoomFromCustom(z),
      })
      // Release on next tick so the moveend/zoomend events from jumpTo are swallowed
      requestAnimationFrame(() => {
        suppressSync.current = false
      })
    },
    []
  )

  // Smooth flyTo for venue selection — Uber-style camera animation
  const flyTo = useCallback(
    (target: { lat: number; lng: number }, targetZoom?: number, options?: {
      pitch?: number
      bearing?: number
      duration?: number
    }) => {
      const map = mapRef.current
      if (!map) return
      suppressSync.current = true

      map.flyTo({
        center: [target.lng, target.lat],
        zoom: targetZoom !== undefined ? mapboxZoomFromCustom(targetZoom) : map.getZoom(),
        pitch: options?.pitch ?? map.getPitch(),
        bearing: options?.bearing ?? map.getBearing(),
        duration: options?.duration ?? 1200,
        essential: true,
        curve: 1.4,
      })

      // Unsuppress after animation completes
      const onMoveEnd = () => {
        suppressSync.current = false
        const c = map.getCenter()
        onMoveRef.current?.({ lat: c.lat, lng: c.lng })
        onZoomRef.current?.(customZoomFromMapbox(map.getZoom()))
        map.off('moveend', onMoveEnd)
      }
      map.once('moveend', onMoveEnd)
    },
    []
  )

  // Ease to a position smoothly
  const easeTo = useCallback(
    (target: { lat: number; lng: number }, targetZoom?: number, duration = 600) => {
      const map = mapRef.current
      if (!map) return
      suppressSync.current = true

      map.easeTo({
        center: [target.lng, target.lat],
        zoom: targetZoom !== undefined ? mapboxZoomFromCustom(targetZoom) : map.getZoom(),
        duration,
        easing: (t: number) => t * (2 - t), // ease-out quadratic
      })

      const onMoveEnd = () => {
        suppressSync.current = false
        const c = map.getCenter()
        onMoveRef.current?.({ lat: c.lat, lng: c.lng })
        onZoomRef.current?.(customZoomFromMapbox(map.getZoom()))
        map.off('moveend', onMoveEnd)
      }
      map.once('moveend', onMoveEnd)
    },
    []
  )

  // Only do passive sync when NOT interactive (i.e., canvas drives)
  useEffect(() => {
    if (!interactive) {
      syncView(center, zoom)
    }
  }, [center, zoom, syncView, interactive])

  return { mapRef, isReady, hasToken, flyTo, easeTo, syncView }
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
