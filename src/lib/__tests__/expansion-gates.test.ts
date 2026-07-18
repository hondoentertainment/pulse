import { describe, it, expect } from 'vitest'
import {
  EXPANSION_GATE_STREAK_WEEKS,
  countConsecutiveClearWeeks,
  evaluateWeekGates,
  summarizeExpansionGates,
  type WeekGateSnapshot,
} from '../expansion-gates'

function clearWeek(weekStart: string): WeekGateSnapshot {
  return {
    weekStart,
    decisionConversionPct: 40,
    freshCoveragePct: 75,
    week4RetentionPct: 30,
    misleadingSignalPct: 5,
    scoutParticipationPct: 60,
  }
}

describe('expansion-gates', () => {
  it('passes when all targets met', () => {
    const checks = evaluateWeekGates(clearWeek('2026-07-13'))
    expect(checks.every((c) => c.passed)).toBe(true)
  })

  it('fails misleading when above max', () => {
    const checks = evaluateWeekGates({
      ...clearWeek('2026-07-13'),
      misleadingSignalPct: 15,
    })
    expect(checks.find((c) => c.id === 'misleadingSignalPctMax')?.passed).toBe(false)
  })

  it('counts consecutive clear weeks from newest', () => {
    const weeks = [
      clearWeek('2026-07-13'),
      clearWeek('2026-07-06'),
      { ...clearWeek('2026-06-29'), freshCoveragePct: 50 },
      clearWeek('2026-06-22'),
    ]
    expect(countConsecutiveClearWeeks(weeks)).toBe(2)
  })

  it('readyToExpand only after streak weeks', () => {
    const weeks = Array.from({ length: EXPANSION_GATE_STREAK_WEEKS }, (_, i) =>
      clearWeek(`2026-week-${i}`),
    )
    const summary = summarizeExpansionGates(weeks)
    expect(summary.readyToExpand).toBe(true)
    expect(summary.consecutiveClearWeeks).toBe(EXPANSION_GATE_STREAK_WEEKS)
  })
})

