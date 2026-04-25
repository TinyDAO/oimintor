import type { Connect, Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  DEFAULT_TOP_N,
  loadMarketInsights,
  normalizeTopN,
} from '../src/lib/loadSignals.ts'
import { scanVariantSignalsForInsights } from '../src/lib/scanVariantHits.ts'

function parsePathname(rawUrl: string): string | null {
  try {
    return new URL(rawUrl, 'http://localhost').pathname
  } catch {
    return null
  }
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer | string) => {
      chunks.push(typeof c === 'string' ? Buffer.from(c) : c)
    })
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

async function handleMarketInsights(
  rawUrl: string,
  res: ServerResponse,
): Promise<void> {
  const u = new URL(rawUrl, 'http://localhost')
  const parsed = parseInt(u.searchParams.get('topN') ?? '', 10)
  const topN = Number.isFinite(parsed) ? normalizeTopN(parsed) : DEFAULT_TOP_N
  const { insights, alphaHits } = await loadMarketInsights(undefined, topN)
  const body = JSON.stringify({
    topN,
    insights,
    alphaSymbols: [...alphaHits],
  })
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'private, max-age=0')
  res.end(body)
}

async function handleVariantScan(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let body: { topN?: unknown }
  try {
    body = (await readJsonBody(req)) as { topN?: unknown }
  } catch {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'Invalid JSON body' }))
    return
  }
  const raw = body.topN
  const parsed =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : typeof raw === 'string'
        ? parseInt(raw, 10)
        : NaN
  const topN = Number.isFinite(parsed) ? normalizeTopN(parsed) : DEFAULT_TOP_N
  const { insights } = await loadMarketInsights(undefined, topN)
  const hits = await scanVariantSignalsForInsights(insights, () => {})
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'private, max-age=0')
  res.end(JSON.stringify({ topN, hits }))
}

/**
 * 开发 / vite preview：同源聚合 Binance 相关接口，减少浏览器请求数。
 */
function aggregateBinanceDevMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const rawUrl = req.url
    if (!rawUrl) return next()
    const pathname = parsePathname(rawUrl)
    if (!pathname) return next()

    if (pathname === '/api/market-insights' && req.method === 'GET') {
      try {
        await handleMarketInsights(rawUrl, res)
      } catch (e) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        )
      }
      return
    }

    if (pathname === '/api/variant-scan' && req.method === 'POST') {
      try {
        await handleVariantScan(req, res)
      } catch (e) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(
          JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }),
        )
      }
      return
    }

    if (pathname === '/api/market-insights' || pathname === '/api/variant-scan') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Method Not Allowed')
      return
    }

    next()
  }
}

export function marketInsightsDevApiPlugin(): Plugin {
  const fn = aggregateBinanceDevMiddleware()
  return {
    name: 'binance-aggregate-dev-api',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(fn)
    },
    configurePreviewServer(server) {
      server.middlewares.use(fn)
    },
  }
}
