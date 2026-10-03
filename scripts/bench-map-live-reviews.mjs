#!/usr/bin/env node
/**
 * Targeted CPU bench for map live-review activity.
 * Compares the pre-#speed naive per-venue scan vs the indexed single-pass path.
 */
import { performance } from 'node:perf_hooks'

const VENUE_COUNT = 400
const PULSE_COUNT = 3000
const LOOKUPS_PER_VENUE = 4 // map filter/sort + heat + markers + surging

function makeVenue(i) {
  return {
    id: `v-${i}`,
    name: `Venue ${i}`,
    location: { lat: 47.6 + (i % 40) * 0.01, lng: -122.3 + (i % 40) * 0.01 },
    pulseScore: i % 100,
  }
}

function makePulse(i, nowMs) {
  return {
    id: `p-${i}`,
    userId: 'u',
    venueId: `v-${i % VENUE_COUNT}`,
    photos: [],
    energyRating: i % 2 === 0 ? 'electric' : 'buzzing',
    caption: 'Packed floor tonight',
    kind: 'review',
    hasBody: true,
    createdAt: new Date(nowMs - (i % 40) * 60 * 1000).toISOString(),
    expiresAt: new Date(nowMs + 90 * 60 * 1000).toISOString(),
    reactions: { fire: [], eyes: [], skull: [], lightning: [] },
    views: 0,
  }
}

function isLiveReview(pulse) {
  return pulse.kind === 'review'
}

function isWithinWindow(createdAt, nowMs, minutes = 60) {
  const createdMs = new Date(createdAt).getTime()
  return nowMs - createdMs <= minutes * 60 * 1000 && nowMs - createdMs >= 0
}

function naiveActivity(venue, pulses, nowMs) {
  const live = []
  for (const pulse of pulses) {
    if (pulse.venueId !== venue.id) continue
    if (!isLiveReview(pulse) || !isWithinWindow(pulse.createdAt, nowMs)) continue
    live.push(pulse)
  }
  return live.length
}

function indexedActivity(venues, pulses, nowMs) {
  const byVenue = new Map()
  for (const pulse of pulses) {
    if (!isLiveReview(pulse) || !isWithinWindow(pulse.createdAt, nowMs)) continue
    const list = byVenue.get(pulse.venueId)
    if (list) list.push(pulse)
    else byVenue.set(pulse.venueId, [pulse])
  }
  let total = 0
  for (const venue of venues) {
    total += byVenue.get(venue.id)?.length ?? 0
  }
  return total
}

const nowMs = Date.now()
const venues = Array.from({ length: VENUE_COUNT }, (_, i) => makeVenue(i))
const pulses = Array.from({ length: PULSE_COUNT }, (_, i) => makePulse(i, nowMs))

// Warm
indexedActivity(venues, pulses, nowMs)
for (const venue of venues) naiveActivity(venue, pulses, nowMs)

const naiveStart = performance.now()
let naiveTotal = 0
for (let n = 0; n < LOOKUPS_PER_VENUE; n++) {
  for (const venue of venues) naiveTotal += naiveActivity(venue, pulses, nowMs)
}
const naiveMs = performance.now() - naiveStart

const indexedStart = performance.now()
let indexedTotal = 0
for (let n = 0; n < LOOKUPS_PER_VENUE; n++) {
  indexedTotal += indexedActivity(venues, pulses, nowMs)
}
const indexedMs = performance.now() - indexedStart

console.log(`venues=${VENUE_COUNT} pulses=${PULSE_COUNT} lookups/venue=${LOOKUPS_PER_VENUE}`)
console.log(`naive:   ${naiveMs.toFixed(2)} ms  (count=${naiveTotal})`)
console.log(`indexed: ${indexedMs.toFixed(2)} ms  (count=${indexedTotal})`)
console.log(`speedup: ${(naiveMs / Math.max(indexedMs, 0.01)).toFixed(1)}x`)
