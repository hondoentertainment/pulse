/**
 * GET /api/share/og?venueId=
 * PNG card (SVG when ?format=svg) that matches the in-app “Someone shared a venue” landing.
 * Default is PNG because iMessage, Slack, and Twitter drop SVG og:image.
 */

import {
  handlePreflight,
  methodNotAllowed,
  type RequestLike,
  type ResponseLike,
} from '../_lib/http.js'
import { loadShareNeighborhoodOg, loadShareOgEnergy } from '../_lib/share-og-lookup.js'
import { renderShareOgPng } from '../_lib/share-og-png.js'
import { parseNeighborhoodShareSlug } from '../../src/lib/neighborhood-slugs.js'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
    const formatRaw = req.query?.format
    const format = Array.isArray(formatRaw) ? formatRaw[0] : formatRaw
    const asSvg = format === 'svg'
    const nRaw = req.query?.n ?? req.query?.neighborhood
    const neighborhoodSlug = parseNeighborhoodShareSlug(Array.isArray(nRaw) ? nRaw[0] : nRaw)
    let title = 'Pulse'
    let energyLine = 'Live reviews on Pulse'
    let eyebrow = 'Someone shared a venue'
    let caption = 'I’m here · open map'
    let cta = "I'm here · open map"

    if (venueId) {
      try {
        const card = await loadShareOgEnergy(venueId)
        if (card) {
          title = card.title
          energyLine = card.energyLine
        }
      } catch {
        /* keep generic card */
      }
    } else if (neighborhoodSlug) {
      eyebrow = 'Someone shared a neighborhood'
      caption = 'Guest-safe rooms · Start here'
      cta = 'Open neighborhood'
      try {
        const card = await loadShareNeighborhoodOg(neighborhoodSlug)
        if (card) {
          title = card.title
          energyLine = card.energyLine
        }
      } catch {
        /* keep generic card */
      }
    }

    const card = { eyebrow, title, energyLine, caption, cta }
    if (asSvg) {
      writeSvg(res, renderShareSvg(card))
      return
    }
    writePng(res, renderShareOgPng({
      eyebrow,
      title,
      energyLine,
      cta,
    }))
  } catch {
    const card = {
      eyebrow: 'Someone shared a venue',
      title: 'Pulse',
      energyLine: 'Live reviews on Pulse',
      caption: 'I’m here · open map',
      cta: "I'm here · open map",
    }
    const formatRaw = req.query?.format
    const format = Array.isArray(formatRaw) ? formatRaw[0] : formatRaw
    if (format === 'svg') {
      writeSvg(res, renderShareSvg(card))
      return
    }
    writePng(res, renderShareOgPng(card))
  }
}

function renderShareSvg(input: {
  eyebrow: string
  title: string
  energyLine: string
  caption: string
  cta: string
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0a0a0d"/>
  <text x="72" y="120" fill="#8c8c94" font-family="Inter, system-ui, sans-serif" font-size="28">${escapeXml(input.eyebrow)}</text>
  <text x="72" y="220" fill="#f5f5f7" font-family="Inter, system-ui, sans-serif" font-size="64" font-weight="700">${escapeXml(input.title)}</text>
  <text x="72" y="290" fill="#fa598c" font-family="Inter, system-ui, sans-serif" font-size="32" font-weight="600">${escapeXml(input.energyLine)}</text>
  <text x="72" y="360" fill="#f5f5f7" font-family="Inter, system-ui, sans-serif" font-size="28">${escapeXml(input.caption)}</text>
  <rect x="72" y="430" width="520" height="80" rx="14" fill="#73d1ff"/>
  <text x="332" y="482" text-anchor="middle" fill="#0a0a0d" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="600">${escapeXml(input.cta)}</text>
</svg>`
}

function writeBody(res: ResponseLike, body: string | Buffer, contentType: string): void {
  res.setHeader('Content-Type', contentType)
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.status(200)
  const writable = res as ResponseLike & {
    end: (body?: string | Buffer) => void
    send?: (body: string | Buffer) => void
  }
  if (typeof writable.send === 'function') {
    writable.send(body)
    return
  }
  writable.end(body)
}

function writePng(res: ResponseLike, png: Buffer): void {
  writeBody(res, png, 'image/png')
}

function writeSvg(res: ResponseLike, svg: string): void {
  writeBody(res, svg, 'image/svg+xml; charset=utf-8')
}
