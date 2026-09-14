import { describe, expect, it } from 'vitest'
import { filterHiddenPulses, HIDE_PULSE_REASON, hiddenPulseIdsForUser } from '../pulse-hide'

describe('hide this pulse', () => {
  it('reuses pulse_reports reason=hide for the signed-in viewer only', () => {
    const hidden = hiddenPulseIdsForUser(
      [
        { pulse_id: 'p1', reporter_id: 'me', reason: HIDE_PULSE_REASON },
        { pulse_id: 'p2', reporter_id: 'me', reason: 'spam' },
        { pulse_id: 'p3', reporter_id: 'other', reason: HIDE_PULSE_REASON },
      ],
      'me',
    )
    expect([...hidden]).toEqual(['p1'])
    expect(filterHiddenPulses([{ id: 'p1' }, { id: 'p2' }], hidden).map((row) => row.id)).toEqual(['p2'])
  })
})
