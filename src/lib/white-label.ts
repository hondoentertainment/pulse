import type { EnergyRating } from './types'

/** Phase 7.3 — White-Label Solution */

export type WhiteLabelEdition = 'festival' | 'hotel' | 'campus' | 'corporate' | 'district'

export interface WhiteLabelConfig {
  id: string
  edition: WhiteLabelEdition
  name: string
  brandColor: string
  logoUrl?: string
  domain?: string
  features: string[]
  createdAt: string
  active: boolean
}

export interface FestivalConfig extends WhiteLabelConfig {
  edition: 'festival'
  festivalName: string
  startDate: string
  endDate: string
  stages: { id: string; name: string; capacity: number }[]
}

export interface HotelConfig extends WhiteLabelConfig {
  edition: 'hotel'
  chainName: string
  properties: { id: string; name: string; city: string }[]
}

export interface CampusConfig extends WhiteLabelConfig {
  edition: 'campus'
  universityName: string
  zones: CampusZone[]
}

export interface CorporateConfig extends WhiteLabelConfig {
  edition: 'corporate'
  companyName: string
  buildings: { id: string; name: string; floors: number }[]
}

export interface DistrictConfig extends WhiteLabelConfig {
  edition: 'district'
  districtName: string
  city: string
  bounds: { north: number; south: number; east: number; west: number }
}

export type CampusZoneType = 'dorm' | 'library' | 'dining' | 'gym' | 'quad' | 'building'

export interface CampusZone {
  id: string; name: string; type: CampusZoneType; capacity?: number
}

export interface StageEnergy {
  stageId: string; stageName: string; energy: EnergyRating; crowdLevel: number; updatedAt: string
}

export interface ZoneActivity {
  zoneId: string; zoneName: string; zoneType: CampusZoneType
  energy: EnergyRating; occupancyPercent: number; updatedAt: string
}

export interface BuildingActivity {
  buildingId: string; buildingName: string
  cafeteriaEnergy?: EnergyRating; meetingRoomUsage?: number; updatedAt: string
}

const DEFAULT_FEATURES: Record<WhiteLabelEdition, string[]> = {
  festival: ['stage_energy', 'crowd_flow', 'artist_schedule', 'food_vendors', 'map'],
  hotel: ['amenity_energy', 'pool_crowd', 'restaurant_buzz', 'concierge', 'local_recommendations'],
  campus: ['dorm_energy', 'library_occupancy', 'dining_buzz', 'event_calendar', 'study_groups'],
  corporate: ['cafeteria_buzz', 'meeting_rooms', 'gym_crowd', 'shuttle_tracker', 'team_events'],
  district: ['venue_discovery', 'walking_routes', 'parking', 'transit', 'events'],
}

export function createWhiteLabelConfig(edition: WhiteLabelEdition, name: string, brandColor: string, opts?: { logoUrl?: string; domain?: string }): WhiteLabelConfig {
  return {
    id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    edition, name, brandColor, logoUrl: opts?.logoUrl, domain: opts?.domain,
    features: DEFAULT_FEATURES[edition],
    createdAt: new Date().toISOString(), active: true,
  }
}

export function createFestivalConfig(name: string, festivalName: string, brandColor: string, startDate: string, endDate: string, stages: { id: string; name: string; capacity: number }[]): FestivalConfig {
  return {
    ...createWhiteLabelConfig('festival', name, brandColor),
    edition: 'festival', festivalName, startDate, endDate, stages,
  }
}

export function createCampusConfig(name: string, universityName: string, brandColor: string, zones: CampusZone[]): CampusConfig {
  return {
    ...createWhiteLabelConfig('campus', name, brandColor),
    edition: 'campus', universityName, zones,
  }
}

export function createCorporateConfig(name: string, companyName: string, brandColor: string, buildings: { id: string; name: string; floors: number }[]): CorporateConfig {
  return {
    ...createWhiteLabelConfig('corporate', name, brandColor),
    edition: 'corporate', companyName, buildings,
  }
}

export function createHotelConfig(name: string, chainName: string, brandColor: string, properties: { id: string; name: string; city: string }[]): HotelConfig {
  return {
    ...createWhiteLabelConfig('hotel', name, brandColor),
    edition: 'hotel', chainName, properties,
  }
}

export function createDistrictConfig(name: string, districtName: string, city: string, brandColor: string, bounds: { north: number; south: number; east: number; west: number }): DistrictConfig {
  return {
    ...createWhiteLabelConfig('district', name, brandColor),
    edition: 'district', districtName, city, bounds,
  }
}

export function getStageEnergy(stageId: string, stageName: string, pulseScore: number): StageEnergy {
  const ENERGY_LABELS: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']
  return {
    stageId, stageName,
    energy: ENERGY_LABELS[Math.min(3, Math.round(pulseScore / 33))],
    crowdLevel: 0, // No longer derived from pulseScore — requires real crowd data
    updatedAt: new Date().toISOString(),
  }
}

export function getZoneActivity(zone: CampusZone, occupancyPercent: number): ZoneActivity {
  const ENERGY_LABELS: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']
  const energy = ENERGY_LABELS[Math.min(3, Math.round(occupancyPercent / 33))]
  return {
    zoneId: zone.id, zoneName: zone.name, zoneType: zone.type,
    energy, occupancyPercent: Math.min(100, occupancyPercent),
    updatedAt: new Date().toISOString(),
  }
}

export function getBuildingActivity(buildingId: string, buildingName: string, cafeteriaScore?: number, meetingRoomUsage?: number): BuildingActivity {
  const ENERGY_LABELS: EnergyRating[] = ['dead', 'chill', 'buzzing', 'electric']
  return {
    buildingId, buildingName,
    cafeteriaEnergy: cafeteriaScore != null ? ENERGY_LABELS[Math.min(3, Math.round(cafeteriaScore / 33))] : undefined,
    meetingRoomUsage, updatedAt: new Date().toISOString(),
  }
}

export function getEditionFeatures(edition: WhiteLabelEdition): string[] {
  return DEFAULT_FEATURES[edition]
}

export function isFeatureEnabled(config: WhiteLabelConfig, feature: string): boolean {
  return config.active && config.features.includes(feature)
}

export function customizeFeatures(config: WhiteLabelConfig, features: string[]): WhiteLabelConfig {
  return { ...config, features }
}

export function deactivateConfig(config: WhiteLabelConfig): WhiteLabelConfig {
  return { ...config, active: false }
}
