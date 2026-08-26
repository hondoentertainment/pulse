/**
 * Scout program MVP (P1-1).
 *
 * Reputation is corroboration quality, not report volume. A scout who files
 * 40 unconfirmed reports stays below a scout who files 4 that others match.
 */

export type ScoutApplicationStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type ScoutTier = 'applicant' | 'scout' | 'trusted'
export type ScoutCorroboration = 'corroborated' | 'contradicted' | 'unreviewed'

export interface ScoutApplication {
  id: string
  userId: string
  city: string
  neighborhoods: string[]
  statement: string
  status: ScoutApplicationStatus
  createdAt: string
  decidedAt?: string
}

export interface ScoutProfile {
  userId: string
  tier: ScoutTier
  corroboratedCount: number
  contradictedCount: number
  unreviewedCount: number
  reputation: number
  approvedAt?: string
}

export interface ScoutReputationInput {
  corroboratedCount: number
  contradictedCount: number
  unreviewedCount?: number
}

const applications = new Map<string, ScoutApplication>()
const profiles = new Map<string, ScoutProfile>()

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function computeScoutReputation(input: ScoutReputationInput): number {
  const reviewed = input.corroboratedCount + input.contradictedCount
  if (reviewed === 0) return 0
  const accuracy = input.corroboratedCount / reviewed
  const sampleConfidence = Math.min(1, reviewed / 8)
  return Math.round(accuracy * sampleConfidence * 100)
}

export function deriveScoutTier(profile: Pick<ScoutProfile, 'tier' | 'corroboratedCount' | 'contradictedCount' | 'reputation'>): ScoutTier {
  if (profile.tier === 'applicant') return 'applicant'
  if (profile.reputation >= 75 && profile.corroboratedCount >= 6 && profile.corroboratedCount > profile.contradictedCount) {
    return 'trusted'
  }
  return 'scout'
}

export function submitScoutApplication(input: {
  userId: string
  city: string
  neighborhoods: string[]
  statement: string
  now?: Date
}): ScoutApplication {
  const existing = [...applications.values()].find(
    (application) => application.userId === input.userId && application.status !== 'rejected',
  )
  if (existing) return existing

  const application: ScoutApplication = {
    id: createId('scout-app'),
    userId: input.userId,
    city: input.city.trim(),
    neighborhoods: input.neighborhoods,
    statement: input.statement.trim(),
    status: 'submitted',
    createdAt: (input.now ?? new Date()).toISOString(),
  }
  applications.set(application.id, application)
  profiles.set(input.userId, {
    userId: input.userId,
    tier: 'applicant',
    corroboratedCount: 0,
    contradictedCount: 0,
    unreviewedCount: 0,
    reputation: 0,
  })
  return application
}

export function decideScoutApplication(
  applicationId: string,
  decision: Extract<ScoutApplicationStatus, 'approved' | 'rejected'>,
  now: Date = new Date(),
): ScoutApplication | null {
  const application = applications.get(applicationId)
  if (!application) return null
  const next = { ...application, status: decision, decidedAt: now.toISOString() }
  applications.set(applicationId, next)

  if (decision === 'approved') {
    const current = profiles.get(application.userId)
    profiles.set(application.userId, {
      userId: application.userId,
      tier: 'scout',
      corroboratedCount: current?.corroboratedCount ?? 0,
      contradictedCount: current?.contradictedCount ?? 0,
      unreviewedCount: current?.unreviewedCount ?? 0,
      reputation: current?.reputation ?? 0,
      approvedAt: now.toISOString(),
    })
  }
  return next
}

export function recordScoutCorroboration(userId: string, result: ScoutCorroboration): ScoutProfile | null {
  const current = profiles.get(userId)
  if (!current || current.tier === 'applicant') return current ?? null

  const nextCounts = {
    corroboratedCount: current.corroboratedCount + (result === 'corroborated' ? 1 : 0),
    contradictedCount: current.contradictedCount + (result === 'contradicted' ? 1 : 0),
    unreviewedCount: current.unreviewedCount + (result === 'unreviewed' ? 1 : 0),
  }
  const reputation = computeScoutReputation(nextCounts)
  const next: ScoutProfile = {
    ...current,
    ...nextCounts,
    reputation,
    tier: deriveScoutTier({ ...current, ...nextCounts, reputation, tier: 'scout' }),
  }
  profiles.set(userId, next)
  return next
}

export function getScoutApplication(userId: string): ScoutApplication | undefined {
  return [...applications.values()].find((application) => application.userId === userId)
}

export function getScoutProfile(userId: string): ScoutProfile | undefined {
  return profiles.get(userId)
}

export function listScoutApplications(): ScoutApplication[] {
  return [...applications.values()]
}

export function clearScoutProgram(): void {
  applications.clear()
  profiles.clear()
}
