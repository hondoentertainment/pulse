/**
 * GET /api/share/og?venueId=
 * SVG card that matches the in-app “Someone shared a venue” landing.
 */

import {
  handlePreflight,
  methodNotAllowed,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http.js'
import { createAdminClient } from '../_lib/supabase-server.js'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
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
  let title = 'Pulse'
  let energyLine = 'Live reviews on Pulse'
  const caption = 'I’m here · open map'

  if (venueId) {
    try {
      const admin = createAdminClient()
      if (admin) {
        const { data } = await admin
          .from('venues')
          .select('name, neighborhood, city, category, pulse_score')
          .eq('id', venueId)
          .maybeSingle()
        if (data && typeof data.name === 'string') {
          title = data.name
          const place = [data.neighborhood, data.city].filter(Boolean).join(', ')
          energyLine = [data.category, place].filter(Boolean).join(' · ') || energyLine
        }
      }
    } catch {
      /* keep generic card */
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0F0F14"/>
  <text x="72" y="120" fill="#9E9EA8" font-family="Inter, system-ui, sans-serif" font-size="28">Someone shared a venue</text>
  <text x="72" y="220" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="64" font-weight="700">${escapeXml(title)}</text>
  <text x="72" y="290" fill="#FF2D78" font-family="Inter, system-ui, sans-serif" font-size="32" font-weight="600">${escapeXml(energyLine)}</text>
  <text x="72" y="360" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="28">${escapeXml(caption)}</text>
  <rect x="72" y="430" width="520" height="80" rx="28" fill="#FF2D78"/>
  <text x="332" y="482" text-anchor="middle" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="600">I'm here · open map</text>
</svg>`

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.status(200)
  const writable = res as ResponseLike & {
    end: (body?: string) => void
    send?: (body: string) => void
  }
  if (typeof writable.send === 'function') {
    writable.send(svg)
    return
  }
  writable.end(svg)
}
