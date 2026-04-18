/**
 * Lightweight in-process storage adapters for the video-feed Edge Functions.
 *
 * Production swaps these modules for the real Supabase client. The interfaces
 * are intentionally narrow so the swap is a drop-in: every function returns
 * plain data, not a client-specific response type.
 *
 * The in-memory store is only used in local dev / tests; it lets the Edge
 * Functions be exercised without a live Supabase project.
 */

import type { VideoFeedCandidate } from './video-feed-scoring'

export interface VideoPulseRow extends VideoFeedCandidate {
  userId: string
  caption: string | null
  hashtags: string[]
  videoUrl: string
  videoDurationMs: number
  videoWidth: number
  videoHeight: number
  videoThumbnailUrl: string | null
  videoMimeType: string
  videoBytes: number
  expiresAt: string
}

export interface VideoReportRow {
  id: string
  pulseId: string
  reporterUserId: string
  reason:
    | 'copyrighted_audio'
    | 'nsfw'
    | 'minor_in_frame'
    | 'harassment'
    | 'spam'
    | 'misinformation'
    | 'other'
  note: string | null
  createdAt: string
  resolvedAt: string | null
  actionTaken: 'none' | 'warning' | 'content_removed' | 'user_suspended' | null
}

declare global {
  // Separate symbols so the fake store doesn't collide with `api/pulses.ts`.
  var __videoPulseStore: VideoPulseRow[] | undefined
  var __videoReportStore: VideoReportRow[] | undefined
}

function getVideoStore(): VideoPulseRow[] {
  if (!globalThis.__videoPulseStore) globalThis.__videoPulseStore = []
  return globalThis.__videoPulseStore
}

function getReportStore(): VideoReportRow[] {
  if (!globalThis.__videoReportStore) globalThis.__videoReportStore = []
  return globalThis.__videoReportStore
}

export function listActiveVideoPulses(nowIso: string = new Date().toISOString()): VideoPulseRow[] {
  return getVideoStore().filter((p) => p.expiresAt > nowIso)
}

export function insertVideoPulse(row: VideoPulseRow): VideoPulseRow {
  getVideoStore().push(row)
  return row
}

export function insertVideoReport(row: VideoReportRow): VideoReportRow {
  getReportStore().push(row)
  return row
}

export function countVideoPulsesForUserSince(userId: string, sinceIso: string): number {
  return getVideoStore().filter((p) => p.userId === userId && p.createdAt >= sinceIso).length
}

/** Test helper — clears both in-memory stores. */
export function __resetVideoStores(): void {
  globalThis.__videoPulseStore = []
  globalThis.__videoReportStore = []
}
