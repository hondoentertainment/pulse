/**
 * Platform fee model.
 *
 * `PLATFORM_FEE_BPS` is in basis points; default 1000 (= 10%). Override with
 * the env var of the same name in Vercel project settings.
 */

const DEFAULT_FEE_BPS = 1000

export function platformFeeBps(): number {
  const raw = process.env.PLATFORM_FEE_BPS
  if (!raw) return DEFAULT_FEE_BPS
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_FEE_BPS
}

export function calculatePlatformFeeCents(grossCents: number): number {
  if (grossCents <= 0) return 0
  const fee = Math.floor((grossCents * platformFeeBps()) / 10_000)
  return fee
}
