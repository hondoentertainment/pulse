/**
 * useRealtimeSubscription — Supabase Realtime → Batched React State
 *
 * Subscribes to Supabase Realtime channels for pulses, reactions, and presence,
 * routing all incoming WebSocket payloads through the RealtimeBatcher middleware
 * before flushing them into the React Query cache.
 *
 * This prevents 500 simultaneous reactions at a viral venue from individually
 * triggering 500 React re-renders. Instead, they are collapsed into a single
 * batched state update every ~2 seconds.
 *
 * Production features:
 * - Connection status tracking with typed states
 * - Automatic reconnection with exponential backoff (max 5 attempts)
 * - Proper cleanup of channels and batchers on unmount
 * - Error capture via Sentry integration
 * - Optional filter support for targeted subscriptions
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/query-client'
import {
  reactionBatcher,
  presenceBatcher,
  pulseBatcher,
  type BatchFlush,
} from '@/lib/realtime-batcher'
import { captureError, addBreadcrumb } from '@/lib/sentry'
import type { Pulse } from '@/lib/types'
import { trackPerformance } from '@/lib/analytics'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

const MAX_RECONNECT_ATTEMPTS = 5
const BASE_RECONNECT_DELAY_MS = 1000

/**
 * Flush handler for pulse inserts — merges new pulses into React Query cache.
 */
function handlePulseBatchFlush(batch: BatchFlush) {
  if (batch.events.length === 0) return

  queryClient.setQueryData<Pulse[]>(['pulses'], (old = []) => {
    const existing = new Set(old.map(p => p.id))
    const newPulses = batch.events
      .filter(e => !existing.has(e.key))
      .map(e => e.payload as Pulse)

    if (newPulses.length === 0) return old
    return [...newPulses, ...old]
  })

  trackPerformance('realtime_pulse_batch_size', batch.events.length)
  if (batch.droppedCount > 0) {
    trackPerformance('realtime_pulse_duplicates_collapsed', batch.droppedCount)
  }
}

/**
 * Flush handler for reactions — merges reaction updates into cached pulses.
 */
function handleReactionBatchFlush(batch: BatchFlush) {
  if (batch.events.length === 0) return

  queryClient.setQueryData<Pulse[]>(['pulses'], (old = []) => {
    const updates = new Map(batch.events.map(e => [e.key, e.payload as Partial<Pulse>]))

    return old.map(pulse => {
      const update = updates.get(pulse.id)
      if (!update) return pulse
      return { ...pulse, reactions: (update as Pulse).reactions ?? pulse.reactions }
    })
  })

  trackPerformance('realtime_reaction_batch_size', batch.events.length)
}

/**
 * Flush handler for presence — updates venue presence data in query cache.
 */
function handlePresenceBatchFlush(batch: BatchFlush) {
  if (batch.events.length === 0) return

  queryClient.setQueryData<Record<string, unknown>>(['venue-presence'], (old = {}) => {
    const merged = { ...old }
    for (const event of batch.events) {
      merged[event.key] = event.payload
    }
    return merged
  })

  trackPerformance('realtime_presence_batch_size', batch.events.length)
}

/**
 * Hook that manages Supabase Realtime subscriptions with batched state updates,
 * automatic reconnection, and connection status tracking.
 */
export function useRealtimeSubscription(enabled = true) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const reconnectAttemptsRef = useRef(0)
  const isMountedRef = useRef(true)

  const updateStatus = useCallback((next: ConnectionStatus) => {
    if (!isMountedRef.current) return
    setStatus(next)
    addBreadcrumb(`Realtime connection: ${next}`, 'realtime')
  }, [])

  const teardown = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = undefined
    }
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
    pulseBatcher.stop()
    reactionBatcher.stop()
    presenceBatcher.stop()
  }, [])

  const connect = useCallback(() => {
    if (!isMountedRef.current) return

    teardown()
    updateStatus('connecting')

    // Start all batchers
    pulseBatcher.start(handlePulseBatchFlush)
    reactionBatcher.start(handleReactionBatchFlush)
    presenceBatcher.start(handlePresenceBatchFlush)

    const channel = supabase
      .channel('pulse-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pulses' },
        (payload) => {
          const row = payload.new
          pulseBatcher.push({
            type: 'pulse_insert',
            key: row.id as string,
            payload: {
              id: row.id,
              userId: row.user_id,
              venueId: row.venue_id,
              crewId: row.crew_id,
              photos: row.photos || [],
              video: row.video_url,
              energyRating: row.energy_rating,
              caption: row.caption,
              hashtags: row.hashtags || [],
              views: row.views,
              isPioneer: row.is_pioneer,
              credibilityWeight: row.credibility_weight,
              reactions: row.reactions || { fire: [], eyes: [], skull: [], lightning: [] },
              createdAt: row.created_at,
              expiresAt: row.expires_at,
              isPending: false,
              uploadError: false,
            },
            timestamp: Date.now(),
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pulses' },
        (payload) => {
          const row = payload.new
          reactionBatcher.push({
            type: 'reaction',
            key: row.id as string,
            payload: {
              id: row.id,
              reactions: row.reactions || { fire: [], eyes: [], skull: [], lightning: [] },
            },
            timestamp: Date.now(),
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'venues' },
        (payload) => {
          const row = payload.new
          presenceBatcher.push({
            type: 'presence',
            key: row.id as string,
            payload: {
              venueId: row.id,
              pulseScore: row.pulse_score,
              scoreVelocity: row.score_velocity,
              lastPulseAt: row.last_pulse_at,
            },
            timestamp: Date.now(),
          })
        }
      )
      .subscribe((channelStatus, err) => {
        if (!isMountedRef.current) return

        if (channelStatus === 'SUBSCRIBED') {
          reconnectAttemptsRef.current = 0
          updateStatus('connected')
          addBreadcrumb('Realtime channel subscribed', 'realtime')
        } else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') {
          const error = err instanceof Error ? err : new Error(`Channel error: ${channelStatus}`)
          captureError(error, { channelStatus, attempt: reconnectAttemptsRef.current })
          scheduleReconnect()
        } else if (channelStatus === 'CLOSED') {
          if (isMountedRef.current) {
            updateStatus('disconnected')
          }
        }
      })

    channelRef.current = channel
  }, [teardown, updateStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleReconnect = useCallback(() => {
    if (!isMountedRef.current) return
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      updateStatus('disconnected')
      captureError(
        new Error(`Realtime: max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) exceeded`),
        { attempts: reconnectAttemptsRef.current }
      )
      return
    }

    updateStatus('reconnecting')
    reconnectAttemptsRef.current++

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 30s)
    const delay = Math.min(
      30000,
      BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current - 1)
    )

    addBreadcrumb(
      `Realtime reconnect scheduled in ${delay}ms (attempt ${reconnectAttemptsRef.current})`,
      'realtime',
      { delay, attempt: reconnectAttemptsRef.current }
    )

    reconnectTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) connect()
    }, delay)
  }, [connect, updateStatus])

  // Expose reconnect for manual triggering (e.g. from UI)
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    connect()
  }, [connect])

  useEffect(() => {
    isMountedRef.current = true

    if (!enabled) {
      updateStatus('disconnected')
      return
    }

    connect()

    return () => {
      isMountedRef.current = false
      teardown()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]) // intentionally omit connect/teardown to avoid re-subscribing on every render

  return { status, reconnect }
}
