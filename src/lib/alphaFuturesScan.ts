import { fetchAlphaTokenList, type AlphaToken } from './api/alpha'
import {
  fetchExchangeInfo,
  fetchGlobalLongShort,
  fetchKlines,
  fetchPremiumIndexAll,
  fetchTicker24hAll,
  fetchTopLongShortPosition,
  type KlineCandle,
  type PremiumIndex,
  type RatioRow,
  type Ticker24h,
} from './api/futures'
import {
  fetchSmartMoneyOverview,
  overviewSideNotionalTraders,
  type SmartMoneyOverviewData,
} from './api/smartMoneyFutures'
import { perpetualUsdtSymbols } from './binance/universe'

export const ALPHA_FUTURES_SCAN_TITLE = 'Alpha 低市值'

const CACHE_KEY_PREFIX = 'oi-monitor-alpha-futures-scan-v1:'
const DAY_MS = 24 * 60 * 60 * 1000
const TREND_DAYS = 30
const RECENT_DAYS = 3
const BASELINE_DAYS = 7

export type AlphaFuturesVolumeBar = {
  openTime: number
  volume: number
}

export type AlphaFuturesScanRow = {
  symbol: string
  alphaSymbol: string
  name: string
  marketCap: number
  holders: number | null
  priceChange24h: number | null
  fundingRate: number | null
  /** 全体账户多空比，多头账户 / 空头账户 */
  accountLongShort: number | null
  /** 大户持仓多空比，多头持仓 / 空头持仓 */
  topPositionLongShort: number | null
  /** 聪明钱全体持仓数量比，多头 qty / 空头 qty */
  smartLongShort: number | null
  smartLongTraders: number | null
  smartShortTraders: number | null
  smartLongNotional: number | null
  smartShortNotional: number | null
  quoteVolume30d: number
  /** 最近 3 个完整日成交额 / 此前 7 个完整日成交额；样本不足时为空 */
  volumeMultiple: number | null
  volumeBars: AlphaFuturesVolumeBar[]
}

export type AlphaFuturesScanUiState =
  | { phase: 'loading'; progress: string }
  | { phase: 'error'; error: string }
  | {
      phase: 'done'
      rows: AlphaFuturesScanRow[]
      totalCount: number
      failedCount: number
      doneAtMs: number
      dateKey: string
      fromCache: boolean
    }

export type AlphaFuturesScanSnapshot = {
  rows: AlphaFuturesScanRow[]
  totalCount: number
  failedCount: number
  doneAtMs: number
  dateKey: string
}

function localDateKey(ms: number): string {
  const date = new Date(ms)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function cacheKey(dateKey: string): string {
  return `${CACHE_KEY_PREFIX}${dateKey}`
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null
}

function parseLoose(value: unknown): number | null {
  if (typeof value === 'number') return finiteOrNull(value)
  if (typeof value === 'string' && value.trim() !== '') {
    return finiteOrNull(parseFloat(value))
  }
  return null
}

function validBar(value: unknown): value is AlphaFuturesVolumeBar {
  if (!value || typeof value !== 'object') return false
  const bar = value as Partial<AlphaFuturesVolumeBar>
  return typeof bar.openTime === 'number' && typeof bar.volume === 'number'
}

function validCachedRow(value: unknown): value is AlphaFuturesScanRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<AlphaFuturesScanRow>
  return (
    typeof row.symbol === 'string' &&
    typeof row.alphaSymbol === 'string' &&
    typeof row.name === 'string' &&
    typeof row.marketCap === 'number' &&
    typeof row.quoteVolume30d === 'number' &&
    Array.isArray(row.volumeBars) &&
    row.volumeBars.every(validBar)
  )
}

export function readTodayAlphaFuturesScan(
  nowMs = Date.now(),
): AlphaFuturesScanSnapshot | null {
  if (typeof localStorage === 'undefined') return null
  const dateKey = localDateKey(nowMs)
  try {
    const raw = localStorage.getItem(cacheKey(dateKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AlphaFuturesScanSnapshot>
    if (
      parsed.dateKey !== dateKey ||
      typeof parsed.doneAtMs !== 'number' ||
      typeof parsed.totalCount !== 'number' ||
      typeof parsed.failedCount !== 'number' ||
      !Array.isArray(parsed.rows) ||
      !parsed.rows.every(validCachedRow)
    ) {
      return null
    }
    return {
      dateKey,
      doneAtMs: parsed.doneAtMs,
      totalCount: parsed.totalCount,
      failedCount: parsed.failedCount,
      rows: parsed.rows,
    }
  } catch {
    return null
  }
}

export function saveAlphaFuturesScan(
  result: Pick<AlphaFuturesScanSnapshot, 'rows' | 'totalCount' | 'failedCount'>,
  nowMs = Date.now(),
): AlphaFuturesScanSnapshot {
  const snapshot: AlphaFuturesScanSnapshot = {
    ...result,
    dateKey: localDateKey(nowMs),
    doneAtMs: nowMs,
  }
  try {
    localStorage.setItem(cacheKey(snapshot.dateKey), JSON.stringify(snapshot))
  } catch {
    /* localStorage 不可用或容量不足时仍展示本次扫描结果 */
  }
  return snapshot
}

function matchFuturesSymbol(
  alphaSymbol: string,
  perpetual: Set<string>,
): { symbol: string; rank: number } | null {
  const base = alphaSymbol.trim().toUpperCase()
  if (!base) return null
  const exact = `${base}USDT`
  if (perpetual.has(exact)) return { symbol: exact, rank: 0 }
  return null
}

type UniverseRow = {
  symbol: string
  alphaSymbol: string
  name: string
  marketCap: number
  holders: number | null
  matchRank: number
}

function buildUniverse(
  tokens: AlphaToken[],
  perpetual: Set<string>,
): UniverseRow[] {
  const bySymbol = new Map<string, UniverseRow>()
  for (const token of tokens) {
    if (!token.symbol) continue
    const matched = matchFuturesSymbol(token.symbol, perpetual)
    if (!matched) continue
    const marketCap = parseLoose(token.marketCap) ?? 0
    const next: UniverseRow = {
      symbol: matched.symbol,
      alphaSymbol: token.symbol,
      name: token.name?.trim() || token.symbol,
      marketCap: marketCap > 0 ? marketCap : 0,
      holders: parseLoose(token.holders),
      matchRank: matched.rank,
    }
    const prev = bySymbol.get(matched.symbol)
    if (!prev) {
      bySymbol.set(matched.symbol, next)
      continue
    }
    const betterRank = next.matchRank < prev.matchRank
    const sameRankRicher =
      next.matchRank === prev.matchRank && next.marketCap > prev.marketCap
    if (betterRank || sameRankRicher) bySymbol.set(matched.symbol, next)
  }
  return Array.from(bySymbol.values()).sort((a, b) => {
    const aCap = a.marketCap > 0 ? a.marketCap : Number.POSITIVE_INFINITY
    const bCap = b.marketCap > 0 ? b.marketCap : Number.POSITIVE_INFINITY
    if (aCap !== bCap) return aCap - bCap
    return a.symbol.localeCompare(b.symbol)
  })
}

function latestRatio(rows: RatioRow[]): number | null {
  const row = rows.at(-1)
  if (!row) return null
  const value = parseFloat(row.longShortRatio)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

function completeQuoteBars(candles: KlineCandle[], nowMs: number): AlphaFuturesVolumeBar[] {
  return candles
    .filter(
      (c) =>
        Number.isFinite(c.openTime) &&
        Number.isFinite(c.quoteVolume) &&
        c.quoteVolume >= 0 &&
        c.openTime + DAY_MS <= nowMs,
    )
    .sort((a, b) => a.openTime - b.openTime)
    .slice(-TREND_DAYS)
    .map((c) => ({ openTime: c.openTime, volume: c.quoteVolume }))
}

function volumeMultiple(bars: AlphaFuturesVolumeBar[]): number | null {
  if (bars.length < RECENT_DAYS + BASELINE_DAYS) return null
  const recent = bars.slice(-RECENT_DAYS)
  const baseline = bars.slice(-(RECENT_DAYS + BASELINE_DAYS), -RECENT_DAYS)
  const recentAvg = recent.reduce((sum, bar) => sum + bar.volume, 0) / recent.length
  const baselineAvg =
    baseline.reduce((sum, bar) => sum + bar.volume, 0) / baseline.length
  if (!(baselineAvg > 0) || !Number.isFinite(recentAvg)) return null
  return recentAvg / baselineAvg
}

function tickerChange(ticker: Ticker24h | undefined): number | null {
  if (!ticker) return null
  return parseLoose(ticker.priceChangePercent)
}

function fundingOf(row: PremiumIndex | undefined): number | null {
  if (!row) return null
  return parseLoose(row.lastFundingRate)
}

function asNum(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function smartFields(data: SmartMoneyOverviewData | null): Pick<
  AlphaFuturesScanRow,
  | 'smartLongShort'
  | 'smartLongTraders'
  | 'smartShortTraders'
  | 'smartLongNotional'
  | 'smartShortNotional'
> {
  if (!data) {
    return {
      smartLongShort: null,
      smartLongTraders: null,
      smartShortTraders: null,
      smartLongNotional: null,
      smartShortNotional: null,
    }
  }
  const normalized: SmartMoneyOverviewData = {
    ...data,
    longShortRatio: asNum(data.longShortRatio),
    longTraders: asNum(data.longTraders),
    shortTraders: asNum(data.shortTraders),
    longTradersQty: asNum(data.longTradersQty),
    shortTradersQty: asNum(data.shortTradersQty),
    longTradersAvgEntryPrice: asNum(data.longTradersAvgEntryPrice),
    shortTradersAvgEntryPrice: asNum(data.shortTradersAvgEntryPrice),
  }
  const ratio = normalized.longShortRatio
  const longNotional = overviewSideNotionalTraders(normalized, 'long')
  const shortNotional = overviewSideNotionalTraders(normalized, 'short')
  return {
    smartLongShort: Number.isFinite(ratio) && ratio > 0 ? ratio : null,
    smartLongTraders: normalized.longTraders,
    smartShortTraders: normalized.shortTraders,
    smartLongNotional: longNotional > 0 ? longNotional : null,
    smartShortNotional: shortNotional > 0 ? shortNotional : null,
  }
}

async function poolMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let cursor = 0
  async function worker() {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      out[index] = await fn(items[index], index)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return out
}

export async function scanAlphaFutures(
  onProgress?: (message: string) => void,
  signal?: AbortSignal,
): Promise<{
  rows: AlphaFuturesScanRow[]
  totalCount: number
  failedCount: number
}> {
  onProgress?.('加载 Alpha 列表与 USDT 永续合约…')
  const [tokens, exchangeInfo, tickers, premiums] = await Promise.all([
    fetchAlphaTokenList(),
    fetchExchangeInfo(signal),
    fetchTicker24hAll(signal),
    fetchPremiumIndexAll(signal),
  ])
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const universe = buildUniverse(tokens, perpetualUsdtSymbols(exchangeInfo.symbols))
  const tickerBySymbol = new Map(tickers.map((t) => [t.symbol, t]))
  const premiumBySymbol = new Map(premiums.map((p) => [p.symbol, p]))
  let completed = 0
  let failedCount = 0

  const scanned = await poolMap(universe, 3, async (item) => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const [candles, accountRows, topPosRows, overview] = await Promise.all([
        fetchKlines(item.symbol, '1d', TREND_DAYS + 1, signal),
        fetchGlobalLongShort(item.symbol, '5m', 1, signal).catch(() => [] as RatioRow[]),
        fetchTopLongShortPosition(item.symbol, '5m', 1, signal).catch(
          () => [] as RatioRow[],
        ),
        fetchSmartMoneyOverview(item.symbol, signal).catch(() => null),
      ])
      const volumeBars = completeQuoteBars(candles, Date.now())
      const row: AlphaFuturesScanRow = {
        symbol: item.symbol,
        alphaSymbol: item.alphaSymbol,
        name: item.name,
        marketCap: item.marketCap,
        holders: item.holders,
        priceChange24h: tickerChange(tickerBySymbol.get(item.symbol)),
        fundingRate: fundingOf(premiumBySymbol.get(item.symbol)),
        accountLongShort: latestRatio(accountRows),
        topPositionLongShort: latestRatio(topPosRows),
        ...smartFields(overview),
        quoteVolume30d: volumeBars.reduce((sum, bar) => sum + bar.volume, 0),
        volumeMultiple: volumeMultiple(volumeBars),
        volumeBars,
      }
      return row
    } catch (error) {
      if (signal?.aborted) throw error
      failedCount += 1
      return null
    } finally {
      completed += 1
      if (completed === universe.length || completed % 6 === 0) {
        onProgress?.(`拉取成交额与多空比 ${completed} / ${universe.length}…`)
      }
      if (!signal?.aborted) {
        await new Promise((resolve) => setTimeout(resolve, 280))
      }
    }
  })

  const rows = scanned.filter((row): row is AlphaFuturesScanRow => row !== null)
  rows.sort((a, b) => {
    const aCap = a.marketCap > 0 ? a.marketCap : Number.POSITIVE_INFINITY
    const bCap = b.marketCap > 0 ? b.marketCap : Number.POSITIVE_INFINITY
    if (aCap !== bCap) return aCap - bCap
    return a.symbol.localeCompare(b.symbol)
  })
  return { rows, totalCount: universe.length, failedCount }
}
