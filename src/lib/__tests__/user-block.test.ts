import { describe, expect, it } from 'vitest'
import { createBlock } from '../content-moderation'
import { blockPerson, blockedUserIdsForViewer, blockPersonAuthPath, filterBlockedPulses } from '../user-block'

describe('block person', () => {
  it('removes blocked people’s pulses from the viewer’s Tonight', () => {
    const blocks = [createBlock('me', 'blocked')]
    const ids = blockedUserIdsForViewer(blocks, 'me')
    expect([...ids]).toEqual(['blocked'])
    expect(filterBlockedPulses(
      [{ userId: 'blocked' }, { userId: 'friend' }],
      ids,
    ).map((row) => row.userId)).toEqual(['friend'])
    expect(blockPerson([], 'me', 'blocked')[0]?.blockedUserId).toBe('blocked')
    expect(blockPersonAuthPath('neumos')).toContain('/auth?next=')
  })
})
