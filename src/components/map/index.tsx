import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Venue } from '@/lib/types'
import { MapFiltersState } from '@/components/MapFilters'
import { MapPin, NavigationArrow } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { motion, AnimatePresence } from 'framer-motion'
import { useUnitPreference } from '@/hooks/use-unit-preference'
import { triggerHapticFeedback } from '@/lib/haptics'
import {
  buildVenueRenderPoints,
  clampZoom,
  clusterVenueRenderPoints,
  getFittedViewport,
  getPreviewVenuePoints,
  calculateDistance,
  type VenueRenderPoint,
} from '@/lib/interactive-map'
import {
  getEnergyLevelFromScore,
  ZOOM_STEP,
  MAP_SCALE,
  type InteractiveMapProps
} from './shared'
import { MapCanvas, useMapInteractions } from './MapCanvas'
import { useHeatmapRenderer } from './MapHeatmap'
import { MapClusterSVG, MapClusterHitAreas, useExpandedClusterNodes } from './MapCluster'
import { MapVenuePinSVG, MapVenuePinLabels } from './MapVenuePin'
import { MapVenueSheet } from './MapVenueSheet'
import { MapTopBar, MapRightControls, MapBottomLeftControls } from './MapControls'
import { MapSmartRoute } from './MapSmartRoute'

const PROGRESSIVE_DISCLOSURE_LIMIT = 5

export function InteractiveMap({
  venues,
  userLocation,
  onVenueClick,
  isTracking = false,
  locationAccuracy,
  locationHeading,
  followedVenueIds = []
}: InteractiveMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [hoveredVenue, setHoveredVenue] = useState<Venue | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [followUser, setFollowUser] = useState(true)
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

  // Track whether the user has ever toggled progressive disclosure this session
  const [hasToggledDisclosure, setHasToggledDisclosure] = useState(false)
  // Track when venues were just revealed for animation
  const [justRevealedAll, setJustRevealedAll] = useState(false)

  const onboardingStorageKey = 'pulse-map-onboarding-v1'
  const { unitSystem } = useUnitPreference()
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const cameraSettleTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const venueSelectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const hoverClearTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // --- Map interaction handlers ---
  const interactions = useMapInteractions({
    center,
    zoom,
    dimensions,
    isDragging,
    dragStart,
    setCenter,
    setZoom,
    setIsDragging,
    setDragStart,
    setFollowUser,
    setHoveredVenue: () => setHoveredVenue(null),
    setExpandedClusterId,
    setLastTouchDistance,
    lastTouchDistance,
    canvasRef,
  })

  // --- Cleanup ---
  useEffect(() => {
    return () => {
      if (cameraSettleTimeoutRef.current) clearTimeout(cameraSettleTimeoutRef.current)
      if (venueSelectTimeoutRef.current) clearTimeout(venueSelectTimeoutRef.current)
      if (hoverClearTimeoutRef.current) clearTimeout(hoverClearTimeoutRef.current)
    }
  }, [])

  // --- Initial center logic ---
  useEffect(() => {
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

  // --- Onboarding ---
  useEffect(() => {
    if (typeof window === 'undefined') return
    const seen = window.localStorage.getItem(onboardingStorageKey)
    if (!seen) {
      setShowOnboardingTips(true)
      setTipIndex(0)
    }
  }, [])

  // --- Camera settle ---
  useEffect(() => {
    setIsCameraMoving(true)
    if (cameraSettleTimeoutRef.current) clearTimeout(cameraSettleTimeoutRef.current)
    cameraSettleTimeoutRef.current = window.setTimeout(() => {
      setIsCameraMoving(false)
    }, isDragging ? 260 : 140)
  }, [center, zoom, isDragging])

  // --- Filtering + Progressive Disclosure ---
  const filteredVenues = useMemo(() => {
    const filtered = venues.filter((venue) => {
      if (filters.energyLevels.length > 0) {
        const energyLevel = getEnergyLevelFromScore(venue.pulseScore)
        if (!filters.energyLevels.includes(energyLevel as MapFiltersState['energyLevels'][number])) {
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
          userLocation.lat, userLocation.lng,
          venue.location.lat, venue.location.lng
        )
        if (distance > filters.maxDistance) return false
      }
      if (nearMeActive && userLocation) {
        const distance = calculateDistance(
          userLocation.lat, userLocation.lng,
          venue.location.lat, venue.location.lng
        )
        if (distance > 0.5) return false
      }
      return true
    })

    // Progressive disclosure: show top venues by default for first-time / simplified view
    if (!showFullHeatmap && !nearMeActive && filters.energyLevels.length === 0 && filters.categories.length === 0) {
      const nearby = userLocation
        ? filtered
          .filter(v => calculateDistance(userLocation.lat, userLocation.lng, v.location.lat, v.location.lng) < 50)
          .sort((a, b) => b.pulseScore - a.pulseScore)
        : filtered.sort((a, b) => b.pulseScore - a.pulseScore)
      return nearby.slice(0, PROGRESSIVE_DISCLOSURE_LIMIT)
    }

    return filtered
  }, [venues, filters, userLocation, nearMeActive, showFullHeatmap])

  const availableCategories = useMemo(() =>
    Array.from(
      new Set(venues.map((v) => v.category).filter((c): c is string => !!c))
    ).sort()
  , [venues])

  // --- Dimensions ---
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

  // --- Heatmap ---
  useHeatmapRenderer(canvasRef, filteredVenues, center, zoom, dimensions)

  // --- Venue render points ---
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

  const expandedClusterNodes = useExpandedClusterNodes(expandedCluster)

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

  // --- Handlers ---
  const toggleCompareVenue = useCallback((venueId: string) => {
    triggerHapticFeedback('light')
    setComparedVenueIds((prev) => {
      if (prev.includes(venueId)) return prev.filter((id) => id !== venueId)
      if (prev.length >= 3) return [...prev.slice(1), venueId]
      return [...prev, venueId]
    })
  }, [])

  const handleVenueSelect = useCallback((venue: Venue) => {
    interactions.stopInertia()
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
  }, [center, interactions])

  const handleZoomIn = useCallback(() => {
    triggerHapticFeedback('light')
    setExpandedClusterId(null)
    setZoom((z) => clampZoom(z * ZOOM_STEP))
    setFollowUser(false)
  }, [])

  const handleZoomOut = useCallback(() => {
    triggerHapticFeedback('light')
    setExpandedClusterId(null)
    setZoom((z) => clampZoom(z / ZOOM_STEP))
    setFollowUser(false)
  }, [])

  const handleCenterOnUser = useCallback(() => {
    if (userLocation) {
      triggerHapticFeedback('medium')
      setExpandedClusterId(null)
      setCenter(userLocation)
      setZoom(1)
      setFollowUser(true)
    }
  }, [userLocation])

  const handleFitToVenues = useCallback(() => {
    const viewport = getFittedViewport(filteredVenues, dimensions)
    if (!viewport) return
    interactions.stopInertia()
    triggerHapticFeedback('medium')
    setCenter(viewport.center)
    setZoom(viewport.zoom)
    setFollowUser(false)
  }, [filteredVenues, dimensions, interactions])

  const handleSmartRoute = useCallback(() => {
    if (!bestNextVenue) return
    triggerHapticFeedback('medium')
    handleVenueSelect(bestNextVenue.venue)
  }, [bestNextVenue, handleVenueSelect])

  const handleClusterClick = useCallback((cluster: { id: string; venues: VenueRenderPoint[]; x: number; y: number }) => {
    triggerHapticFeedback('medium')
    if (cluster.venues.length <= 10 && zoom >= 0.85 && expandedClusterId !== cluster.id) {
      setExpandedClusterId(cluster.id)
      setHoveredVenue(null)
      return
    }
    setExpandedClusterId(null)
    interactions.zoomAroundPoint(zoom * ZOOM_STEP, cluster.x, cluster.y)
    setFollowUser(false)
    setHoveredVenue(null)
  }, [zoom, expandedClusterId, interactions])

  const handleExpandedVenueClick = useCallback((venue: Venue) => {
    triggerHapticFeedback('medium')
    setExpandedClusterId(null)
    onVenueClick(venue)
  }, [onVenueClick])

  const onboardingTips = [
    'Pinch or scroll to zoom. Double tap to zoom quickly.',
    'Tap clusters to expand nearby venues or zoom deeper.',
    'Use the bottom cards to compare hotspots and jump fast.',
    'Turn on A11y mode for larger markers and calmer motion.'
  ]

  const completeOnboarding = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(onboardingStorageKey, 'seen')
    }
    setShowOnboardingTips(false)
    setTipIndex(0)
  }, [])

  // --- Progressive Disclosure Toggle ---
  const handleToggleDisclosure = useCallback(() => {
    triggerHapticFeedback('light')
    const nextVal = !showFullHeatmap
    setShowFullHeatmap(nextVal)
    setHasToggledDisclosure(true)
    if (nextVal) {
      setJustRevealedAll(true)
      // Reset animation flag after the transition
      window.setTimeout(() => setJustRevealedAll(false), 600)
    }
  }, [showFullHeatmap])

  // Determine whether to show the progressive disclosure CTA
  const isProgressiveDisclosureActive = !showFullHeatmap && !nearMeActive &&
    filters.energyLevels.length === 0 && filters.categories.length === 0
  const totalMatchingVenues = useMemo(() => {
    if (!isProgressiveDisclosureActive) return 0
    return userLocation
      ? venues.filter(v => calculateDistance(userLocation.lat, userLocation.lng, v.location.lat, v.location.lng) < 50).length
      : venues.length
  }, [venues, userLocation, isProgressiveDisclosureActive])
  const hasMoreVenues = totalMatchingVenues > PROGRESSIVE_DISCLOSURE_LIMIT

  // --- User location SVG rendering ---
  const userLocationSVG = useMemo(() => {
    if (!userLocation || !center) return null
    const scale = MAP_SCALE * zoom
    const userPos = {
      x: dimensions.width / 2 + (userLocation.lng - center.lng) * scale,
      y: dimensions.height / 2 - (userLocation.lat - center.lat) * scale
    }
    const accuracyRadiusInMeters = locationAccuracy || 50
    const metersPerDegree = 111320
    const accuracyRadius = (accuracyRadiusInMeters / metersPerDegree) * scale

    return { userPos, accuracyRadius }
  }, [userLocation, center, zoom, dimensions, locationAccuracy])

  // --- Loading state ---
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
      onKeyDown={interactions.handleKeyDown}
    >
      {/* Canvas (heatmap) */}
      <MapCanvas
        canvasRef={canvasRef}
        isDragging={isDragging}
        handlers={interactions}
      />

      {/* SVG Overlays */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <MapClusterSVG
          clusters={clusteredMapData.clusters}
          expandedClusterId={expandedClusterId}
          expandedCluster={expandedCluster}
          expandedClusterNodes={expandedClusterNodes}
          accessibilityMode={accessibilityMode}
          zoom={zoom}
          isCameraMoving={isCameraMoving}
        />

        <MapVenuePinSVG
          singles={clusteredMapData.singles}
          hoveredVenue={hoveredVenue}
          isCameraMoving={isCameraMoving}
          accessibilityMode={accessibilityMode}
          zoom={zoom}
          followedVenueIds={followedVenueIds}
        />

        {/* User Location */}
        {userLocationSVG && (() => {
          const { userPos, accuracyRadius } = userLocationSVG
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

      {/* Empty State */}
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

      {/* Cluster Hit Areas */}
      <MapClusterHitAreas
        clusters={clusteredMapData.clusters}
        expandedClusterId={expandedClusterId}
        expandedClusterNodes={expandedClusterNodes}
        zoom={zoom}
        isCameraMoving={isCameraMoving}
        onClusterClick={handleClusterClick}
        onExpandedVenueClick={handleExpandedVenueClick}
      />

      {/* Venue Pin Labels/Hit Areas */}
      <MapVenuePinLabels
        singles={clusteredMapData.singles}
        labelVenueIds={labelVenueIds}
        hoveredVenue={hoveredVenue}
        unitSystem={unitSystem}
        onVenueClick={onVenueClick}
        onHoverVenue={setHoveredVenue}
        showRevealAnimation={justRevealedAll}
      />

      {/* Venue Tooltip Sheet */}
      <MapVenueSheet
        hoveredVenue={hoveredVenue}
        isDragging={isDragging}
        isCameraMoving={isCameraMoving}
        center={center}
        zoom={zoom}
        dimensions={dimensions}
        userLocation={userLocation}
        unitSystem={unitSystem}
      />

      {/* Top Bar: Search, Status, Filters, Onboarding */}
      <MapTopBar
        venues={venues}
        userLocation={userLocation}
        statusChips={statusChips}
        showOnboardingTips={showOnboardingTips}
        tipIndex={tipIndex}
        onboardingTips={onboardingTips}
        filters={filters}
        nearMeActive={nearMeActive}
        showFullHeatmap={showFullHeatmap}
        onVenueSelect={handleVenueSelect}
        onFilterChange={setFilters}
        onNearMeToggle={() => {
          triggerHapticFeedback('light')
          setNearMeActive(!nearMeActive)
        }}
        onShowFullHeatmapToggle={handleToggleDisclosure}
        onTipNext={() => {
          if (tipIndex >= onboardingTips.length - 1) {
            completeOnboarding()
          } else {
            setTipIndex((prev) => prev + 1)
          }
        }}
        onTipSkip={completeOnboarding}
      />

      {/* Right Controls */}
      <MapRightControls
        zoom={zoom}
        followUser={followUser}
        userLocation={userLocation}
        nearMeActive={nearMeActive}
        accessibilityMode={accessibilityMode}
        filteredVenueCount={filteredVenues.length}
        filters={filters}
        availableCategories={availableCategories}
        isTracking={isTracking}
        locationAccuracy={locationAccuracy}
        totalVenueCount={venues.length}
        showLegend={showLegend}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onCenterOnUser={handleCenterOnUser}
        onNearMeToggle={() => {
          triggerHapticFeedback('light')
          setNearMeActive(!nearMeActive)
        }}
        onAccessibilityToggle={() => {
          triggerHapticFeedback('light')
          setAccessibilityMode((prev) => !prev)
        }}
        onFitToVenues={handleFitToVenues}
        onFilterChange={setFilters}
        onShowLegendToggle={() => setShowLegend(!showLegend)}
      />

      {/* Progressive Disclosure Floating CTA */}
      <AnimatePresence>
        {isProgressiveDisclosureActive && hasMoreVenues && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.92 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30"
          >
            <button
              onClick={handleToggleDisclosure}
              className="px-5 py-3 rounded-full text-sm font-semibold
                bg-gradient-to-r from-purple-600 to-cyan-500
                text-white shadow-lg shadow-purple-500/25
                border border-purple-400/30
                hover:shadow-xl hover:shadow-purple-500/35
                hover:scale-105 active:scale-[0.98]
                transition-all duration-200 touch-manipulation
                backdrop-blur-sm"
            >
              Show all venues ({totalMatchingVenues})
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFullHeatmap && hasToggledDisclosure && !isProgressiveDisclosureActive && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.92 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30"
          >
            <button
              onClick={handleToggleDisclosure}
              className="px-5 py-3 rounded-full text-sm font-semibold
                bg-card/95 backdrop-blur-sm
                text-foreground shadow-lg
                border border-border
                hover:shadow-xl hover:bg-card
                hover:scale-105 active:scale-[0.98]
                transition-all duration-200 touch-manipulation"
            >
              Show top {PROGRESSIVE_DISCLOSURE_LIMIT} only
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart Route + Preview Cards */}
      <MapSmartRoute
        previewVenues={previewVenues}
        bestNextVenue={bestNextVenue}
        comparedVenues={comparedVenues}
        comparedVenueIds={comparedVenueIds}
        hoveredVenue={hoveredVenue}
        userLocation={userLocation}
        locationHeading={locationHeading}
        unitSystem={unitSystem}
        onVenueSelect={handleVenueSelect}
        onVenueClick={onVenueClick}
        onSmartRoute={handleSmartRoute}
        onToggleCompare={toggleCompareVenue}
        onClearCompare={() => setComparedVenueIds([])}
      />

      {/* Bottom Left Controls */}
      <MapBottomLeftControls
        isTracking={isTracking}
        locationAccuracy={locationAccuracy}
        filters={filters}
        filteredVenueCount={filteredVenues.length}
        totalVenueCount={venues.length}
        showLegend={showLegend}
        onShowLegendToggle={() => setShowLegend(!showLegend)}
      />
    </div>
  )
}
