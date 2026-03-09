import { UnitSystem } from '@/hooks/use-unit-preference'

const MILES_TO_KM = 1.60934

export function formatDistance(distanceMiles: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    if (distanceMiles < 0.1) {
      const feet = Math.round(distanceMiles * 5280)
      return `${feet}ft`
    }
    return `${distanceMiles.toFixed(1)}mi`
  } else {
    const distanceKm = distanceMiles * MILES_TO_KM
    if (distanceKm < 1) {
      const meters = Math.round(distanceKm * 1000)
      return `${meters}m`
    }
    return `${distanceKm.toFixed(1)}km`
  }
}

export function convertMilesToMeters(miles: number): number {
  return miles * MILES_TO_KM * 1000
}

export function convertMilesToKm(miles: number): number {
  return miles * MILES_TO_KM
}

export function getDistanceUnitLabel(unitSystem: UnitSystem, short: boolean = false): string {
  if (short) {
    return unitSystem === 'imperial' ? 'mi' : 'km'
  }
  return unitSystem === 'imperial' ? 'miles' : 'kilometers'
}
