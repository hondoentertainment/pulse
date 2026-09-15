import type { Connect, Plugin } from 'vite'

/**
 * Local Spark KV stand-in for preview / e2e builds.
 * Production Spark injects BASE_KV_SERVICE_URL via the workbench plugin (dev-only).
 * Without a define + handler, useKV throws `BASE_KV_SERVICE_URL is not defined`
 * and onboarding / claim state cannot survive a full navigation.
 */
const KV_PREFIX = '/_spark/kv'

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function createKvMiddleware() {
  const store = new Map<string, string>()

  return async function sparkKvLocal(
    req: Connect.IncomingMessage,
    res: Connect.ServerResponse,
    next: Connect.NextFunction,
  ) {
    const rawUrl = req.url ?? ''
    if (!rawUrl.startsWith(KV_PREFIX)) {
      next()
      return
    }

    const url = new URL(rawUrl, 'http://spark.local')
    const path = url.pathname.slice(KV_PREFIX.length)
    const key = decodeURIComponent(path.replace(/^\//, ''))
    const method = (req.method ?? 'GET').toUpperCase()

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')

    try {
      if (method === 'GET' && !key) {
        res.statusCode = 200
        res.end(JSON.stringify([...store.keys()]))
        return
      }

      if (method === 'GET' && key) {
        if (!store.has(key)) {
          res.statusCode = 404
          res.end('not found')
          return
        }
        res.statusCode = 200
        res.end(store.get(key))
        return
      }

      if (method === 'POST' && key) {
        const body = await readBody(req)
        store.set(key, body || 'null')
        res.statusCode = 200
        res.end(body || 'null')
        return
      }

      if (method === 'DELETE' && key) {
        store.delete(key)
        res.statusCode = 200
        res.end('')
        return
      }

      res.statusCode = 405
      res.end('method not allowed')
    } catch (error) {
      res.statusCode = 500
      res.end(error instanceof Error ? error.message : 'kv error')
    }
  }
}

export function sparkKvLocalPlugin(): Plugin {
  return {
    name: 'pulse-spark-kv-local',
    configureServer(server) {
      server.middlewares.use(createKvMiddleware())
    },
    configurePreviewServer(server) {
      server.middlewares.use(createKvMiddleware())
    },
  }
}
