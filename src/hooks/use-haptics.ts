import { useCallback } from 'react'

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'selection'

const vibrationPatterns: Record<HapticType, number | number[]> = {
    light: 10,
    medium: 25,
    heavy: 50,
    success: [10, 50, 20],
    error: [50, 30, 50, 30, 50],
    selection: 5
}

export function useHaptics() {
    const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator

    const trigger = useCallback((type: HapticType = 'light') => {
        if (!isSupported) return false

        try {
            const pattern = vibrationPatterns[type]
            navigator.vibrate(pattern)
            return true
        } catch {
            return false
        }
    }, [isSupported])

    const triggerLight = useCallback(() => trigger('light'), [trigger])
    const triggerMedium = useCallback(() => trigger('medium'), [trigger])
    const triggerHeavy = useCallback(() => trigger('heavy'), [trigger])
    const triggerSuccess = useCallback(() => trigger('success'), [trigger])
    const triggerError = useCallback(() => trigger('error'), [trigger])
    const triggerSelection = useCallback(() => trigger('selection'), [trigger])

    return {
        isSupported,
        trigger,
        triggerLight,
        triggerMedium,
        triggerHeavy,
        triggerSuccess,
        triggerError,
        triggerSelection
    }
}
