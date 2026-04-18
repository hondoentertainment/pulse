import { useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { clampZoom, clampCenter } from '@/lib/interactive-map'
import { triggerHapticFeedback } from '@/lib/haptics'
import { ZOOM_STEP, MAP_SCALE } from './shared'


// eslint-disable-next-line react-refresh/only-export-components
export function useMapInteractions(props: {
  center: { lat: number; lng: number } | null
  zoom: number
  dimensions: { width: number; height: number }
  isDragging: boolean
  dragStart: { x: number; y: number } | null
  setCenter: React.Dispatch<React.SetStateAction<{ lat: number; lng: number } | null>>
  setZoom: React.Dispatch<React.SetStateAction<number>>
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>
  setDragStart: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>
  setFollowUser: React.Dispatch<React.SetStateAction<boolean>>
  setHoveredVenue: (v: null) => void
  setExpandedClusterId: React.Dispatch<React.SetStateAction<string | null>>
  setLastTouchDistance: React.Dispatch<React.SetStateAction<number | null>>
  lastTouchDistance: number | null
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}) {
  const {
    center, zoom, dimensions, isDragging, dragStart,
    setCenter, setZoom, setIsDragging, setDragStart,
    setFollowUser, setHoveredVenue, setExpandedClusterId,
    setLastTouchDistance, lastTouchDistance, canvasRef
  } = props

  const inertialFrameRef = useRef<number | null>(null)
  const panVelocityRef = useRef({ lat: 0, lng: 0 })
  const lastPanFrameRef = useRef<{ x: number; y: number; ts: number } | null>(null)
  const lastTapRef = useRef<{ x: number; y: number; ts: number } | null>(null)
  const movedDuringTouchRef = useRef(false)

  const stopInertia = useCallback(() => {
    if (inertialFrameRef.current !== null) {
      cancelAnimationFrame(inertialFrameRef.current)
      inertialFrameRef.current = null
    }
    panVelocityRef.current = { lat: 0, lng: 0 }
  }, [])

  useEffect(() => {
    return () => {
      if (inertialFrameRef.current !== null) {
        cancelAnimationFrame(inertialFrameRef.current)
        inertialFrameRef.current = null
      }
      panVelocityRef.current = { lat: 0, lng: 0 }
    }
  }, [])

  const pixelToLatLng = useCallback((
    x: number, y: number,
    mapCenter: { lat: number; lng: number },
    mapZoom: number,
    dims: { width: number; height: number }
  ) => {
    const scale = MAP_SCALE * mapZoom
    return {
      lng: mapCenter.lng + (x - dims.width / 2) / scale,
      lat: mapCenter.lat - (y - dims.height / 2) / scale
    }
  }, [])

  const panByPixels = useCallback((dx: number, dy: number, mapZoom: number) => {
    const scale = MAP_SCALE * mapZoom
    setCenter((prev) => {
      if (!prev) return prev
      return clampCenter({
        lng: prev.lng - dx / scale,
        lat: prev.lat + dy / scale
      })
    })
  }, [setCenter])

  const zoomAroundPoint = useCallback((
    nextZoom: number, pointX: number, pointY: number
  ) => {
    if (!center) return
    const clampedZoom = clampZoom(nextZoom)
    if (clampedZoom === zoom) return
    const anchor = pixelToLatLng(pointX, pointY, center, zoom, dimensions)
    const scale = MAP_SCALE * clampedZoom
    const nextCenter = clampCenter({
      lng: anchor.lng - (pointX - dimensions.width / 2) / scale,
      lat: anchor.lat + (pointY - dimensions.height / 2) / scale
    })
    setCenter(nextCenter)
    setZoom(clampedZoom)
  }, [center, zoom, dimensions, pixelToLatLng, setCenter, setZoom])

  const startInertia = useCallback(() => {
    if (!center) return
    const MIN_VELOCITY = 0.0000008
    const FRICTION_PER_FRAME = 0.9
    let lastTime = performance.now()

    const step = (now: number) => {
      const dt = Math.max(8, now - lastTime)
      lastTime = now
      const decay = Math.pow(FRICTION_PER_FRAME, dt / 16)

      panVelocityRef.current = {
        lat: panVelocityRef.current.lat * decay,
        lng: panVelocityRef.current.lng * decay
      }

      setCenter((prev) => {
        if (!prev) return prev
        return clampCenter({
          lat: prev.lat + panVelocityRef.current.lat * dt,
          lng: prev.lng + panVelocityRef.current.lng * dt
        })
      })

      const speed = Math.hypot(panVelocityRef.current.lat, panVelocityRef.current.lng)
      if (speed < MIN_VELOCITY) {
        stopInertia()
        return
      }
      inertialFrameRef.current = requestAnimationFrame(step)
    }

    stopInertia()
    inertialFrameRef.current = requestAnimationFrame(step)
  }, [center, setCenter, stopInertia])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    stopInertia()
    setHoveredVenue(null)
    setExpandedClusterId(null)
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    lastPanFrameRef.current = { x: e.clientX, y: e.clientY, ts: performance.now() }
    setFollowUser(false)
  }, [stopInertia, setHoveredVenue, setExpandedClusterId, setIsDragging, setDragStart, setFollowUser])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !center) return

    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y

    const now = performance.now()
    if (lastPanFrameRef.current) {
      const dt = Math.max(1, now - lastPanFrameRef.current.ts)
      const scale = MAP_SCALE * zoom
      panVelocityRef.current = {
        lng: (-dx / scale) / dt,
        lat: (dy / scale) / dt
      }
    }

    panByPixels(dx, dy, zoom)
    setDragStart({ x: e.clientX, y: e.clientY })
    lastPanFrameRef.current = { x: e.clientX, y: e.clientY, ts: now }
  }, [isDragging, dragStart, center, zoom, panByPixels, setDragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setDragStart(null)
    lastPanFrameRef.current = null
    startInertia()
  }, [setIsDragging, setDragStart, startInertia])

  const handleWheelZoom = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!center) return
    stopInertia()
    setExpandedClusterId(null)
    const rect = e.currentTarget.getBoundingClientRect()
    const pointX = e.clientX - rect.left
    const pointY = e.clientY - rect.top
    const delta = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
    zoomAroundPoint(zoom * delta, pointX, pointY)
    setFollowUser(false)
  }, [center, zoom, stopInertia, setExpandedClusterId, zoomAroundPoint, setFollowUser])

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!center) return
    stopInertia()
    setExpandedClusterId(null)
    const rect = e.currentTarget.getBoundingClientRect()
    const pointX = e.clientX - rect.left
    const pointY = e.clientY - rect.top
    triggerHapticFeedback('light')
    zoomAroundPoint(zoom * ZOOM_STEP, pointX, pointY)
    setFollowUser(false)
  }, [center, zoom, stopInertia, setExpandedClusterId, zoomAroundPoint, setFollowUser])

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    stopInertia()
    setExpandedClusterId(null)
    if (e.touches.length === 2) {
      setLastTouchDistance(getTouchDistance(e.touches))
    } else if (e.touches.length === 1) {
      const now = performance.now()
      const tap = { x: e.touches[0].clientX, y: e.touches[0].clientY, ts: now }
      if (lastTapRef.current) {
        const dt = now - lastTapRef.current.ts
        const dx = tap.x - lastTapRef.current.x
        const dy = tap.y - lastTapRef.current.y
        const dist = Math.hypot(dx, dy)
        if (dt < 280 && dist < 24 && center && canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect()
          triggerHapticFeedback('light')
          zoomAroundPoint(zoom * ZOOM_STEP, tap.x - rect.left, tap.y - rect.top)
          setFollowUser(false)
          lastTapRef.current = null
          return
        }
      }
      lastTapRef.current = tap
      movedDuringTouchRef.current = false
      setHoveredVenue(null)
      setIsDragging(true)
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
      lastPanFrameRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ts: now }
      setFollowUser(false)
    }
  }, [stopInertia, setExpandedClusterId, setLastTouchDistance, center, zoom, canvasRef, zoomAroundPoint, setFollowUser, setHoveredVenue, setIsDragging, setDragStart])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance !== null) {
      const newDistance = getTouchDistance(e.touches)
      if (newDistance !== null) {
        const scale = newDistance / lastTouchDistance
        setZoom(z => clampZoom(z * scale))
        setLastTouchDistance(newDistance)
        setFollowUser(false)
      }
    } else if (e.touches.length === 1 && isDragging && dragStart && center) {
      const dx = e.touches[0].clientX - dragStart.x
      const dy = e.touches[0].clientY - dragStart.y
      movedDuringTouchRef.current = true
      const now = performance.now()
      if (lastPanFrameRef.current) {
        const dt = Math.max(1, now - lastPanFrameRef.current.ts)
        const scale = MAP_SCALE * zoom
        panVelocityRef.current = {
          lng: (-dx / scale) / dt,
          lat: (dy / scale) / dt
        }
      }
      panByPixels(dx, dy, zoom)
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
      lastPanFrameRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ts: now }
    }
  }, [lastTouchDistance, isDragging, dragStart, center, zoom, setZoom, setLastTouchDistance, setFollowUser, panByPixels, setDragStart])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    setDragStart(null)
    setLastTouchDistance(null)
    lastPanFrameRef.current = null
    if (movedDuringTouchRef.current) {
      startInertia()
    }
    movedDuringTouchRef.current = false
  }, [setIsDragging, setDragStart, setLastTouchDistance, startInertia])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
        triggerHapticFeedback('light')
        setExpandedClusterId(null)
        setZoom((z) => clampZoom(z * ZOOM_STEP))
        setFollowUser(false)
        break
      case '-':
        triggerHapticFeedback('light')
        setExpandedClusterId(null)
        setZoom((z) => clampZoom(z / ZOOM_STEP))
        setFollowUser(false)
        break
    }
  }, [center, zoom, setCenter, setFollowUser, setExpandedClusterId, setZoom])

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheelZoom,
    handleDoubleClick,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleKeyDown,
    stopInertia,
    zoomAroundPoint,
  }
}

interface MapCanvasElementProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  isDragging: boolean
  handlers: {
    handleMouseDown: (e: React.MouseEvent) => void
    handleMouseMove: (e: React.MouseEvent) => void
    handleMouseUp: () => void
    handleWheelZoom: (e: React.WheelEvent<HTMLCanvasElement>) => void
    handleDoubleClick: (e: React.MouseEvent<HTMLCanvasElement>) => void
    handleTouchStart: (e: React.TouchEvent) => void
    handleTouchMove: (e: React.TouchEvent) => void
    handleTouchEnd: () => void
  }
}

export function MapCanvas({ canvasRef, isDragging, handlers }: MapCanvasElementProps) {
  return (
    <canvas
      ref={canvasRef}
      className={cn(
        'absolute inset-0 w-full h-full touch-none',
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      )}
      onMouseDown={handlers.handleMouseDown}
      onMouseMove={handlers.handleMouseMove}
      onMouseUp={handlers.handleMouseUp}
      onMouseLeave={handlers.handleMouseUp}
      onTouchStart={handlers.handleTouchStart}
      onTouchMove={handlers.handleTouchMove}
      onTouchEnd={handlers.handleTouchEnd}
      onWheel={handlers.handleWheelZoom}
      onDoubleClick={handlers.handleDoubleClick}
    />
  )
}
