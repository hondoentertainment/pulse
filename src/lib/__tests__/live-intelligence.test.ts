import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearReports,
  createLiveReport,
  getVenueLiveData,
  getVenueLiveDataFromReports,
  reportCrowdLevel,
  reportWaitTime,
} from '../live-intelligence'

describe('live-intelligence', () => {
  beforeEach(() => {
    clearReports()
  })

  it('builds live data from supplied report rows without touching local fallback reports', () => {
    reportWaitTime('fallback-venue', 'user-1', 30)

    const reports = [
      createLiveReport('venue-1', 'user-1', 'wait_time', 0),
      createLiveReport('venue-1', 'user-2', 'crowd_level', 80),
      createLiveReport('venue-1', 'user-3', 'music', 'House'),
    ]

    const liveData = getVenueLiveDataFromReports('venue-1', reports)
    const fallbackData = getVenueLiveData('fallback-venue')

    expect(liveData.waitTime).toBe(0)
    expect(liveData.crowdLevel).toBe(80)
    expect(liveData.musicGenre).toBe('House')
    expect(liveData.doorMode.lineStatus).toBe('walk-right-in')
    expect(fallbackData.waitTime).toBe(30)
  })

  it('raises confidence as recent report consensus grows', () => {
    const reports = [
      createLiveReport('venue-1', 'user-1', 'crowd_level', 60),
      createLiveReport('venue-1', 'user-2', 'crowd_level', 65),
      createLiveReport('venue-1', 'user-3', 'crowd_level', 70),
      createLiveReport('venue-1', 'user-4', 'crowd_level', 75),
      createLiveReport('venue-1', 'user-5', 'crowd_level', 80),
    ]

    const liveData = getVenueLiveDataFromReports('venue-1', reports)

    expect(liveData.confidence.crowdLevel).toBe('high')
    expect(liveData.confidenceDetails.crowdLevel.reportCount).toBe(5)
  })

  it('keeps prototype report helpers working for no-Supabase mode', () => {
    reportWaitTime('venue-1', 'user-1', 5)
    reportCrowdLevel('venue-1', 'user-1', 55)

    const liveData = getVenueLiveData('venue-1')

    expect(liveData.waitTime).toBe(5)
    expect(liveData.crowdLevel).toBe(55)
  })
})
