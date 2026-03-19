type EventPayload = {
  id: string
  venueId: string
  title: string
  category?: string
  startTime: string
  endTime?: string
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
  var __eventsApiStore: EventPayload[] | undefined
}

const getStore = (): EventPayload[] => {
  if (!globalThis.__eventsApiStore) {
    globalThis.__eventsApiStore = []
  }
  return globalThis.__eventsApiStore
}

const setCors = (res: ResponseLike) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

const isValidEventPayload = (value: unknown): value is EventPayload => {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<EventPayload>
  return !!(payload.id && payload.venueId && payload.title && payload.startTime)
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
    if (!isValidEventPayload(req.body)) {
      res.status(400).json({ error: 'Invalid event payload' })
      return
    }
    store.push(req.body)
    res.status(201).json({ data: req.body })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
