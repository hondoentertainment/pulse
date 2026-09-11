import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Venue, type Pulse } from '@/lib/types'
import { PulseScore } from '@/components/PulseScore'
import { MapLiveReviewToast } from '@/components/MapLiveReviewToast'
import { TrustPinChips } from '@/components/TrustPinChips'
import { buildTrustGlance, shouldShowMapTrustHover } from '@/lib/trust-glance'
import { markMapInteractive } from '@/lib/cold-start'
import { useMapLiveReviews } from '@/hooks/use-map-live-reviews'
import {
  buildMapLiveToast,
  buildVenueActivityMap,
  compareVenueMapActivity,
  getVenueMapActivityFromLive,
  type MapLiveToast,
  type VenueMapActivity,
} from '@/lib/map-live-reviews'
import { MapFilters, type EnergyFilter, type MapFiltersState } from '@/components/MapFilters'
import {
  collectNeighborhoods,
  filterMapVenues,
  isCuratedVenue,
  shouldClusterMapMarkers,
} from '@/lib/map-filters'
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
import { getEnergyAriaLabel } from '@/lib/accessibility'
import { getEnergyLabel } from '@/lib/pulse-engine'
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
  isLocationNearCatalog,
  resolveMapCamera,
  type VenueRenderPoint
} from '@/lib/interactive-map'
import { MapEmptyOverlay } from '@/components/MapEmptyOverlay'

interface InteractiveMapProps {
  venues: Venue[]
  userLocation: { lat: number; lng: number } | null
  onVenueClick: (venue: Venue) => void
  isTracking?: boolean
  locationAccuracy?: number
  locationHeading?: number | null
  pulses?: Pulse[]
  /** `heatmap` hides search/smart-route chrome so the map tab can match Figma. */
  chrome?: 'full' | 'heatmap'
  energyLevels?: EnergyFilter[]
  onEnergyLevelsChange?: (levels: EnergyFilter[]) => void
  nearMe?: boolean
  onNearMeChange?: (active: boolean) => void
  inventoryLayer?: 'curated' | 'all'
  onInventoryLayerChange?: (layer: 'curated' | 'all') => void
  bloomVenueId?: string | null
  /** Deep-link / I’m-here pin to center on. */
  focusVenueId?: string | null
}

const ZOOM_STEP = 1.35
const MAP_SCALE = 500000
const EMPTY_PULSES: Pulse[] = []

export const InteractiveMap = memo(function InteractiveMap({
  venues,
  userLocation,
  onVenueClick,
  isTracking = false,
  locationAccuracy,
  locationHeading,
  pulses = EMPTY_PULSES,
  chrome = 'full',
  energyLevels,
  onEnergyLevelsChange,
  nearMe,
  onNearMeChange,
  inventoryLayer: inventoryLayerProp,
  onInventoryLayerChange,
  bloomVenueId = null,
  focusVenueId = null,
}: InteractiveMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [zoom, setZoom] = useState(() => resolveMapCamera().zoom)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(() => resolveMapCamera().center)
  const [hoveredVenue, setHoveredVenue] = useState<Venue | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [followUser, setFollowUser] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null) // Optimization: Reuse canvas
  const [filters, setFilters] = useState<MapFiltersState>({
    energyLevels: [],
    categories: [],
    maxDistance: Infinity,
    neighborhoods: [],
    inventoryLayer: 'curated',
  })
  const [nearMeActive, setNearMeActive] = useState(false)

  useEffect(() => {
    if (energyLevels) {
      setFilters((current) => ({ ...current, energyLevels }))
    }
  }, [energyLevels])

  useEffect(() => {
    if (nearMe !== undefined) {
      setNearMeActive(nearMe)
    }
  }, [nearMe])

  useEffect(() => {
    if (inventoryLayerProp) {
      setFilters((current) => ({ ...current, inventoryLayer: inventoryLayerProp }))
    }
  }, [inventoryLayerProp])

  const applyEnergyLevels = (levels: EnergyFilter[]) => {
    setFilters((current) => ({ ...current, energyLevels: levels }))
    onEnergyLevelsChange?.(levels)
  }

  const applyNearMe = (active: boolean) => {
    setNearMeActive(active)
    onNearMeChange?.(active)
  }
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
  const { toast: incomingLiveToast, dismissToast } = useMapLiveReviews(pulses, venues)
  const activityByVenueId = useMemo(
    () => buildVenueActivityMap(venues, pulses),
    [venues, pulses],
  )
  const activityFor = useCallback((venue: Venue): VenueMapActivity => {
    return activityByVenueId.get(venue.id) ?? getVenueMapActivityFromLive(venue, undefined)
  }, [activityByVenueId])
  const [pinnedLiveToast, setPinnedLiveToast] = useState<MapLiveToast | null>(null)
  const liveToast = pinnedLiveToast ?? incomingLiveToast
  const handleDismissLiveToast = useCallback(() => {
    setPinnedLiveToast(null)
    dismissToast()
  }, [dismissToast])
  const handleOpenLiveToast = useCallback((next: MapLiveToast) => {
    const venue = venues.find((item) => item.id === next.venueId)
    if (venue) onVenueClick(venue)
  }, [venues, onVenueClick])
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
    const camera = resolveMapCamera({ userLocation, venues })
    setCenter((current) => current ?? camera.center)
    if (camera.followUser) {
      setFollowUser(true)
      setCenter(camera.center)
      setZoom((current) => current || camera.zoom)
    }
  }, [userLocation, venues])

  useEffect(() => {
    if (userLocation && followUser && isLocationNearCatalog(userLocation, venues)) {
      setCenter(userLocation)
    }
  }, [userLocation, followUser, venues])

  useEffect(() => {
    markMapInteractive()
  }, [])

  useEffect(() => {
    if (!focusVenueId) return
    const venue = venues.find((item) => item.id === focusVenueId)
    if (!venue?.location) return
    setFollowUser(false)
    setCenter({ lat: venue.location.lat, lng: venue.location.lng })
    setZoom((current) => clampZoom(Math.max(2.1, current)))
    setHoveredVenue(venue)
  }, [focusVenueId, venues])

  useEffect(() => {
    if (userLocation && !center && isLocationNearCatalog(userLocation, venues)) {
      setCenter(userLocation)
    }
  }, [userLocation, center, venues])

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

  const getLiveIntelLabel = (venue: Venue) => {
    const activity = activityFor(venue)
    if (activity.countLabel) return activity.countLabel
    const live = venue.liveSummary
    if (!live || live.reportCount === 0) return null
    if (live.waitTime !== null && live.waitTime <= 5) return 'Walk right in'
    if (live.waitTime !== null && live.waitTime >= 25) return 'Line risk'
    if (live.crowdLevel >= 75) return 'Packed now'
    if (live.nowPlaying) return 'Track confirmed'
    if (live.musicGenre) return `${live.musicGenre} now`
    return `${live.reportCount} live report${live.reportCount === 1 ? '' : 's'}`
  }

  const filteredVenues = useMemo(() => {
    const filtered = filterMapVenues({
      venues,
      filters,
      userLocation,
      nearMe: nearMeActive,
    })

    const extraFiltersOn =
      filters.energyLevels.length > 0 ||
      filters.categories.length > 0 ||
      (filters.neighborhoods?.length ?? 0) > 0
    const layer = filters.inventoryLayer ?? 'curated'

    // All-Seattle + no extra filters: keep the old top-5 surging preview
    // unless the user asked for the full catalog.
    if (
      layer === 'all' &&
      !showFullHeatmap &&
      !nearMeActive &&
      !extraFiltersOn
    ) {
      const nearby = userLocation && isLocationNearCatalog(userLocation, filtered)
        ? filtered
          .filter(v => calculateDistance(userLocation.lat, userLocation.lng, v.location.lat, v.location.lng) < 50)
          .sort((a, b) => compareVenueMapActivity(activityFor(a), activityFor(b)))
        : filtered.sort((a, b) => compareVenueMapActivity(activityFor(a), activityFor(b)))
      return (nearby.length > 0 ? nearby : filtered).slice(0, 5)
    }

    return filtered
  }, [venues, filters, userLocation, nearMeActive, showFullHeatmap, activityFor])

  const availableCategories = useMemo(
    () => Array.from(
      new Set(venues.map((v) => v.category).filter((c): c is string => !!c))
    ).sort(),
    [venues],
  )
  const availableNeighborhoods = useMemo(() => collectNeighborhoods(venues), [venues])

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

    const frame = window.requestAnimationFrame(() => {
      const canvas = canvasRef.current
      if (!canvas || !center) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = dimensions.width * window.devicePixelRatio
      canvas.height = dimensions.height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

      drawHeatmap(ctx, filteredVenues, center, zoom, dimensions)
    })
    return () => window.cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredVenues, center, zoom, dimensions, activityByVenueId])

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
      const activity = activityFor(venue)
      if (activity.heatScore <= 0) return

      const pos = latLngToPixel(venue.location.lat, venue.location.lng, mapCenter, mapZoom, dims)
      const intensity = Math.min(activity.heatScore / 100, 1)
      const radius = Math.max(40 * mapZoom * (0.5 + intensity * 0.5) * activity.radiusFactor, 20)
      const { r, g, b } = activity.heatColor

      const gradient = heatmapCtx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius)
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${intensity * 1.0})`)
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${intensity * 0.55})`)
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
    triggerHapticFeedback('medium')
    setExpandedClusterId(null)
    const camera = resolveMapCamera({ userLocation, venues: filteredVenues.length > 0 ? filteredVenues : venues })
    setCenter(camera.center)
    setZoom(camera.zoom)
    setFollowUser(camera.followUser)
  }

  const handleShowSeattle = () => {
    const viewport = getFittedViewport(
      filteredVenues.length > 0 ? filteredVenues : venues,
      dimensions,
    )
    const camera = resolveMapCamera({ userLocation: null, venues: filteredVenues.length > 0 ? filteredVenues : venues })
    stopInertia()
    triggerHapticFeedback('medium')
    setExpandedClusterId(null)
    setCenter(viewport?.center ?? camera.center)
    setZoom(viewport?.zoom ?? camera.zoom)
    setFollowUser(false)
  }

  const handleClearMapFilters = () => {
    applyEnergyLevels([])
    applyNearMe(false)
    setFilters((current) => ({
      ...current,
      energyLevels: [],
      categories: [],
      neighborhoods: [],
      maxDistance: Infinity,
    }))
    handleShowSeattle()
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

  const autoFitRef = useRef(false)
  useEffect(() => {
    if (autoFitRef.current || !center || filteredVenues.length === 0) return
    if (venueRenderPoints.length > 0) {
      autoFitRef.current = true
      return
    }
    const viewport = getFittedViewport(filteredVenues, dimensions)
    if (!viewport) return
    autoFitRef.current = true
    setCenter(viewport.center)
    setZoom(viewport.zoom)
    setFollowUser(false)
  }, [center, filteredVenues, venueRenderPoints.length, dimensions])

  const shouldClusterMarkers = shouldClusterMapMarkers({
    zoom,
    isDragging,
    inventoryLayer: filters.inventoryLayer ?? 'curated',
  })

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

  const activeFilterCount =
    filters.energyLevels.length +
    filters.categories.length +
    (filters.neighborhoods?.length ?? 0) +
    ((filters.inventoryLayer ?? 'curated') === 'all' ? 1 : 0) +
    (filters.maxDistance !== Infinity ? 1 : 0)

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

  const inventoryLayer = filters.inventoryLayer ?? 'curated'
  const mapModeLabel = nearMeActive
    ? 'Near Me'
    : activeFilterCount > 0
      ? 'Filtered'
      : inventoryLayer === 'curated'
        ? 'Launch 33'
        : showFullHeatmap
          ? 'All Seattle'
          : 'Top Surges'
  const mapSummary = activeFilterCount > 0
    ? `${filteredVenues.length} matching ${filteredVenues.length === 1 ? 'spot' : 'spots'}`
    : inventoryLayer === 'curated'
      ? `${filteredVenues.length} curated launch venues`
      : showFullHeatmap
        ? `${filteredVenues.length} venues in view`
        : `Showing the ${filteredVenues.length} strongest ${filteredVenues.length === 1 ? 'signal' : 'signals'} nearby`
  const showCuratedToggle = !nearMeActive
    && filters.energyLevels.length === 0
    && filters.categories.length === 0
    && (filters.neighborhoods?.length ?? 0) === 0
    && filters.maxDistance === Infinity

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
      role="application"
      aria-label="Venue map. Use arrow keys to pan, plus and minus to zoom."
      className="relative w-full h-full rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-accent"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <nav aria-label="Venues on this map" className="sr-only">
        <ul>
          {venues.map((venue) => (
            <li key={`map-list-${venue.id}`}>
              <button
                type="button"
                onClick={() => onVenueClick(venue)}
              >
                {getEnergyAriaLabel(venue.pulseScore, getEnergyLabel(venue.pulseScore), venue.name)}
                {venue.neighborhood ? `, ${venue.neighborhood}` : ''}
              </button>
            </li>
          ))}
        </ul>
      </nav>
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
          const activity = activityFor(venue)
          const baseSize = accessibilityMode ? 24 : 18
          const scale = activity.heatScore > 0 ? 1 + (activity.heatScore / 100) : 1
          const markerSize = baseSize * zoom * scale * 0.6
          const isHighlighted = hoveredVenue?.id === venue.id
          const isHighEnergy = activity.heatScore >= 80
          const isBlooming = bloomVenueId === venue.id || incomingLiveToast?.venueId === venue.id
          const hasRecentActivity = isBlooming || activity.hasFreshReview || (venue.lastActivity
            ? (Date.now() - new Date(venue.lastActivity).getTime()) < 10 * 60 * 1000
            : activity.heatScore >= 50)

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
                    className={isBlooming ? 'animate-ping' : 'animate-pulse-glow'}
                    style={{ animationDuration: isBlooming ? '1.2s' : '3s' }}
                    data-bloom={isBlooming ? 'true' : undefined}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={markerSize * 1.8}
                    fill={getEnergyColor(venue.pulseScore)}
                    opacity={0.25}
                    className={isBlooming ? 'animate-ping' : 'animate-pulse'}
                    style={{ animationDuration: isBlooming ? '1.2s' : '2s' }}
                  />
                </>
              )}

              <circle
                cx={x}
                cy={y}
                r={markerSize}
                fill={activity.heatScore > 0 ? getEnergyColor(activity.heatScore) : 'oklch(0.25 0.05 260)'}
                stroke={isHighlighted ? 'white' : isCuratedVenue(venue) ? '#F7D774' : 'oklch(0.15 0 0)'}
                strokeWidth={isHighlighted ? 3 : isCuratedVenue(venue) ? 2.4 : 1.5}
                className="transition-all duration-300"
                filter={activity.heatScore >= 30 ? `drop-shadow(0 0 ${activity.heatScore >= 80 ? '8px' : '4px'} ${activity.heatScore >= 80 ? 'rgba(255, 45, 120, 0.6)' : activity.heatScore >= 60 ? 'rgba(255, 138, 0, 0.5)' : 'rgba(0, 209, 255, 0.4)'})` : undefined}
              />

              <text
                x={x + markerSize * 0.85}
                y={y - markerSize * 0.7}
                textAnchor="middle"
                fill="white"
                fontSize={Math.max(9, markerSize * 0.55)}
                fontWeight="700"
                stroke="oklch(0.15 0 0)"
                strokeWidth={2}
                paintOrder="stroke"
              >
                {getEnergyLabel(venue.pulseScore).charAt(0)}
              </text>
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

      <MapEmptyOverlay
        catalogCount={venues.length}
        filteredCount={filteredVenues.length}
        inViewCount={venueRenderPoints.length}
        onShowCatalog={handleShowSeattle}
        onClearFilters={handleClearMapFilters}
      />

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
          {chrome === 'full' && !isCameraMoving && (
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
        const activity = activityFor(venue)
        const showLabel = labelVenueIds.has(venue.id) || activity.heatScore >= 75 || activity.liveReviewCount > 0
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
              type="button"
              className="pointer-events-auto relative z-20 cursor-pointer hover:scale-110 transition-transform"
              aria-label={getEnergyAriaLabel(venue.pulseScore, getEnergyLabel(venue.pulseScore), venue.name)}
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
              {chrome === 'full' && showLabel && (
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
                    <p className="text-[10px] font-semibold text-foreground">
                      {getEnergyLabel(activity.heatScore)} · {activity.heatScore}
                    </p>
                    {activity.countLabel && (
                      <button
                        type="button"
                        className="pointer-events-auto mt-1 rounded-full bg-[#FF2D78] px-2 py-0.5 text-[10px] font-semibold text-white"
                        aria-label={`Live reviews at ${venue.name}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          triggerHapticFeedback('light')
                          if (activity.latest) {
                            setPinnedLiveToast(buildMapLiveToast(activity.latest, venue))
                            dismissToast()
                          } else {
                            onVenueClick(venue)
                          }
                        }}
                      >
                        {activity.countLabel}
                      </button>
                    )}
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
        {shouldShowMapTrustHover({
          hasHoveredVenue: Boolean(hoveredVenue),
          isDragging,
          isCameraMoving,
        }) && hoveredVenue && (() => {
          const pos = getVenuePixelPosition(hoveredVenue)
          if (!pos) return null
          const compact = chrome === 'heatmap'
          const glance = buildTrustGlance(hoveredVenue, pulses)

          const distance = userLocation
            ? calculateDistance(
              userLocation.lat,
              userLocation.lng,
              hoveredVenue.location.lat,
              hoveredVenue.location.lng
            )
            : undefined

          const tooltipWidth = compact ? 220 : 240
          const tooltipHeight = compact ? 72 : 100
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

                      {!compact && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase font-mono border-accent/30 text-accent bg-accent/5">
                            {hoveredVenue.category || 'Venue'}
                          </Badge>
                          {getLiveIntelLabel(hoveredVenue) && (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase font-mono border-primary/30 text-primary bg-primary/5">
                              {getLiveIntelLabel(hoveredVenue)}
                            </Badge>
                          )}
                          {distance !== undefined && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {formatDistance(distance, unitSystem)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {!compact && <PulseScore score={hoveredVenue.pulseScore} size="sm" showLabel={false} />}
                  </div>
                  <TrustPinChips chips={glance.chips} />

                  {!compact && hoveredVenue.location.address && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin size={12} weight="fill" />
                      <p className="text-[10px] line-clamp-1">
                        {hoveredVenue.location.address}
                      </p>
                    </div>
                  )}

                  {!compact && (
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
                  )}
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

      {chrome === 'full' && <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none">
        <div className="max-w-xl pointer-events-auto">
          <Card className="bg-card/92 backdrop-blur-xl border-border/80 shadow-2xl overflow-hidden">
            <div className="p-2.5">
              <MapSearch
                venues={venues}
                onVenueSelect={handleVenueSelect}
                userLocation={userLocation}
              />
            </div>

            <div className="border-t border-border/50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-5 px-2 text-[10px] font-bold bg-primary/12 text-primary border-primary/20">
                      {mapModeLabel}
                    </Badge>
                    {followUser && userLocation && (
                      <span className="text-[10px] font-medium text-muted-foreground">Following you</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground truncate">{mapSummary}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      triggerHapticFeedback('light')
                      const next = (filters.inventoryLayer ?? 'curated') === 'curated' ? 'all' : 'curated'
                      setFilters((current) => ({ ...current, inventoryLayer: next }))
                      onInventoryLayerChange?.(next)
                      if (next === 'all') setShowFullHeatmap(true)
                    }}
                    className="h-8 px-3 text-[11px] font-semibold"
                  >
                    {(filters.inventoryLayer ?? 'curated') === 'curated' ? 'Launch 33' : 'All Seattle'}
                  </Button>
                  {showCuratedToggle && (filters.inventoryLayer ?? 'curated') === 'all' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleToggleFullHeatmap}
                      className="h-8 px-3 text-[11px] font-semibold"
                    >
                      {showFullHeatmap ? 'Top only' : 'Show all'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Filter Chips — Figma Enhanced: Electric / Buzzing / Near me */}
        <div className="mt-2 flex max-w-xl gap-2 overflow-x-auto pb-1 pointer-events-auto [scrollbar-width:none]">
          <button
            onClick={() => {
              triggerHapticFeedback('light')
              if (filters.energyLevels.includes('electric')) {
                applyEnergyLevels(filters.energyLevels.filter(e => e !== 'electric'))
              } else {
                applyEnergyLevels([...filters.energyLevels, 'electric'])
              }
            }}
            className={cn(
              "shrink-0 px-3 min-h-10 rounded-full text-xs font-semibold transition-all touch-manipulation active:scale-[0.98]",
              filters.energyLevels.includes('electric')
                ? "bg-primary text-primary-foreground"
                : "border border-[#40404D] bg-[#1F1F24] text-[#9E9EAD] hover:text-foreground"
            )}
          >
            Electric
          </button>
          <button
            onClick={() => {
              triggerHapticFeedback('light')
              if (filters.energyLevels.includes('buzzing')) {
                applyEnergyLevels(filters.energyLevels.filter(e => e !== 'buzzing'))
              } else {
                applyEnergyLevels([...filters.energyLevels, 'buzzing'])
              }
            }}
            className={cn(
              "shrink-0 px-3 min-h-10 rounded-full text-xs font-semibold transition-all touch-manipulation active:scale-[0.98]",
              filters.energyLevels.includes('buzzing')
                ? "bg-[var(--energy-buzzing)] text-white"
                : "border border-[#40404D] bg-[#1F1F24] text-[#9E9EAD] hover:text-foreground"
            )}
          >
            Buzzing
          </button>
          <button
            onClick={() => {
              triggerHapticFeedback('light')
              applyNearMe(!nearMeActive)
            }}
            className={cn(
              "shrink-0 px-3 min-h-10 rounded-full text-xs font-semibold transition-all touch-manipulation active:scale-[0.98]",
              nearMeActive
                ? "bg-accent text-accent-foreground"
                : "border border-[#40404D] bg-[#1F1F24] text-[#9E9EAD] hover:text-foreground"
            )}
          >
            Near me
          </button>
          {availableNeighborhoods.slice(0, 8).map((name) => {
            const selected = (filters.neighborhoods ?? []).includes(name)
            return (
              <button
                key={name}
                onClick={() => {
                  triggerHapticFeedback('light')
                  const current = filters.neighborhoods ?? []
                  const next = selected
                    ? current.filter((item) => item !== name)
                    : [...current, name]
                  setFilters((state) => ({ ...state, neighborhoods: next }))
                }}
                className={cn(
                  'shrink-0 px-3 min-h-10 rounded-full text-xs font-semibold transition-all touch-manipulation active:scale-[0.98]',
                  selected
                    ? 'bg-white text-black'
                    : 'border border-[#40404D] bg-[#1F1F24] text-[#9E9EAD] hover:text-foreground',
                )}
              >
                {name}
              </button>
            )
          })}
        </div>

        {showOnboardingTips && (
          <Card className="mt-2 max-w-xl bg-card/95 backdrop-blur-sm border border-border shadow-lg p-3 pointer-events-auto">
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
      </div>}

      <div className="pointer-events-none absolute top-3 left-3 right-3 z-40">
        <div className="pointer-events-auto max-w-xl">
          <AnimatePresence>
            <MapLiveReviewToast
              toast={liveToast}
              onDismiss={handleDismissLiveToast}
              onOpen={handleOpenLiveToast}
            />
          </AnimatePresence>
        </div>
      </div>

      {/* Consolidated Map Controls */}
      {chrome === 'full' && <div className="absolute bottom-28 right-3 flex flex-col items-end gap-2 z-20">
        <Button
          size="sm"
          variant={accessibilityMode ? "default" : "secondary"}
          className="self-end h-10 px-3 bg-card/95 backdrop-blur-sm border border-border shadow-lg"
          aria-pressed={accessibilityMode}
          aria-label={accessibilityMode ? 'Disable high-contrast map markers' : 'Enable high-contrast map markers'}
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
        <MapFilters
          filters={filters}
          onChange={setFilters}
          availableCategories={availableCategories}
          availableNeighborhoods={availableNeighborhoods}
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
                  applyNearMe(!nearMeActive)
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
        <div className="text-[10px] font-mono text-muted-foreground text-center bg-card/80 backdrop-blur-sm rounded px-2 py-1 shadow-sm">
          {zoom.toFixed(1)}x
        </div>
      </div>}

      {chrome === 'full' && previewVenues.length > 0 && (
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
              const previewActivity = activityFor(point.venue)
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
                          {previewActivity.countLabel && (
                            <p className="mt-1 text-[10px] font-semibold text-[#FF2D78]">
                              {previewActivity.countLabel}
                            </p>
                          )}
                        </div>
                        <PulseScore score={previewActivity.heatScore} size="xs" showLabel={false} />
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
      {chrome === 'full' && <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2">
        <GPSIndicator isTracking={isTracking} accuracy={locationAccuracy} />

        {(filters.energyLevels.length > 0 ||
          filters.categories.length > 0 ||
          (filters.neighborhoods?.length ?? 0) > 0 ||
          (filters.inventoryLayer ?? 'curated') === 'all' ||
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
            type="button"
            aria-expanded={showLegend}
            aria-controls="map-energy-legend"
            onClick={() => setShowLegend(!showLegend)}
            className="w-full min-h-11 px-3 py-2 flex items-center justify-between hover:bg-secondary/50 transition-colors"
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
                <div id="map-energy-legend" className="px-3 pb-3 grid grid-cols-2 gap-2">
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
      </div>}

    </div>
  )
})
