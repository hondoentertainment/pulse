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
 */

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/query-client'
import {
  reactionBatcher,
  presenceBatcher,
  pulseBatcher,
  type BatchFlush,
} from '@/lib/realtime-batcher'
import type { Pulse } from '@/lib/types'
import { trackPerformance } from '@/lib/analytics'

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

  // Presence updates are stored in a dedicated query key
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
 * Hook that manages Supabase Realtime subscriptions with batched state updates.
 */
export function useRealtimeSubscription(enabled = true) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!enabled) return

    // Start all batchers
    pulseBatcher.start(handlePulseBatchFlush)
    reactionBatcher.start(handleReactionBatchFlush)
    presenceBatcher.start(handlePresenceBatchFlush)

    // Subscribe to Supabase Realtime
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
      .subscribe()

    channelRef.current = channel

    return () => {
      pulseBatcher.stop()
      reactionBatcher.stop()
      presenceBatcher.stop()
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [enabled])
}
