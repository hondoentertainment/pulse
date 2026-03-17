import { Venue } from '@/lib/types'
import {
  MapPin, BeerBottle, MusicNotes, ForkKnife, Coffee, Martini, Confetti,
} from '@phosphor-icons/react'
import type { MapFiltersState } from '@/components/MapFilters'
import type { VenueRenderPoint, VenueCluster } from '@/lib/interactive-map'
import type { Icon } from '@phosphor-icons/react'

export type { VenueRenderPoint, VenueCluster }

export interface MapPoint {
  lat: number
  lng: number
}

export interface MapDimensions {
  width: number
  height: number
}

export interface InteractiveMapProps {
  venues: Venue[]
  userLocation: { lat: number; lng: number } | null
  onVenueClick: (venue: Venue) => void
  isTracking?: boolean
  locationAccuracy?: number
  locationHeading?: number | null
  followedVenueIds?: string[]
}

export function getEnergyColor(score: number) {
  if (score >= 80) return 'oklch(0.65 0.28 320)'
  if (score >= 60) return 'oklch(0.65 0.25 25)'
  if (score >= 30) return 'oklch(0.65 0.18 240)'
  return 'oklch(0.40 0.05 260)'
}

export function getEnergyLevelFromScore(score: number): string {
  if (score >= 80) return 'electric'
  if (score >= 60) return 'buzzing'
  if (score >= 30) return 'chill'
  return 'dead'
}

export function getCategoryIcon(category?: string): Icon {
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

export const ZOOM_STEP = 1.35
export const MAP_SCALE = 500000
