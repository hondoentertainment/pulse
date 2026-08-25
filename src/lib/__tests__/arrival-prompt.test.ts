import { afterEach, describe, expect, it } from 'vitest'
import {
  ARRIVAL_PROMPT_MIN_ELAPSED_MS,
  ARRIVAL_WINDOW_MS,
  clearArrivalWatches,
  confirmArrival,
  getArrivalWatchStatus,
  reportArrivalMismatch,
  shouldShowArrivalPrompt,
  startArrivalWatch,
} from '../arrival-prompt'

describe('arrival prompt', () => {
  afterEach(() => {
    clearArrivalWatches()
  })

  it('opens a post-Go window and becomes ready after the minimum elapsed time', () => {
    const started = new Date('2026-08-25T23:00:00.000Z')
    const watch = startArrivalWatch('venue-1', 'Neumos', started)
    expect(getArrivalWatchStatus(watch, started)).toBe('pending')
    expect(shouldShowArrivalPrompt(watch, started)).toBe(false)

    const readyAt = new Date(started.getTime() + ARRIVAL_PROMPT_MIN_ELAPSED_MS)
    expect(getArrivalWatchStatus(watch, readyAt)).toBe('ready')
    expect(shouldShowArrivalPrompt(watch, readyAt)).toBe(true)
  })

  it('confirms or records a mismatch inside the window', () => {
    const started = new Date('2026-08-25T23:00:00.000Z')
    const watch = startArrivalWatch('venue-1', 'Neumos', started)
    const confirmed = confirmArrival(watch.id, new Date(started.getTime() + 5 * 60_000))
    expect(confirmed?.status).toBe('confirmed')

    const second = startArrivalWatch('venue-2', 'Q Nightclub', started)
    const mismatch = reportArrivalMismatch(second.id, 'quieter')
    expect(mismatch?.status).toBe('mismatch')
    expect(mismatch?.correction).toBe('quieter')
  })

  it('expires after the arrival window', () => {
    const started = new Date('2026-08-25T23:00:00.000Z')
    const watch = startArrivalWatch('venue-1', 'Neumos', started)
    const expiredAt = new Date(started.getTime() + ARRIVAL_WINDOW_MS + 1)
    expect(getArrivalWatchStatus(watch, expiredAt)).toBe('expired')
  })
})
