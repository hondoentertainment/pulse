import { useEffect, useRef, useState, useMemo } from 'react'
import { Venue } from '@/lib/types'
import { PulseScore } from '@/components/PulseScore'
import { MapFilters, MapFiltersState } from '@/components/MapFilters'
import { MapSearch } from '@/components/MapSearch'
import { GPSIndicator } from '@/components/GPSIndicator'
import { MapboxBaseLayer, type MapboxBaseLayerHandle } from '@/components/MapboxBaseLayer'
import {
  MapPin, NavigationArrow, Plus, Minus,
  BeerBottle, MusicNotes, ForkKnife, Coffee, Martini, Confetti,
  Users, Fire
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
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

  const [showOnboardingTips, setShowOnboardingTips] = useState(false)
  const [tipIndex, setTipIndex] = useState(0)
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null)
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null)
  const [accessibilityMode, _setAccessibilityMode] = useState(false)
  const [isCameraMoving, setIsCameraMoving] = useState(false)
  const hasMapboxToken = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)
  // When Mapbox is available, it drives all interactions (Uber-style)
  const mapboxDrives = hasMapboxToken
  const mapboxRef = useRef<MapboxBaseLayerHandle>(null)
  const onboardingStorageKey = 'pulse-map-onboarding-v1'
  const { unitSystem } = useUnitPreference()
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cameraSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const venueSelectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  // Instagram-style gradient palette
  const getEnergyColor = (score: number) => {
    if (score >= 80) return '#E1306C' // IG pink
    if (score >= 60) return '#F77737' // IG orange
    if (score >= 30) return '#FCAF45' // IG gold
    return '#833AB4'                  // IG purple (muted)
  }

  const getEnergyGradientColors = (score: number): [string, string] => {
    if (score >= 80) return ['#833AB4', '#E1306C'] // purple → pink
    if (score >= 60) return ['#E1306C', '#F77737'] // pink → orange
    if (score >= 30) return ['#F77737', '#FCAF45'] // orange → gold
    return ['#405DE6', '#833AB4']                  // blue → purple
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

    return filtered
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

    // When Mapbox tiles are active the canvas is a transparent overlay;
    // otherwise draw the Instagram-style dark gradient background.
    if (!hasMapboxToken) {
      const bgGradient = ctx.createRadialGradient(
        dims.width / 2, dims.height / 2, 0,
        dims.width / 2, dims.height / 2, Math.max(dims.width, dims.height) * 0.75
      )
      bgGradient.addColorStop(0, '#1a1a2e')
      bgGradient.addColorStop(0.6, '#16132b')
      bgGradient.addColorStop(1, '#0d0d1a')
      ctx.fillStyle = bgGradient
      ctx.fillRect(0, 0, dims.width, dims.height)
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

      // Instagram gradient heatmap glows
      if (venue.pulseScore >= 80) {
        gradient.addColorStop(0, `rgba(225, 48, 108, ${intensity * 0.9})`) // IG pink
        gradient.addColorStop(0.5, `rgba(131, 58, 180, ${intensity * 0.5})`) // IG purple
      } else if (venue.pulseScore >= 60) {
        gradient.addColorStop(0, `rgba(247, 119, 55, ${intensity * 0.85})`) // IG orange
        gradient.addColorStop(0.5, `rgba(225, 48, 108, ${intensity * 0.4})`) // IG pink
      } else if (venue.pulseScore >= 30) {
        gradient.addColorStop(0, `rgba(252, 175, 69, ${intensity * 0.7})`) // IG gold
        gradient.addColorStop(0.5, `rgba(247, 119, 55, ${intensity * 0.35})`) // IG orange
      } else {
        gradient.addColorStop(0, `rgba(131, 58, 180, ${intensity * 0.5})`) // IG purple
        gradient.addColorStop(0.5, `rgba(64, 93, 230, ${intensity * 0.25})`) // IG blue
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
    if (mapboxDrives && mapboxRef.current && center) {
      const newZoom = clampZoom(zoom * ZOOM_STEP)
      mapboxRef.current.easeTo(center, newZoom, 300)
    } else {
      setZoom((z) => clampZoom(z * ZOOM_STEP))
    }
    setFollowUser(false)
  }

  const handleZoomOut = () => {
    triggerHapticFeedback('light')
    setExpandedClusterId(null)
    if (mapboxDrives && mapboxRef.current && center) {
      const newZoom = clampZoom(zoom / ZOOM_STEP)
      mapboxRef.current.easeTo(center, newZoom, 300)
    } else {
      setZoom((z) => clampZoom(z / ZOOM_STEP))
    }
    setFollowUser(false)
  }

  const handleCenterOnUser = () => {
    if (userLocation) {
      triggerHapticFeedback('medium')
      setExpandedClusterId(null)
      if (mapboxDrives && mapboxRef.current) {
        // Uber-style smooth flyTo with pitch reset
        mapboxRef.current.flyTo(userLocation, 1, {
          pitch: 45,
          bearing: 0,
          duration: 1500,
        })
      } else {
        setCenter(userLocation)
        setZoom(1)
      }
      setFollowUser(true)
    }
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

    if (mapboxDrives && mapboxRef.current) {
      // Uber-style smooth flyTo with zoom-in and slight pitch
      const targetZoom = clampZoom(Math.max(2.5, zoom * 1.3))
      mapboxRef.current.flyTo(
        { lat: venue.location.lat, lng: venue.location.lng },
        targetZoom,
        { pitch: 50, duration: 1200 }
      )
    } else if (center) {
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

  const previewVenues = useMemo(() => {
    if (!center) return [] as VenueRenderPoint[]
    return getPreviewVenuePoints({
      points: venueRenderPoints,
      center,
      userLocation,
      locationHeading
    })
  }, [center, venueRenderPoints, locationHeading, userLocation])

  // Compare mode removed — premature complexity for a discovery map

  const onboardingTips = [
    'Pinch or scroll to zoom. Double-tap to zoom in quickly.',
    'Tap a venue to see details. Swipe the cards below to explore.',
    'Use filter pills to find bars, clubs, or trending spots nearby.',
  ]

  const completeOnboarding = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(onboardingStorageKey, 'seen')
    }
    setShowOnboardingTips(false)
    setTipIndex(0)
  }


  if (!center) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center rounded-xl gap-5"
        style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%)' }}
      >
        <div className="relative">
          <div className="w-14 h-14 rounded-full animate-spin"
            style={{
              background: 'conic-gradient(from 0deg, transparent 0%, #833AB4 25%, #E1306C 50%, #F77737 75%, transparent 100%)',
              padding: '2.5px'
            }}
          >
            <div className="w-full h-full rounded-full bg-[#1a1a2e]" />
          </div>
          <MapPin size={20} weight="fill" className="absolute inset-0 m-auto text-[#E1306C]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-white">Finding your location</p>
          <p className="text-xs text-white/50 mt-1">Discovering nearby venues...</p>
        </div>
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
      {/* Mapbox tile layer — when available, drives all map interactions (Uber-style) */}
      {hasMapboxToken && center && (
        <MapboxBaseLayer
          ref={mapboxRef}
          center={center}
          zoom={zoom}
          interactive={mapboxDrives}
          pitch={45}
          bearing={0}
          onMove={(c) => {
            if (mapboxDrives) {
              setCenter(clampCenter(c))
              setFollowUser(false)
            }
          }}
          onZoom={(z) => {
            if (mapboxDrives) {
              setZoom(clampZoom(z))
            }
          }}
        />
      )}

      <canvas
        ref={canvasRef}
        className={cn(
          'absolute inset-0 w-full h-full',
          mapboxDrives ? 'pointer-events-none' : 'touch-none',
          !mapboxDrives && (isDragging ? 'cursor-grabbing' : 'cursor-grab')
        )}
        style={{ zIndex: mapboxDrives ? -1 : 1 }}
        {...(!mapboxDrives ? {
          onMouseDown: handleMouseDown,
          onMouseMove: handleMouseMove,
          onMouseUp: handleMouseUp,
          onMouseLeave: handleMouseUp,
          onTouchStart: handleTouchStart,
          onTouchMove: handleTouchMove,
          onTouchEnd: handleTouchEnd,
          onWheel: handleWheelZoom,
          onDoubleClick: handleDoubleClick,
        } : {})}
      />

      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 2 }}>
        {/* Instagram-style gradient definitions */}
        <defs>
          <linearGradient id="ig-gradient-hot" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#833AB4" />
            <stop offset="50%" stopColor="#E1306C" />
            <stop offset="100%" stopColor="#F77737" />
          </linearGradient>
          <linearGradient id="ig-gradient-warm" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E1306C" />
            <stop offset="50%" stopColor="#F77737" />
            <stop offset="100%" stopColor="#FCAF45" />
          </linearGradient>
          <linearGradient id="ig-gradient-chill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F77737" />
            <stop offset="100%" stopColor="#FCAF45" />
          </linearGradient>
          <linearGradient id="ig-gradient-quiet" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#405DE6" />
            <stop offset="100%" stopColor="#833AB4" />
          </linearGradient>
        </defs>

        {clusteredMapData.clusters.map((cluster) => {
          const clusterSize = Math.min(42, 20 + cluster.venues.length * 1.8)
          const gradientId = cluster.maxPulseScore >= 80 ? 'ig-gradient-hot'
            : cluster.maxPulseScore >= 60 ? 'ig-gradient-warm'
            : cluster.maxPulseScore >= 30 ? 'ig-gradient-chill'
            : 'ig-gradient-quiet'
          const isExpanded = expandedClusterId === cluster.id
          return (
            <g key={cluster.id} className="pointer-events-none">
              {/* Outer glow ring — story-ring style */}
              <circle
                cx={cluster.x}
                cy={cluster.y}
                r={clusterSize + 4}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={3}
                opacity={isExpanded ? 0.3 : 0.9}
              />
              <circle
                cx={cluster.x}
                cy={cluster.y}
                r={clusterSize}
                fill="#1a1a2e"
                stroke="none"
                opacity={isExpanded ? 0.4 : 1}
              />
              <text
                x={cluster.x}
                y={cluster.y + 5}
                textAnchor="middle"
                fill="white"
                fontSize={Math.max(11, Math.min(16, clusterSize * 0.5))}
                fontWeight="600"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              >
                {cluster.venues.length}
              </text>
            </g>
          )
        })}

        {expandedCluster && expandedClusterNodes.map((node) => {
          const nodeGradientId = node.venue.pulseScore >= 80 ? 'ig-gradient-hot'
            : node.venue.pulseScore >= 60 ? 'ig-gradient-warm'
            : node.venue.pulseScore >= 30 ? 'ig-gradient-chill'
            : 'ig-gradient-quiet'
          const nodeR = Math.max(11, 12 * zoom * 0.5)
          return (
            <g key={`expanded-${node.venue.id}`}>
              <line
                x1={expandedCluster.x}
                y1={expandedCluster.y}
                x2={node.sx}
                y2={node.sy}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <circle cx={node.sx} cy={node.sy} r={nodeR + 2.5} fill="none" stroke={`url(#${nodeGradientId})`} strokeWidth={2.5} />
              <circle cx={node.sx} cy={node.sy} r={nodeR} fill="#1a1a2e" />
            </g>
          )
        })}

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
          const iconSize = markerSize * 1.1
          const gradientId = venue.pulseScore >= 80 ? 'ig-gradient-hot'
            : venue.pulseScore >= 60 ? 'ig-gradient-warm'
            : venue.pulseScore >= 30 ? 'ig-gradient-chill'
            : 'ig-gradient-quiet'

          return (
            <g key={venue.id} className="pointer-events-none">
              {/* Soft glow for active venues */}
              {(isHighEnergy || hasRecentActivity) && !isCameraMoving && !accessibilityMode && (
                <circle
                  cx={x}
                  cy={y}
                  r={markerSize * 2.2}
                  fill={getEnergyColor(venue.pulseScore)}
                  opacity={0.12}
                  className="animate-pulse"
                  style={{ animationDuration: '3s' }}
                />
              )}

              {/* Story-ring gradient border */}
              <circle
                cx={x}
                cy={y}
                r={markerSize + (isHighlighted ? 3.5 : 2.5)}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={isHighlighted ? 3 : 2}
                className="transition-all duration-300"
              />

              {/* Inner dark fill */}
              <circle
                cx={x}
                cy={y}
                r={markerSize}
                fill={venue.pulseScore > 0 ? '#1a1a2e' : '#111'}
                className="transition-all duration-300"
              />

              <foreignObject
                x={x - iconSize / 2}
                y={y - iconSize / 2}
                width={iconSize}
                height={iconSize}
                className="pointer-events-none"
              >
                <div className="w-full h-full flex items-center justify-center">
                  <Icon
                    weight="fill"
                    className={cn(
                      "w-full h-full drop-shadow-sm",
                      venue.pulseScore >= 80 ? "text-[#E1306C]" :
                      venue.pulseScore >= 60 ? "text-[#F77737]" :
                      venue.pulseScore >= 30 ? "text-[#FCAF45]" :
                      "text-[#833AB4]/60"
                    )}
                  />
                </div>
              </foreignObject>
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
                  fill="#405DE6"
                  opacity={0.1}
                  stroke="#405DE6"
                  strokeWidth={1}
                  strokeOpacity={0.2}
                />
              )}
              <circle
                cx={userPos.x}
                cy={userPos.y}
                r={12 * zoom}
                fill="#405DE6"
                opacity={0.25}
                className={accessibilityMode ? undefined : "animate-pulse"}
              />
              <circle
                cx={userPos.x}
                cy={userPos.y}
                r={(accessibilityMode ? 8 : 6) * zoom}
                fill="#405DE6"
                stroke="white"
                strokeWidth={2.5 * zoom}
              />
              {locationHeading !== null && locationHeading !== undefined && !Number.isNaN(locationHeading) && (
                <g
                  transform={`translate(${userPos.x}, ${userPos.y}) rotate(${locationHeading})`}
                >
                  <path
                    d="M0 -16 L4 -6 L0 -8 L-4 -6 Z"
                    fill="#405DE6"
                    opacity={0.85}
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
          <div className="bg-card/95 backdrop-blur-xl border border-white/10 rounded-3xl p-6 text-center max-w-xs shadow-2xl">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737] flex items-center justify-center">
              <MapPin size={24} weight="fill" className="text-white" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">No Venues Here</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Zoom out or pan to discover nearby spots
            </p>
            <Button
              size="sm"
              className="pointer-events-auto rounded-full bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] text-white border-0 hover:opacity-90"
              onClick={handleCenterOnUser}
            >
              <NavigationArrow size={14} weight="fill" className="mr-1.5" />
              Center on Me
            </Button>
          </div>
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
              <div className="bg-card/95 backdrop-blur-xl border border-white/10 rounded-full px-2.5 py-0.5 shadow-lg">
                <p className="text-[10px] font-medium text-foreground">
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
                  <div className={cn(
                    "rounded-full px-2.5 py-1 shadow-lg transition-all",
                    "bg-card/95 backdrop-blur-xl border border-white/10",
                    isHovered && "bg-card shadow-xl scale-105"
                  )}>
                    <p className="text-[11px] font-semibold text-center">{venue.name}</p>
                    {distance !== undefined && (
                      <p className="text-[9px] text-muted-foreground text-center">
                        {formatDistance(distance, unitSystem)}
                      </p>
                    )}
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
              <div className="rounded-2xl bg-card/98 backdrop-blur-xl shadow-xl border border-white/10 relative overflow-hidden">
                {/* IG gradient top accent */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737]" />

                <div className="p-3 pt-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{hoveredVenue.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {hoveredVenue.category || 'Venue'}
                        </span>
                        {distance !== undefined && (
                          <>
                            <span className="text-[10px] text-muted-foreground/50">·</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistance(distance, unitSystem)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <PulseScore score={hoveredVenue.pulseScore} size="sm" showLabel={false} />
                  </div>

                  <div className="flex items-center gap-3 pt-1.5">
                    {(hoveredVenue.verifiedCheckInCount ?? 0) > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Users size={11} />
                        <span>{hoveredVenue.verifiedCheckInCount} here</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Fire size={11} className={hoveredVenue.pulseScore > 50 ? "text-[#F77737]" : ""} />
                      <span>{hoveredVenue.pulseScore > 80 ? "Trending" : hoveredVenue.pulseScore > 50 ? "Active" : "Quiet"}</span>
                    </div>
                  </div>
                </div>
                {/* Pointer arrow */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-card/98 rotate-45 border-r border-b border-white/10"
                />
              </div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      <div className="absolute top-4 left-4 right-14 z-10 flex flex-col gap-2">
        <div className="flex-1 max-w-md">
          <MapSearch
            venues={venues}
            onVenueSelect={handleVenueSelect}
            userLocation={userLocation}
          />
        </div>

        {showOnboardingTips && (
          <div className="max-w-md bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl p-3.5">
            <p className="text-[11px] font-semibold text-[#E1306C] mb-1.5">
              Tip {tipIndex + 1}/{onboardingTips.length}
            </p>
            <p className="text-xs text-foreground">
              {onboardingTips[tipIndex]}
            </p>
            <div className="mt-3 flex gap-2 justify-end">
              <button
                className="h-7 px-3 text-[11px] text-muted-foreground hover:text-foreground rounded-full transition-colors"
                onClick={completeOnboarding}
              >
                Skip
              </button>
              <button
                className="h-7 px-4 text-[11px] font-semibold text-white rounded-full bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] hover:opacity-90 transition-opacity"
                onClick={() => {
                  if (tipIndex >= onboardingTips.length - 1) {
                    completeOnboarding()
                  } else {
                    setTipIndex((prev) => prev + 1)
                  }
                }}
              >
                {tipIndex >= onboardingTips.length - 1 ? 'Done' : 'Next'}
              </button>
            </div>
          </div>
        )}

        {/* Instagram-style filter pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide max-w-[calc(100vw-5rem)]">
          {([
            { label: 'Bars', icon: BeerBottle, active: filters.categories.includes('bar'), toggle: () => {
              if (filters.categories.includes('bar')) setFilters(f => ({ ...f, categories: f.categories.filter(c => c !== 'bar') }))
              else setFilters(f => ({ ...f, categories: [...f.categories, 'bar'] }))
            }},
            { label: 'Clubs', icon: MusicNotes, active: filters.categories.includes('club') || filters.categories.includes('nightclub'), toggle: () => {
              const has = filters.categories.includes('club') || filters.categories.includes('nightclub')
              if (has) setFilters(f => ({ ...f, categories: f.categories.filter(c => c !== 'club' && c !== 'nightclub') }))
              else setFilters(f => ({ ...f, categories: [...f.categories, 'club', 'nightclub'] }))
            }},
            { label: 'Near Me', icon: MapPin, active: nearMeActive, toggle: () => setNearMeActive(!nearMeActive) },
            { label: 'Hot', icon: Fire, active: filters.energyLevels.includes('electric') || filters.energyLevels.includes('buzzing'), toggle: () => {
              const has = filters.energyLevels.includes('electric') || filters.energyLevels.includes('buzzing')
              if (has) setFilters(f => ({ ...f, energyLevels: f.energyLevels.filter(e => e !== 'electric' && e !== 'buzzing') }))
              else setFilters(f => ({ ...f, energyLevels: [...f.energyLevels, 'electric', 'buzzing'] }))
            }},
            { label: 'Food', icon: ForkKnife, active: filters.categories.includes('restaurant') || filters.categories.includes('food'), toggle: () => {
              const has = filters.categories.includes('restaurant') || filters.categories.includes('food')
              if (has) setFilters(f => ({ ...f, categories: f.categories.filter(c => c !== 'restaurant' && c !== 'food') }))
              else setFilters(f => ({ ...f, categories: [...f.categories, 'restaurant', 'food'] }))
            }},
          ] as const).map(({ label, icon: ChipIcon, active, toggle }) => (
            <button
              key={label}
              onClick={() => { triggerHapticFeedback('light'); toggle() }}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-4 h-9 rounded-full text-[13px] font-medium transition-all touch-manipulation active:scale-[0.96]",
                active
                  ? "bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] text-white shadow-md"
                  : "bg-card/90 backdrop-blur-xl text-foreground border border-white/10 hover:bg-card"
              )}
            >
              <ChipIcon size={14} weight="fill" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Right Controls — Instagram-style floating buttons */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <MapFilters
          filters={filters}
          onChange={setFilters}
          availableCategories={availableCategories}
        />

        <div className="flex flex-col gap-1.5">
          <button
            className="w-10 h-10 rounded-full bg-card/90 backdrop-blur-xl border border-white/10 shadow-lg flex items-center justify-center text-foreground hover:bg-card transition-colors touch-manipulation"
            onClick={handleZoomIn}
            aria-label="Zoom in"
          >
            <Plus size={18} weight="bold" />
          </button>
          <button
            className="w-10 h-10 rounded-full bg-card/90 backdrop-blur-xl border border-white/10 shadow-lg flex items-center justify-center text-foreground hover:bg-card transition-colors touch-manipulation"
            onClick={handleZoomOut}
            aria-label="Zoom out"
          >
            <Minus size={18} weight="bold" />
          </button>
          <button
            className={cn(
              "w-10 h-10 rounded-full backdrop-blur-xl border shadow-lg flex items-center justify-center transition-colors touch-manipulation",
              followUser
                ? "bg-gradient-to-br from-[#833AB4] to-[#E1306C] text-white border-white/20"
                : "bg-card/90 text-foreground border-white/10 hover:bg-card"
            )}
            onClick={handleCenterOnUser}
            aria-label="Center map on my location"
          >
            <NavigationArrow size={18} weight="fill" />
          </button>
        </div>
      </div>

      {/* Bottom venue carousel — Uber-style single row */}
      {previewVenues.length > 0 && !isDragging && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-4 left-0 right-0 z-20 pointer-events-none"
        >
          <div className="flex gap-2.5 overflow-x-auto pb-1 px-4 snap-x snap-mandatory scrollbar-hide">
            {previewVenues.map((point, index) => {
              const Icon = getCategoryIcon(point.venue.category)
              const isFirst = index === 0
              const headingDelta = (locationHeading !== null && locationHeading !== undefined && userLocation)
                ? getHeadingDelta(calculateBearing(
                  userLocation.lat,
                  userLocation.lng,
                  point.venue.location.lat,
                  point.venue.location.lng
                ), locationHeading)
                : null
              const isAhead = headingDelta !== null && headingDelta < 30

              const [gradStart, gradEnd] = getEnergyGradientColors(point.venue.pulseScore)

              return (
                <motion.button
                  key={`preview-${point.venue.id}`}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "pointer-events-auto snap-start flex-shrink-0 w-[180px] text-left transition-all active:scale-[0.96]",
                    "rounded-2xl overflow-hidden",
                    hoveredVenue?.id === point.venue.id && "scale-[1.02]"
                  )}
                  style={{
                    padding: '2px',
                    background: isFirst
                      ? `linear-gradient(135deg, ${gradStart}, ${gradEnd})`
                      : 'rgba(255,255,255,0.08)'
                  }}
                  onClick={() => {
                    triggerHapticFeedback('medium')
                    onVenueClick(point.venue)
                  }}
                >
                  <div className="bg-card/98 backdrop-blur-xl rounded-[14px] p-3 h-full">
                    {isFirst && (
                      <div className="flex items-center gap-1 mb-1.5">
                        <NavigationArrow size={10} weight="fill" className="text-[#E1306C]" />
                        <span className="text-[9px] font-bold text-[#E1306C] uppercase tracking-wider">Suggested</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      {/* Story-ring icon */}
                      <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${gradStart}, ${gradEnd})`, padding: '2px' }}
                      >
                        <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
                          <Icon size={14} weight="fill" style={{ color: gradEnd }} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate leading-tight">{point.venue.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {point.venue.category || 'Venue'}
                          {point.distance !== undefined && ` · ${formatDistance(point.distance, unitSystem)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <PulseScore score={point.venue.pulseScore} size="xs" showLabel={false} />
                      {isAhead && (
                        <span className="text-[9px] font-semibold text-[#E1306C]">Ahead</span>
                      )}
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Bottom Left — GPS only */}
      <div className="absolute bottom-4 left-4 z-10">
        <GPSIndicator isTracking={isTracking} accuracy={locationAccuracy} />
      </div>
    </div>
  )
}
