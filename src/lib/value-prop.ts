/**
 * Canonical end-user value prop — one promise everywhere.
 * Investors and users should hear the same sentence.
 */

export const VALUE_PROP = {
  brand: 'Pulse',
  market: 'Seattle',
  /** Primary promise (headline) */
  headline: 'Stop guessing where to go tonight.',
  /** One supporting sentence */
  subhead:
    "Live tips from people on the floor — they fade in 90 minutes, so you only see what's real right now.",
  /** Short meta / share line */
  tagline: "Know where it's actually live — before you leave the house.",
  /** CTA */
  primaryCta: "See what's live",
  secondaryCta: 'Browse the map',
  /** How it works (below fold) */
  steps: [
    {
      title: 'Pick a vibe',
      body: 'Dead, Chill, Buzzing, or Electric — tell Pulse what you want tonight.',
    },
    {
      title: 'Read live reviews',
      body: 'Short tips with energy, wait, and crowd — stamped fresh, gone in 90 minutes.',
    },
    {
      title: 'Go with confidence',
      body: 'Directions in one tap. After you arrive, fix the tip if it changed.',
    },
  ],
  /** Contrast vs stale review apps */
  differentiator:
    'Not last month’s reviews. Not pretty photos with no answer. What’s happening now.',
  /** SEO */
  titleDefault: 'Pulse — Stop guessing where to go tonight',
  titleWelcome: 'Pulse — Live nightlife tips for Seattle right now',
  descriptionDefault:
    'Pulse shows live nightlife tips that fade in 90 minutes. Pick a vibe, see what’s actually packed, and go — before you waste the night.',
} as const

export function tonightHeaderCopy(): { eyebrow: string; title: string; subtitle: string } {
  return {
    eyebrow: `Tonight · ${VALUE_PROP.market}`,
    title: "What's live right now",
    subtitle: 'Pick a vibe. Trust tips that fade in 90 minutes. Go.',
  }
}
