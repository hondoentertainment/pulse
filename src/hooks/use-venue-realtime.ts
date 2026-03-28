/**
 * useVenueRealtime — Per-venue live pulse score + Supabase Presence
 *
 * Provides:
 * 1. Real-time pulse score updates as new pulses arrive for a specific venue.
 *    New pulses are merged into the React Query cache so VenueCard / VenuePage
 *    update immediately without a full refetch.
 * 2. Presence tracking via Supabase Presence: who is "at" this venue right now.
 *    Presence state is broadcast and tracked locally in this hook.
 * 3. Connection status so the UI can indicate live vs stale data.
 *
 * Usage:
 *   const { pulseScore, presenceCount, presenceUsers, status } =
 *     useVenueRealtime(venueId, currentUserId)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { calculatePulseScore } from '@/lib/pulse-engine'
import { captureError, addBreadcrumb } from '@/lib/sentry'
import { trackPerformance } from '@/lib/analytics'
import type { Pulse, Venue } from '@/lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────────────────

export type VenueRealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

export interface PresenceUser {
  userId: string
  username?: string
  joinedAt: number
}

export interface UseVenueRealtimeResult {
  /** Latest calculated pulse score (null until first data arrives) */
  pulseScore: number | null
  /** Number of users currently present at this venue via Supabase Presence */
  presenceCount: number
  /** Array of users currently tracked as present */
  presenceUsers: PresenceUser[]
  /** WebSocket connection status */
  status: VenueRealtimeStatus
  /** Timestamp of the last pulse received via realtime */
  lastPulseAt: string | null
}

interface PresencePayload {
  userId: string
  username?: string
  joinedAt: number
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_RECONNECT_ATTEMPTS = 5
const BASE_RECONNECT_DELAY_MS = 1000

// ── Hook ───────────────────────────────────────────────────────────────────

export function useVenueRealtime(
  venueId: string | null | undefined,
  currentUserId?: string | null
): UseVenueRealtimeResult {
  const queryClient = useQueryClient()

  const [pulseScore, setPulseScore] = useState<number | null>(null)
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([])
  const [status, setStatus] = useState<VenueRealtimeStatus>('disconnected')
  const [lastPulseAt, setLastPulseAt] = useState<string | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const reconnectAttemptsRef = useRef(0)
  const isMountedRef = useRef(true)

  // ── Score recalculation ────────────────────────────────────────────────

  const recalculateScore = useCallback((venueId: string) => {
    const cachedPulses = queryClient.getQueryData<Pulse[]>(['pulses']) ?? []
    const venuePulses = cachedPulses.filter(p => p.venueId === venueId)
    const newScore = calculatePulseScore(venuePulses)

    setPulseScore(newScore)
    trackPerformance('venue_realtime_score_recalc', newScore)

    // Also update the venue record in the venues cache so VenueCard re-renders
    queryClient.setQueryData<Venue[]>(['venues'], (old = []) =>
      old.map(v => v.id === venueId ? { ...v, pulseScore: newScore } : v)
    )
  }, [queryClient])

  // ── Channel management ────────────────────────────────────────────────

  const teardown = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = undefined
    }
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
  }, [])

  const scheduleReconnect = useCallback((vid: string) => {
    if (!isMountedRef.current) return
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setStatus('disconnected')
      captureError(
        new Error(`Venue realtime: max reconnect attempts exceeded for venue ${vid}`),
        { venueId: vid, attempts: reconnectAttemptsRef.current }
      )
      return
    }

    setStatus('reconnecting')
    reconnectAttemptsRef.current++
    const delay = Math.min(
      30000,
      BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current - 1)
    )

    reconnectTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) connect(vid)
    }, delay)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const connect = useCallback((vid: string) => {
    if (!isMountedRef.current) return

    teardown()
    setStatus('connecting')
    addBreadcrumb(`Subscribing to venue ${vid}`, 'realtime', { venueId: vid })

    const channelName = `venue-realtime:${vid}`

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: currentUserId ?? 'anonymous',
        },
      },
    })

    // ── Postgres changes: new pulses for this venue ──────────────────────
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'pulses',
        filter: `venue_id=eq.${vid}`,
      },
      (payload) => {
        if (!isMountedRef.current) return
        const row = payload.new

        const newPulse: Pulse = {
          id: row.id as string,
          userId: row.user_id as string,
          venueId: row.venue_id as string,
          crewId: row.crew_id as string | undefined,
          photos: (row.photos as string[]) || [],
          video: row.video_url as string | undefined,
          energyRating: row.energy_rating as Pulse['energyRating'],
          caption: row.caption as string | undefined,
          hashtags: (row.hashtags as string[]) || [],
          views: (row.views as number) || 0,
          isPioneer: row.is_pioneer as boolean | undefined,
          credibilityWeight: row.credibility_weight as number | undefined,
          reactions: (row.reactions as Pulse['reactions']) || {
            fire: [], eyes: [], skull: [], lightning: [],
          },
          createdAt: row.created_at as string,
          expiresAt: row.expires_at as string,
          isPending: false,
          uploadError: false,
        }

        // Merge into React Query cache
        queryClient.setQueryData<Pulse[]>(['pulses'], (old = []) => {
          const exists = old.some(p => p.id === newPulse.id)
          if (exists) return old
          return [newPulse, ...old]
        })

        setLastPulseAt(newPulse.createdAt)
        recalculateScore(vid)
      }
    )

    // ── Postgres changes: venue score updated server-side ────────────────
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'venues',
        filter: `id=eq.${vid}`,
      },
      (payload) => {
        if (!isMountedRef.current) return
        const row = payload.new

        // Update the venues query cache with the authoritative server score
        queryClient.setQueryData<Venue[]>(['venues'], (old = []) =>
          old.map(v =>
            v.id === vid
              ? {
                  ...v,
                  pulseScore: (row.pulse_score as number) ?? v.pulseScore,
                  scoreVelocity: (row.score_velocity as number) ?? v.scoreVelocity,
                  lastPulseAt: (row.last_pulse_at as string) ?? v.lastPulseAt,
                }
              : v
          )
        )

        if (row.pulse_score != null) {
          setPulseScore(row.pulse_score as number)
        }
      }
    )

    // ── Presence: track who is currently at this venue ───────────────────
    channel.on('presence', { event: 'sync' }, () => {
      if (!isMountedRef.current) return
      const state = channel.presenceState()
      const users: PresenceUser[] = Object.values(state).flatMap(
        (presences) => (presences as unknown as PresencePayload[]).map(p => ({
          userId: p.userId,
          username: p.username,
          joinedAt: p.joinedAt,
        }))
      )
      setPresenceUsers(users)
    })

    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      if (!isMountedRef.current) return
      const joined = (newPresences as unknown as PresencePayload[]).map(p => ({
        userId: p.userId,
        username: p.username,
        joinedAt: p.joinedAt,
      }))
      setPresenceUsers(prev => {
        const existing = new Set(prev.map(u => u.userId))
        return [...prev, ...joined.filter(u => !existing.has(u.userId))]
      })
    })

    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      if (!isMountedRef.current) return
      const leftIds = new Set((leftPresences as unknown as PresencePayload[]).map(p => p.userId))
      setPresenceUsers(prev => prev.filter(u => !leftIds.has(u.userId)))
    })

    // ── Subscribe + broadcast our own presence ───────────────────────────
    channel.subscribe((channelStatus, err) => {
      if (!isMountedRef.current) return

      if (channelStatus === 'SUBSCRIBED') {
        reconnectAttemptsRef.current = 0
        setStatus('connected')
        addBreadcrumb(`Venue ${vid} subscribed`, 'realtime')

        // Broadcast our own presence if we have a user ID
        if (currentUserId) {
          channel.track({
            userId: currentUserId,
            joinedAt: Date.now(),
          } satisfies PresencePayload).catch((trackErr) => {
            captureError(
              trackErr instanceof Error ? trackErr : new Error(String(trackErr)),
              { venueId: vid }
            )
          })
        }
      } else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') {
        const error = err instanceof Error ? err : new Error(`Venue channel error: ${channelStatus}`)
        captureError(error, { venueId: vid, channelStatus })
        scheduleReconnect(vid)
      } else if (channelStatus === 'CLOSED') {
        if (isMountedRef.current) setStatus('disconnected')
      }
    })

    channelRef.current = channel
  }, [currentUserId, queryClient, recalculateScore, scheduleReconnect, teardown])

  // ── Lifecycle ──────────────────────────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true

    if (!venueId) {
      setStatus('disconnected')
      return
    }

    // Seed initial score from the React Query cache immediately
    const cachedPulses = queryClient.getQueryData<Pulse[]>(['pulses']) ?? []
    const venuePulses = cachedPulses.filter(p => p.venueId === venueId)
    if (venuePulses.length > 0) {
      setPulseScore(calculatePulseScore(venuePulses))
    }

    connect(venueId)

    return () => {
      isMountedRef.current = false
      teardown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, currentUserId])

  // ── Return ──────────────────────────────────────────────────────────────

  return {
    pulseScore,
    presenceCount: presenceUsers.length,
    presenceUsers,
    status,
    lastPulseAt,
  }
}
