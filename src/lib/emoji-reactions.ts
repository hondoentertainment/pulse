export type ReactionType = 'fire' | 'music' | 'dancing' | 'drinks' | 'electric' | 'love' | 'chill' | 'vip'

export interface ReactionEmoji {
  type: ReactionType
  emoji: string
  label: string
  color: string
}

export interface ReactionBurst {
  id: string
  type: ReactionType
  x: number
  y: number
  timestamp: number
  velocity: { x: number; y: number }
  rotation: number
  scale: number
  opacity: number
}

export const REACTION_EMOJIS: Record<ReactionType, ReactionEmoji> = {
  fire: { type: 'fire', emoji: '\u{1F525}', label: 'Fire', color: 'oklch(0.70 0.22 40)' },
  music: { type: 'music', emoji: '\u{1F3B6}', label: 'Music', color: 'oklch(0.65 0.20 280)' },
  dancing: { type: 'dancing', emoji: '\u{1F483}', label: 'Dancing', color: 'oklch(0.70 0.22 330)' },
  drinks: { type: 'drinks', emoji: '\u{1F378}', label: 'Drinks', color: 'oklch(0.65 0.18 200)' },
  electric: { type: 'electric', emoji: '\u{26A1}', label: 'Electric', color: 'oklch(0.75 0.22 85)' },
  love: { type: 'love', emoji: '\u{2764}\u{FE0F}', label: 'Love', color: 'oklch(0.60 0.25 15)' },
  chill: { type: 'chill', emoji: '\u{1F60E}', label: 'Chill', color: 'oklch(0.65 0.15 220)' },
  vip: { type: 'vip', emoji: '\u{1F451}', label: 'VIP', color: 'oklch(0.75 0.18 85)' },
}

let particleIdCounter = 0

export function createBurstParticles(
  type: ReactionType,
  originX: number,
  originY: number,
  count: number = 3
): ReactionBurst[] {
  const now = Date.now()
  const particles: ReactionBurst[] = []

  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI / 2)
    const speed = 120 + Math.random() * 180

    particles.push({
      id: `particle-${++particleIdCounter}`,
      type,
      x: originX + (Math.random() - 0.5) * 20,
      y: originY,
      timestamp: now,
      velocity: {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
      },
      rotation: (Math.random() - 0.5) * 60,
      scale: 0.8 + Math.random() * 0.4,
      opacity: 1,
    })
  }

  return particles
}

export function updateParticle(particle: ReactionBurst, deltaTime: number): ReactionBurst {
  const gravity = 180
  const airResistance = 0.97
  const fadeRate = 0.7

  const elapsed = (Date.now() - particle.timestamp) / 1000

  return {
    ...particle,
    x: particle.x + particle.velocity.x * deltaTime,
    y: particle.y + particle.velocity.y * deltaTime,
    velocity: {
      x: particle.velocity.x * airResistance,
      y: particle.velocity.y * airResistance + gravity * deltaTime,
    },
    rotation: particle.rotation + (particle.velocity.x > 0 ? 1 : -1) * 90 * deltaTime,
    scale: elapsed < 0.3 ? 1 + elapsed : Math.max(0.3, 1.3 - (elapsed - 0.3) * 0.8),
    opacity: Math.max(0, 1 - elapsed * fadeRate),
  }
}

export function isParticleExpired(particle: ReactionBurst): boolean {
  return particle.opacity <= 0.01
}

export interface ReactionCount {
  type: ReactionType
  count: number
}

export function aggregateReactions(reactions: ReactionCount[]): ReactionCount[] {
  return [...reactions]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
}

export function getReactionVelocity(tapCount: number): number {
  if (tapCount <= 1) return 3
  if (tapCount <= 3) return 5
  return 8
}

export function formatReactionCount(count: number): string {
  if (count < 1000) return String(count)
  const k = count / 1000
  if (k >= 10) return `${Math.floor(k)}K`
  const formatted = k.toFixed(1)
  return formatted.endsWith('.0') ? `${Math.floor(k)}K` : `${formatted}K`
}
