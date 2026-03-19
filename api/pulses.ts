type PulsePayload = {
  id: string
  userId?: string
  venueId: string
  energyRating: 'dead' | 'chill' | 'buzzing' | 'electric'
  caption?: string
  createdAt?: string
}

type RequestLike = {
  method?: string
  body?: unknown
}

type ResponseLike = {
  status: (code: number) => ResponseLike
  setHeader: (name: string, value: string) => void
  json: (payload: unknown) => void
  end: () => void
}

declare global {
  var __pulseApiStore: PulsePayload[] | undefined
}

const getStore = (): PulsePayload[] => {
  if (!globalThis.__pulseApiStore) {
    globalThis.__pulseApiStore = []
  }
  return globalThis.__pulseApiStore
}

const setCors = (res: ResponseLike) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

const isValidPulsePayload = (value: unknown): value is PulsePayload => {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<PulsePayload>
  return !!(
    payload.id &&
    payload.venueId &&
    payload.energyRating &&
    ['dead', 'chill', 'buzzing', 'electric'].includes(payload.energyRating)
  )
}

export default function handler(req: RequestLike, res: ResponseLike) {
  setCors(res)

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const store = getStore()

  if (req.method === 'GET') {
    res.status(200).json({ data: store.slice(-200) })
    return
  }

  if (req.method === 'POST') {
    if (!isValidPulsePayload(req.body)) {
      res.status(400).json({ error: 'Invalid pulse payload' })
      return
    }
    const payload = {
      ...req.body,
      userId: req.body.userId ?? 'offline-user',
      createdAt: req.body.createdAt ?? new Date().toISOString(),
    }
    store.push(payload)
    res.status(201).json({ data: payload })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
