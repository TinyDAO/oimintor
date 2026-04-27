import {
  fetchExchangeInfo,
  fetchTicker24hAll,
  fetchOpenInterestHist,
  fetchGlobalLongShort,
  fetchTopLongShortAccount,
  fetchTopLongShortPosition,
  fetchKlines,
} from './api/futures.js'
import {
  fetchAlphaTokenListCached,
  futuresSymbolsFromAlpha,
} from './api/alpha.js'
import {
  perpetualUsdtSymbols,
  filterAltUniverse,
  topSymbolsByQuoteVolume,
  tickerMap,
} from './binance/universe.js'
import { buildInsight, type SymbolInsight } from './signals/compute.js'

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

/**
 * 浏览器侧始终先请求同源 `/api/market-insights`（Vite dev/preview 插件或 Vercel Function），
 * 成功则只 1 次 HTTP；失败再回退到直连 /api/fapi 的多请求逻辑。
 * 设置 VITE_MARKET_INSIGHTS_AGGREGATE=0 可强制跳过聚合（调试用）。
 */
async function tryLoadMarketInsightsViaAggregate(
  onProgress: LoadProgress | undefined,
  topN: TopNChoice,
  signal: AbortSignal | undefined,
): Promise<{ insights: SymbolInsight[]; alphaHits: Set<string> } | null> {
  const g = globalThis as Record<string, unknown>
  if (typeof g.window === 'undefined' || g.window == null) return null
  const env = (import.meta as unknown as {
    env: { VITE_MARKET_INSIGHTS_AGGREGATE?: string }
  }).env
  const agg = env.VITE_MARKET_INSIGHTS_AGGREGATE
  if (agg === '0' || agg === 'false') return null
  try {
    onProgress?.('聚合接口（服务端）…')
    const r = await fetch(
      `/api/market-insights?topN=${encodeURIComponent(String(topN))}`,
      { signal, credentials: 'same-origin' },
    )
    if (!r.ok) return null
    const ct = r.headers.get('content-type') ?? ''
    if (!ct.includes('application/json')) return null
    const j = (await r.json()) as {
      insights?: SymbolInsight[]
      alphaSymbols?: string[]
    }
    if (!Array.isArray(j.insights)) return null
    onProgress?.(`深度数据 ${j.insights.length} 个合约（聚合）`)
    return {
      insights: j.insights,
      alphaHits: new Set(
        Array.isArray(j.alphaSymbols) ? j.alphaSymbols : [],
      ),
    }
  } catch {
    return null
  }
}

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
  signal?: AbortSignal,
): Promise<{ insights: SymbolInsight[]; alphaHits: Set<string> }> {
  const topN = normalizeTopN(topNInput)
  const viaApi = await tryLoadMarketInsightsViaAggregate(
    onProgress,
    topN,
    signal,
  )
  if (viaApi) return viaApi

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
