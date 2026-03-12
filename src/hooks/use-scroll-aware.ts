import { useEffect, useRef, useState, useCallback } from 'react'

interface UseScrollAwareOptions {
  threshold?: number
  directionDebounce?: number
}

interface ScrollAwareState {
  scrollY: number
  isScrolled: boolean
  scrollDirection: 'up' | 'down' | null
  isAtTop: boolean
}

export function useScrollAware(options: UseScrollAwareOptions = {}): ScrollAwareState {
  const { threshold = 20, directionDebounce = 50 } = options

  const [state, setState] = useState<ScrollAwareState>({
    scrollY: 0,
    isScrolled: false,
    scrollDirection: null,
    isAtTop: true,
  })

  const lastScrollY = useRef(0)
  const lastDirection = useRef<'up' | 'down' | null>(null)
  const directionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ticking = useRef(false)

  const updateScroll = useCallback(() => {
    const currentY = window.scrollY
    const prevY = lastScrollY.current

    let newDirection: 'up' | 'down' | null = lastDirection.current
    const delta = currentY - prevY

    if (Math.abs(delta) > 2) {
      const detectedDirection = delta > 0 ? 'down' : 'up'

      if (detectedDirection !== lastDirection.current) {
        if (directionTimer.current) {
          clearTimeout(directionTimer.current)
        }
        directionTimer.current = setTimeout(() => {
          lastDirection.current = detectedDirection
          setState((prev) => ({
            ...prev,
            scrollDirection: detectedDirection,
          }))
        }, directionDebounce)
      }

      newDirection = lastDirection.current
    }

    lastScrollY.current = currentY

    setState((prev) => {
      const isScrolled = currentY > threshold
      const isAtTop = currentY <= 0

      if (
        prev.scrollY === currentY &&
        prev.isScrolled === isScrolled &&
        prev.isAtTop === isAtTop
      ) {
        return prev
      }

      return {
        scrollY: currentY,
        isScrolled,
        scrollDirection: newDirection,
        isAtTop,
      }
    })

    ticking.current = false
  }, [threshold, directionDebounce])

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        ticking.current = true
        requestAnimationFrame(updateScroll)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    // Initialize with current scroll position
    updateScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (directionTimer.current) {
        clearTimeout(directionTimer.current)
      }
    }
  }, [updateScroll])

  return state
}
