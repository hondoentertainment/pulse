import { describe, expect, it } from 'vitest'
import {
  canSaveCrewTonight,
  crewTonightAuthPath,
  crewTonightInviteUrl,
  sanitizeCrewMemberIds,
  toggleCrewMember,
} from '../crew-tonight'

describe('crew tonight', () => {
  it('picks 2–4 followed people and reuses the invite link', () => {
    expect(sanitizeCrewMemberIds(['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'c', 'd', 'e', 'a'])).toEqual([
      'a', 'b', 'c', 'd',
    ])
    expect(canSaveCrewTonight(['a'])).toBe(false)
    expect(canSaveCrewTonight(['a', 'b'])).toBe(true)
    expect(toggleCrewMember(['a', 'b'], 'c', ['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
    expect(crewTonightInviteUrl('neumos', 'https://pulse-chi-nine.vercel.app')).toContain('from=invite')
    expect(crewTonightAuthPath('neumos')).toContain('/auth?next=')
  })
})
