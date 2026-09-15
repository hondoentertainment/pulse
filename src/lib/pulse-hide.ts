/**
 * Signed-in “hide this pulse” — reuse pulse_reports with reason=hide.
 * Hidden rows leave that user’s Tonight.
 */

export const HIDE_PULSE_REASON = 'hide'

export function isHiddenPulseReport(report: {
  reason?: string | null
  reporterId?: string
  reporter_id?: string
}): boolean {
  return (report.reason ?? '').toLowerCase() === HIDE_PULSE_REASON
}

export function hiddenPulseIdsForUser(
  reports: readonly { pulseId?: string; pulse_id?: string; reason?: string | null; reporterId?: string; reporter_id?: string }[],
  userId: string,
): Set<string> {
  const ids = new Set<string>()
  for (const report of reports) {
    const reporter = report.reporterId ?? report.reporter_id
    if (reporter !== userId) continue
    if (!isHiddenPulseReport(report)) continue
    const pulseId = report.pulseId ?? report.pulse_id
    if (pulseId) ids.add(pulseId)
  }
  return ids
}

export function filterHiddenPulses<T extends { id: string }>(
  pulses: readonly T[],
  hiddenIds: ReadonlySet<string>,
): T[] {
  if (hiddenIds.size === 0) return [...pulses]
  return pulses.filter((pulse) => !hiddenIds.has(pulse.id))
}
