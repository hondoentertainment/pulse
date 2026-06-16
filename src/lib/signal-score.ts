export type DraftMetrics = {
  energy: number
  mood: number
  stress: number
  sleepQuality: number
}

/** Computes the 0–100 signal score from draft sliders. */
export function computeDraftScore(draft: DraftMetrics): number {
  const positive = draft.energy * 0.36 + draft.mood * 0.34 + draft.sleepQuality * 0.22
  const stressPenalty = draft.stress * 0.18
  return Math.max(1, Math.min(100, Math.round((positive - stressPenalty + 2) * 10)))
}

export type ScoreBucket = 'low' | 'mid' | 'high'

export function scoreBucket(score: number): ScoreBucket {
  if (score < 40) return 'low'
  if (score < 70) return 'mid'
  return 'high'
}

export function scoreBucketLabel(bucket: ScoreBucket): string {
  if (bucket === 'low') return 'Recovery mode'
  if (bucket === 'mid') return 'Steady'
  return 'Peak signal'
}

export function scoreBucketColor(bucket: ScoreBucket): string {
  if (bucket === 'low') return 'oklch(0.72 0.16 55)'
  if (bucket === 'mid') return 'oklch(0.68 0.18 195)'
  return 'oklch(0.72 0.22 145)'
}
