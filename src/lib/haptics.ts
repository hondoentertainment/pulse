export type HapticIntensity = 'light' | 'medium' | 'heavy'

export function triggerHapticFeedback(intensity: HapticIntensity = 'medium') {
  if (typeof navigator === 'undefined') return

  if ('vibrate' in navigator) {
    const duration = {
      light: 10,
      medium: 20,
      heavy: 40
    }[intensity]

    navigator.vibrate(duration)
  }

  if ((navigator as any).hapticEngine) {
    const type = {
      light: 'light',
      medium: 'medium',
      heavy: 'heavy'
    }[intensity]
    
    ;(navigator as any).hapticEngine.impact(type)
  }
}

export function triggerHapticPattern(pattern: number[]) {
  if (typeof navigator === 'undefined') return

  if ('vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

export function triggerEnergyChangeHaptic(fromIntensity: number, toIntensity: number) {
  const intensityMap: Record<number, HapticIntensity> = {
    0: 'light',
    1: 'light',
    2: 'medium',
    3: 'heavy'
  }

  const hapticIntensity = intensityMap[toIntensity] || 'medium'
  triggerHapticFeedback(hapticIntensity)

  if (Math.abs(toIntensity - fromIntensity) > 1) {
    setTimeout(() => {
      triggerHapticFeedback(hapticIntensity)
    }, 100)
  }
}
