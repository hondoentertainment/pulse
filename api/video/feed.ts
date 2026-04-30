/**
 * GET /api/video/feed?cursor=&limit=&lat=&lng=
 *
 * Returns a paginated, composite-scored feed of video pulses. Cache-Control is
 * set to 30s to let the CDN absorb load — the cursor is already in the URL so
 * successive pages each get their own cache key.
 */

import {
  badRequest,
  handlePreflight,
  methodNotAllowed,
  ok,
  parseQueryFloat,
  parseQueryInt,
  type RequestLike,
  type ResponseLike,
  setCors,
} from '../_lib/http'
import { listActiveVideoPulses } from '../_lib/store'
import { rankCandidates } from '../_lib/video-feed-scoring'

const MAX_LIMIT = 20
const DEFAULT_LIMIT = 10
const CACHE_SECONDS = 30

export default function handler(req: RequestLike, res: ResponseLike) {
  if (handlePreflight(req, res)) return
  setCors(res)

  if (req.method !== 'GET') {
    methodNotAllowed(res)
    return
  }

  const query = req.query ?? {}
  const limit = parseQueryInt(query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT)
  const cursor = typeof query.cursor === 'string' ? query.cursor : null
  const lat = parseQueryFloat(query.lat)
  const lng = parseQueryFloat(query.lng)

  if (lat !== null && (lat < -90 || lat > 90)) {
    badRequest(res, 'Invalid lat')
    return
  }
  if (lng !== null && (lng < -180 || lng > 180)) {
    badRequest(res, 'Invalid lng')
    return
  }

  const all = listActiveVideoPulses()
  const ranked = rankCandidates(all, { viewerLat: lat, viewerLng: lng })

  // Cursor is the id of the last item the client saw. We skip past it.
  let startIndex = 0
  if (cursor) {
    const foundAt = ranked.findIndex((r) => r.candidate.id === cursor)
    if (foundAt >= 0) startIndex = foundAt + 1
  }

  const page = ranked.slice(startIndex, startIndex + limit)
  const nextCursor = page.length === limit ? page[page.length - 1].candidate.id : null

  const items = page.map((scored) => ({
    ...scored.candidate,
    score: scored.score,
    components: scored.components,
  }))

  ok(res, { items, nextCursor, hasMore: nextCursor !== null }, CACHE_SECONDS)
}
