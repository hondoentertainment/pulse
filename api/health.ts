type RequestLike = {
  method?: string
}

type ResponseLike = {
  status: (code: number) => ResponseLike
  setHeader: (name: string, value: string) => void
  json: (payload: unknown) => void
  end: () => void
}

/**
 * Lightweight liveness probe for uptime monitors and deploy verification.
 * GET /api/health → 200 { status: "ok", ... }
 */
export default function handler(req: RequestLike, res: ResponseLike): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

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
