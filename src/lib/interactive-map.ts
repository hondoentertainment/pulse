import type { Venue } from './types'
import { DOWNTOWN_SEATTLE, LAUNCH_33_CENTER } from './neighborhood-geo'
import { isCuratedVenue } from './map-filters'

export interface MapPoint {
  lat: number
  lng: number
}

export interface MapDimensions {
  width: number
  height: number
}

export interface VenueRenderPoint {
  venue: Venue
  x: number
  y: number
  distance?: number
}

export interface VenueCluster {
  id: string
  x: number
  y: number
  venues: VenueRenderPoint[]
  maxPulseScore: number
}

export const MIN_ZOOM = 0.6
/** Compact 320px heatmap must zoom out past MIN_ZOOM to keep Launch 33 on screen. */
export const FIT_MIN_ZOOM = 0.04
export const MAX_ZOOM = 4.5
export const ZOOM_STEP = 1.35
export const MAP_SCALE = 500000
/** A guest outside this radius is not "near" the Seattle catalog. */
export const CATALOG_NEAR_MILES = 30

export const PIN_STROKE = {
  highlighted: 'white',
  claimed: '#5EEAD4',
  curated: '#F7D774',
  default: 'oklch(0.15 0 0)',
} as const

/** Claimed venues are visually distinct from curated gold rings. */
export function pinStrokeForVenue(
  venue: Pick<Venue, 'claimVerified' | 'inventorySource' | 'seeded'>,
  highlighted = false,
): { stroke: string; strokeWidth: number; claimed: boolean } {
  if (highlighted) {
    return { stroke: PIN_STROKE.highlighted, strokeWidth: 3, claimed: venue.claimVerified === true }
  }
  if (venue.claimVerified) {
    return { stroke: PIN_STROKE.claimed, strokeWidth: 2.6, claimed: true }
  }
  if (isCuratedVenue(venue)) {
    return { stroke: PIN_STROKE.curated, strokeWidth: 2.4, claimed: false }
  }
  return { stroke: PIN_STROKE.default, strokeWidth: 1.5, claimed: false }
}

export type MapCameraReason = 'user' | 'launch33' | 'catalog' | 'downtown'

export interface MapCamera {
  center: MapPoint
  zoom: number
  followUser: boolean
  reason: MapCameraReason
}

export function clampZoom(value: number, min = MIN_ZOOM, max = MAX_ZOOM) {
  return Math.max(min, Math.min(max, value))
}

function isLaunchPin(venue: Pick<Venue, 'inventorySource' | 'seeded'>): boolean {
  if (venue.inventorySource === 'curated-seed') return true
  if (venue.inventorySource === 'osm') return false
  return venue.seeded === true
}

/** True when GPS is inside the Seattle catalog (or Launch 33 if the catalog is empty). */
export function isLocationNearCatalog(
  location: MapPoint | null | undefined,
  venues: Array<Pick<Venue, 'location'>> = [],
  maxMiles = CATALOG_NEAR_MILES,
): boolean {
  if (!location) return false
  const anchors = venues.length > 0
    ? venues.slice(0, 40).map((venue) => venue.location)
    : [LAUNCH_33_CENTER, DOWNTOWN_SEATTLE]
  return anchors.some((anchor) => (
    calculateDistance(location.lat, location.lng, anchor.lat, anchor.lng) <= maxMiles
  ))
}

/**
 * Map camera when GPS is denied, far from Seattle, or still loading.
 * Never invents pulses — only picks a real catalog / Launch 33 / Downtown center.
 */
export function resolveMapCamera(input: {
  userLocation?: MapPoint | null
  venues?: Array<Pick<Venue, 'location' | 'inventorySource' | 'seeded'>>
} = {}): MapCamera {
  const venues = input.venues ?? []
  const launch = venues.filter((venue) => isLaunchPin(venue))
  const focus = launch.length > 0 ? launch : venues

  if (input.userLocation && isLocationNearCatalog(input.userLocation, focus)) {
    return {
      center: clampCenter(input.userLocation),
      zoom: 1,
      followUser: true,
      reason: 'user',
    }
  }

  if (focus.length > 0) {
    const sample = focus.slice(0, 12)
    const lat = sample.reduce((sum, venue) => sum + venue.location.lat, 0) / sample.length
    const lng = sample.reduce((sum, venue) => sum + venue.location.lng, 0) / sample.length
    return {
      center: clampCenter({ lat, lng }),
      zoom: 1,
      followUser: false,
      reason: 'catalog',
    }
  }

  return {
    center: LAUNCH_33_CENTER,
    zoom: 1,
    followUser: false,
    reason: 'launch33',
  }
}

/** Near-me radius origin: real GPS, else Launch 33 so pins stay on screen. */
export function resolveNearMeOrigin(
  userLocation: MapPoint | null | undefined,
): MapPoint {
  return userLocation ?? LAUNCH_33_CENTER
}

export function clampCenter(value: MapPoint): MapPoint {
  return {
    lat: Math.max(-85, Math.min(85, value.lat)),
    lng: ((value.lng + 540) % 360) - 180,
  }
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadiusMiles = 3958.8
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusMiles * c
}

export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const lambda1 = (lon1 * Math.PI) / 180
  const lambda2 = (lon2 * Math.PI) / 180

  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1)
  const theta = Math.atan2(y, x)

  return ((theta * 180) / Math.PI + 360) % 360
}

export function getHeadingDelta(targetBearing: number, currentHeading: number) {
  return Math.abs(((targetBearing - currentHeading + 540) % 360) - 180)
}

export function latLngToPixel(
  lat: number,
  lng: number,
  mapCenter: MapPoint,
  mapZoom: number,
  dimensions: MapDimensions
) {
  const scale = MAP_SCALE * mapZoom

  return {
    x: dimensions.width / 2 + (lng - mapCenter.lng) * scale,
    y: dimensions.height / 2 - (lat - mapCenter.lat) * scale,
  }
}

export function pixelToLatLng(
  x: number,
  y: number,
  mapCenter: MapPoint,
  mapZoom: number,
  dimensions: MapDimensions
): MapPoint {
  const scale = MAP_SCALE * mapZoom

  return {
    lng: mapCenter.lng + (x - dimensions.width / 2) / scale,
    lat: mapCenter.lat - (y - dimensions.height / 2) / scale,
  }
}

export function getTimeAwareCategoryBoost(venue: Venue, now = new Date()): number {
  const hour = now.getUTCHours()
  const category = (venue.category || '').toLowerCase()
  const isNight = hour >= 20 || hour <= 3
  const isMorning = hour >= 6 && hour <= 11

  if (isNight) {
    if (category.includes('club') || category.includes('bar') || category.includes('lounge')) return 16
    if (category.includes('event')) return 12
    if (category.includes('restaurant')) return 6
  }

  if (isMorning) {
    if (category.includes('cafe') || category.includes('coffee')) return 14
    if (category.includes('restaurant')) return 7
  }

  if (category.includes('restaurant') || category.includes('food')) return 6
  return 0
}

export function buildVenueRenderPoints(params: {
  venues: Venue[]
  center: MapPoint
  zoom: number
  dimensions: MapDimensions
  userLocation: MapPoint | null
  overscan?: number
}): VenueRenderPoint[] {
  const {
    venues,
    center,
    zoom,
    dimensions,
    userLocation,
    overscan = 80,
  } = params

  return venues
    .map((venue) => {
      const pos = latLngToPixel(venue.location.lat, venue.location.lng, center, zoom, dimensions)
      const distance = userLocation
        ? calculateDistance(
          userLocation.lat,
          userLocation.lng,
          venue.location.lat,
          venue.location.lng
        )
        : undefined

      return {
        venue,
        x: pos.x,
        y: pos.y,
        distance,
      }
    })
    .filter(({ x, y }) => (
      x >= -overscan &&
      x <= dimensions.width + overscan &&
      y >= -overscan &&
      y <= dimensions.height + overscan
    ))
}

import Supercluster from 'supercluster'

type VenuePointProperties = { point: VenueRenderPoint }

let clusterIndex: Supercluster<VenuePointProperties, Supercluster.ClusterProperties> | null = null
let lastPointsSignature = ''

function getPointsSignature(points: VenueRenderPoint[]) {
  return points
    .map((point) => `${point.venue.id}:${point.venue.location.lat}:${point.venue.location.lng}`)
    .sort()
    .join('|')
}

export function clusterVenueRenderPoints(
  points: VenueRenderPoint[],
  zoom: number,
  shouldCluster: boolean
) {
  if (!shouldCluster) {
    return {
      clusters: [] as VenueCluster[],
      singles: points,
    }
  }

  // Optimize supercluster caching on static datasets
  const pointsSignature = getPointsSignature(points)
  if (!clusterIndex || lastPointsSignature !== pointsSignature) {
    clusterIndex = new Supercluster({
      radius: 54, // Max distance in pixels to cluster points
      maxZoom: 16,
    })

    const geoJsonPoints = points.map(p => ({
      type: 'Feature' as const,
      properties: { point: p },
      geometry: { type: 'Point' as const, coordinates: [p.venue.location.lng, p.venue.location.lat] }
    }))

    clusterIndex.load(geoJsonPoints)
    lastPointsSignature = pointsSignature
  }

  // Map arbitrary local zoom (0.6 - 4.5) to Supercluster zoom levels (0 - 16)
  const scZoom = Math.max(0, Math.min(16, Math.floor((zoom - 0.6) / (4.5 - 0.6) * 16)))
  
  // Calculate bounding box in lat/lng since we overs-can the viewport
  // For simplicity since Supercluster uses standard coordinates, we extract all clusters globally
  const clustersData = clusterIndex.getClusters([-180, -85, 180, 85], scZoom)

  const clusters: VenueCluster[] = []
  const singles: VenueRenderPoint[] = []

  clustersData.forEach(c => {
    const props = c.properties
    if (props && 'cluster' in props && props.cluster) {
      // It's a cluster
      const leaves = clusterIndex!.getLeaves(props.cluster_id, Infinity)
      const venues = leaves.flatMap((leaf) => {
        const leafProps = leaf.properties
        if (!leafProps || !('point' in leafProps) || !leafProps.point) return []
        return [leafProps.point as VenueRenderPoint]
      })
      if (venues.length === 0) return
      
      const x = venues.reduce((sum, v) => sum + v.x, 0) / venues.length
      const y = venues.reduce((sum, v) => sum + v.y, 0) / venues.length
      const maxPulseScore = venues.reduce((max, v) => Math.max(max, v.venue.pulseScore), 0)

      clusters.push({
        id: `cluster-${props.cluster_id}`,
        x,
        y,
        venues,
        maxPulseScore,
      })
    } else if (props && 'point' in props) {
      singles.push(props.point)
    }
  })

  return { clusters, singles }
}

function getFreshnessBoost(lastActivity: string | undefined, nowMs: number) {
  if (!lastActivity) return 0
  return Math.max(0, 10 - (nowMs - new Date(lastActivity).getTime()) / (1000 * 60 * 8))
}

function getDirectionBoost(
  point: VenueRenderPoint,
  userLocation: MapPoint | null,
  locationHeading: number | null | undefined
) {
  if (locationHeading === null || locationHeading === undefined || !userLocation) return 0

  const bearing = calculateBearing(
    userLocation.lat,
    userLocation.lng,
    point.venue.location.lat,
    point.venue.location.lng
  )
  const delta = getHeadingDelta(bearing, locationHeading)

  return Math.max(0, 20 - delta) * 1.1
}

export function getPreviewVenuePoints(params: {
  points: VenueRenderPoint[]
  center: MapPoint
  userLocation: MapPoint | null
  locationHeading?: number | null
  nowMs?: number
  now?: Date
  limit?: number
}) {
  const {
    points,
    center,
    userLocation,
    locationHeading,
    nowMs = Date.now(),
    now = new Date(nowMs),
    limit = 4,
  } = params

  return [...points]
    .sort((a, b) => {
      const centerDistA = calculateDistance(center.lat, center.lng, a.venue.location.lat, a.venue.location.lng)
      const centerDistB = calculateDistance(center.lat, center.lng, b.venue.location.lat, b.venue.location.lng)

      const scoreA =
        a.venue.pulseScore * 1.25 +
        getDirectionBoost(a, userLocation, locationHeading) +
        getTimeAwareCategoryBoost(a.venue, now) +
        getFreshnessBoost(a.venue.lastActivity, nowMs) -
        centerDistA * 6
      const scoreB =
        b.venue.pulseScore * 1.25 +
        getDirectionBoost(b, userLocation, locationHeading) +
        getTimeAwareCategoryBoost(b.venue, now) +
        getFreshnessBoost(b.venue.lastActivity, nowMs) -
        centerDistB * 6

      return scoreB - scoreA
    })
    .slice(0, limit)
}

export function getFittedViewport(
  venues: Venue[],
  dimensions: MapDimensions,
  options?: { minZoom?: number },
) {
  const minZoom = options?.minZoom ?? MIN_ZOOM
  const focusVenues = venues.slice(0, 100)
  if (focusVenues.length === 0) return null

  if (focusVenues.length === 1) {
    return {
      center: {
        lat: focusVenues[0].location.lat,
        lng: focusVenues[0].location.lng,
      },
      zoom: clampZoom(2, minZoom),
    }
  }

  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity

  for (const venue of focusVenues) {
    minLat = Math.min(minLat, venue.location.lat)
    maxLat = Math.max(maxLat, venue.location.lat)
    minLng = Math.min(minLng, venue.location.lng)
    maxLng = Math.max(maxLng, venue.location.lng)
  }

  const latSpan = Math.max(0.002, (maxLat - minLat) * 1.4)
  const lngSpan = Math.max(0.002, (maxLng - minLng) * 1.4)
  const zoomByLat = dimensions.height / (latSpan * MAP_SCALE)
  const zoomByLng = dimensions.width / (lngSpan * MAP_SCALE)

  return {
    center: clampCenter({
      lat: (minLat + maxLat) / 2,
      lng: (minLng + maxLng) / 2,
    }),
    zoom: clampZoom(Math.min(zoomByLat, zoomByLng), minZoom),
  }
}
