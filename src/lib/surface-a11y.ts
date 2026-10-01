/**
 * WC-12 keyboard, motion, and contrast helpers for map, Tonight, and composer.
 * Energy meaning is always a word. Emoji is decorative.
 */

import { ENERGY_CONFIG, type EnergyRating } from '@/lib/types'

export function nextRovingIndex(current: number, length: number, key: string): number | null {
  if (length <= 0 || current < 0) return null
  if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % length
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + length) % length
  if (key === 'Home') return 0
  if (key === 'End') return length - 1
  return null
}

export function energyTextLabel(rating: EnergyRating | string | undefined): string {
  if (rating && rating in ENERGY_CONFIG) {
    return ENERGY_CONFIG[rating as EnergyRating].label
  }
  return 'Energy'
}

/** Emoji never carries the meaning by itself. */
export function energyAccessibleName(rating: EnergyRating | string | undefined): string {
  return `Energy: ${energyTextLabel(rating)}`
}

export function shouldRunMapInertia(reducedMotion: boolean): boolean {
  return !reducedMotion
}

export function surfaceMotion(reducedMotion: boolean): { duration: number; y: number } {
  if (reducedMotion) return { duration: 0, y: 0 }
  return { duration: 0.2, y: 20 }
}
