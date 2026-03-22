import { describe, it, expect } from 'vitest'
import {
  initializeSeededHashtags,
  applyHashtagDecay,
  updateHashtagUsage,
  getTimeOfDay,
  getDayOfWeek,
  createUserHashtag,
  shouldPromoteUserHashtag,
  SEEDED_HASHTAGS,
} from '../seeded-hashtags'

describe('initializeSeededHashtags', () => {
  it('returns an array with the same length as SEEDED_HASHTAGS', () => {
    const hashtags = initializeSeededHashtags()
    expect(hashtags.length).toBe(SEEDED_HASHTAGS.length)
  })

  it('assigns unique ids to each hashtag', () => {
    const hashtags = initializeSeededHashtags()
    const ids = new Set(hashtags.map(h => h.id))
    expect(ids.size).toBe(hashtags.length)
  })

  it('initializes all usage counts to 0', () => {
    const hashtags = initializeSeededHashtags()
    hashtags.forEach(h => {
      expect(h.usageCount).toBe(0)
      expect(h.verifiedUsageCount).toBe(0)
    })
  })

  it('initializes decay scores to 100', () => {
    const hashtags = initializeSeededHashtags()
    hashtags.forEach(h => {
      expect(h.decayScore).toBe(100)
    })
  })
})

describe('applyHashtagDecay', () => {
  it('reduces decay score for unused hashtags', () => {
    const hashtags = initializeSeededHashtags()
    const decayed = applyHashtagDecay(hashtags)
    decayed.forEach(h => {
      expect(h.decayScore).toBeLessThanOrEqual(100)
    })
  })

  it('does not reduce decay below minimum floor for seeded hashtags', () => {
    const hashtags = initializeSeededHashtags().map(h => ({
      ...h,
      decayScore: 21,
      lastUsedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    }))
    const decayed = applyHashtagDecay(hashtags)
    decayed.forEach(h => {
      expect(h.decayScore).toBeGreaterThanOrEqual(20)
    })
  })

  it('does not decay recently used hashtags', () => {
    const hashtags = initializeSeededHashtags().map(h => ({
      ...h,
      lastUsedAt: new Date().toISOString(), // just used
    }))
    const decayed = applyHashtagDecay(hashtags)
    decayed.forEach(h => {
      expect(h.decayScore).toBe(100)
    })
  })
})

describe('updateHashtagUsage', () => {
  it('increments usage count', () => {
    const hashtag = initializeSeededHashtags()[0]
    const updated = updateHashtagUsage(hashtag, false)
    expect(updated.usageCount).toBe(1)
    expect(updated.verifiedUsageCount).toBe(0)
  })

  it('increments verified usage count when verified', () => {
    const hashtag = initializeSeededHashtags()[0]
    const updated = updateHashtagUsage(hashtag, true)
    expect(updated.usageCount).toBe(1)
    expect(updated.verifiedUsageCount).toBe(1)
  })

  it('increases decay score on usage', () => {
    const hashtag = { ...initializeSeededHashtags()[0], decayScore: 50 }
    const updated = updateHashtagUsage(hashtag, true)
    expect(updated.decayScore).toBeGreaterThan(50)
  })

  it('caps decay score at 100', () => {
    const hashtag = { ...initializeSeededHashtags()[0], decayScore: 98 }
    const updated = updateHashtagUsage(hashtag, true)
    expect(updated.decayScore).toBeLessThanOrEqual(100)
  })
})

describe('getTimeOfDay', () => {
  it('returns morning for 8am', () => {
    expect(getTimeOfDay(8)).toBe('morning')
  })

  it('returns afternoon for 14', () => {
    expect(getTimeOfDay(14)).toBe('afternoon')
  })

  it('returns evening for 20', () => {
    expect(getTimeOfDay(20)).toBe('evening')
  })

  it('returns latenight for 2am', () => {
    expect(getTimeOfDay(2)).toBe('latenight')
  })
})

describe('getDayOfWeek', () => {
  it('returns weekend for Saturday', () => {
    // Use explicit local-time constructor: Jan 4, 2025 is a Saturday
    expect(getDayOfWeek(new Date(2025, 0, 4))).toBe('weekend')
  })

  it('returns weekday for Monday', () => {
    // Use explicit local-time constructor: Jan 6, 2025 is a Monday
    expect(getDayOfWeek(new Date(2025, 0, 6))).toBe('weekday')
  })
})

describe('createUserHashtag', () => {
  it('strips special characters from name', () => {
    const tag = createUserHashtag('Hello World!', 'general', 'social', 'user-1')
    expect(tag.name).toBe('HelloWorld')
  })

  it('creates non-seeded hashtag', () => {
    const tag = createUserHashtag('MyTag', 'nightlife', 'energetic', 'user-1')
    expect(tag.seeded).toBe(false)
    expect(tag.usageCount).toBe(1)
  })
})

describe('shouldPromoteUserHashtag', () => {
  it('returns false for seeded hashtags', () => {
    const tag = initializeSeededHashtags()[0]
    expect(shouldPromoteUserHashtag(tag)).toBe(false)
  })

  it('returns true when thresholds met', () => {
    const tag = createUserHashtag('Popular', 'general', 'social', 'user-1')
    tag.verifiedUsageCount = 3
    tag.usageCount = 5
    expect(shouldPromoteUserHashtag(tag)).toBe(true)
  })

  it('returns false when thresholds not met', () => {
    const tag = createUserHashtag('New', 'general', 'social', 'user-1')
    expect(shouldPromoteUserHashtag(tag)).toBe(false)
  })
})
