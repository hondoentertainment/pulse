import { describe, expect, it } from 'vitest'
import { isOpenNow, openNowChip, venueHasHours } from '../open-now'

describe('open now', () => {
  it('omits the chip when hours are null or missing', () => {
    expect(venueHasHours({ hours: undefined })).toBe(false)
    expect(openNowChip({ hours: undefined })).toBeNull()
    expect(openNowChip({ hours: null as unknown as undefined })).toBeNull()
    expect(openNowChip({})).toBeNull()
    expect(isOpenNow({ hours: {} })).toBe(false)
  })

  it('never invents open when today’s hours are missing or closed', () => {
    expect(openNowChip({
      hours: { monday: 'Closed' },
    }, new Date('2026-09-14T20:00:00.000Z'))).toBeNull()
  })
})
