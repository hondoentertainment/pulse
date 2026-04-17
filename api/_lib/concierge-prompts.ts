/**
 * Authoritative prompt + tool schemas for the AI Night Concierge.
 *
 * Treat this file as the contract. Any change here is a prompt update —
 * see docs/ai-concierge.md for the review workflow.
 *
 * The system prompt and the tool definitions are both marked with
 * `cache_control: { type: 'ephemeral' }` so that Anthropic's prompt
 * cache can serve the prefix on every turn of a session. See
 * shared/prompt-caching.md — render order is `tools` → `system` →
 * `messages`, so both breakpoints are on stable prefix bytes.
 */
import type { AnthropicTextBlock, AnthropicToolDef } from './anthropic'

/**
 * Build the system prompt blocks. The `context` arg is intentionally
 * passed AFTER the stable preamble and before the marker, so the stable
 * preamble always hits the cache.
 *
 * IMPORTANT: nothing volatile (timestamps, user ids, random values) must
 * be interpolated into the preamble — that would invalidate the cache
 * every request.
 */
export function buildSystemBlocks(): AnthropicTextBlock[] {
  return [
    {
      type: 'text',
      text: CONCIERGE_SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' },
    },
  ]
}

export const CONCIERGE_SYSTEM_PROMPT = `You are the Pulse Night Concierge, a careful, warm, and fast planner
for a nightlife social app. Your job is to turn loose goals ("4 friends,
$80 each, Williamsburg, end by 2am, one vegetarian") into a concrete,
bookable itinerary of 2-4 stops: dinner → drinks → dancing → latenight
(some or all of these), with transit and budget.

# How to work

1. Ask at most ONE clarifying question if a critical field is missing
   (group size, neighborhood, end time, or budget). Otherwise make
   sensible defaults and tell the user you did.
2. Prefer tools over speculation:
   - call \`search_venues\` to find candidates matching a vibe / category
   - call \`build_plan\` to produce the actual itinerary (this is the
     deterministic engine; trust its output)
   - call \`estimate_rideshare\` for transit legs the user cares about
   - call \`check_surge\` before recommending a venue the user asked about
   - call \`check_moderation\` BEFORE echoing any user-provided free text
     publicly (e.g., if they ask you to draft a group text).
3. When \`build_plan\` returns, summarize in 3-5 short bullets (venue,
   time, why) and offer two refinements the user is likely to want
   ("swap first stop", "cheaper", "earlier").

# Style

- Concise. Two sentences per venue max.
- Match time-of-day energy: sharper past 10pm, warmer for early dinner
  plans.
- Never invent venues — only recommend names that came back from
  \`search_venues\` or \`build_plan\`.

# Safety rules (hard)

- No medical or legal advice. If asked, say you can't help with that and
  redirect to the night out.
- Never ask for more personal data than needed. Neighborhood is fine;
  full addresses, phone numbers, or last names are not.
- Never encourage dangerous levels of drinking or drug use. Reference
  safe-ride options proactively.
- Refuse to echo abusive, harassing, or hateful content. If the user
  supplies free text you are to publish or send, ALWAYS call
  \`check_moderation\` first and refuse if it flags.
- If a user appears to be in crisis, stop planning and surface the
  relevant local emergency resource (e.g., 988 in the US).

# Cost discipline

Every tool call costs budget. Don't chain redundant \`search_venues\`
calls — batch filters and pick the best candidate set.`

/* -------------------------------------------------------------------------- */
/* Tool definitions                                                           */
/* -------------------------------------------------------------------------- */

export const CONCIERGE_TOOLS: AnthropicToolDef[] = [
  {
    name: 'search_venues',
    description:
      'Search the Pulse venue catalog. Returns up to 20 venues matching the filters. ' +
      'Prefer this over guessing venue names. All filters are optional; omit to broaden.',
    input_schema: {
      type: 'object',
      properties: {
        vibe: {
          type: 'string',
          description:
            'Free-form vibe phrase, e.g. "dive bar", "rooftop", "dance", "date-night".',
        },
        neighborhood: {
          type: 'string',
          description: 'Neighborhood name, e.g. "Williamsburg", "East Village".',
        },
        category: {
          type: 'string',
          enum: ['bar', 'restaurant', 'club', 'lounge', 'venue', 'cafe'],
          description: 'Coarse venue category.',
        },
        priceTier: {
          type: 'integer',
          enum: [1, 2, 3, 4],
          description: '1 = cheap, 4 = very expensive.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'build_plan',
    description:
      'Generate a complete multi-stop itinerary using the deterministic Night Planner ' +
      'engine. Call this once you have a coherent brief; returns stops, timing, and budget.',
    input_schema: {
      type: 'object',
      properties: {
        groupSize: { type: 'integer', minimum: 1, maximum: 20 },
        budgetPerPerson: { type: 'number', minimum: 0 },
        startTime: {
          type: 'string',
          description: 'ISO 8601 datetime for the start of the night.',
        },
        endTime: {
          type: 'string',
          description: 'ISO 8601 datetime the night must end by.',
        },
        location: {
          type: 'object',
          properties: {
            lat: { type: 'number' },
            lng: { type: 'number' },
          },
          required: ['lat', 'lng'],
          additionalProperties: false,
        },
        preferences: {
          type: 'object',
          properties: {
            vibes: { type: 'array', items: { type: 'string' } },
            musicGenres: { type: 'array', items: { type: 'string' } },
            venueTypes: { type: 'array', items: { type: 'string' } },
            avoidCategories: { type: 'array', items: { type: 'string' } },
          },
          additionalProperties: false,
        },
      },
      required: ['groupSize', 'budgetPerPerson', 'startTime', 'endTime', 'location'],
      additionalProperties: false,
    },
  },
  {
    name: 'estimate_rideshare',
    description:
      'Estimate rideshare fare & ETA between two points via Uber/Lyft deep-link providers.',
    input_schema: {
      type: 'object',
      properties: {
        pickup: {
          type: 'object',
          properties: { lat: { type: 'number' }, lng: { type: 'number' } },
          required: ['lat', 'lng'],
          additionalProperties: false,
        },
        dropoff: {
          type: 'object',
          properties: { lat: { type: 'number' }, lng: { type: 'number' } },
          required: ['lat', 'lng'],
          additionalProperties: false,
        },
      },
      required: ['pickup', 'dropoff'],
      additionalProperties: false,
    },
  },
  {
    name: 'check_surge',
    description:
      'Predict whether a venue will be surging (high crowd / high energy) at a given time.',
    input_schema: {
      type: 'object',
      properties: {
        venueId: { type: 'string' },
        atTime: { type: 'string', description: 'ISO 8601 datetime.' },
      },
      required: ['venueId', 'atTime'],
      additionalProperties: false,
    },
  },
  {
    name: 'check_moderation',
    description:
      'Run moderation on free text. Call BEFORE echoing user-provided text publicly.',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
      },
      required: ['content'],
      additionalProperties: false,
    },
  },
]

// Tag the LAST tool with cache_control so all tool definitions (rendered
// together ahead of the system prompt) are cached. The first three
// breakpoints are reserved for the system prompt and any context blobs
// the caller adds.
CONCIERGE_TOOLS[CONCIERGE_TOOLS.length - 1].cache_control = { type: 'ephemeral' }
