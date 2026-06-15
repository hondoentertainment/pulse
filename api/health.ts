import type { RequestLike, ResponseLike } from './_lib/http'
import { handleOptions, setCors } from './_lib/http'

/**
 * Lightweight liveness probe for uptime monitors and deploy verification.
 * GET /api/health → 200 { status: "ok", ... }
 */
export default function handler(req: RequestLike, res: ResponseLike): void {
  setCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  res.status(200).json({
    status: 'ok',
    service: 'pulse',
    timestamp: new Date().toISOString(),
  })
}
