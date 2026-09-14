/**
 * GET /api/share/venue?venueId=
 *
 * Lightweight Open Graph card for crawlers. Humans are sent to /venue/:id.
 * Does not restore Signal push and does not invent venue energy.
 */

import {
  handlePreflight,
  methodNotAllowed,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http.js'
import { loadShareNeighborhoodOg, loadShareOgEnergy, loadShareVenueCoverUrl } from '../_lib/share-og-lookup.js'
import { parseNeighborhoodShareSlug } from '../../src/lib/neighborhood-share.js'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
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
  let ogImage = venueId
    ? `${origin}/api/share/og?venueId=${encodeURIComponent(venueId)}`
    : neighborhoodSlug
      ? `${origin}/api/share/og?n=${encodeURIComponent(neighborhoodSlug)}`
      : `${origin}/api/share/og`

  let title = 'Pulse'
  let description = 'Nightlife energy on a map — live reviews from people who are there.'
  if (venueId) {
    title = 'Venue on Pulse'
    try {
      const card = await loadShareOgEnergy(venueId)
      if (card) {
        title = card.title
        description = card.description
      }
      const cover = await loadShareVenueCoverUrl(venueId)
      if (cover) ogImage = cover
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
      }
    } catch {
      /* keep generic card */
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(target)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(target)}" />
  <link rel="canonical" href="${escapeHtml(target)}" />
</head>
<body>
  <p><a href="${escapeHtml(target)}">${escapeHtml(title)}</a></p>
</body>
</html>`

  writeHtml(res, html)
}
