import type { SymbolInsight } from './signals/compute'
import {
  fetchExchangeInfo,
  fetchGlobalLongShort,
  fetchTopLongShortAccount,
  fetchTopLongShortPosition,
  type RatioRow,
} from './api/futures'
import { perpetualUsdtSymbols } from './binance/universe'

export const RETAIL_WHALE_DIVERGENCE_SCAN_TITLE = '散户大户背离'

export type RetailWhaleDivergenceKind =
  | 'whaleLongRetailShort'
  | 'whaleShortRetailLong'

export type RetailWhaleDivergenceRow = {
  symbol: string
  insight?: SymbolInsight
  kind: RetailWhaleDivergenceKind
  userLsr: number
  topPosLsr: number
  topAccLsr: number
  /** 对 1 的双侧偏离强度；用 log 保持 2 vs 0.5 这类镜像偏离公平 */
  divergenceScore: number
  /** 大户持仓 LSR 与用户 LSR 的绝对差，作为次级排序和展示 */
  ratioGap: number
  timestamp: number | null
}

export type RetailWhaleDivergenceScanUiState =
  | { phase: 'loading'; progress: string }
  | { phase: 'error'; error: string }
  | {
      phase: 'done'
      rows: RetailWhaleDivergenceRow[]
      totalCount: number
      failedCount: number
      doneAtMs: number
    }

function validLsr(n: number): boolean {
  return Number.isFinite(n) && n > 0
}

function divergenceScore(userLsr: number, topPosLsr: number): number {
  return Math.abs(Math.log(userLsr)) + Math.abs(Math.log(topPosLsr))
}

function latestRatio(rows: RatioRow[]): { value: number; timestamp: number } | null {
  const row = rows.at(-1)
  if (!row) return null
  const value = parseFloat(row.longShortRatio)
  if (!validLsr(value)) return null
  return { value, timestamp: row.timestamp }
}

function divergenceKind(
  userLsr: number,
  topPosLsr: number,
): RetailWhaleDivergenceKind | null {
  if (topPosLsr > 1 && userLsr < 1) return 'whaleLongRetailShort'
  if (topPosLsr < 1 && userLsr > 1) return 'whaleShortRetailLong'
  return null
}

function sortRows(rows: RetailWhaleDivergenceRow[]) {
  rows.sort((a, b) => {
    if (b.divergenceScore !== a.divergenceScore) {
      return b.divergenceScore - a.divergenceScore
    }
    if (b.ratioGap !== a.ratioGap) return b.ratioGap - a.ratioGap
    return a.symbol.localeCompare(b.symbol)
  })
}

export function buildRetailWhaleDivergenceRows(
  insights: SymbolInsight[],
): RetailWhaleDivergenceRow[] {
  const rows: RetailWhaleDivergenceRow[] = []

  for (const insight of insights) {
    const userLsr = insight.globalLsr
    const topPosLsr = insight.topPosLsr
    if (!validLsr(userLsr) || !validLsr(topPosLsr)) continue

    const kind = divergenceKind(userLsr, topPosLsr)
    if (!kind) continue

    const latestTs = Math.max(
      insight.global.at(-1)?.timestamp ?? Number.NEGATIVE_INFINITY,
      insight.topPos.at(-1)?.timestamp ?? Number.NEGATIVE_INFINITY,
    )

    rows.push({
      symbol: insight.symbol,
      insight,
      kind,
      userLsr,
      topPosLsr,
      topAccLsr: insight.topAccLsr,
      divergenceScore: divergenceScore(userLsr, topPosLsr),
      ratioGap: Math.abs(topPosLsr - userLsr),
      timestamp: Number.isFinite(latestTs) ? latestTs : null,
    })
  }

  sortRows(rows)

  return rows
}


async function poolMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let cursor = 0
  async function worker() {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      out[index] = await fn(items[index])
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return out
}

export async function scanRetailWhaleDivergences(
  onProgress?: (message: string) => void,
  signal?: AbortSignal,
): Promise<{
  rows: RetailWhaleDivergenceRow[]
  totalCount: number
  failedCount: number
}> {
  onProgress?.('加载全部 USDT-M 永续合约…')
  const exchangeInfo = await fetchExchangeInfo(signal)
  const symbols = [...perpetualUsdtSymbols(exchangeInfo.symbols)].sort()
  let completed = 0
  let failedCount = 0

  const scanned = await poolMap<string, RetailWhaleDivergenceRow | null>(
    symbols,
    8,
    async (symbol) => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const [globalRows, topPosRows] = await Promise.all([
        fetchGlobalLongShort(symbol, '1h', 1, signal),
        fetchTopLongShortPosition(symbol, '1h', 1, signal),
      ])
      const user = latestRatio(globalRows)
      const topPos = latestRatio(topPosRows)
      if (!user || !topPos) return null
      const kind = divergenceKind(user.value, topPos.value)
      if (!kind) return null

      const topAccRows = await fetchTopLongShortAccount(symbol, '1h', 1, signal)
      const topAcc = latestRatio(topAccRows)
      return {
        symbol,
        kind,
        userLsr: user.value,
        topPosLsr: topPos.value,
        topAccLsr: topAcc?.value ?? Number.NaN,
        divergenceScore: divergenceScore(user.value, topPos.value),
        ratioGap: Math.abs(topPos.value - user.value),
        timestamp: Math.max(user.timestamp, topPos.timestamp),
      } satisfies RetailWhaleDivergenceRow
    } catch (error) {
      if (signal?.aborted) throw error
      failedCount += 1
      return null
    } finally {
      completed += 1
      if (completed === symbols.length || completed % 8 === 0) {
        onProgress?.(`扫描多空比 ${completed} / ${symbols.length}…`)
      }
    }
    },
  )

  const rows = scanned.filter(
    (row): row is RetailWhaleDivergenceRow => row !== null,
  )
  sortRows(rows)
  return { rows, totalCount: symbols.length, failedCount }
}
