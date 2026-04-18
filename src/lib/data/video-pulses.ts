/**
 * Data-layer facade for the video feed.
 *
 * Thin wrapper over `video-client` that normalizes shapes and centralizes the
 * auth-token / base-URL resolution so callers (hooks, components) don't need
 * to know about either.
 */

import {
  listVideoFeed as listVideoFeedHttp,
  publishVideoPulse as publishVideoPulseHttp,
  type ApiResult,
  type PublishVideoPulseInput,
  type PublishVideoPulseResponse,
  type VideoFeedPage,
  type VideoClientOptions,
} from '@/lib/video-client'

function resolveOptions(): VideoClientOptions {
  // The auth session is attached at the call site (see `use-video-feed.ts`),
  // but we centralize the base-URL pick here so tests can stub it.
  const base =
    (typeof import.meta !== 'undefined' &&
      (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env
        ?.VITE_API_BASE_URL) ||
    ''
  return { baseUrl: base }
}

export async function listVideoFeed(
  cursor: string | null,
  limit: number,
  viewer?: { lat: number; lng: number } | null,
): Promise<ApiResult<VideoFeedPage>> {
  return listVideoFeedHttp(
    {
      cursor,
      limit,
      lat: viewer?.lat ?? null,
      lng: viewer?.lng ?? null,
    },
    resolveOptions(),
  )
}

export async function publishVideoPulse(
  input: PublishVideoPulseInput,
  authToken?: string | null,
): Promise<ApiResult<PublishVideoPulseResponse>> {
  return publishVideoPulseHttp(input, { ...resolveOptions(), authToken: authToken ?? null })
}

export type { PublishVideoPulseInput, PublishVideoPulseResponse, VideoFeedPage }
