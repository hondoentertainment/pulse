import type { Pulse } from './types'
import type { VenueEvent } from './events'

interface ApiListResponse<T> {
  data: T[]
}

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

export async function postPulseToApi(pulse: Pulse): Promise<boolean> {
  try {
    const response = await fetch('/api/pulses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pulse),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function syncQueuedPulseToApi(payload: {
  id: string
  venueId: string
  energyRating: Pulse['energyRating']
  caption?: string
  photos: string[]
  hashtags?: string[]
}): Promise<boolean> {
  try {
    const response = await fetch('/api/pulses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function fetchEventsFromApi(): Promise<VenueEvent[] | null> {
  try {
    const response = await fetch('/api/events')
    if (!response.ok) return null
    const payload = await parseJsonSafely<ApiListResponse<VenueEvent>>(response)
    return payload?.data ?? null
  } catch {
    return null
  }
}

export async function fetchPulsesFromApi(): Promise<Pulse[] | null> {
  try {
    const response = await fetch('/api/pulses')
    if (!response.ok) return null
    const payload = await parseJsonSafely<ApiListResponse<Pulse>>(response)
    return payload?.data ?? null
  } catch {
    return null
  }
}

export async function postEventToApi(event: VenueEvent): Promise<boolean> {
  try {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
    return response.ok
  } catch {
    return false
  }
}
