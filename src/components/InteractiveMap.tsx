import { useEffect, useRef, useState, useMemo } from 'react'
import { Venue } from '@/lib/types'
import { PulseScore } from '@/components/PulseScore'
import { MapFilters, MapFiltersState } from '@/components/MapFilters'
import { MapSearch } from '@/components/MapSearch'
import { GPSIndicator } from '@/components/GPSIndicator'
import {
  MapPin, NavigationArrow, Plus, Minus, CaretDown, CaretUp,
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
import { triggerHapticFeedback } from '@/lib/haptics'
import {
  buildVenueRenderPoints,
  clampCenter,
  clampZoom,
  clusterVenueRenderPoints,
  getFittedViewport,
  getHeadingDelta,
  getPreviewVenuePoints,
  type VenueRenderPoint
} from '@/lib/interactive-map'

interface InteractiveMapProps {
  venues: Venue[]
  userLocation: { lat: number; lng: number } | null
  onVenueClick: (venue: Venue) => void
  isTracking?: boolean
  locationAccuracy?: number
  locationHeading?: number | null
}

const ZOOM_STEP = 1.35
const MAP_SCALE = 500000

export function InteractiveMap({
  venues,
  userLocation,
  onVenueClick,
  isTracking = false,
  locationAccuracy,
  locationHeading
}: InteractiveMapProps) {
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
  const [showFullHeatmap, setShowFullHeatmap] = useState(false)
  const [comparedVenueIds, setComparedVenueIds] = useState<string[]>([])
  const [showOnboardingTips, setShowOnboardingTips] = useState(false)
  const [tipIndex, setTipIndex] = useState(0)
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null)
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null)
  const [accessibilityMode, setAccessibilityMode] = useState(false)
  const [isCameraMoving, setIsCameraMoving] = useState(false)
  const onboardingStorageKey = 'pulse-map-onboarding-v1'
  const { unitSystem } = useUnitPreference()
  const loadingTimeoutRef = useRef<number | null>(null)
  const cameraSettleTimeoutRef = useRef<number | null>(null)
  const venueSelectTimeoutRef = useRef<number | null>(null)
  const hoverClearTimeoutRef = useRef<number | null>(null)
  const inertialFrameRef = useRef<number | null>(null)
  const panVelocityRef = useRef({ lat: 0, lng: 0 })
  const lastPanFrameRef = useRef<{ x: number; y: number; ts: number } | null>(null)
  const lastTapRef = useRef<{ x: number; y: number; ts: number } | null>(null)
  const movedDuringTouchRef = useRef(false)

  const stopInertia = () => {
    if (inertialFrameRef.current !== null) {
      cancelAnimationFrame(inertialFrameRef.current)
      inertialFrameRef.current = null
    }
    panVelocityRef.current = { lat: 0, lng: 0 }
  }

  useEffect(() => {
    return () => {
      if (inertialFrameRef.current !== null) {
        cancelAnimationFrame(inertialFrameRef.current)
        inertialFrameRef.current = null
      }
      panVelocityRef.current = { lat: 0, lng: 0 }
      if (cameraSettleTimeoutRef.current) clearTimeout(cameraSettleTimeoutRef.current)
      if (venueSelectTimeoutRef.current) clearTimeout(venueSelectTimeoutRef.current)
      if (hoverClearTimeoutRef.current) clearTimeout(hoverClearTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    // If no location after 3s, default to first venue or SF
    loadingTimeoutRef.current = window.setTimeout(() => {
      if (!center && !userLocation && venues.length > 0) {
        setCenter({ lat: venues[0].location.lat, lng: venues[0].location.lng })
        setFollowUser(false)
      }
    }, 3000)

    return () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
    }
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    const seen = window.localStorage.getItem(onboardingStorageKey)
    if (!seen) {
      setShowOnboardingTips(true)
      setTipIndex(0)
    }
  }, [onboardingStorageKey])

  useEffect(() => {
    setIsCameraMoving(true)
    if (cameraSettleTimeoutRef.current) clearTimeout(cameraSettleTimeoutRef.current)
    cameraSettleTimeoutRef.current = window.setTimeout(() => {
      setIsCameraMoving(false)
    }, isDragging ? 260 : 140)
  }, [center, zoom, isDragging])

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

  const calculateBearing = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const λ1 = (lon1 * Math.PI) / 180
    const λ2 = (lon2 * Math.PI) / 180

    const y = Math.sin(λ2 - λ1) * Math.cos(φ2)
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1)
    const θ = Math.atan2(y, x)
    return ((θ * 180) / Math.PI + 360) % 360
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

  const getEnergyColor = (score: number) => {
    if (score >= 80) return 'oklch(0.65 0.28 320)'
    if (score >= 60) return 'oklch(0.65 0.25 25)'
    if (score >= 30) return 'oklch(0.65 0.18 240)'
    return 'oklch(0.40 0.05 260)'
  }

  const filteredVenues = useMemo(() => {
    const filtered = venues.filter((venue) => {
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

    // Progressive disclosure: show top 5 surging venues by default
    if (!showFullHeatmap && !nearMeActive && filters.energyLevels.length === 0 && filters.categories.length === 0) {
      // Only nearby venues (within 50mi of center or user) sorted by pulseScore
      const nearby = userLocation
        ? filtered
          .filter(v => calculateDistance(userLocation.lat, userLocation.lng, v.location.lat, v.location.lng) < 50)
          .sort((a, b) => b.pulseScore - a.pulseScore)
        : filtered.sort((a, b) => b.pulseScore - a.pulseScore)
      return nearby.slice(0, 5)
    }

    return filtered
  }, [venues, filters, userLocation, nearMeActive, showFullHeatmap])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredVenues, center, zoom, dimensions])

  const latLngToPixel = (
    lat: number,
    lng: number,
    mapCenter: { lat: number; lng: number },
    mapZoom: number,
    dims: { width: number; height: number }
  ) => {
    const scale = MAP_SCALE * mapZoom
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
    const scale = MAP_SCALE * mapZoom
    return {
      lng: mapCenter.lng + (x - dims.width / 2) / scale,
      lat: mapCenter.lat - (y - dims.height / 2) / scale
    }
  }

  const zoomAroundPoint = (
    nextZoom: number,
    pointX: number,
    pointY: number
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
  }

  const panByPixels = (dx: number, dy: number, mapZoom: number) => {
    const scale = MAP_SCALE * mapZoom
    setCenter((prev) => {
      if (!prev) return prev
      return clampCenter({
        lng: prev.lng - dx / scale,
        lat: prev.lat + dy / scale
      })
    })
  }

  const startInertia = () => {
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
        gradient.addColorStop(0, `rgba(217, 70, 239, ${intensity * 1.0})`) // Neon Fuchsia - boosted
        gradient.addColorStop(0.5, `rgba(217, 70, 239, ${intensity * 0.6})`)
      } else if (venue.pulseScore >= 60) {
        gradient.addColorStop(0, `rgba(244, 63, 94, ${intensity * 0.9})`) // Neon Rose - boosted
        gradient.addColorStop(0.5, `rgba(244, 63, 94, ${intensity * 0.5})`)
      } else if (venue.pulseScore >= 30) {
        gradient.addColorStop(0, `rgba(14, 165, 233, ${intensity * 0.8})`) // Neon Sky - boosted
        gradient.addColorStop(0.5, `rgba(14, 165, 233, ${intensity * 0.4})`)
      } else {
        gradient.addColorStop(0, `rgba(99, 102, 241, ${intensity * 0.6})`) // Indigo - boosted
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

  const handleMouseDown = (e: React.MouseEvent) => {
    stopInertia()
    setHoveredVenue(null)
    setExpandedClusterId(null)
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    lastPanFrameRef.current = { x: e.clientX, y: e.clientY, ts: performance.now() }
    setFollowUser(false)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
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
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDragStart(null)
    lastPanFrameRef.current = null
    startInertia()
  }

  const handleZoomIn = () => {
    triggerHapticFeedback('light')
    setExpandedClusterId(null)
    setZoom((z) => clampZoom(z * ZOOM_STEP))
    setFollowUser(false)
  }

  const handleZoomOut = () => {
    triggerHapticFeedback('light')
    setExpandedClusterId(null)
    setZoom((z) => clampZoom(z / ZOOM_STEP))
    setFollowUser(false)
  }

  const handleCenterOnUser = () => {
    if (userLocation) {
      triggerHapticFeedback('medium')
      setExpandedClusterId(null)
      setCenter(userLocation)
      setZoom(1)
      setFollowUser(true)
    }
  }

  const handleToggleFullHeatmap = () => {
    triggerHapticFeedback('light')
    setShowFullHeatmap(prev => !prev)
  }

  const handleWheelZoom = (e: React.WheelEvent<HTMLCanvasElement>) => {
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
  }

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!center) return
    stopInertia()
    setExpandedClusterId(null)
    const rect = e.currentTarget.getBoundingClientRect()
    const pointX = e.clientX - rect.left
    const pointY = e.clientY - rect.top
    triggerHapticFeedback('light')
    zoomAroundPoint(zoom * ZOOM_STEP, pointX, pointY)
    setFollowUser(false)
  }

  // Touch event handlers for mobile
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
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
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance !== null) {
      // Pinch to zoom
      const newDistance = getTouchDistance(e.touches)
      if (newDistance !== null) {
        const scale = newDistance / lastTouchDistance
        setZoom(z => clampZoom(z * scale))
        setLastTouchDistance(newDistance)
        setFollowUser(false)
      }
    } else if (e.touches.length === 1 && isDragging && dragStart && center) {
      // Touch pan
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
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    setDragStart(null)
    setLastTouchDistance(null)
    lastPanFrameRef.current = null
    if (movedDuringTouchRef.current) {
      startInertia()
    }
    movedDuringTouchRef.current = false
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
    stopInertia()
    if (venueSelectTimeoutRef.current) clearTimeout(venueSelectTimeoutRef.current)
    if (hoverClearTimeoutRef.current) clearTimeout(hoverClearTimeoutRef.current)
    triggerHapticFeedback('medium')
    setExpandedClusterId(null)
    if (center) {
      setCenter({
        lat: (center.lat + venue.location.lat) / 2,
        lng: (center.lng + venue.location.lng) / 2
      })
      setZoom((z) => clampZoom(Math.max(0.9, Math.min(1.4, z))))
      venueSelectTimeoutRef.current = window.setTimeout(() => {
        setCenter({ lat: venue.location.lat, lng: venue.location.lng })
        setZoom((z) => clampZoom(Math.max(2.1, z * 1.1)))
      }, 170)
    } else {
      setCenter({ lat: venue.location.lat, lng: venue.location.lng })
      setZoom(2.1)
    }
    setFollowUser(false)
    window.setTimeout(() => {
      setHoveredVenue(venue)
      hoverClearTimeoutRef.current = window.setTimeout(() => {
        setHoveredVenue(null)
      }, 2500)
    }, 220)
  }

  const getVenuePixelPosition = (venue: Venue) => {
    if (!center) return null
    return latLngToPixel(venue.location.lat, venue.location.lng, center, zoom, dimensions)
  }

  const handleFitToVenues = () => {
    const viewport = getFittedViewport(filteredVenues, dimensions)
    if (!viewport) return
    stopInertia()
    triggerHapticFeedback('medium')
    setCenter(viewport.center)
    setZoom(viewport.zoom)
    setFollowUser(false)
  }

  const venueRenderPoints = useMemo<VenueRenderPoint[]>(() => {
    if (!center) return []
    return buildVenueRenderPoints({
      venues: filteredVenues,
      center,
      zoom,
      dimensions,
      userLocation
    })
  }, [center, filteredVenues, zoom, dimensions, userLocation])

  const shouldClusterMarkers = zoom < 1.05 && !isDragging

  const clusteredMapData = useMemo(() => {
    return clusterVenueRenderPoints(venueRenderPoints, zoom, shouldClusterMarkers)
  }, [shouldClusterMarkers, venueRenderPoints, zoom])

  useEffect(() => {
    if (!expandedClusterId) return
    const stillExists = clusteredMapData.clusters.some((cluster) => cluster.id === expandedClusterId)
    if (!stillExists || !shouldClusterMarkers) {
      setExpandedClusterId(null)
    }
  }, [expandedClusterId, clusteredMapData.clusters, shouldClusterMarkers])

  const expandedCluster = useMemo(() => (
    clusteredMapData.clusters.find((cluster) => cluster.id === expandedClusterId) ?? null
  ), [clusteredMapData.clusters, expandedClusterId])

  const expandedClusterNodes = useMemo(() => {
    if (!expandedCluster) return [] as Array<VenueRenderPoint & { sx: number; sy: number }>
    const total = expandedCluster.venues.length
    const radius = Math.min(110, Math.max(48, 34 + total * 5))
    return expandedCluster.venues.map((point, index) => {
      const angle = (Math.PI * 2 * index) / total - Math.PI / 2
      return {
        ...point,
        sx: expandedCluster.x + radius * Math.cos(angle),
        sy: expandedCluster.y + radius * Math.sin(angle)
      }
    })
  }, [expandedCluster])

  const labelVenueIds = useMemo(() => {
    const sorted = [...clusteredMapData.singles].sort((a, b) => {
      const pulseWeight = b.venue.pulseScore - a.venue.pulseScore
      if (Math.abs(pulseWeight) > 10) return pulseWeight

      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance
      }

      return a.venue.name.localeCompare(b.venue.name)
    })

    const maxLabels = (isDragging || isCameraMoving)
      ? 0
      : zoom < 0.85
        ? 2
        : zoom < 1.1
          ? 4
          : zoom < 1.5
            ? (accessibilityMode ? 10 : 8)
            : (accessibilityMode ? 18 : 14)

    const ids = new Set(sorted.slice(0, maxLabels).map((point) => point.venue.id))
    if (hoveredVenue) ids.add(hoveredVenue.id)
    return ids
  }, [clusteredMapData.singles, isDragging, isCameraMoving, zoom, hoveredVenue, accessibilityMode])

  const activeFilterCount = filters.energyLevels.length + filters.categories.length + (filters.maxDistance !== Infinity ? 1 : 0)

  const previewVenues = useMemo(() => {
    if (!center) return [] as VenueRenderPoint[]
    return getPreviewVenuePoints({
      points: venueRenderPoints,
      center,
      userLocation,
      locationHeading
    })
  }, [center, venueRenderPoints, locationHeading, userLocation])

  const comparedVenues = useMemo(() => {
    const map = new Map(previewVenues.map((point) => [point.venue.id, point]))
    return comparedVenueIds
      .map((id) => map.get(id))
      .filter((point): point is VenueRenderPoint => !!point)
  }, [comparedVenueIds, previewVenues])

  const bestNextVenue = previewVenues[0] ?? null

  const statusChips = [
    followUser && userLocation ? 'Following You' : null,
    isCameraMoving ? 'Moving' : 'Settled',
    locationHeading !== null && locationHeading !== undefined ? `Heading ${Math.round(locationHeading)}°` : null,
    activeFilterCount > 0 ? `${activeFilterCount} Filters` : 'All Venues',
    clusteredMapData.clusters.length > 0 ? `${clusteredMapData.clusters.length} Clusters` : null,
    comparedVenueIds.length > 0 ? `${comparedVenueIds.length} Comparing` : null,
    accessibilityMode ? 'Accessibility Mode' : null
  ].filter(Boolean) as string[]

  useEffect(() => {
    if (comparedVenueIds.length === 0) return
    const validIds = new Set(previewVenues.map((point) => point.venue.id))
    setComparedVenueIds((prev) => prev.filter((id) => validIds.has(id)))
  }, [previewVenues, comparedVenueIds.length])

  const toggleCompareVenue = (venueId: string) => {
    triggerHapticFeedback('light')
    setComparedVenueIds((prev) => {
      if (prev.includes(venueId)) return prev.filter((id) => id !== venueId)
      if (prev.length >= 3) return [...prev.slice(1), venueId]
      return [...prev, venueId]
    })
  }

  const onboardingTips = [
    'Pinch or scroll to zoom. Double tap to zoom quickly.',
    'Tap clusters to expand nearby venues or zoom deeper.',
    'Use the bottom cards to compare hotspots and jump fast.',
    'Turn on A11y mode for larger markers and calmer motion.'
  ]

  const completeOnboarding = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(onboardingStorageKey, 'seen')
    }
    setShowOnboardingTips(false)
    setTipIndex(0)
  }

  const handleSmartRoute = () => {
    if (!bestNextVenue) return
    triggerHapticFeedback('medium')
    handleVenueSelect(bestNextVenue.venue)
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
        onWheel={handleWheelZoom}
        onDoubleClick={handleDoubleClick}
      />

      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {clusteredMapData.clusters.map((cluster) => {
          const clusterSize = Math.min(42, 20 + cluster.venues.length * 1.8)
          const clusterColor = getEnergyColor(cluster.maxPulseScore)
          const isExpanded = expandedClusterId === cluster.id
          return (
            <g key={cluster.id} className="pointer-events-none">
              <circle
                cx={cluster.x}
                cy={cluster.y}
                r={clusterSize * 1.35}
                fill={clusterColor}
                opacity={isExpanded ? 0.1 : 0.22}
              />
              <circle
                cx={cluster.x}
                cy={cluster.y}
                r={clusterSize}
                fill={clusterColor}
                stroke="oklch(0.98 0 0 / 0.85)"
                strokeWidth={2}
                filter={`drop-shadow(0 0 8px ${clusterColor})`}
                opacity={isExpanded ? 0.4 : 1}
              />
              <text
                x={cluster.x}
                y={cluster.y + 4}
                textAnchor="middle"
                fill="white"
                fontSize={Math.max(10, Math.min(15, clusterSize * 0.45))}
                fontWeight="700"
              >
                {cluster.venues.length}
              </text>
            </g>
          )
        })}

        {expandedCluster && expandedClusterNodes.map((node) => (
          <g key={`expanded-${node.venue.id}`}>
            <line
              x1={expandedCluster.x}
              y1={expandedCluster.y}
              x2={node.sx}
              y2={node.sy}
              stroke="oklch(0.92 0 0 / 0.35)"
              strokeWidth={1.5}
            />
            <circle
              cx={node.sx}
              cy={node.sy}
              r={Math.max(11, (accessibilityMode ? 14 : 12) * zoom * 0.5)}
              fill={getEnergyColor(node.venue.pulseScore)}
              stroke="white"
              strokeWidth={1.5}
            />
          </g>
        ))}

        {clusteredMapData.singles.map(({ venue, x, y }) => {
          const baseSize = accessibilityMode ? 24 : 18
          const scale = venue.pulseScore > 0 ? 1 + (venue.pulseScore / 100) : 1
          const markerSize = baseSize * zoom * scale * 0.6
          const isHighlighted = hoveredVenue?.id === venue.id
          const isHighEnergy = venue.pulseScore >= 80
          const hasRecentActivity = venue.lastActivity
            ? (Date.now() - new Date(venue.lastActivity).getTime()) < 10 * 60 * 1000
            : venue.pulseScore >= 50

          const Icon = getCategoryIcon(venue.category)
          const iconSize = markerSize * 1.2

          return (
            <g key={venue.id} className="pointer-events-none">
              {(isHighEnergy || hasRecentActivity) && !isCameraMoving && !accessibilityMode && (
                <>
                  <circle
                    cx={x}
                    cy={y}
                    r={markerSize * 2.5}
                    fill={getEnergyColor(venue.pulseScore)}
                    opacity={0.15}
                    className="animate-pulse-glow"
                    style={{ animationDuration: '3s' }}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={markerSize * 1.8}
                    fill={getEnergyColor(venue.pulseScore)}
                    opacity={0.25}
                    className="animate-pulse"
                    style={{ animationDuration: '2s' }}
                  />
                </>
              )}

              <circle
                cx={x}
                cy={y}
                r={markerSize}
                fill={venue.pulseScore > 0 ? getEnergyColor(venue.pulseScore) : 'oklch(0.25 0.05 260)'}
                stroke={isHighlighted ? 'white' : 'oklch(0.15 0 0)'}
                strokeWidth={isHighlighted ? 3 : 1.5}
                className="transition-all duration-300"
                filter={venue.pulseScore >= 30 ? `drop-shadow(0 0 ${venue.pulseScore >= 80 ? '8px' : '4px'} ${venue.pulseScore >= 80 ? 'rgba(217, 70, 239, 0.6)' : venue.pulseScore >= 60 ? 'rgba(244, 63, 94, 0.5)' : 'rgba(14, 165, 233, 0.4)'})` : undefined}
              />

              <foreignObject
                x={x - iconSize / 2}
                y={y - iconSize / 2}
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

              {hasRecentActivity && !isCameraMoving && !accessibilityMode && (
                <circle
                  cx={x}
                  cy={y}
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
            const scale = MAP_SCALE * zoom
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
                className={accessibilityMode ? undefined : "animate-pulse"}
              />
              <circle
                cx={userPos.x}
                cy={userPos.y}
                r={(accessibilityMode ? 8 : 6) * zoom}
                fill="oklch(0.75 0.18 195)"
                stroke="oklch(0.98 0 0)"
                strokeWidth={2 * zoom}
              />
              {locationHeading !== null && locationHeading !== undefined && !Number.isNaN(locationHeading) && (
                <g
                  transform={`translate(${userPos.x}, ${userPos.y}) rotate(${locationHeading})`}
                >
                  <path
                    d="M0 -16 L4 -6 L0 -8 L-4 -6 Z"
                    fill="oklch(0.92 0.11 210)"
                    opacity={0.9}
                  />
                </g>
              )}
            </g>
          )
        })()}
      </svg>

      {/* Empty State Message */}
      {venueRenderPoints.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <Card className="bg-card/95 backdrop-blur-md border-border p-6 text-center max-w-xs shadow-2xl">
            <MapPin size={32} weight="fill" className="mx-auto text-muted-foreground mb-3" />
            <h3 className="font-bold text-foreground mb-1">No Venues in View</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Zoom out or pan to discover nearby spots
            </p>
            <Button
              size="sm"
              variant="outline"
              className="pointer-events-auto"
              onClick={handleCenterOnUser}
            >
              <NavigationArrow size={14} weight="fill" className="mr-1.5" />
              Center on Me
            </Button>
          </Card>
        </motion.div>
      )}

      {clusteredMapData.clusters.map((cluster) => (
        <div
          key={`cluster-hit-${cluster.id}`}
          className="absolute pointer-events-none"
          style={{
            left: cluster.x,
            top: cluster.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <button
            className="pointer-events-auto relative z-20 cursor-pointer rounded-full"
            aria-label={`Zoom into cluster of ${cluster.venues.length} venues`}
            onClick={() => {
              triggerHapticFeedback('medium')
              if (cluster.venues.length <= 10 && zoom >= 0.85 && expandedClusterId !== cluster.id) {
                setExpandedClusterId(cluster.id)
                setHoveredVenue(null)
                return
              }
              setExpandedClusterId(null)
              zoomAroundPoint(zoom * ZOOM_STEP, cluster.x, cluster.y)
              setFollowUser(false)
              setHoveredVenue(null)
            }}
          >
            <div className="w-14 h-14" />
          </button>
          {!isCameraMoving && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-10">
              <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg px-2 py-1 shadow-lg">
                <p className="text-[10px] font-semibold text-foreground">
                  {cluster.venues.length} venues
                </p>
              </div>
            </div>
          )}
        </div>
      ))}

      {expandedClusterNodes.map((node) => (
        <div
          key={`expanded-hit-${node.venue.id}`}
          className="absolute pointer-events-none"
          style={{
            left: node.sx,
            top: node.sy,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <button
            className="pointer-events-auto relative z-30 cursor-pointer rounded-full"
            aria-label={`Open ${node.venue.name}`}
            onClick={() => {
              triggerHapticFeedback('medium')
              setExpandedClusterId(null)
              onVenueClick(node.venue)
            }}
          >
            <div className="w-11 h-11" />
          </button>
        </div>
      ))}

      {clusteredMapData.singles.map(({ venue, x, y, distance }) => {
        const showLabel = labelVenueIds.has(venue.id) || venue.pulseScore >= 75
        const isHovered = hoveredVenue?.id === venue.id

        return (
          <div
            key={venue.id}
            className="absolute pointer-events-none"
            style={{
              left: x,
              top: y,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <button
              className="pointer-events-auto relative z-20 cursor-pointer hover:scale-110 transition-transform"
              onMouseEnter={() => setHoveredVenue(venue)}
              onMouseLeave={() => setHoveredVenue(null)}
              onClick={() => {
                triggerHapticFeedback('medium')
                onVenueClick(venue)
              }}
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
        {hoveredVenue && !isDragging && !isCameraMoving && (() => {
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

      <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 max-w-md">
            <MapSearch
              venues={venues}
              onVenueSelect={handleVenueSelect}
              userLocation={userLocation}
            />
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap max-w-lg">
          {statusChips.map((chip) => (
            <Badge
              key={chip}
              variant="secondary"
              className="bg-card/90 backdrop-blur-sm border border-border/70 text-[10px] font-semibold"
            >
              {chip}
            </Badge>
          ))}
        </div>

        {showOnboardingTips && (
          <Card className="max-w-md bg-card/95 backdrop-blur-sm border border-border shadow-lg p-3">
            <p className="text-[11px] font-semibold text-primary mb-1.5">
              Map tips {tipIndex + 1}/{onboardingTips.length}
            </p>
            <p className="text-xs text-foreground">
              {onboardingTips[tipIndex]}
            </p>
            <div className="mt-2.5 flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={completeOnboarding}
              >
                Skip
              </Button>
              <Button
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => {
                  if (tipIndex >= onboardingTips.length - 1) {
                    completeOnboarding()
                  } else {
                    setTipIndex((prev) => prev + 1)
                  }
                }}
              >
                {tipIndex >= onboardingTips.length - 1 ? 'Done' : 'Next'}
              </Button>
            </div>
          </Card>
        )}

        {/* Quick Filter Chips */}
        <div className="flex gap-1.5 flex-wrap max-w-md">
          <button
            onClick={() => {
              triggerHapticFeedback('light')
              if (filters.categories.includes('bar')) {
                setFilters(f => ({ ...f, categories: f.categories.filter(c => c !== 'bar') }))
              } else {
                setFilters(f => ({ ...f, categories: [...f.categories, 'bar'] }))
              }
            }}
            className={cn(
              "px-3.5 min-h-11 rounded-full text-xs font-medium transition-all touch-manipulation active:scale-[0.98]",
              "border backdrop-blur-sm shadow-sm",
              filters.categories.includes('bar')
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-card/90 text-foreground border-border hover:bg-secondary"
            )}
          >
            <BeerBottle size={14} weight="fill" className="inline mr-1" />
            Bars
          </button>
          <button
            onClick={() => {
              triggerHapticFeedback('light')
              const hasClub = filters.categories.includes('club') || filters.categories.includes('nightclub')
              if (hasClub) {
                setFilters(f => ({ ...f, categories: f.categories.filter(c => c !== 'club' && c !== 'nightclub') }))
              } else {
                setFilters(f => ({ ...f, categories: [...f.categories, 'club', 'nightclub'] }))
              }
            }}
            className={cn(
              "px-3.5 min-h-11 rounded-full text-xs font-medium transition-all touch-manipulation active:scale-[0.98]",
              "border backdrop-blur-sm shadow-sm",
              filters.categories.includes('club') || filters.categories.includes('nightclub')
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-card/90 text-foreground border-border hover:bg-secondary"
            )}
          >
            <MusicNotes size={14} weight="fill" className="inline mr-1" />
            Clubs
          </button>
          <button
            onClick={() => {
              triggerHapticFeedback('light')
              setNearMeActive(!nearMeActive)
            }}
            className={cn(
              "px-3.5 min-h-11 rounded-full text-xs font-medium transition-all touch-manipulation active:scale-[0.98]",
              "border backdrop-blur-sm shadow-sm",
              nearMeActive
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card/90 text-foreground border-border hover:bg-secondary"
            )}
          >
            <MapPin size={14} weight="fill" className="inline mr-1" />
            Near Me
          </button>
          <button
            onClick={() => {
              triggerHapticFeedback('light')
              const hasHot = filters.energyLevels.includes('electric') || filters.energyLevels.includes('buzzing')
              if (hasHot) {
                setFilters(f => ({ ...f, energyLevels: f.energyLevels.filter(e => e !== 'electric' && e !== 'buzzing') }))
              } else {
                setFilters(f => ({ ...f, energyLevels: [...f.energyLevels, 'electric', 'buzzing'] }))
              }
            }}
            className={cn(
              "px-3.5 min-h-11 rounded-full text-xs font-medium transition-all touch-manipulation active:scale-[0.98]",
              "border backdrop-blur-sm shadow-sm",
              filters.energyLevels.includes('electric') || filters.energyLevels.includes('buzzing')
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-card/90 text-foreground border-border hover:bg-secondary"
            )}
          >
            <Fire size={14} weight="fill" className="inline mr-1" />
            Hot
          </button>
          <button
            onClick={() => {
              triggerHapticFeedback('light')
              setShowFullHeatmap(!showFullHeatmap)
            }}
            className={cn(
              "px-3.5 min-h-11 rounded-full text-xs font-medium transition-all touch-manipulation active:scale-[0.98]",
              "border backdrop-blur-sm shadow-sm",
              showFullHeatmap
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-card/90 text-foreground border-border hover:bg-secondary"
            )}
          >
            {showFullHeatmap ? 'Top 5' : 'Full Map'}
          </button>
        </div>
      </div>

      {/* Consolidated Right Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <Button
          size="sm"
          variant={accessibilityMode ? "default" : "secondary"}
          className="self-end h-10 px-3 bg-card/95 backdrop-blur-sm border border-border shadow-lg"
          onClick={() => {
            triggerHapticFeedback('light')
            setAccessibilityMode((prev) => !prev)
          }}
        >
          A11y
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="self-end h-10 px-3 bg-card/95 backdrop-blur-sm border border-border shadow-lg"
          onClick={handleFitToVenues}
        >
          <MapPin size={14} weight="fill" className="mr-1.5" />
          Fit view
        </Button>
        {!followUser && userLocation && (
          <Button
            size="sm"
            variant="secondary"
            className="self-end h-10 px-3 bg-card/95 backdrop-blur-sm border border-border shadow-lg"
            onClick={handleCenterOnUser}
          >
            <NavigationArrow size={14} weight="fill" className="mr-1.5" />
            Re-center
          </Button>
        )}
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
                className="h-11 w-11 hover:bg-secondary touch-manipulation"
                onClick={handleZoomIn}
                title="Zoom in (+)"
                aria-label="Zoom in"
              >
                <Plus size={18} weight="bold" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-11 w-11 hover:bg-secondary touch-manipulation"
                onClick={handleZoomOut}
                title="Zoom out (-)"
                aria-label="Zoom out"
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
                  "h-11 w-11 touch-manipulation",
                  followUser && "bg-accent text-accent-foreground"
                )}
                onClick={handleCenterOnUser}
                title="Center on me"
                aria-label="Center map on my location"
              >
                <NavigationArrow size={18} weight="fill" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  "h-11 w-11 touch-manipulation",
                  nearMeActive && "bg-accent text-accent-foreground"
                )}
                onClick={() => {
                  triggerHapticFeedback('light')
                  setNearMeActive(!nearMeActive)
                }}
                title="Near me (0.5 mi)"
                aria-label="Toggle near me venues"
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
        <div className="text-[10px] font-mono text-muted-foreground/80 text-center bg-card/70 backdrop-blur-sm rounded px-2 py-1">
          Drag to pan · scroll to zoom
        </div>
      </div>

      {previewVenues.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(94%,720px)] pointer-events-none">
          {bestNextVenue && (
            <Card className="pointer-events-auto mb-2 p-2.5 bg-card/95 backdrop-blur-sm border border-border shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold text-foreground">Smart Route</p>
                  <p className="text-[10px] text-muted-foreground">
                    Best next stop: {bestNextVenue.venue.name}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={handleSmartRoute}
                >
                  Take Me
                </Button>
              </div>
            </Card>
          )}
          <AnimatePresence>
            {comparedVenues.length > 0 && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="pointer-events-auto mb-2 p-2.5 bg-card/95 backdrop-blur-sm border border-border shadow-lg">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-foreground">
                      Compare ({comparedVenues.length}/3)
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => setComparedVenueIds([])}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {comparedVenues.map((point) => (
                      <motion.button
                        layout
                        key={`compare-${point.venue.id}`}
                        className="text-left rounded-md border border-border/70 bg-background/40 px-2 py-1.5 hover:bg-background/60 transition-colors"
                        onClick={() => onVenueClick(point.venue)}
                      >
                        <p className="text-[11px] font-semibold truncate">{point.venue.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase truncate">
                          {point.venue.category || 'Venue'}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <PulseScore score={point.venue.pulseScore} size="xs" showLabel={false} />
                          {point.distance !== undefined && (
                            <span className="text-[10px] text-accent font-mono">
                              {formatDistance(point.distance, unitSystem)}
                            </span>
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-2 overflow-x-auto pb-1 px-1">
            {previewVenues.map((point) => {
              const isCompared = comparedVenueIds.includes(point.venue.id)
              const headingDelta = (locationHeading !== null && locationHeading !== undefined && userLocation)
                ? getHeadingDelta(calculateBearing(
                  userLocation.lat,
                  userLocation.lng,
                  point.venue.location.lat,
                  point.venue.location.lng
                ), locationHeading)
                : null
              const isAhead = headingDelta !== null && headingDelta < 30

              return (
                <motion.div layout key={`preview-wrap-${point.venue.id}`}>
                  <Card
                    className={cn(
                      "pointer-events-auto min-w-[180px] p-2.5 bg-card/95 backdrop-blur-sm border border-border shadow-lg",
                      hoveredVenue?.id === point.venue.id && "border-accent/70 shadow-accent/30",
                      isCompared && "border-primary/70 shadow-primary/20"
                    )}
                  >
                    <button
                      className="w-full text-left"
                      onClick={() => handleVenueSelect(point.venue)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{point.venue.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase truncate">
                            {point.venue.category || 'Venue'}
                          </p>
                          {isAhead && (
                            <Badge variant="secondary" className="mt-1 text-[9px] h-4 px-1.5 bg-primary/15 text-primary border-primary/25">
                              Ahead
                            </Badge>
                          )}
                          {point.distance !== undefined && (
                            <p className="text-[10px] text-accent font-mono mt-0.5">
                              {formatDistance(point.distance, unitSystem)}
                            </p>
                          )}
                        </div>
                        <PulseScore score={point.venue.pulseScore} size="xs" showLabel={false} />
                      </div>
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1 h-7 w-full text-[11px]"
                      onClick={() => {
                        triggerHapticFeedback('medium')
                        onVenueClick(point.venue)
                      }}
                    >
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant={isCompared ? "default" : "ghost"}
                      className="mt-1 h-7 w-full text-[11px]"
                      onClick={() => toggleCompareVenue(point.venue.id)}
                    >
                      {isCompared ? 'Compared' : 'Compare'}
                    </Button>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

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

      {/* Progressive Disclosure Toggle */}
      {!nearMeActive && filters.energyLevels.length === 0 && filters.categories.length === 0 && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleToggleFullHeatmap}
            className="bg-card/90 backdrop-blur-md shadow-lg border border-border/50 text-xs font-semibold px-4 py-1.5 rounded-full hover:bg-card/100 transition-colors"
          >
            {showFullHeatmap ? "Show Top Surges Only" : "Show Full Heatmap"}
          </Button>
        </div>
      )}
    </div>
  )
}
