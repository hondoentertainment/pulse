import { useEffect, useRef, useState } from 'react'
import { Venue } from '@/lib/types'
import { PulseScore } from '@/components/PulseScore'
import { MapPin, NavigationArrow, Plus, Minus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface InteractiveMapProps {
  venues: Venue[]
  userLocation: { lat: number; lng: number } | null
  onVenueClick: (venue: Venue) => void
}

export function InteractiveMap({ venues, userLocation, onVenueClick }: InteractiveMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [hoveredVenue, setHoveredVenue] = useState<Venue | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (userLocation && !center) {
      setCenter(userLocation)
    }
  }, [userLocation, center])

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

    drawHeatmap(ctx, venues, center, zoom, dimensions)
  }, [venues, center, zoom, dimensions])

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

    const gradient = ctx.createLinearGradient(0, dims.height, 0, 0)
    gradient.addColorStop(0, 'oklch(0.15 0 0)')
    gradient.addColorStop(1, 'oklch(0.20 0 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, dims.width, dims.height)

    ctx.strokeStyle = 'oklch(0.35 0 0 / 0.3)'
    ctx.lineWidth = 1
    const gridSize = 50 * mapZoom
    for (let x = 0; x < dims.width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, dims.height)
      ctx.stroke()
    }
    for (let y = 0; y < dims.height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(dims.width, y)
      ctx.stroke()
    }

    const heatmapCanvas = document.createElement('canvas')
    heatmapCanvas.width = dims.width
    heatmapCanvas.height = dims.height
    const heatmapCtx = heatmapCanvas.getContext('2d')
    if (!heatmapCtx) return

    venueList.forEach((venue) => {
      if (venue.pulseScore <= 0) return

      const pos = latLngToPixel(venue.location.lat, venue.location.lng, mapCenter, mapZoom, dims)
      const intensity = Math.min(venue.pulseScore / 100, 1)
      const radius = Math.max(40 * mapZoom * (0.5 + intensity * 0.5), 20)

      const gradient = heatmapCtx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius)

      if (venue.pulseScore >= 80) {
        gradient.addColorStop(0, `rgba(168, 85, 247, ${intensity * 0.8})`)
        gradient.addColorStop(0.5, `rgba(168, 85, 247, ${intensity * 0.4})`)
      } else if (venue.pulseScore >= 60) {
        gradient.addColorStop(0, `rgba(251, 146, 60, ${intensity * 0.7})`)
        gradient.addColorStop(0.5, `rgba(251, 146, 60, ${intensity * 0.35})`)
      } else if (venue.pulseScore >= 30) {
        gradient.addColorStop(0, `rgba(34, 197, 94, ${intensity * 0.6})`)
        gradient.addColorStop(0.5, `rgba(34, 197, 94, ${intensity * 0.3})`)
      } else {
        gradient.addColorStop(0, `rgba(100, 116, 139, ${intensity * 0.5})`)
        gradient.addColorStop(0.5, `rgba(100, 116, 139, ${intensity * 0.25})`)
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
  }

  const handleZoomOut = () => {
    setZoom((z) => Math.max(z / 1.5, 0.5))
  }

  const handleCenterOnUser = () => {
    if (userLocation) {
      setCenter(userLocation)
      setZoom(1)
    }
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
    <div ref={containerRef} className="relative w-full h-full rounded-xl overflow-hidden">
      <canvas
        ref={canvasRef}
        className={cn(
          'absolute inset-0 w-full h-full',
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {venues.map((venue) => {
          const pos = getVenuePixelPosition(venue)
          if (!pos || pos.x < 0 || pos.x > dimensions.width || pos.y < 0 || pos.y > dimensions.height)
            return null

          return (
            <g key={venue.id}>
              {venue.pulseScore > 0 && (
                <>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={8 * zoom}
                    fill="oklch(0.65 0.25 300)"
                    className="animate-pulse-glow"
                    opacity={0.6}
                  />
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={4 * zoom}
                    fill="oklch(0.75 0.18 195)"
                    stroke="oklch(0.98 0 0)"
                    strokeWidth={1.5 * zoom}
                  />
                </>
              )}
              {venue.pulseScore === 0 && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={4 * zoom}
                  fill="oklch(0.35 0 0)"
                  stroke="oklch(0.65 0 0)"
                  strokeWidth={1 * zoom}
                  opacity={0.5}
                />
              )}
            </g>
          )
        })}

        {userLocation && (() => {
          const userPos = latLngToPixel(userLocation.lat, userLocation.lng, center, zoom, dimensions)
          return (
            <g>
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

      {venues.map((venue) => {
        const pos = getVenuePixelPosition(venue)
        if (!pos || pos.x < 0 || pos.x > dimensions.width || pos.y < 0 || pos.y > dimensions.height)
          return null

        return (
          <button
            key={venue.id}
            className="absolute pointer-events-auto"
            style={{
              left: pos.x,
              top: pos.y,
              transform: 'translate(-50%, -50%)'
            }}
            onMouseEnter={() => setHoveredVenue(venue)}
            onMouseLeave={() => setHoveredVenue(null)}
            onClick={() => onVenueClick(venue)}
          >
            <div className="w-8 h-8" />
          </button>
        )
      })}

      <AnimatePresence>
        {hoveredVenue && (() => {
          const pos = getVenuePixelPosition(hoveredVenue)
          if (!pos) return null

          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute pointer-events-none z-50"
              style={{
                left: Math.min(Math.max(pos.x, 120), dimensions.width - 120),
                top: Math.max(pos.y - 80, 10)
              }}
            >
              <Card className="bg-card/95 backdrop-blur-sm border-border p-3 shadow-xl">
                <div className="flex items-start gap-3 min-w-[200px]">
                  <div className="flex-1">
                    <h3 className="font-bold text-sm">{hoveredVenue.name}</h3>
                    {hoveredVenue.category && (
                      <p className="text-xs text-muted-foreground uppercase font-mono mt-1">
                        {hoveredVenue.category}
                      </p>
                    )}
                  </div>
                  <PulseScore score={hoveredVenue.pulseScore} size="sm" showLabel={false} />
                </div>
              </Card>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <Button
          size="icon"
          variant="secondary"
          className="bg-card/95 backdrop-blur-sm hover:bg-card shadow-lg"
          onClick={handleZoomIn}
        >
          <Plus size={20} weight="bold" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="bg-card/95 backdrop-blur-sm hover:bg-card shadow-lg"
          onClick={handleZoomOut}
        >
          <Minus size={20} weight="bold" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="bg-card/95 backdrop-blur-sm hover:bg-card shadow-lg"
          onClick={handleCenterOnUser}
        >
          <NavigationArrow size={20} weight="fill" />
        </Button>
      </div>

      <div className="absolute bottom-4 left-4 z-10">
        <Card className="bg-card/95 backdrop-blur-sm border-border p-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[oklch(0.35_0_0)]" />
              <span className="text-xs text-muted-foreground">Dead</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[oklch(0.60_0.15_150)]" />
              <span className="text-xs text-muted-foreground">Chill</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[oklch(0.70_0.22_60)]" />
              <span className="text-xs text-muted-foreground">Buzzing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[oklch(0.65_0.28_340)]" />
              <span className="text-xs text-muted-foreground">Electric</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
