import { fetchKlines } from './api/futures.js'
import { normalizeTopN } from './loadSignals.js'
import type { SymbolInsight } from './signals/compute.js'
import {
  computeVariantSignals,
  type VariantSignals,
} from './signals/variantSignals.js'

export type VariantScanHit = {
  symbol: string
  insight: SymbolInsight
  signals: VariantSignals
}

/** Drawer 内展示的扫描状态（depth 与工具栏「榜单深度」Top N 一致） */
export type VariantScanUiState =
  | { phase: 'loading'; progress: string; depth: number }
  | { phase: 'error'; progress: string; error: string; depth: number }
  | {
      phase: 'done'
      progress: string
      hits: VariantScanHit[]
      depth: number
      /** 本条结果快照时间（Unix ms），缓存命中或扫描完成时写入 */
      cachedAtMs?: number
      /** 本次打开是否未发请求、直接来自本地缓存 */
      fromCache?: boolean
    }

async function poolMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  async function worker() {
    while (true) {
      const j = i++
      if (j >= items.length) break
      out[j] = await fn(items[j])
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  )
  await Promise.all(workers)
  return out
}

const KLINE_LIMIT = 336

/**
 * 浏览器优先 POST `/api/variant-scan`（Vite 中间件或 Vercel），一次完成榜单 + K 线 + V4A/V7/V8。
 * 与 `loadSignals` 中 `VITE_MARKET_INSIGHTS_AGGREGATE=0` 同源：设为 0/false 时跳过。
 */
export async function tryScanVariantViaAggregate(
  topNInput: number,
  signal?: AbortSignal,
): Promise<VariantScanHit[] | null> {
  const g = globalThis as Record<string, unknown>
  if (typeof g.window === 'undefined' || g.window == null) return null
  const env = (import.meta as unknown as {
    env: { VITE_MARKET_INSIGHTS_AGGREGATE?: string }
  }).env
  const agg = env.VITE_MARKET_INSIGHTS_AGGREGATE
  if (agg === '0' || agg === 'false') return null
  const topN = normalizeTopN(topNInput)
  try {
    const r = await fetch('/api/variant-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topN }),
      signal,
      credentials: 'same-origin',
    })
    if (!r.ok) return null
    const ct = r.headers.get('content-type') ?? ''
    if (!ct.includes('application/json')) return null
    const j = (await r.json()) as { hits?: VariantScanHit[] }
    if (!Array.isArray(j.hits)) return null
    return j.hits
  } catch {
    return null
  }
}

/**
 * 对已有 insights 逐个拉 1h K 线后计算 V4A/V7/V8，返回至少命中一条的合约。
 */
export async function scanVariantSignalsForInsights(
  insights: SymbolInsight[],
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<VariantScanHit[]> {
  const total = insights.length
  if (total === 0) return []

  let done = 0
  const rows = await poolMap(insights, 6, async (row) => {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    const klines = await fetchKlines(row.symbol, '1h', KLINE_LIMIT, signal)
    const signals = computeVariantSignals(row, klines)
    done++
    onProgress(done, total)
    return { row, signals }
  })

  const hits: VariantScanHit[] = []
  for (const { row, signals } of rows) {
    if (
      signals.v4a.hit ||
      signals.v7.hit ||
      signals.v8.hit
    ) {
      hits.push({ symbol: row.symbol, insight: row, signals })
    }
  }
  return hits
}
