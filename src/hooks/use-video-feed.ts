/**
 * React Query-backed infinite feed hook for the video surface.
 *
 * - Infinite scroll: each page returns a `nextCursor`; `getNextPageParam`
 *   surfaces it to React Query.
 * - Prefetching: the caller invokes `fetchNextPage` from an IntersectionObserver
 *   sentinel so the next page is in cache before the user swipes.
 * - Memory pruning: once the user has scrolled past ~5 pages we drop the
 *   oldest pages from the query cache. Each video can be up to 50 MB on
 *   disk and the rendered `<video>` elements hold their own buffers, so
 *   pruning keeps the DOM + React Query cache from growing unboundedly.
 */

import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import { listVideoFeed, type VideoFeedPage } from '@/lib/data/video-pulses'
import type { VideoFeedItem } from '@/lib/video-client'

const PAGE_SIZE = 10
const MAX_PAGES_IN_CACHE = 5

export interface UseVideoFeedOptions {
  viewer?: { lat: number; lng: number } | null
  enabled?: boolean
}

export interface UseVideoFeedReturn {
  items: VideoFeedItem[]
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  error: unknown
  fetchNextPage: () => void
  refetch: () => void
}

export function useVideoFeed(options: UseVideoFeedOptions = {}): UseVideoFeedReturn {
  const { viewer, enabled = true } = options
  const queryClient = useQueryClient()

  const queryKey = useMemo(
    () => ['video-feed', viewer?.lat ?? null, viewer?.lng ?? null] as const,
    [viewer?.lat, viewer?.lng],
  )

  const query = useInfiniteQuery<VideoFeedPage, Error, InfiniteData<VideoFeedPage>, typeof queryKey, string | null>({
    queryKey,
    initialPageParam: null,
    enabled,
    queryFn: async ({ pageParam }) => {
      const result = await listVideoFeed(pageParam ?? null, PAGE_SIZE, viewer ?? null)
      if (!result.ok) throw new Error(result.error)
      return result.data
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })

  // Memory pruning: drop oldest pages once we exceed MAX_PAGES_IN_CACHE.
  useEffect(() => {
    if (!query.data) return
    if (query.data.pages.length <= MAX_PAGES_IN_CACHE) return

    queryClient.setQueryData<InfiniteData<VideoFeedPage>>(queryKey, (prev) => {
      if (!prev) return prev
      const overflow = prev.pages.length - MAX_PAGES_IN_CACHE
      if (overflow <= 0) return prev
      return {
        pages: prev.pages.slice(overflow),
        pageParams: prev.pageParams.slice(overflow),
      }
    })
  }, [query.data, queryKey, queryClient])

  const items = useMemo<VideoFeedItem[]>(
    () => (query.data?.pages ?? []).flatMap((page) => page.items),
    [query.data],
  )

  const fetchNextPage = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage()
    }
  }, [query])

  return {
    items,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    error: query.error,
    fetchNextPage,
    refetch: () => {
      void query.refetch()
    },
  }
}
