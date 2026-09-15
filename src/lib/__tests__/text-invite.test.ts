import { describe, expect, it } from 'vitest'
import { textInviteBody, textInviteHref } from '../text-invite'

describe('text invite', () => {
  it('builds an sms: href with venue name and I’m-here URL', () => {
    const href = textInviteHref({
      venueName: 'Neumos',
      venueId: 'neumos',
      baseUrl: 'https://pulse-chi-nine.vercel.app',
    })
    expect(href.startsWith('sms:?&body=')).toBe(true)
    const body = decodeURIComponent(href.replace('sms:?&body=', ''))
    expect(body).toContain('Neumos')
    expect(body).toContain('https://pulse-chi-nine.vercel.app/venue/neumos?from=invite')
    expect(textInviteBody({
      venueName: 'Neumos',
      venueId: 'neumos',
      baseUrl: 'https://pulse-chi-nine.vercel.app',
    })).toMatch(/I’m here at Neumos/)
  })
})
