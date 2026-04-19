import {
  fetchExchangeInfo,
  fetchTicker24hAll,
  fetchOpenInterestHist,
  fetchGlobalLongShort,
  fetchTopLongShortAccount,
  fetchTopLongShortPosition,
  fetchKlines,
} from './api/futures'
import {
  fetchAlphaTokenListCached,
  futuresSymbolsFromAlpha,
} from './api/alpha'
import {
  perpetualUsdtSymbols,
  filterAltUniverse,
  topSymbolsByQuoteVolume,
  tickerMap,
} from './binance/universe'
import { buildInsight, type SymbolInsight } from './signals/compute'

const PERIOD = '1h'
/** 1h K：336 ≈ 14 天（API max 500） */
const OI_LIMIT = 336
/** 多空比与 OI 同窗口 */
const RATIO_LIMIT = 336
/** 日 K 根数：8 根连续日 K，首尾收盘约跨 7 日 */
const DAILY_K_LIMIT = 8

/** 按 24h 成交额取前 N 个山寨永续；数值越大请求越多、越慢 */
export const TOP_N_CHOICES = [48, 64, 80, 100, 120, 150, 200] as const
export type TopNChoice = (typeof TOP_N_CHOICES)[number]
export const DEFAULT_TOP_N: TopNChoice = 100

export function normalizeTopN(n: number): TopNChoice {
  return (TOP_N_CHOICES as readonly number[]).includes(n)
    ? (n as TopNChoice)
    : DEFAULT_TOP_N
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

export type LoadProgress = (msg: string) => void

/** 永续合约名规范为 UPPERCASE 且以 USDT 结尾 */
export function normalizePerpSymbol(symbol: string): string {
  const u = symbol.trim().toUpperCase()
  return u.endsWith('USDT') ? u : `${u}USDT`
}

async function buildInsightForSymbol(
  sym: string,
  tmap: ReturnType<typeof tickerMap>,
  alphaHits: Set<string>,
  signal?: AbortSignal,
): Promise<SymbolInsight | null> {
  const ticker = tmap.get(sym)
  if (!ticker) return null
  if (signal?.aborted) return null
  try {
    const [oiHist, gl, ta, tp, dailyK] = await Promise.all([
      fetchOpenInterestHist(sym, PERIOD, OI_LIMIT),
      fetchGlobalLongShort(sym, PERIOD, RATIO_LIMIT),
      fetchTopLongShortAccount(sym, PERIOD, RATIO_LIMIT),
      fetchTopLongShortPosition(sym, PERIOD, RATIO_LIMIT),
      fetchKlines(sym, '1d', DAILY_K_LIMIT),
    ])
    if (signal?.aborted) return null
    return buildInsight(
      sym,
      ticker,
      dailyK,
      oiHist,
      gl,
      ta,
      tp,
      alphaHits.has(sym),
    )
  } catch {
    return null
  }
}

/** 拉取单个合约的 OI 结构洞察（与榜单同源计算），用于聪明钱列表等入口打开详情抽屉 */
export async function loadSymbolInsight(
  symbol: string,
  signal?: AbortSignal,
): Promise<SymbolInsight | null> {
  const sym = normalizePerpSymbol(symbol)
  const [info, tickers, alphaList] = await Promise.all([
    fetchExchangeInfo(),
    fetchTicker24hAll(),
    fetchAlphaTokenListCached().catch(() => []),
  ])
  if (signal?.aborted) return null
  const perp = perpetualUsdtSymbols(info.symbols)
  if (!perp.has(sym)) return null
  const tmap = tickerMap(tickers)
  const alphaHits = futuresSymbolsFromAlpha(alphaList, perp)
  return buildInsightForSymbol(sym, tmap, alphaHits, signal)
}

export async function loadMarketInsights(
  onProgress?: LoadProgress,
  topNInput: number = DEFAULT_TOP_N,
): Promise<{ insights: SymbolInsight[]; alphaHits: Set<string> }> {
  const topN = normalizeTopN(topNInput)
  onProgress?.('exchangeInfo + 24h tickers…')
  const [info, tickers, alphaList] = await Promise.all([
    fetchExchangeInfo(),
    fetchTicker24hAll(),
    fetchAlphaTokenListCached().catch(() => []),
  ])

  const perp = perpetualUsdtSymbols(info.symbols)
  const alt = filterAltUniverse(perp)
  const topSyms = topSymbolsByQuoteVolume(tickers, alt, topN)
  const tmap = tickerMap(tickers)
  const alphaHits = futuresSymbolsFromAlpha(alphaList, perp)

  onProgress?.(`深度数据 ${topSyms.length} 个合约…`)

  const insights: SymbolInsight[] = []

  const chunks: string[][] = []
  for (let i = 0; i < topSyms.length; i += 6) {
    chunks.push(topSyms.slice(i, i + 6))
  }

  for (const batch of chunks) {
    const part = await poolMap(batch, 6, async (sym) =>
      buildInsightForSymbol(sym, tmap, alphaHits),
    )
    for (const p of part) {
      if (p) insights.push(p)
    }
  }

  return { insights, alphaHits }
}
