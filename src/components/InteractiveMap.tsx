import { useEffect, useRef, useState, useMemo } from 'react'
import { Venue } from '@/lib/types'
import { PulseScore } from '@/components/PulseScore'
import { MapFilters, MapFiltersState } from '@/components/MapFilters'
import { MapSearch } from '@/components/MapSearch'
import { GPSIndicator } from '@/components/GPSIndicator'
import {
  MapPin, NavigationArrow, Plus, Minus, Info, CaretDown, CaretUp,
  BeerBottle, MusicNotes, ForkKnife, Coffee, Martini, Confetti,
  Users, Fire, Lightning
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistance } from '@/lib/units'
import { useUnitPreference } from '@/hooks/use-unit-preference'

interface InteractiveMapProps {
  venues: Venue[]
  userLocation: { lat: number; lng: number } | null
  onVenueClick: (venue: Venue) => void
  isTracking?: boolean
  locationAccuracy?: number
}

export function InteractiveMap({ venues, userLocation, onVenueClick, isTracking = false, locationAccuracy }: InteractiveMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [hoveredVenue, setHoveredVenue] = useState<Venue | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [followUser, setFollowUser] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null) // Optimization: Reuse canvas
  const [filters, setFilters] = useState<MapFiltersState>({
    energyLevels: [],
    categories: [],
    maxDistance: Infinity
  })
  const [nearMeActive, setNearMeActive] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null)
  const { unitSystem } = useUnitPreference()
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    // If no location after 3s, default to first venue or SF
    loadingTimeoutRef.current = window.setTimeout(() => {
      if (!center && !userLocation && venues.length > 0) {
        setCenter({ lat: venues[0].location.lat, lng: venues[0].location.lng })
        setFollowUser(false)
      }
    }, 3000)

    return () => clearTimeout(loadingTimeoutRef.current)
  }, [center, userLocation, venues])

  useEffect(() => {
    if (userLocation && followUser) {
      setCenter(userLocation)
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
    }
  }, [userLocation, followUser])

  useEffect(() => {
    if (userLocation && !center) {
      setCenter(userLocation)
    }
  }, [userLocation, center])

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 3958.8
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  const getEnergyLevelFromScore = (score: number): string => {
    if (score >= 80) return 'electric'
    if (score >= 60) return 'buzzing'
    if (score >= 30) return 'chill'
    return 'dead'
  }

  const getCategoryIcon = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'bar': return BeerBottle
      case 'club': return MusicNotes
      case 'nightclub': return MusicNotes
      case 'restaurant': return ForkKnife
      case 'food': return ForkKnife
      case 'cafe': return Coffee
      case 'lounge': return Martini
      case 'event': return Confetti
      default: return MapPin
    }
  }

  const filteredVenues = useMemo(() => {
    return venues.filter((venue) => {
      if (filters.energyLevels.length > 0) {
        const energyLevel = getEnergyLevelFromScore(venue.pulseScore)
        if (!filters.energyLevels.includes(energyLevel as any)) {
          return false
        }
      }

      if (filters.categories.length > 0 && venue.category) {
        if (!filters.categories.includes(venue.category)) {
          return false
        }
      }

      if (filters.maxDistance !== Infinity && userLocation) {
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          venue.location.lat,
          venue.location.lng
        )
        if (distance > filters.maxDistance) {
          return false
        }
      }
      // Near Me filter (0.5 mile radius)
      if (nearMeActive && userLocation) {
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          venue.location.lat,
          venue.location.lng
        )
        if (distance > 0.5) {
          return false
        }
      }

      return true
    })
  }, [venues, filters, userLocation, nearMeActive])

  const availableCategories = Array.from(
    new Set(venues.map((v) => v.category).filter((c): c is string => !!c))
  ).sort()

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        setDimensions({ width, height })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  useEffect(() => {
    if (!canvasRef.current || !center) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = dimensions.width * window.devicePixelRatio
    canvas.height = dimensions.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    drawHeatmap(ctx, filteredVenues, center, zoom, dimensions)
  }, [filteredVenues, center, zoom, dimensions])

  const latLngToPixel = (
    lat: number,
    lng: number,
    mapCenter: { lat: number; lng: number },
    mapZoom: number,
    dims: { width: number; height: number }
  ) => {
    const scale = 500000 * mapZoom
    const x = dims.width / 2 + (lng - mapCenter.lng) * scale
    const y = dims.height / 2 - (lat - mapCenter.lat) * scale
    return { x, y }
  }

  const pixelToLatLng = (
    x: number,
    y: number,
    mapCenter: { lat: number; lng: number },
    mapZoom: number,
    dims: { width: number; height: number }
  ) => {
    const scale = 500000 * mapZoom
    const lng = mapCenter.lng + (x - dims.width / 2) / scale
    const lat = mapCenter.lat - (y - dims.height / 2) / scale
    return { lat, lng }
  }

  const drawHeatmap = (
    ctx: CanvasRenderingContext2D,
    venueList: Venue[],
    mapCenter: { lat: number; lng: number },
    mapZoom: number,
    dims: { width: number; height: number }
  ) => {
    ctx.clearRect(0, 0, dims.width, dims.height)

    // Clean dark background with subtle vignette
    const bgGradient = ctx.createRadialGradient(
      dims.width / 2, dims.height / 2, 0,
      dims.width / 2, dims.height / 2, Math.max(dims.width, dims.height) * 0.7
    )
    bgGradient.addColorStop(0, 'oklch(0.18 0.01 260)')
    bgGradient.addColorStop(1, 'oklch(0.12 0 0)')
    ctx.fillStyle = bgGradient
    ctx.fillRect(0, 0, dims.width, dims.height)

    // Subtle dot grid pattern instead of lines
    ctx.fillStyle = 'oklch(0.25 0 0 / 0.3)'
    const dotSpacing = 40 * mapZoom
    const dotSize = 1.5
    for (let x = dotSpacing; x < dims.width; x += dotSpacing) {
      for (let y = dotSpacing; y < dims.height; y += dotSpacing) {
        ctx.beginPath()
        ctx.arc(x, y, dotSize, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas')
    }
    const heatmapCanvas = offscreenCanvasRef.current

    // Resize only if needed to avoid flicker/perf hit
    if (heatmapCanvas.width !== dims.width || heatmapCanvas.height !== dims.height) {
      heatmapCanvas.width = dims.width
      heatmapCanvas.height = dims.height
    } else {
      // Clear previous draw
      const offCtx = heatmapCanvas.getContext('2d')
      offCtx?.clearRect(0, 0, dims.width, dims.height)
    }

    const heatmapCtx = heatmapCanvas.getContext('2d')
    if (!heatmapCtx) return

    venueList.forEach((venue) => {
      if (venue.pulseScore <= 0) return

      const pos = latLngToPixel(venue.location.lat, venue.location.lng, mapCenter, mapZoom, dims)
      const intensity = Math.min(venue.pulseScore / 100, 1)
      const radius = Math.max(40 * mapZoom * (0.5 + intensity * 0.5), 20)

      const gradient = heatmapCtx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius)

      if (venue.pulseScore >= 80) {
        gradient.addColorStop(0, `rgba(217, 70, 239, ${intensity * 0.9})`) // Neon Fuchsia
        gradient.addColorStop(0.5, `rgba(217, 70, 239, ${intensity * 0.5})`)
      } else if (venue.pulseScore >= 60) {
        gradient.addColorStop(0, `rgba(244, 63, 94, ${intensity * 0.8})`) // Neon Rose
        gradient.addColorStop(0.5, `rgba(244, 63, 94, ${intensity * 0.4})`)
      } else if (venue.pulseScore >= 30) {
        gradient.addColorStop(0, `rgba(14, 165, 233, ${intensity * 0.7})`) // Neon Sky
        gradient.addColorStop(0.5, `rgba(14, 165, 233, ${intensity * 0.35})`)
      } else {
        gradient.addColorStop(0, `rgba(99, 102, 241, ${intensity * 0.5})`) // Indigo
        gradient.addColorStop(0.5, `rgba(99, 102, 241, ${intensity * 0.25})`)
      }
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

      heatmapCtx.fillStyle = gradient
      heatmapCtx.fillRect(pos.x - radius, pos.y - radius, radius * 2, radius * 2)
    })

    ctx.globalCompositeOperation = 'screen'
    ctx.drawImage(heatmapCanvas, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setFollowUser(false)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !center) return

    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y

    const scale = 500000 * zoom
    const newCenter = {
      lng: center.lng - dx / scale,
      lat: center.lat + dy / scale
    }

    setCenter(newCenter)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDragStart(null)
  }

  const handleZoomIn = () => {
    setZoom((z) => Math.min(z * 1.5, 5))
    setFollowUser(false)
  }

  const handleZoomOut = () => {
    setZoom((z) => Math.max(z / 1.5, 0.5))
    setFollowUser(false)
  }

  const handleCenterOnUser = () => {
    if (userLocation) {
      setCenter(userLocation)
      setZoom(1)
      setFollowUser(true)
    }
  }

  // Touch event handlers for mobile
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setLastTouchDistance(getTouchDistance(e.touches))
    } else if (e.touches.length === 1) {
      setIsDragging(true)
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
      setFollowUser(false)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance !== null) {
      // Pinch to zoom
      const newDistance = getTouchDistance(e.touches)
      if (newDistance !== null) {
        const scale = newDistance / lastTouchDistance
        setZoom(z => Math.max(0.5, Math.min(5, z * scale)))
        setLastTouchDistance(newDistance)
        setFollowUser(false)
      }
    } else if (e.touches.length === 1 && isDragging && dragStart && center) {
      // Touch pan
      const dx = e.touches[0].clientX - dragStart.x
      const dy = e.touches[0].clientY - dragStart.y
      const scale = 500000 * zoom
      setCenter({
        lng: center.lng - dx / scale,
        lat: center.lat + dy / scale
      })
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    setDragStart(null)
    setLastTouchDistance(null)
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!center) return
    const panAmount = 0.0005 / zoom

    switch (e.key) {
      case 'ArrowUp':
        setCenter({ ...center, lat: center.lat + panAmount })
        setFollowUser(false)
        break
      case 'ArrowDown':
        setCenter({ ...center, lat: center.lat - panAmount })
        setFollowUser(false)
        break
      case 'ArrowLeft':
        setCenter({ ...center, lng: center.lng - panAmount })
        setFollowUser(false)
        break
      case 'ArrowRight':
        setCenter({ ...center, lng: center.lng + panAmount })
        setFollowUser(false)
        break
      case '+':
      case '=':
        handleZoomIn()
        break
      case '-':
        handleZoomOut()
        break
    }
  }

  const handleVenueSelect = (venue: Venue) => {
    setCenter({ lat: venue.location.lat, lng: venue.location.lng })
    setZoom(2)
    setFollowUser(false)
    setTimeout(() => {
      setHoveredVenue(venue)
      setTimeout(() => {
        setHoveredVenue(null)
      }, 3000)
    }, 300)
  }

  const getVenuePixelPosition = (venue: Venue) => {
    if (!center) return null
    return latLngToPixel(venue.location.lat, venue.location.lng, center, zoom, dimensions)
  }

  if (!center) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-secondary rounded-xl">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-accent"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <canvas
        ref={canvasRef}
        className={cn(
          'absolute inset-0 w-full h-full touch-none',
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {filteredVenues.map((venue) => {
          const pos = getVenuePixelPosition(venue)
          if (!pos || pos.x < 0 || pos.x > dimensions.width || pos.y < 0 || pos.y > dimensions.height)
            return null

          const getEnergyColor = (score: number) => {
            if (score >= 80) return 'oklch(0.65 0.28 320)' // Hot Pink
            if (score >= 60) return 'oklch(0.65 0.25 25)'  // Orange/Red
            if (score >= 30) return 'oklch(0.65 0.18 240)' // Blue
            return 'oklch(0.40 0.05 260)' // Muted
          }

          const baseSize = 12
          const scale = venue.pulseScore > 0 ? 1 + (venue.pulseScore / 100) : 1
          const markerSize = baseSize * zoom * scale * 0.6
          const isHighlighted = hoveredVenue?.id === venue.id
          const isHighEnergy = venue.pulseScore >= 80

          // Check for recent activity (within last 10 minutes)
          const hasRecentActivity = venue.lastActivity
            ? (Date.now() - new Date(venue.lastActivity).getTime()) < 10 * 60 * 1000
            : venue.pulseScore >= 50

          const Icon = getCategoryIcon(venue.category)
          const iconSize = markerSize * 1.2

          return (
            <g key={venue.id} className="pointer-events-none">
              {isHighEnergy && (
                <>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={markerSize * 2.5}
                    fill={getEnergyColor(venue.pulseScore)}
                    opacity={0.15}
                    className="animate-pulse-glow"
                    style={{ animationDuration: '3s' }}
                  />
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={markerSize * 1.8}
                    fill={getEnergyColor(venue.pulseScore)}
                    opacity={0.25}
                    className="animate-pulse"
                    style={{ animationDuration: '2s' }}
                  />
                </>
              )}

              {/* Main Marker Background */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={markerSize}
                fill={venue.pulseScore > 0 ? getEnergyColor(venue.pulseScore) : 'oklch(0.25 0.05 260)'}
                stroke={isHighlighted ? 'white' : 'oklch(0.15 0 0)'}
                strokeWidth={isHighlighted ? 3 : 1.5}
                className="transition-all duration-300"
                filter={isHighEnergy ? "drop-shadow(0 0 6px rgba(217, 70, 239, 0.5))" : undefined}
              />

              {/* Icon Overlay inside Marker */}
              <foreignObject
                x={pos.x - iconSize / 2}
                y={pos.y - iconSize / 2}
                width={iconSize}
                height={iconSize}
                className="pointer-events-none"
              >
                <div className="w-full h-full flex items-center justify-center text-white">
                  <Icon
                    weight="fill"
                    className={cn(
                      "w-full h-full drop-shadow-md",
                      venue.pulseScore === 0 && "text-white/50"
                    )}
                  />
                </div>
              </foreignObject>

              {/* Live Activity Ping */}
              {hasRecentActivity && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={markerSize * 1.5}
                  fill="none"
                  stroke={getEnergyColor(venue.pulseScore)}
                  strokeWidth={2}
                  opacity={0}
                  className="animate-ping"
                  style={{ animationDuration: '1.5s' }}
                />
              )}
            </g>
          )
        })}

        {userLocation && (() => {
          const userPos = latLngToPixel(userLocation.lat, userLocation.lng, center, zoom, dimensions)
          const accuracyRadiusInMeters = locationAccuracy || 50
          const metersToPixels = (meters: number) => {
            const scale = 500000 * zoom
            const metersPerDegree = 111320
            return (meters / metersPerDegree) * scale
          }
          const accuracyRadius = metersToPixels(accuracyRadiusInMeters)

          return (
            <g>
              {locationAccuracy && (
                <circle
                  cx={userPos.x}
                  cy={userPos.y}
                  r={accuracyRadius}
                  fill="oklch(0.75 0.18 195)"
                  opacity={0.15}
                  stroke="oklch(0.75 0.18 195)"
                  strokeWidth={1}
                  strokeOpacity={0.3}
                />
              )}
              <circle
                cx={userPos.x}
                cy={userPos.y}
                r={12 * zoom}
                fill="oklch(0.75 0.18 195)"
                opacity={0.3}
                className="animate-pulse"
              />
              <circle
                cx={userPos.x}
                cy={userPos.y}
                r={6 * zoom}
                fill="oklch(0.75 0.18 195)"
                stroke="oklch(0.98 0 0)"
                strokeWidth={2 * zoom}
              />
            </g>
          )
        })()}
      </svg>

      {filteredVenues.map((venue) => {
        const pos = getVenuePixelPosition(venue)
        if (!pos || pos.x < -50 || pos.x > dimensions.width + 50 || pos.y < -50 || pos.y > dimensions.height + 50)
          return null

        const showLabel = zoom >= 1.2 || venue.pulseScore >= 70 || hoveredVenue?.id === venue.id
        const isHovered = hoveredVenue?.id === venue.id

        const distance = userLocation
          ? calculateDistance(
            userLocation.lat,
            userLocation.lng,
            venue.location.lat,
            venue.location.lng
          )
          : undefined

        return (
          <div
            key={venue.id}
            className="absolute pointer-events-none"
            style={{
              left: pos.x,
              top: pos.y,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <button
              className="pointer-events-auto relative z-20 cursor-pointer hover:scale-110 transition-transform"
              onMouseEnter={() => setHoveredVenue(venue)}
              onMouseLeave={() => setHoveredVenue(null)}
              onClick={() => onVenueClick(venue)}
            >
              <div className="w-10 h-10" />
            </button>
            <AnimatePresence>
              {showLabel && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 5 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute top-full mt-3 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-10"
                >
                  {isHovered && (
                    <motion.div
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 w-0.5 h-3 bg-gradient-to-t from-border to-transparent mb-0.5 origin-bottom"
                    />
                  )}
                  <div className={cn(
                    "bg-card/95 backdrop-blur-sm border border-border rounded-lg px-2.5 py-1.5 shadow-lg transition-all",
                    isHovered && "bg-card border-accent shadow-2xl scale-110",
                    venue.pulseScore >= 70 && "border-accent/50"
                  )}>
                    <p className="text-xs font-bold">{venue.name}</p>
                    <div className="flex items-center gap-2">
                      {venue.category && (
                        <p className="text-[10px] text-muted-foreground uppercase font-mono">
                          {venue.category}
                        </p>
                      )}
                      {distance !== undefined && (
                        <>
                          {venue.category && (
                            <span className="text-[10px] text-muted-foreground">•</span>
                          )}
                          <p className="text-[10px] text-accent font-mono font-bold">
                            {formatDistance(distance, unitSystem)}
                          </p>
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

      <AnimatePresence>
        {hoveredVenue && (() => {
          const pos = getVenuePixelPosition(hoveredVenue)
          if (!pos) return null

          const distance = userLocation
            ? calculateDistance(
              userLocation.lat,
              userLocation.lng,
              hoveredVenue.location.lat,
              hoveredVenue.location.lng
            )
            : undefined

          const tooltipWidth = 240
          const tooltipHeight = 100
          const padding = 16

          let left = pos.x
          let top = pos.y - tooltipHeight - 20

          if (left - tooltipWidth / 2 < padding) {
            left = tooltipWidth / 2 + padding
          } else if (left + tooltipWidth / 2 > dimensions.width - padding) {
            left = dimensions.width - tooltipWidth / 2 - padding
          }

          if (top < padding) {
            top = pos.y + 30
          }

          return (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute pointer-events-none z-50"
              style={{
                left,
                top,
                width: tooltipWidth,
                transform: 'translateX(-50%)'
              }}
            >
              <Card className="bg-card/98 backdrop-blur-md border-border shadow-2xl relative overflow-hidden">
                {/* Header Decoration */}
                <div
                  className={cn(
                    "absolute top-0 left-0 right-0 h-1",
                    hoveredVenue.pulseScore >= 80 ? "bg-gradient-to-r from-fuchsia-500 to-cyan-500" :
                      hoveredVenue.pulseScore >= 60 ? "bg-rose-500" :
                        hoveredVenue.pulseScore >= 30 ? "bg-sky-500" : "bg-slate-700"
                  )}
                />

                <div className="p-3 pt-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <h3 className="font-bold text-sm truncate">{hoveredVenue.name}</h3>
                        {hoveredVenue.pulseScore >= 80 && (
                          <Fire size={14} weight="fill" className="text-orange-500 animate-pulse" />
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase font-mono border-accent/30 text-accent bg-accent/5">
                          {hoveredVenue.category || 'Venue'}
                        </Badge>
                        {distance !== undefined && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatDistance(distance, unitSystem)}
                          </span>
                        )}
                      </div>
                    </div>
                    <PulseScore score={hoveredVenue.pulseScore} size="sm" showLabel={false} />
                  </div>

                  {hoveredVenue.location.address && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin size={12} weight="fill" />
                      <p className="text-[10px] line-clamp-1">
                        {hoveredVenue.location.address}
                      </p>
                    </div>
                  )}

                  {/* Social Signals / Stats simulated */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Users size={12} />
                        <span className="font-medium">{Math.floor(hoveredVenue.pulseScore * 1.5 + 5)} here</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Lightning size={12} className={hoveredVenue.pulseScore > 50 ? "text-yellow-500" : ""} />
                        <span className="font-medium">{hoveredVenue.pulseScore > 80 ? "Trending" : hoveredVenue.pulseScore > 50 ? "Active" : "Quiet"}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-primary font-bold cursor-pointer hover:underline">View</span>
                  </div>
                </div>
                {/* Pointer arrow */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-card/98"
                  style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))' }}
                />
              </Card>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      <div className="absolute top-4 left-4 right-4 z-10 flex items-start gap-2">
        <div className="flex-1 max-w-md">
          <MapSearch
            venues={venues}
            onVenueSelect={handleVenueSelect}
            userLocation={userLocation}
          />
        </div>
      </div>

      {/* Consolidated Right Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        {/* Venue Count Badge */}
        <Card className="bg-card/95 backdrop-blur-sm border-border px-3 py-2 shadow-lg">
          <div className="flex items-center gap-2">
            <MapPin size={16} weight="fill" className="text-primary" />
            <div className="text-xs">
              <span className="font-bold text-foreground">{filteredVenues.length}</span>
              <span className="text-muted-foreground ml-1">
                {filteredVenues.length === 1 ? 'venue' : 'venues'}
              </span>
            </div>
          </div>
        </Card>

        <MapFilters
          filters={filters}
          onChange={setFilters}
          availableCategories={availableCategories}
        />

        {/* Unified Control Group */}
        <Card className="bg-card/95 backdrop-blur-sm border-border p-1.5 shadow-lg">
          <div className="flex flex-col gap-1">
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 hover:bg-secondary"
                onClick={handleZoomIn}
                title="Zoom in (+)"
              >
                <Plus size={18} weight="bold" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 hover:bg-secondary"
                onClick={handleZoomOut}
                title="Zoom out (-)"
              >
                <Minus size={18} weight="bold" />
              </Button>
            </div>
            <div className="h-px bg-border" />
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  "h-8 w-8",
                  followUser && "bg-accent text-accent-foreground"
                )}
                onClick={handleCenterOnUser}
                title="Center on me"
              >
                <NavigationArrow size={18} weight="fill" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  "h-8 w-8",
                  nearMeActive && "bg-accent text-accent-foreground"
                )}
                onClick={() => setNearMeActive(!nearMeActive)}
                title="Near me (0.5 mi)"
              >
                <MapPin size={18} weight="fill" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Zoom Level Indicator */}
        <div className="text-[10px] font-mono text-muted-foreground text-center bg-card/80 backdrop-blur-sm rounded px-2 py-1">
          {zoom.toFixed(1)}x
        </div>
      </div>

      {/* Bottom Left Controls */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2">
        <GPSIndicator isTracking={isTracking} accuracy={locationAccuracy} />

        {(filters.energyLevels.length > 0 ||
          filters.categories.length > 0 ||
          filters.maxDistance !== Infinity) && (
            <Card className="bg-card/95 backdrop-blur-sm border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-bold text-foreground">{filteredVenues.length}</span> of{' '}
                {venues.length} venues
              </p>
            </Card>
          )}

        {/* Collapsible Legend */}
        <Card className="bg-card/95 backdrop-blur-sm border-border overflow-hidden">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-secondary/50 transition-colors"
          >
            <span className="text-xs font-bold text-foreground">Energy Levels</span>
            {showLegend ? (
              <CaretUp size={14} className="text-muted-foreground" />
            ) : (
              <CaretDown size={14} className="text-muted-foreground" />
            )}
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
                <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[oklch(0.35_0.05_240)] border border-border" />
                    <span className="text-xs text-muted-foreground">Dead</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[oklch(0.60_0.15_150)] border border-foreground/20" />
                    <span className="text-xs text-muted-foreground">Chill</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[oklch(0.70_0.22_60)] border border-foreground/20 shadow-sm" />
                    <span className="text-xs text-muted-foreground">Buzzing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[oklch(0.65_0.28_340)] border border-foreground/20 shadow-sm animate-pulse-glow" />
                    <span className="text-xs text-muted-foreground">Electric</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </div>
  )
}
