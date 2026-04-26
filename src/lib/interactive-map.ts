import type { Venue } from './types'

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
export const MAX_ZOOM = 4.5
export const ZOOM_STEP = 1.35
export const MAP_SCALE = 500000

export function clampZoom(value: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
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
  const hour = now.getHours()
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

let clusterIndex: Supercluster<Record<string, unknown>, Record<string, unknown>> | null = null
let lastPointsCount = -1

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
  if (!clusterIndex || lastPointsCount !== points.length) {
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
    lastPointsCount = points.length
  }

  // Map arbitrary local zoom (0.6 - 4.5) to Supercluster zoom levels (0 - 16)
  const scZoom = Math.max(0, Math.min(16, Math.floor((zoom - 0.6) / (4.5 - 0.6) * 16)))
  
  // Calculate bounding box in lat/lng since we overs-can the viewport
  // For simplicity since Supercluster uses standard coordinates, we extract all clusters globally
  const clustersData = clusterIndex.getClusters([-180, -85, 180, 85], scZoom)

  const clusters: VenueCluster[] = []
  const singles: VenueRenderPoint[] = []

  clustersData.forEach(c => {
    if (c.properties?.cluster) {
      // It's a cluster
      const leaves = clusterIndex!.getLeaves(c.properties.cluster_id, Infinity)
      const venues = leaves.map(l => l.properties.point as VenueRenderPoint)
      
      const x = venues.reduce((sum, v) => sum + v.x, 0) / venues.length
      const y = venues.reduce((sum, v) => sum + v.y, 0) / venues.length
      const maxPulseScore = venues.reduce((max, v) => Math.max(max, v.venue.pulseScore), 0)

      clusters.push({
        id: `cluster-${c.properties.cluster_id}`,
        x,
        y,
        venues,
        maxPulseScore,
      })
    } else {
      singles.push(c.properties.point)
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

export function getFittedViewport(venues: Venue[], dimensions: MapDimensions) {
  const focusVenues = venues.slice(0, 100)
  if (focusVenues.length === 0) return null

  if (focusVenues.length === 1) {
    return {
      center: {
        lat: focusVenues[0].location.lat,
        lng: focusVenues[0].location.lng,
      },
      zoom: 2,
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
    zoom: clampZoom(Math.min(zoomByLat, zoomByLng)),
  }
}
