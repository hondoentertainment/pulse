import { describe, it, expect, vi } from 'vitest'
import {
  normalizeBase64Payload,
  parseVibeAssessJson,
  assessVenueVibe,
} from '../vibe-vision'
import type { AnthropicResponse } from '../anthropic'

describe('normalizeBase64Payload', () => {
  it('parses a data URL', () => {
    const raw = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const result = normalizeBase64Payload(raw)
    expect(result?.mediaType).toBe('image/png')
    expect(result?.data.startsWith('iVBORw0KGgo')).toBe(true)
  })

  it('accepts bare base64 as jpeg', () => {
    const bare = 'a'.repeat(64)
    const result = normalizeBase64Payload(bare)
    expect(result).toEqual({ mediaType: 'image/jpeg', data: bare })
  })

  it('rejects garbage', () => {
    expect(normalizeBase64Payload('not-an-image!!!')).toBeNull()
  })
})

describe('parseVibeAssessJson', () => {
  it('parses a clean JSON object', () => {
    const result = parseVibeAssessJson(
      JSON.stringify({
        energyRating: 'buzzing',
        confidence: 0.82,
        summary: 'Crowded bar with people standing at the counters.',
        tags: ['packed-bar', 'LiveMusic', '#cocktails'],
        crowdDensity: 'moderate',
        lighting: 'dim',
        suggestedCaption: 'Solid mid-evening energy',
      }),
    )
    expect(result).toMatchObject({
      energyRating: 'buzzing',
      confidence: 0.82,
      crowdDensity: 'moderate',
      lighting: 'dim',
      suggestedCaption: 'Solid mid-evening energy',
    })
    expect(result?.tags).toEqual(['packed-bar', 'livemusic', 'cocktails'])
  })

  it('strips markdown fences and clamps confidence', () => {
    const result = parseVibeAssessJson(`\`\`\`json
{"energyRating":"electric","confidence":1.4,"summary":"Packed dance floor"}
\`\`\``)
    expect(result?.energyRating).toBe('electric')
    expect(result?.confidence).toBe(1)
  })

  it('returns null for invalid energy', () => {
    expect(parseVibeAssessJson('{"energyRating":"meh","confidence":0.5}')).toBeNull()
  })
})

describe('assessVenueVibe', () => {
  it('calls Claude with an image block and returns parsed vibe', async () => {
    const response: AnthropicResponse = {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4-6',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            energyRating: 'chill',
            confidence: 0.7,
            summary: 'Quiet lounge seating',
            tags: ['lounge'],
            crowdDensity: 'sparse',
            lighting: 'dim',
          }),
        },
      ],
      stop_reason: 'end_turn',
      usage: { input_tokens: 200, output_tokens: 40 },
    }

    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        messages: Array<{ content: unknown }>
      }
      const content = body.messages[0]?.content
      expect(Array.isArray(content)).toBe(true)
      const blocks = content as Array<{ type: string }>
      expect(blocks.some((b) => b.type === 'image')).toBe(true)
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch

    const result = await assessVenueVibe({
      apiKey: 'test-key',
      image: { type: 'url', url: 'https://cdn.example.com/venue.jpg' },
      venueName: "Joe's",
      fetchImpl,
    })

    expect(result.energyRating).toBe('chill')
    expect(result.tags).toContain('lounge')
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('rejects non-http image URLs', async () => {
    await expect(
      assessVenueVibe({
        apiKey: 'test-key',
        image: { type: 'url', url: 'ftp://evil.example/x.jpg' },
      }),
    ).rejects.toMatchObject({ status: 400 })
  })
})
