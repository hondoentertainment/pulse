import type { EnergyRating } from '@/lib/types'

export type SignalTone = 'electric' | 'buzzing' | 'chill' | 'cyan' | 'dead' | 'amber'

/** Figma AI 2026-09 tinted pills. Idle and selected share the hue; selected is stronger. */
export function signalToneClass(tone: SignalTone, pressed = false): string {
  const tones: Record<SignalTone, string> = {
    electric: pressed
      ? 'border-[rgba(250,89,140,0.7)] bg-[rgba(250,89,140,0.28)] text-[#fa598c]'
      : 'border-[rgba(250,89,140,0.55)] bg-[rgba(250,89,140,0.18)] text-[#fa598c]',
    buzzing: pressed
      ? 'border-[rgba(255,184,71,0.7)] bg-[rgba(255,184,71,0.28)] text-[#ffb847]'
      : 'border-[rgba(255,184,71,0.55)] bg-[rgba(255,184,71,0.18)] text-[#ffb847]',
    amber: pressed
      ? 'border-[rgba(255,184,71,0.7)] bg-[rgba(255,184,71,0.28)] text-[#ffb847]'
      : 'border-[rgba(255,184,71,0.55)] bg-[rgba(255,184,71,0.18)] text-[#ffb847]',
    chill: pressed
      ? 'border-[rgba(89,199,158,0.7)] bg-[rgba(89,199,158,0.28)] text-[#59c79e]'
      : 'border-[rgba(89,199,158,0.55)] bg-[rgba(89,199,158,0.18)] text-[#59c79e]',
    cyan: pressed
      ? 'border-[rgba(115,209,255,0.75)] bg-[rgba(115,209,255,0.28)] text-[#73d1ff]'
      : 'border-[rgba(115,209,255,0.55)] bg-[rgba(115,209,255,0.18)] text-[#73d1ff]',
    dead: pressed
      ? 'border-[rgba(140,140,148,0.7)] bg-[rgba(140,140,148,0.28)] text-[#c8c8d0]'
      : 'border-[rgba(140,140,148,0.55)] bg-[rgba(140,140,148,0.18)] text-[#8c8c94]',
  }
  return `border ${tones[tone]}`
}

export function toneForEnergy(rating: EnergyRating | string | undefined): SignalTone {
  if (rating === 'electric' || rating === 'buzzing' || rating === 'chill' || rating === 'dead') {
    return rating
  }
  return 'dead'
}
