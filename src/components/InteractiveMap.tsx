import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Venue } from '@/lib/types'
import { PulseScore } from '@/components/PulseScore'
import { MapFilters, MapFiltersState, EnergyFilter } from '@/components/MapFilters'
import { MapSearch } from '@/components/MapSearch'
import { GPSIndicator } from '@/components/GPSIndicator'
import { CityHeatmap } from '@/components/CityHeatmap'
import { MapVenueSheet } from '@/components/MapVenueSheet'
import {
  MapPin, NavigationArrow, Plus, Minus,
  BeerBottle, MusicNotes, ForkKnife, Coffee, Martini, Confetti,
  Users, Fire, Lightning, ThermometerHot, CaretDown, CaretUp
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistance } from '@/lib/units'
import { useUnitPreference } from '@/hooks/use-unit-preference'
import { calculateDistance } from '@/lib/pulse-engine'
import FriendMapDots from '@/components/FriendMapDots'

interface InteractiveMapProps {
  venues: Venue[]
  userLocation: { lat: number; lng: number } | null
  onVenueClick: (venue: Venue) => void
  isTracking?: boolean
  locationAccuracy?: number
}

// --- Helpers ---

const getEnergyLevelFromScore = (score: number): string => {
  if (score >= 80) return 'electric'
  if (score >= 60) return 'buzzing'
  if (score >= 30) return 'chill'
  return 'dead'
}

const getCategoryIcon = (category?: string) => {
  switch (category?.toLowerCase()) {
    case 'bar': return BeerBottle
    case 'club': case 'nightclub': return MusicNotes
    case 'restaurant': case 'food': return ForkKnife
    case 'cafe': return Coffee
    case 'lounge': return Martini
    case 'event': return Confetti
    default: return MapPin
  }
}

const getEnergyColor = (score: number) => {
  if (score >= 80) return { r: 217, g: 70, b: 239 }  // Fuchsia
  if (score >= 60) return { r: 244, g: 63, b: 94 }   // Rose
  if (score >= 30) return { r: 14, g: 165, b: 233 }   // Sky
  return { r: 99, g: 102, b: 241 }                     // Indigo
}

const getEnergyColorCSS = (score: number) => {
  if (score >= 80) return 'oklch(0.65 0.28 320)'
  if (score >= 60) return 'oklch(0.65 0.25 25)'
  if (score >= 30) return 'oklch(0.65 0.18 240)'
  return 'oklch(0.40 0.05 260)'
}

// Cluster nearby venues
interface ClusterGroup {
  venues: Venue[]
  center: { lat: number; lng: number }
  topVenue: Venue
}

function clusterVenues(
  venues: Venue[],
  zoom: number,
  mapCenter: { lat: number; lng: number },
  dims: { width: number; height: number }
): ClusterGroup[] {
  const clusterRadius = 40 / zoom // pixels
  const scale = 500000 * zoom
  const assigned = new Set<string>()
  const clusters: ClusterGroup[] = []

  const toPixel = (lat: number, lng: number) => ({
    x: dims.width / 2 + (lng - mapCenter.lng) * scale,
    y: dims.height / 2 - (lat - mapCenter.lat) * scale,
  })

  // Sort by pulseScore descending so top venues anchor clusters
  const sorted = [...venues].sort((a, b) => b.pulseScore - a.pulseScore)

  for (const venue of sorted) {
    if (assigned.has(venue.id)) continue

    const pos = toPixel(venue.location.lat, venue.location.lng)
    const group: Venue[] = [venue]
    assigned.add(venue.id)

    for (const other of sorted) {
      if (assigned.has(other.id)) continue
      const otherPos = toPixel(other.location.lat, other.location.lng)
      const dx = pos.x - otherPos.x
      const dy = pos.y - otherPos.y
      if (Math.sqrt(dx * dx + dy * dy) < clusterRadius) {
        group.push(other)
        assigned.add(other.id)
      }
    }

    const avgLat = group.reduce((s, v) => s + v.location.lat, 0) / group.length
    const avgLng = group.reduce((s, v) => s + v.location.lng, 0) / group.length

    clusters.push({
      venues: group,
      center: { lat: avgLat, lng: avgLng },
      topVenue: group[0],
    })
  }

  return clusters
}

// --- Component ---

export function InteractiveMap({ venues, userLocation, onVenueClick, isTracking = false, locationAccuracy }: InteractiveMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number>(0)
  const velocityRef = useRef({ vx: 0, vy: 0 })
  const lastPointerRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const prevPointerRef = useRef<{ x: number; y: number; t: number } | null>(null)

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [zoom, setZoom] = useState(1)
  const [targetZoom, setTargetZoom] = useState(1)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [followUser, setFollowUser] = useState(true)
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null)
  const [showLegend, setShowLegend] = useState(false)
  const [showFullHeatmap, setShowFullHeatmap] = useState(false)
  const [showCityHeatmap, setShowCityHeatmap] = useState(false)
  const [nearMeActive, setNearMeActive] = useState(false)
  const [filters, setFilters] = useState<MapFiltersState>({
    energyLevels: [],
    categories: [],
    maxDistance: Infinity
  })

  const { unitSystem } = useUnitPreference()
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const zoomAnimRef = useRef<number>(0)

  // --- Initialization ---

  useEffect(() => {
    loadingTimeoutRef.current = window.setTimeout(() => {
      if (!center && !userLocation && venues.length > 0) {
        setCenter({ lat: venues[0].location.lat, lng: venues[0].location.lng })
        setFollowUser(false)
      }
    }, 3000)
    return () => { if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current) }
  }, [center, userLocation, venues])

  useEffect(() => {
    if (userLocation && followUser) {
      setCenter(userLocation)
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
    }
  }, [userLocation, followUser])

  useEffect(() => {
    if (userLocation && !center) setCenter(userLocation)
  }, [userLocation, center])

  // --- Dimensions ---

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        setDimensions({ width, height })
      }
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // --- Smooth zoom animation ---

  useEffect(() => {
    if (Math.abs(zoom - targetZoom) < 0.01) {
      setZoom(targetZoom)
      return
    }
    const animate = () => {
      setZoom(prev => {
        const next = prev + (targetZoom - prev) * 0.15
        if (Math.abs(next - targetZoom) < 0.01) return targetZoom
        zoomAnimRef.current = requestAnimationFrame(animate)
        return next
      })
    }
    zoomAnimRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(zoomAnimRef.current)
  }, [targetZoom])

  // --- Momentum panning ---

  const startMomentum = useCallback(() => {
    const { vx, vy } = velocityRef.current
    if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) return

    const decay = () => {
      const vel = velocityRef.current
      if (Math.abs(vel.vx) < 0.3 && Math.abs(vel.vy) < 0.3) {
        velocityRef.current = { vx: 0, vy: 0 }
        return
      }

      vel.vx *= 0.92
      vel.vy *= 0.92

      setCenter(prev => {
        if (!prev) return prev
        const scale = 500000 * zoom
        return {
          lng: prev.lng - vel.vx / scale,
          lat: prev.lat + vel.vy / scale,
        }
      })

      animFrameRef.current = requestAnimationFrame(decay)
    }

    animFrameRef.current = requestAnimationFrame(decay)
  }, [zoom])

  // --- Filtering ---

  const filteredVenues = useMemo(() => {
    const filtered = venues.filter((venue) => {
      if (filters.energyLevels.length > 0) {
        const level = getEnergyLevelFromScore(venue.pulseScore)
        if (!filters.energyLevels.includes(level as EnergyFilter)) return false
      }
      if (filters.categories.length > 0 && venue.category) {
        if (!filters.categories.includes(venue.category)) return false
      }
      if (filters.maxDistance !== Infinity && userLocation) {
        const d = calculateDistance(userLocation.lat, userLocation.lng, venue.location.lat, venue.location.lng)
        if (d > filters.maxDistance) return false
      }
      if (nearMeActive && userLocation) {
        const d = calculateDistance(userLocation.lat, userLocation.lng, venue.location.lat, venue.location.lng)
        if (d > 0.5) return false
      }
      return true
    })

    if (!showFullHeatmap && !nearMeActive && filters.energyLevels.length === 0 && filters.categories.length === 0) {
      const nearby = userLocation
        ? filtered
            .filter(v => calculateDistance(userLocation.lat, userLocation.lng, v.location.lat, v.location.lng) < 50)
            .sort((a, b) => b.pulseScore - a.pulseScore)
        : filtered.sort((a, b) => b.pulseScore - a.pulseScore)
      return nearby.slice(0, 20)
    }

    return filtered
  }, [venues, filters, userLocation, nearMeActive, showFullHeatmap])

  const availableCategories = useMemo(() =>
    Array.from(new Set(venues.map(v => v.category).filter((c): c is string => !!c))).sort(),
    [venues]
  )

  // --- Canvas rendering ---

  const latLngToPixel = useCallback((
    lat: number, lng: number,
    mapCenter: { lat: number; lng: number },
    mapZoom: number,
    dims: { width: number; height: number }
  ) => {
    const scale = 500000 * mapZoom
    return {
      x: dims.width / 2 + (lng - mapCenter.lng) * scale,
      y: dims.height / 2 - (lat - mapCenter.lat) * scale,
    }
  }, [])

  useEffect(() => {
    if (!canvasRef.current || !center) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    ctx.scale(dpr, dpr)

    const { width, height } = dimensions

    // Background with radial gradient
    const bg = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) * 0.7
    )
    bg.addColorStop(0, '#1a1a2e')
    bg.addColorStop(0.5, '#141425')
    bg.addColorStop(1, '#0d0d1a')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    // Subtle grid pattern - crosshairs style
    const gridSpacing = Math.max(30, 60 * zoom)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'
    ctx.lineWidth = 0.5
    for (let x = gridSpacing; x < width; x += gridSpacing) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = gridSpacing; y < height; y += gridSpacing) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Heatmap layer
    if (!offscreenRef.current) {
      offscreenRef.current = document.createElement('canvas')
    }
    const hc = offscreenRef.current
    if (hc.width !== width || hc.height !== height) {
      hc.width = width
      hc.height = height
    }
    const hctx = hc.getContext('2d')
    if (!hctx) return
    hctx.clearRect(0, 0, width, height)

    filteredVenues.forEach(venue => {
      if (venue.pulseScore <= 0) return
      const pos = latLngToPixel(venue.location.lat, venue.location.lng, center, zoom, dimensions)
      const intensity = Math.min(venue.pulseScore / 100, 1)
      const radius = Math.max(50 * zoom * (0.4 + intensity * 0.6), 25)
      const c = getEnergyColor(venue.pulseScore)

      const grad = hctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius)
      grad.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${intensity * 0.8})`)
      grad.addColorStop(0.3, `rgba(${c.r}, ${c.g}, ${c.b}, ${intensity * 0.4})`)
      grad.addColorStop(0.7, `rgba(${c.r}, ${c.g}, ${c.b}, ${intensity * 0.1})`)
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      hctx.fillStyle = grad
      hctx.fillRect(pos.x - radius, pos.y - radius, radius * 2, radius * 2)
    })

    ctx.globalCompositeOperation = 'screen'
    ctx.drawImage(hc, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
  }, [filteredVenues, center, zoom, dimensions, latLngToPixel])

  // --- Clusters ---

  const clusters = useMemo(() => {
    if (!center) return []
    return clusterVenues(filteredVenues, zoom, center, dimensions)
  }, [filteredVenues, zoom, center, dimensions])

  // --- Event handlers ---

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && e.isPrimary === false) return
    cancelAnimationFrame(animFrameRef.current)
    velocityRef.current = { vx: 0, vy: 0 }
    setIsDragging(true)
    setFollowUser(false)
    lastPointerRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    prevPointerRef.current = null;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !lastPointerRef.current || !center) return

    const dx = e.clientX - lastPointerRef.current.x
    const dy = e.clientY - lastPointerRef.current.y
    const now = Date.now()

    prevPointerRef.current = lastPointerRef.current
    lastPointerRef.current = { x: e.clientX, y: e.clientY, t: now }

    const scale = 500000 * zoom
    setCenter(prev => prev ? {
      lng: prev.lng - dx / scale,
      lat: prev.lat + dy / scale,
    } : prev)
  }, [isDragging, center, zoom])

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)

    // Calculate velocity from last two pointer events
    if (prevPointerRef.current && lastPointerRef.current) {
      const dt = lastPointerRef.current.t - prevPointerRef.current.t
      if (dt > 0 && dt < 100) {
        velocityRef.current = {
          vx: (lastPointerRef.current.x - prevPointerRef.current.x) / (dt / 16),
          vy: (lastPointerRef.current.y - prevPointerRef.current.y) / (dt / 16),
        }
        startMomentum()
      }
    }

    lastPointerRef.current = null
    prevPointerRef.current = null
  }, [isDragging, startMomentum])

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = -e.deltaY * 0.001
    setTargetZoom(prev => Math.max(0.3, Math.min(6, prev * (1 + delta))))
    setFollowUser(false)
  }, [])

  // Touch pinch zoom
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setLastTouchDistance(getTouchDistance(e.touches))
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance !== null) {
      const newDist = getTouchDistance(e.touches)
      if (newDist !== null) {
        const scale = newDist / lastTouchDistance
        setTargetZoom(z => Math.max(0.3, Math.min(6, z * scale)))
        setLastTouchDistance(newDist)
        setFollowUser(false)
      }
    }
  }, [lastTouchDistance])

  const handleTouchEnd = useCallback(() => {
    setLastTouchDistance(null)
  }, [])

  // Keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!center) return
    const pan = 0.0005 / zoom
    switch (e.key) {
      case 'ArrowUp': setCenter(c => c ? { ...c, lat: c.lat + pan } : c); setFollowUser(false); break
      case 'ArrowDown': setCenter(c => c ? { ...c, lat: c.lat - pan } : c); setFollowUser(false); break
      case 'ArrowLeft': setCenter(c => c ? { ...c, lng: c.lng - pan } : c); setFollowUser(false); break
      case 'ArrowRight': setCenter(c => c ? { ...c, lng: c.lng + pan } : c); setFollowUser(false); break
      case '+': case '=': setTargetZoom(z => Math.min(z * 1.5, 6)); break
      case '-': setTargetZoom(z => Math.max(z / 1.5, 0.3)); break
    }
  }, [center, zoom])

  const handleZoomIn = () => { setTargetZoom(z => Math.min(z * 1.5, 6)); setFollowUser(false) }
  const handleZoomOut = () => { setTargetZoom(z => Math.max(z / 1.5, 0.3)); setFollowUser(false) }
  const handleCenterOnUser = () => {
    if (userLocation) {
      setCenter(userLocation)
      setTargetZoom(1.5)
      setFollowUser(true)
    }
  }

  const handleVenueSelect = useCallback((venue: Venue) => {
    setCenter({ lat: venue.location.lat, lng: venue.location.lng })
    setTargetZoom(2.5)
    setFollowUser(false)
    setSelectedVenue(venue)
  }, [])

  const handleMarkerClick = useCallback((venue: Venue) => {
    setSelectedVenue(venue)
    // Smooth pan to venue
    setCenter({ lat: venue.location.lat, lng: venue.location.lng })
  }, [])

  const getVenuePixelPosition = useCallback((venue: Venue) => {
    if (!center) return null
    return latLngToPixel(venue.location.lat, venue.location.lng, center, zoom, dimensions)
  }, [center, zoom, dimensions, latLngToPixel])

  // --- Loading state ---

  if (!center) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0d0d1a]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary"
          />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Finding your location</p>
            <p className="text-xs text-muted-foreground mt-1">Getting the best view for you</p>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Canvas heatmap layer */}
      <canvas
        ref={canvasRef}
        className={cn(
          'absolute inset-0 w-full h-full touch-none select-none',
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* SVG marker layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
        {/* User location */}
        {userLocation && (() => {
          const pos = latLngToPixel(userLocation.lat, userLocation.lng, center, zoom, dimensions)
          const accuracyRadius = locationAccuracy
            ? (locationAccuracy / 111320) * 500000 * zoom
            : 0

          return (
            <g>
              {accuracyRadius > 0 && (
                <circle cx={pos.x} cy={pos.y} r={accuracyRadius}
                  fill="rgba(56, 189, 248, 0.08)"
                  stroke="rgba(56, 189, 248, 0.2)"
                  strokeWidth={1}
                />
              )}
              <circle cx={pos.x} cy={pos.y} r={16 * Math.min(zoom, 2)}
                fill="rgba(56, 189, 248, 0.2)"
                className="animate-pulse"
              />
              <circle cx={pos.x} cy={pos.y} r={7 * Math.min(zoom, 2)}
                fill="#38bdf8" stroke="white" strokeWidth={2.5}
              />
            </g>
          )
        })()}

        {/* Venue markers (clustered) */}
        {clusters.map((cluster) => {
          const pos = latLngToPixel(cluster.center.lat, cluster.center.lng, center, zoom, dimensions)

          // Off-screen culling
          if (pos.x < -60 || pos.x > dimensions.width + 60 || pos.y < -60 || pos.y > dimensions.height + 60) {
            return null
          }

          const venue = cluster.topVenue
          const isSelected = selectedVenue?.id === venue.id
          const isCluster = cluster.venues.length > 1
          const score = isCluster
            ? Math.max(...cluster.venues.map(v => v.pulseScore))
            : venue.pulseScore
          const isHighEnergy = score >= 80

          const baseSize = isCluster ? 22 : 18
          const pulseScale = score > 0 ? 1 + (score / 100) * 0.4 : 1
          const markerSize = baseSize * Math.min(zoom, 2.5) * pulseScale * 0.6

          return (
            <g key={venue.id}>
              {/* Outer glow for high-energy */}
              {isHighEnergy && (
                <>
                  <circle
                    cx={pos.x} cy={pos.y}
                    r={markerSize * 2.8}
                    fill={getEnergyColorCSS(score)}
                    opacity={0.1}
                    className="animate-pulse"
                    style={{ animationDuration: '3s' }}
                  />
                  <circle
                    cx={pos.x} cy={pos.y}
                    r={markerSize * 1.8}
                    fill={getEnergyColorCSS(score)}
                    opacity={0.2}
                    className="animate-pulse"
                    style={{ animationDuration: '2s' }}
                  />
                </>
              )}

              {/* Main marker */}
              <circle
                cx={pos.x} cy={pos.y}
                r={markerSize}
                fill={score > 0 ? getEnergyColorCSS(score) : 'oklch(0.25 0.05 260)'}
                stroke={isSelected ? 'white' : 'rgba(0,0,0,0.4)'}
                strokeWidth={isSelected ? 3 : 1.5}
                style={{
                  filter: score >= 30
                    ? `drop-shadow(0 0 ${score >= 80 ? '10px' : '6px'} ${getEnergyColorCSS(score)})`
                    : undefined,
                  transition: 'r 0.3s, stroke-width 0.2s',
                }}
              />

              {/* Icon */}
              {(() => {
                const Icon = getCategoryIcon(venue.category)
                const iconSize = markerSize * (isCluster ? 1.0 : 1.2)
                return (
                  <foreignObject
                    x={pos.x - iconSize / 2}
                    y={pos.y - iconSize / 2}
                    width={iconSize}
                    height={iconSize}
                    className="pointer-events-none"
                  >
                    <div className="w-full h-full flex items-center justify-center text-white">
                      <Icon weight="fill" className={cn(
                        "w-full h-full drop-shadow",
                        score === 0 && "text-white/50"
                      )} />
                    </div>
                  </foreignObject>
                )
              })()}

              {/* Cluster count badge */}
              {isCluster && (
                <>
                  <circle
                    cx={pos.x + markerSize * 0.7}
                    cy={pos.y - markerSize * 0.7}
                    r={8} fill="white"
                  />
                  <text
                    x={pos.x + markerSize * 0.7}
                    y={pos.y - markerSize * 0.7 + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="9"
                    fontWeight="bold"
                    fill="#0d0d1a"
                  >
                    {cluster.venues.length}
                  </text>
                </>
              )}

              {/* Activity ping */}
              {score >= 50 && (
                <circle
                  cx={pos.x} cy={pos.y}
                  r={markerSize * 1.6}
                  fill="none"
                  stroke={getEnergyColorCSS(score)}
                  strokeWidth={1.5}
                  opacity={0}
                  className="animate-ping"
                  style={{ animationDuration: '2s' }}
                />
              )}
            </g>
          )
        })}
      </svg>

      {/* Phase 3: Friend location dots */}
      <FriendMapDots
        friends={useMemo(() => {
          // Generate demo friend dots near top venues
          const topVenues = [...venues].sort((a, b) => b.pulseScore - a.pulseScore).slice(0, 4)
          return topVenues.map((v, i) => ({
            id: `friend-${i}`,
            username: ['Alex', 'Sam', 'Jordan', 'Taylor'][i] || `Friend ${i}`,
            avatar: '',
            lat: v.location.lat + (Math.random() - 0.5) * 0.002,
            lng: v.location.lng + (Math.random() - 0.5) * 0.002,
            venueId: v.id,
            venueName: v.name,
            visibility: 'everyone' as const,
          }))
        }, [venues])}
        latLngToPixel={(lat, lng) => latLngToPixel(lat, lng, center, zoom, dimensions)}
        zoom={zoom}
      />

      {/* Interactive hit targets & labels (HTML overlay) */}
      {clusters.map((cluster) => {
        const pos = latLngToPixel(cluster.center.lat, cluster.center.lng, center, zoom, dimensions)
        if (pos.x < -60 || pos.x > dimensions.width + 60 || pos.y < -60 || pos.y > dimensions.height + 60) {
          return null
        }

        const venue = cluster.topVenue
        const isSelected = selectedVenue?.id === venue.id
        const showLabel = zoom >= 0.8 || venue.pulseScore >= 60 || isSelected

        const distance = userLocation
          ? calculateDistance(userLocation.lat, userLocation.lng, venue.location.lat, venue.location.lng)
          : undefined

        return (
          <div
            key={`hit-${venue.id}`}
            className="absolute pointer-events-none"
            style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)' }}
          >
            {/* Tap target */}
            <button
              className="pointer-events-auto relative z-20 cursor-pointer active:scale-90 transition-transform"
              onClick={() => handleMarkerClick(cluster.venues.length === 1 ? venue : venue)}
              aria-label={`${venue.name}, pulse score ${venue.pulseScore}`}
            >
              <div className="w-12 h-12" />
            </button>

            {/* Label */}
            <AnimatePresence>
              {showLabel && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-10"
                >
                  <div className={cn(
                    "bg-card/95 backdrop-blur-sm border rounded-lg px-2.5 py-1.5 shadow-xl transition-all",
                    isSelected
                      ? "border-accent bg-card shadow-accent/20 scale-105"
                      : "border-border/50"
                  )}>
                    <p className="text-xs font-bold leading-tight">{venue.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {venue.category && (
                        <span className="text-[10px] text-muted-foreground uppercase font-mono">{venue.category}</span>
                      )}
                      {distance !== undefined && (
                        <>
                          {venue.category && <span className="text-[10px] text-muted-foreground">·</span>}
                          <span className="text-[10px] text-accent font-mono font-bold">
                            {formatDistance(distance, unitSystem)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}

      {/* Empty state */}
      {filteredVenues.filter(v => {
        const pos = getVenuePixelPosition(v)
        return pos && pos.x >= 0 && pos.x <= dimensions.width && pos.y >= 0 && pos.y <= dimensions.height
      }).length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <Card className="bg-card/95 backdrop-blur-xl border-border p-6 text-center max-w-xs shadow-2xl">
            <MapPin size={32} weight="fill" className="mx-auto text-muted-foreground mb-3" />
            <h3 className="font-bold text-foreground mb-1">No Venues in View</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Zoom out or pan to discover nearby spots
            </p>
            <Button size="sm" variant="outline" className="pointer-events-auto" onClick={handleCenterOnUser}>
              <NavigationArrow size={14} weight="fill" className="mr-1.5" />
              Center on Me
            </Button>
          </Card>
        </motion.div>
      )}

      {/* --- Top controls --- */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-start gap-2 pointer-events-auto">
          <div className="flex-1 max-w-md">
            <MapSearch
              venues={venues}
              onVenueSelect={handleVenueSelect}
              userLocation={userLocation}
            />
          </div>
        </div>

        {/* Quick filter chips */}
        <div className="flex gap-1.5 flex-wrap max-w-md pointer-events-auto">
          {[
            {
              key: 'bars',
              icon: BeerBottle,
              label: 'Bars',
              active: filters.categories.includes('bar'),
              toggle: () => {
                setFilters(f => ({
                  ...f,
                  categories: f.categories.includes('bar')
                    ? f.categories.filter(c => c !== 'bar')
                    : [...f.categories, 'bar']
                }))
              }
            },
            {
              key: 'clubs',
              icon: MusicNotes,
              label: 'Clubs',
              active: filters.categories.includes('club') || filters.categories.includes('nightclub'),
              toggle: () => {
                const has = filters.categories.includes('club') || filters.categories.includes('nightclub')
                setFilters(f => ({
                  ...f,
                  categories: has
                    ? f.categories.filter(c => c !== 'club' && c !== 'nightclub')
                    : [...f.categories, 'club', 'nightclub']
                }))
              }
            },
            {
              key: 'near',
              icon: MapPin,
              label: 'Near Me',
              active: nearMeActive,
              color: 'primary',
              toggle: () => setNearMeActive(!nearMeActive),
            },
            {
              key: 'hot',
              icon: Fire,
              label: 'Hot',
              active: filters.energyLevels.includes('electric') || filters.energyLevels.includes('buzzing'),
              color: 'orange',
              toggle: () => {
                const has = filters.energyLevels.includes('electric') || filters.energyLevels.includes('buzzing')
                setFilters(f => ({
                  ...f,
                  energyLevels: has
                    ? f.energyLevels.filter(e => e !== 'electric' && e !== 'buzzing')
                    : [...f.energyLevels, 'electric', 'buzzing']
                }))
              }
            },
            {
              key: 'full',
              label: showFullHeatmap ? 'Top 20' : 'Show All',
              active: showFullHeatmap,
              toggle: () => setShowFullHeatmap(!showFullHeatmap),
            },
          ].map(chip => {
            const ChipIcon = chip.icon
            return (
              <motion.button
                key={chip.key}
                whileTap={{ scale: 0.95 }}
                onClick={chip.toggle}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  "border backdrop-blur-md shadow-lg",
                  chip.active
                    ? chip.color === 'orange'
                      ? "bg-orange-500 text-white border-orange-500 shadow-orange-500/25"
                      : chip.color === 'primary'
                        ? "bg-primary text-primary-foreground border-primary shadow-primary/25"
                        : "bg-accent text-accent-foreground border-accent shadow-accent/25"
                    : "bg-card/80 text-foreground border-border/50 hover:bg-card hover:border-border"
                )}
              >
                {ChipIcon && <ChipIcon size={14} weight="fill" className="inline mr-1" />}
                {chip.label}
              </motion.button>
            )
          })}

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCityHeatmap(true)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all border backdrop-blur-md shadow-lg bg-card/80 text-foreground border-border/50 hover:bg-card hover:border-border"
          >
            <ThermometerHot size={14} weight="fill" className="inline mr-1" />
            Heatmap
          </motion.button>
        </div>
      </div>

      {/* --- Right controls --- */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        {/* Venue count */}
        <Card className="bg-card/90 backdrop-blur-md border-border/50 px-3 py-2 shadow-xl">
          <div className="flex items-center gap-2">
            <MapPin size={14} weight="fill" className="text-primary" />
            <span className="text-xs font-bold tabular-nums">{filteredVenues.length}</span>
            <span className="text-xs text-muted-foreground">
              {filteredVenues.length === 1 ? 'venue' : 'venues'}
            </span>
          </div>
        </Card>

        <MapFilters
          filters={filters}
          onChange={setFilters}
          availableCategories={availableCategories}
        />

        {/* Zoom & location controls */}
        <Card className="bg-card/90 backdrop-blur-md border-border/50 p-1.5 shadow-xl">
          <div className="flex flex-col gap-0.5">
            <Button size="icon" variant="ghost" className="h-9 w-9 hover:bg-secondary" onClick={handleZoomIn} title="Zoom in">
              <Plus size={18} weight="bold" />
            </Button>
            <div className="h-px bg-border/50 mx-1" />
            <Button size="icon" variant="ghost" className="h-9 w-9 hover:bg-secondary" onClick={handleZoomOut} title="Zoom out">
              <Minus size={18} weight="bold" />
            </Button>
            <div className="h-px bg-border/50 mx-1" />
            <Button
              size="icon"
              variant="ghost"
              className={cn("h-9 w-9", followUser && "bg-primary/15 text-primary")}
              onClick={handleCenterOnUser}
              title="Center on me"
            >
              <NavigationArrow size={18} weight="fill" />
            </Button>
          </div>
        </Card>

        {/* Zoom level */}
        <div className="text-[10px] font-mono text-muted-foreground/70 text-center tabular-nums">
          {zoom.toFixed(1)}x
        </div>
      </div>

      {/* --- Bottom left controls --- */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2" style={{ bottom: selectedVenue ? '196px' : '16px', transition: 'bottom 0.3s ease' }}>
        <GPSIndicator isTracking={isTracking} accuracy={locationAccuracy} />

        {(filters.energyLevels.length > 0 || filters.categories.length > 0 || filters.maxDistance !== Infinity) && (
          <Card className="bg-card/90 backdrop-blur-md border-border/50 px-3 py-2 shadow-lg">
            <p className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground">{filteredVenues.length}</span> of {venues.length} venues
            </p>
          </Card>
        )}

        {/* Legend */}
        <Card className="bg-card/90 backdrop-blur-md border-border/50 overflow-hidden shadow-lg">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-secondary/30 transition-colors"
          >
            <span className="text-xs font-bold">Energy</span>
            {showLegend ? <CaretUp size={12} className="text-muted-foreground" /> : <CaretDown size={12} className="text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {showLegend && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 space-y-1.5">
                  {[
                    { color: 'oklch(0.65 0.28 320)', label: 'Electric' },
                    { color: 'oklch(0.65 0.25 25)', label: 'Buzzing' },
                    { color: 'oklch(0.65 0.18 240)', label: 'Chill' },
                    { color: 'oklch(0.35 0.05 240)', label: 'Dead' },
                  ].map(level => (
                    <div key={level.label} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: level.color }} />
                      <span className="text-[11px] text-muted-foreground">{level.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      {/* --- Bottom venue sheet --- */}
      <MapVenueSheet
        venue={selectedVenue}
        venues={filteredVenues}
        userLocation={userLocation}
        onClose={() => setSelectedVenue(null)}
        onVenueClick={(v) => {
          handleMarkerClick(v)
          setCenter({ lat: v.location.lat, lng: v.location.lng })
        }}
        onViewDetails={(v) => {
          onVenueClick(v)
          setSelectedVenue(null)
        }}
        calculateDistance={calculateDistance}
      />

      {/* City heatmap overlay */}
      <CityHeatmap
        venues={venues}
        userLocation={userLocation}
        onVenueClick={onVenueClick}
        visible={showCityHeatmap}
        onClose={() => setShowCityHeatmap(false)}
      />
    </div>
  )
}
