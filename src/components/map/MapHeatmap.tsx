import { useEffect, useRef } from 'react'
import { Venue } from '@/lib/types'
import { MAP_SCALE } from './shared'

function latLngToPixel(
  lat: number,
  lng: number,
  mapCenter: { lat: number; lng: number },
  mapZoom: number,
  dims: { width: number; height: number }
) {
  const scale = MAP_SCALE * mapZoom
  const x = dims.width / 2 + (lng - mapCenter.lng) * scale
  const y = dims.height / 2 - (lat - mapCenter.lat) * scale
  return { x, y }
}

function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  venueList: Venue[],
  mapCenter: { lat: number; lng: number },
  mapZoom: number,
  dims: { width: number; height: number },
  offscreenCanvas: HTMLCanvasElement
) {
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

  // Subtle dot grid pattern
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

  const heatmapCanvas = offscreenCanvas

  if (heatmapCanvas.width !== dims.width || heatmapCanvas.height !== dims.height) {
    heatmapCanvas.width = dims.width
    heatmapCanvas.height = dims.height
  } else {
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
      gradient.addColorStop(0, `rgba(217, 70, 239, ${intensity * 1.0})`)
      gradient.addColorStop(0.5, `rgba(217, 70, 239, ${intensity * 0.6})`)
    } else if (venue.pulseScore >= 60) {
      gradient.addColorStop(0, `rgba(244, 63, 94, ${intensity * 0.9})`)
      gradient.addColorStop(0.5, `rgba(244, 63, 94, ${intensity * 0.5})`)
    } else if (venue.pulseScore >= 30) {
      gradient.addColorStop(0, `rgba(14, 165, 233, ${intensity * 0.8})`)
      gradient.addColorStop(0.5, `rgba(14, 165, 233, ${intensity * 0.4})`)
    } else {
      gradient.addColorStop(0, `rgba(99, 102, 241, ${intensity * 0.6})`)
      gradient.addColorStop(0.5, `rgba(99, 102, 241, ${intensity * 0.3})`)
    }
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

    heatmapCtx.fillStyle = gradient
    heatmapCtx.fillRect(pos.x - radius, pos.y - radius, radius * 2, radius * 2)
  })

  ctx.globalCompositeOperation = 'screen'
  ctx.drawImage(heatmapCanvas, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
}

export function useHeatmapRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  filteredVenues: Venue[],
  center: { lat: number; lng: number } | null,
  zoom: number,
  dimensions: { width: number; height: number }
) {
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !center) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = dimensions.width * window.devicePixelRatio
    canvas.height = dimensions.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas')
    }

    drawHeatmap(ctx, filteredVenues, center, zoom, dimensions, offscreenCanvasRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredVenues, center, zoom, dimensions])
}
