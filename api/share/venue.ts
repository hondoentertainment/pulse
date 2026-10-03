/**
 * GET /api/share/venue?venueId=
 *
 * Lightweight Open Graph card for crawlers. Humans are sent to /venue/:id#energy
 * with a script, not a meta refresh — crawlers that follow a refresh would
 * land on index.html and lose the venue name. The image stays the PNG energy
 * card (name + freshness), not a cover photo. Does not restore Signal.
 */

import {
  handlePreflight,
  methodNotAllowed,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http.js'
import { loadShareNeighborhoodOg, loadShareOgEnergy } from '../_lib/share-og-lookup.js'
import { SHARE_OG_HEIGHT, SHARE_OG_WIDTH } from '../_lib/share-og-png.js'
import { parseNeighborhoodShareSlug } from '../../src/lib/neighborhood-slugs.js'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function originFromReq(req: RequestLike): string {
  const proto = typeof req.headers?.['x-forwarded-proto'] === 'string'
    ? req.headers['x-forwarded-proto']
    : 'https'
  const host = typeof req.headers?.host === 'string' ? req.headers.host : 'pulse-chi-nine.vercel.app'
  return `${proto}://${host}`
}

function writeHtml(res: ResponseLike, html: string, status = 200): void {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=120')
  res.status(status)
  const writable = res as ResponseLike & {
    end: (body?: string) => void
    send?: (body: string) => void
  }
  if (typeof writable.send === 'function') {
    writable.send(html)
    return
  }
  writable.end(html)
}

export default async function handler(
  req: RequestLike,
  res: ResponseLike,
): Promise<void> {
  if (handlePreflight(req, res)) return
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET'])
    return
  }

  try {
    const raw = req.query?.venueId
    const venueId = Array.isArray(raw) ? raw[0] : raw
    const nRaw = req.query?.n ?? req.query?.neighborhood
    const neighborhoodSlug = parseNeighborhoodShareSlug(Array.isArray(nRaw) ? nRaw[0] : nRaw)
    const origin = originFromReq(req)
    const fromRaw = req.query?.from
    const from = Array.isArray(fromRaw) ? fromRaw[0] : fromRaw
    const landingFrom = from === 'invite' ? 'invite' : 'share'
    const target = venueId
      ? `${origin}/venue/${encodeURIComponent(venueId)}?from=${landingFrom}`
      : neighborhoodSlug
        ? `${origin}/n/${encodeURIComponent(neighborhoodSlug)}`
        : `${origin}/?here=${encodeURIComponent(venueId ?? '')}`
    const humanUrl = venueId && landingFrom === 'share' ? `${target}#energy` : target
    const ogImage = venueId
      ? `${origin}/api/share/og?venueId=${encodeURIComponent(venueId)}`
      : neighborhoodSlug
        ? `${origin}/api/share/og?n=${encodeURIComponent(neighborhoodSlug)}`
        : `${origin}/api/share/og`
    const selfUrl = venueId
      ? `${origin}/api/share/venue?venueId=${encodeURIComponent(venueId)}${landingFrom === 'invite' ? '&from=invite' : ''}`
      : neighborhoodSlug
        ? `${origin}/api/share/venue?n=${encodeURIComponent(neighborhoodSlug)}`
        : `${origin}/api/share/venue`

    let title = 'Pulse'
    let description = 'Nightlife energy on a map — live reviews from people who are there.'
    let energyLine = 'Live reviews on Pulse'
    if (venueId) {
      title = 'Venue on Pulse'
      try {
        const card = await loadShareOgEnergy(venueId)
        if (card) {
          title = card.title
          description = card.description
          energyLine = card.energyLine
        }
      } catch {
        /* keep generic card */
      }
    } else if (neighborhoodSlug) {
      title = 'Neighborhood on Pulse'
      try {
        const card = await loadShareNeighborhoodOg(neighborhoodSlug)
        if (card) {
          title = card.title
          description = card.description
          energyLine = card.energyLine
        }
      } catch {
        /* keep generic card */
      }
    }

    const html = renderShareHtml({
      title,
      description,
      energyLine,
      image: ogImage,
      pageUrl: selfUrl,
      humanUrl,
    })

    writeHtml(res, html)
  } catch {
    const origin = originFromReq(req)
    writeHtml(res, renderShareHtml({
      title: 'Pulse',
      description: 'Nightlife energy on a map — live reviews from people who are there.',
      energyLine: 'Live reviews on Pulse',
      image: `${origin}/api/share/og`,
      pageUrl: origin,
      humanUrl: origin,
    }))
  }
}

function renderShareHtml(input: {
  title: string
  description: string
  energyLine: string
  image: string
  pageUrl: string
  humanUrl: string
}): string {
  const title = escapeHtml(input.title)
  const description = escapeHtml(input.description)
  const energyLine = escapeHtml(input.energyLine)
  const image = escapeHtml(input.image)
  const pageUrl = escapeHtml(input.pageUrl)
  const humanUrl = escapeHtml(input.humanUrl)
  const scriptTarget = JSON.stringify(input.humanUrl).replace(/</g, '\\u003c')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="${SHARE_OG_WIDTH}" />
  <meta property="og:image:height" content="${SHARE_OG_HEIGHT}" />
  <meta property="og:image:alt" content="${energyLine}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="twitter:image:alt" content="${energyLine}" />
  <link rel="canonical" href="${pageUrl}" />
</head>
<body>
  <p><a href="${humanUrl}">${title}</a></p>
  <script>location.replace(${scriptTarget})</script>
</body>
</html>`
}
