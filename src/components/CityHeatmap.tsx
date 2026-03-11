import { useState, useEffect, useRef, useCallback } from 'react'
import { Venue } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, MapPin } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { getCityHeatmap, type HeatmapCell } from '@/lib/live-intelligence'

interface CityHeatmapProps {
  venues: Venue[]
  userLocation: { lat: number; lng: number } | null
  onVenueClick: (venue: Venue) => void
  visible: boolean
  onClose: () => void
}

function getHeatColor(intensity: number): string {
  if (intensity >= 80) return 'rgba(239, 68, 68, 0.6)' // red - electric
  if (intensity >= 60) return 'rgba(234, 179, 8, 0.5)' // yellow - buzzing
  if (intensity >= 40) return 'rgba(34, 197, 94, 0.4)' // green - chill
  if (intensity >= 20) return 'rgba(59, 130, 246, 0.3)' // blue - slow
  return 'rgba(30, 58, 138, 0.15)' // dark blue - dead
}

function getHeatLabel(intensity: number): string {
  if (intensity >= 80) return 'Electric'
  if (intensity >= 60) return 'Buzzing'
  if (intensity >= 40) return 'Chill'
  if (intensity >= 20) return 'Slow'
  return 'Dead'
}

export function CityHeatmap({ venues, userLocation, onVenueClick, visible, onClose }: CityHeatmapProps) {
  const [cells, setCells] = useState<HeatmapCell[]>([])
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 300, height: 300 })
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const radiusMiles = 5

  const refreshData = useCallback(() => {
    if (!userLocation || venues.length === 0) return
    const heatmapData = getCityHeatmap(userLocation, radiusMiles, venues)
    setCells(heatmapData)
  }, [userLocation, venues])

  useEffect(() => {
    if (!visible) return
    refreshData()

    // Auto-refresh every 30 seconds
    refreshTimerRef.current = setInterval(refreshData, 30000)
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [visible, refreshData])

  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect()
      setDimensions({ width, height: Math.min(height, width) })
    }
  }, [visible])

  // Render heatmap on canvas
  useEffect(() => {
    if (!canvasRef.current || cells.length === 0 || !userLocation) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = 'oklch(0.14 0.01 260)'
    ctx.fillRect(0, 0, dimensions.width, dimensions.height)

    const gridSize = 10
    const cellWidth = dimensions.width / gridSize
    const cellHeight = dimensions.height / gridSize

    // Draw heat cells
    for (let i = 0; i < cells.length; i++) {
      const row = Math.floor(i / gridSize)
      const col = i % gridSize
      const cell = cells[i]

      const x = col * cellWidth
      const y = row * cellHeight

      // Draw cell with gradient
      const gradient = ctx.createRadialGradient(
        x + cellWidth / 2, y + cellHeight / 2, 0,
        x + cellWidth / 2, y + cellHeight / 2, Math.max(cellWidth, cellHeight) * 0.8
      )
      gradient.addColorStop(0, getHeatColor(cell.intensity))
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

      ctx.fillStyle = gradient
      ctx.fillRect(x, y, cellWidth, cellHeight)

      // Draw cell border
      if (cell.intensity > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
        ctx.lineWidth = 0.5
        ctx.strokeRect(x, y, cellWidth, cellHeight)
      }
    }

    // Draw user location marker
    const centerX = dimensions.width / 2
    const centerY = dimensions.height / 2
    ctx.beginPath()
    ctx.arc(centerX, centerY, 6, 0, Math.PI * 2)
    ctx.fillStyle = 'oklch(0.75 0.18 195)'
    ctx.fill()
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [cells, dimensions, userLocation])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (cells.length === 0) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const gridSize = 10
    const cellWidth = dimensions.width / gridSize
    const cellHeight = dimensions.height / gridSize

    const col = Math.floor(x / cellWidth)
    const row = Math.floor(y / cellHeight)
    const idx = row * gridSize + col

    if (idx >= 0 && idx < cells.length && cells[idx].intensity > 0) {
      setSelectedCell(cells[idx])
    } else {
      setSelectedCell(null)
    }
  }

  if (!visible) return null

  const nearbyVenuesForCell = selectedCell?.topVenueId
    ? venues.filter(v => v.id === selectedCell.topVenueId)
    : []

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="absolute inset-0 z-30 bg-background/95 backdrop-blur-md flex flex-col"
        ref={containerRef}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <div>
            <h3 className="text-lg font-bold">City Energy Map</h3>
            <p className="text-xs text-muted-foreground font-mono">
              {radiusMiles} mi radius - Updates every 30s
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        {/* Legend */}
        <div className="px-4 pb-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(30, 58, 138, 0.6)' }} />
            <span className="text-[10px] text-muted-foreground">Dead</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(34, 197, 94, 0.6)' }} />
            <span className="text-[10px] text-muted-foreground">Chill</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(234, 179, 8, 0.6)' }} />
            <span className="text-[10px] text-muted-foreground">Buzzing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.7)' }} />
            <span className="text-[10px] text-muted-foreground">Electric</span>
          </div>
        </div>

        {/* Heatmap Canvas */}
        <div className="flex-1 px-4 pb-4">
          <div className="relative w-full h-full rounded-xl overflow-hidden border border-border">
            {!userLocation ? (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Location needed for heatmap</p>
              </div>
            ) : (
              <>
                <canvas
                  ref={canvasRef}
                  className="w-full h-full cursor-pointer"
                  style={{ width: dimensions.width, height: dimensions.height }}
                  onClick={handleCanvasClick}
                />

                {/* Selected cell info */}
                <AnimatePresence>
                  {selectedCell && selectedCell.intensity > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-4 left-4 right-4"
                    >
                      <Card className="bg-card/95 backdrop-blur-md border-border p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold">{getHeatLabel(selectedCell.intensity)} Zone</p>
                            <p className="text-xs text-muted-foreground">
                              {selectedCell.venueCount} venue{selectedCell.venueCount !== 1 ? 's' : ''} nearby
                            </p>
                          </div>
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                            style={{ backgroundColor: getHeatColor(selectedCell.intensity) }}
                          >
                            {selectedCell.intensity}
                          </div>
                        </div>
                        {nearbyVenuesForCell.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border">
                            {nearbyVenuesForCell.map(venue => (
                              <button
                                key={venue.id}
                                onClick={() => onVenueClick(venue)}
                                className="flex items-center gap-2 w-full text-left p-1 rounded hover:bg-secondary transition-colors"
                              >
                                <MapPin size={14} weight="fill" className="text-primary" />
                                <span className="text-sm font-medium">{venue.name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                  Score: {venue.pulseScore}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
