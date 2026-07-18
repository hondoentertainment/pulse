/**
 * PRD §15.1 / §20.10 expansion gates — track 8 consecutive weeks before geo expand.
 */

export const EXPANSION_GATE_STREAK_WEEKS = 8

export interface ExpansionGateTargets {
  decisionConversionPct: number
  freshCoveragePct: number
  week4RetentionPct: number
  misleadingSignalPctMax: number
  scoutParticipationPct: number
}

export const EXPANSION_GATE_TARGETS: ExpansionGateTargets = {
  decisionConversionPct: 35,
  freshCoveragePct: 70,
  week4RetentionPct: 25,
  misleadingSignalPctMax: 10,
  scoutParticipationPct: 50,
}

export interface WeekGateSnapshot {
  /** ISO week start (Monday) YYYY-MM-DD */
  weekStart: string
  decisionConversionPct: number
  freshCoveragePct: number
  week4RetentionPct: number
  misleadingSignalPct: number
  scoutParticipationPct: number
}

export interface GateCheckResult {
  id: keyof ExpansionGateTargets
  label: string
  value: number
  target: number
  passed: boolean
  higherIsBetter: boolean
}

export interface ExpansionGateSummary {
  weekStart: string
  checks: GateCheckResult[]
  allPassed: boolean
  consecutiveClearWeeks: number
  readyToExpand: boolean
  targets: ExpansionGateTargets
}

export function evaluateWeekGates(
  week: WeekGateSnapshot,
  targets: ExpansionGateTargets = EXPANSION_GATE_TARGETS,
): GateCheckResult[] {
  return [
    {
      id: 'decisionConversionPct',
      label: 'Decision conversion',
      value: week.decisionConversionPct,
      target: targets.decisionConversionPct,
      higherIsBetter: true,
      passed: week.decisionConversionPct >= targets.decisionConversionPct,
    },
    {
      id: 'freshCoveragePct',
      label: 'Fresh coverage',
      value: week.freshCoveragePct,
      target: targets.freshCoveragePct,
      higherIsBetter: true,
      passed: week.freshCoveragePct >= targets.freshCoveragePct,
    },
    {
      id: 'week4RetentionPct',
      label: 'Week-4 retention',
      value: week.week4RetentionPct,
      target: targets.week4RetentionPct,
      higherIsBetter: true,
      passed: week.week4RetentionPct >= targets.week4RetentionPct,
    },
    {
      id: 'misleadingSignalPctMax',
      label: 'Misleading signal rate',
      value: week.misleadingSignalPct,
      target: targets.misleadingSignalPctMax,
      higherIsBetter: false,
      passed: week.misleadingSignalPct <= targets.misleadingSignalPctMax,
    },
    {
      id: 'scoutParticipationPct',
      label: 'Scout participation',
      value: week.scoutParticipationPct,
      target: targets.scoutParticipationPct,
      higherIsBetter: true,
      passed: week.scoutParticipationPct >= targets.scoutParticipationPct,
    },
  ]
}

export function countConsecutiveClearWeeks(
  weeksNewestFirst: WeekGateSnapshot[],
  targets: ExpansionGateTargets = EXPANSION_GATE_TARGETS,
): number {
  let streak = 0
  for (const week of weeksNewestFirst) {
    const allPassed = evaluateWeekGates(week, targets).every((c) => c.passed)
    if (!allPassed) break
    streak += 1
  }
  return streak
}

export function summarizeExpansionGates(
  weeksNewestFirst: WeekGateSnapshot[],
  targets: ExpansionGateTargets = EXPANSION_GATE_TARGETS,
): ExpansionGateSummary {
  const latest = weeksNewestFirst[0]
  const checks = latest
    ? evaluateWeekGates(latest, targets)
    : evaluateWeekGates(
        {
          weekStart: '',
          decisionConversionPct: 0,
          freshCoveragePct: 0,
          week4RetentionPct: 0,
          misleadingSignalPct: 100,
          scoutParticipationPct: 0,
        },
        targets,
      )
  const consecutiveClearWeeks = countConsecutiveClearWeeks(weeksNewestFirst, targets)
  return {
    weekStart: latest?.weekStart ?? '',
    checks,
    allPassed: checks.every((c) => c.passed),
    consecutiveClearWeeks,
    readyToExpand: consecutiveClearWeeks >= EXPANSION_GATE_STREAK_WEEKS,
    targets,
  }
}

/** ISO Monday date for a given instant (UTC). */
export function isoWeekStart(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1))
  return d.toISOString().slice(0, 10)
}
