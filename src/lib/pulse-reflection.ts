/**
 * Client timing for pulse_created → local map / Surging reflection.
 * Samples stay in memory for a p95-friendly log. No new observability vendor.
 */

const MAX_SAMPLES = 50
const samples: number[] = []

export function reflectionPercentile(values: readonly number[], percentile: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1))
  return sorted[rank] ?? 0
}

export interface PulseReflectionSample {
  pulseId: string
  latencyMs: number
  p95Ms: number
  sampleCount: number
}

/** Latency from server `created_at` to the local cache flush that Surging reads. */
export function recordPulseReflection(input: {
  pulseId: string
  createdAt: string
  reflectedAtMs?: number
}): PulseReflectionSample | null {
  const created = Date.parse(input.createdAt)
  const reflected = input.reflectedAtMs ?? Date.now()
  if (!input.pulseId || !Number.isFinite(created)) return null
  const latencyMs = reflected - created
  if (latencyMs < 0 || latencyMs > 10 * 60 * 1000) return null
  samples.push(latencyMs)
  if (samples.length > MAX_SAMPLES) samples.shift()
  return {
    pulseId: input.pulseId,
    latencyMs,
    p95Ms: reflectionPercentile(samples, 95),
    sampleCount: samples.length,
  }
}

export function resetPulseReflectionSamples(): void {
  samples.length = 0
}

export function pulseReflectionSamples(): readonly number[] {
  return samples
}
