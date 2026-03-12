import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { calculateVisibleRange } from '@/lib/performance-engine'

interface VirtualizedListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  /** Estimated height of each item in pixels (used for initial layout). */
  itemHeight: number
  /** Height of the scrollable container in pixels. */
  containerHeight: number
  /** Number of extra items to render above/below the viewport. */
  overscan?: number
  className?: string
}

/**
 * Windowed rendering component that only mounts items visible in the
 * viewport plus an overscan buffer. Uses CSS transforms for positioning
 * and a measurement cache for dynamic item heights.
 */
export function VirtualizedList<T>({
  items,
  renderItem,
  itemHeight,
  containerHeight,
  overscan = 3,
  className,
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const [scrollTop, setScrollTop] = useState(0)

  // Measurement cache: maps item index → measured pixel height
  const measuredHeights = useRef<Map<number, number>>(new Map())

  /** Return the height for a given index, falling back to the estimate. */
  const getItemHeight = useCallback(
    (index: number) => measuredHeights.current.get(index) ?? itemHeight,
    [itemHeight]
  )

  /** Sum of all item heights (measured when available, estimated otherwise). */
  const getTotalHeight = useCallback(() => {
    let total = 0
    for (let i = 0; i < items.length; i++) {
      total += getItemHeight(i)
    }
    return total
  }, [items.length, getItemHeight])

  /** Compute the Y offset for a given item index. */
  const getOffsetForIndex = useCallback(
    (index: number) => {
      let offset = 0
      for (let i = 0; i < index; i++) {
        offset += getItemHeight(i)
      }
      return offset
    },
    [getItemHeight]
  )

  // Scroll handler throttled via requestAnimationFrame
  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (containerRef.current) {
        setScrollTop(containerRef.current.scrollTop)
      }
    })
  }, [])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Determine visible range using the performance engine helper.
  // We use the estimated itemHeight for the range calculation since it is
  // close enough to determine overscan boundaries.
  const { startIndex, endIndex } = calculateVisibleRange(
    scrollTop,
    { itemHeight, overscan, containerHeight },
    items.length
  )

  const totalHeight = getTotalHeight()

  // Callback ref to measure a rendered item
  const measureRef = useCallback(
    (index: number) => (node: HTMLDivElement | null) => {
      if (!node) return
      const height = node.getBoundingClientRect().height
      if (height > 0 && height !== measuredHeights.current.get(index)) {
        measuredHeights.current.set(index, height)
      }
    },
    []
  )

  // Build the visible slice
  const visibleItems: ReactNode[] = []
  for (let i = startIndex; i <= endIndex && i < items.length; i++) {
    const offsetY = getOffsetForIndex(i)
    visibleItems.push(
      <div
        key={i}
        ref={measureRef(i)}
        className="absolute left-0 w-full"
        style={{ transform: `translateY(${offsetY}px)` }}
        role="listitem"
      >
        {renderItem(items[i], i)}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className ?? ''}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
      role="list"
    >
      <div className="relative w-full" style={{ height: totalHeight }}>
        {visibleItems}
      </div>
    </div>
  )
}
