import { afterEach, describe, expect, it } from 'vitest'
import {
  clearScoutProgram,
  computeScoutReputation,
  decideScoutApplication,
  deriveScoutTier,
  recordScoutCorroboration,
  submitScoutApplication,
  type ScoutProfile,
} from '../scout-program'

describe('scout program', () => {
  afterEach(() => {
    clearScoutProgram()
  })

  it('scores reputation from corroboration, not volume', () => {
    const highVolumeGuesses = computeScoutReputation({
      corroboratedCount: 2,
      contradictedCount: 18,
    })
    const lowVolumeAccurate = computeScoutReputation({
      corroboratedCount: 6,
      contradictedCount: 0,
    })
    expect(lowVolumeAccurate).toBeGreaterThan(highVolumeGuesses)
  })

  it('moves an approved applicant to scout, then trusted after corroboration', () => {
    const application = submitScoutApplication({
      userId: 'user-1',
      city: 'Seattle,WA',
      neighborhoods: ['Capitol Hill', 'Belltown'],
      statement: 'I go out on Capitol Hill most weekends and can confirm door times.',
    })
    expect(application.status).toBe('submitted')

    const approved = decideScoutApplication(application.id, 'approved')
    expect(approved?.status).toBe('approved')

    let profile: ScoutProfile | null = null
    for (let i = 0; i < 6; i += 1) {
      profile = recordScoutCorroboration('user-1', 'corroborated')
    }
    expect(profile?.reputation).toBeGreaterThanOrEqual(75)
    expect(deriveScoutTier(profile!)).toBe('trusted')
    expect(profile?.tier).toBe('trusted')
  })
})
