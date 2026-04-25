import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  DEFAULT_TOP_N,
  loadMarketInsights,
  normalizeTopN,
} from '../src/lib/loadSignals.js'
import { scanVariantSignalsForInsights } from '../src/lib/scanVariantHits.js'

/**
 * 服务端拉 Top N 榜单 + 1h K 线并计算 V4A/V7/V8，浏览器只发 1 次 POST。
 * POST /api/variant-scan  body: { "topN": 100 }
 */
export const config = {
  maxDuration: 120,
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  let body: { topN?: unknown }
  try {
    body =
      typeof req.body === 'string'
        ? (JSON.parse(req.body) as { topN?: unknown })
        : ((req.body ?? {}) as { topN?: unknown })
  } catch {
    return res.status(400).json({ error: { message: 'Invalid JSON body' } })
  }

  const raw = body.topN
  const parsed =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : typeof raw === 'string'
        ? parseInt(raw, 10)
        : NaN
  const topN = Number.isFinite(parsed) ? normalizeTopN(parsed) : DEFAULT_TOP_N

  try {
    const { insights } = await loadMarketInsights(undefined, topN)
    const hits = await scanVariantSignalsForInsights(insights, () => {})
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'private, max-age=0')
    return res.status(200).json({ topN, hits })
  } catch (e) {
    return res.status(502).json({
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
