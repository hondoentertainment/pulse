/**
 * POST /api/push/register
 * Register (or refresh) a native push token for the authenticated user.
 *
 * Body: { token: string, platform: 'ios' | 'android', deviceId?: string, appVersion?: string }
 */
import { getAuthenticatedUserId } from '../_lib/auth'

type RequestLike = {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

type ResponseLike = {
  status: (code: number) => ResponseLike
  setHeader: (name: string, value: string) => void
  json: (payload: unknown) => void
  end: () => void
}

interface RegisterBody {
  token?: string
  platform?: 'ios' | 'android'
  deviceId?: string
  appVersion?: string
  userId?: string
}

const setCors = (res: ResponseLike) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

const isValid = (body: unknown): body is Required<Pick<RegisterBody, 'token' | 'platform'>> & RegisterBody => {
  if (!body || typeof body !== 'object') return false
  const b = body as RegisterBody
  return (
    typeof b.token === 'string' &&
    b.token.length > 0 &&
    (b.platform === 'ios' || b.platform === 'android')
  )
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  setCors(res)

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const userId = getAuthenticatedUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (!isValid(req.body)) {
    res.status(400).json({ error: 'Invalid payload — require { token, platform }' })
    return
  }

  const body = req.body
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE

  // Dev / local fallback: no Supabase config — accept the registration and
  // return success so the client can continue. Real installs must set envs.
  if (!supabaseUrl || !supabaseKey) {
    console.info('[push/register] log-only (Supabase env missing)', {
      userId,
      platform: body.platform,
    })
    res.status(200).json({ data: { registered: true, logOnly: true } })
    return
  }

  try {
    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/push_tokens?on_conflict=user_id,token`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        user_id: userId,
        token: body.token,
        platform: body.platform,
        device_id: body.deviceId ?? null,
        app_version: body.appVersion ?? null,
        last_seen_at: new Date().toISOString(),
      }),
    })

    if (!upsertRes.ok) {
      const text = await upsertRes.text()
      console.error('[push/register] upsert failed', upsertRes.status, text)
      res.status(502).json({ error: 'Upstream error' })
      return
    }

    res.status(200).json({ data: { registered: true } })
  } catch (err) {
    console.error('[push/register] error', err)
    res.status(500).json({ error: 'Internal error' })
  }
}
