import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  DEFAULT_TOP_N,
  loadMarketInsights,
  normalizeTopN,
} from '../src/lib/loadSignals.js'
import { mapInsightsSlimForList } from '../src/lib/symbolInsightSlim.js'

/**
 * 生产环境聚合 OI 榜单所需 Binance 请求，避免浏览器对 Top N 合约各打 5 路 fapi。
 * GET /api/market-insights?topN=100
 *
 * 依赖 `paths.ts` 在 Node 下直连 fapi/bapi；与 `loadMarketInsights` 逻辑同源。
 */
export const config = {
  maxDuration: 60,
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const raw = req.query.topN
  const parsed =
    typeof raw === 'string'
      ? parseInt(raw, 10)
      : Array.isArray(raw)
        ? parseInt(raw[0] ?? '', 10)
        : NaN
  const topN = Number.isFinite(parsed) ? normalizeTopN(parsed) : DEFAULT_TOP_N

  try {
    const { insights, alphaHits } = await loadMarketInsights(undefined, topN)
    const listPayload = mapInsightsSlimForList(insights)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'private, max-age=60')
    return res.status(200).json({
      topN,
      insights: listPayload,
      alphaSymbols: [...alphaHits],
    })
  } catch (e) {
    return res.status(502).json({
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
