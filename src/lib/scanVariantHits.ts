import { fetchKlines } from './api/futures'
import type { SymbolInsight } from './signals/compute'
import {
  computeVariantSignals,
  type VariantSignals,
} from './signals/variantSignals'

export type VariantScanHit = {
  symbol: string
  insight: SymbolInsight
  signals: VariantSignals
}

/** Drawer 内展示的扫描状态（depth 与工具栏「榜单深度」Top N 一致） */
export type VariantScanUiState =
  | { phase: 'loading'; progress: string; depth: number }
  | { phase: 'error'; progress: string; error: string; depth: number }
  | { phase: 'done'; progress: string; hits: VariantScanHit[]; depth: number }

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
