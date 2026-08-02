import {
  fetchExchangeInfo,
  fetchKlines,
  fetchTicker24hAll,
  type KlineCandle,
} from './api/futures'
import {
  perpetualUsdtSymbols,
  topSymbolsByQuoteVolume,
} from './binance/universe'

export const DAILY_VOLUME_SCAN_TITLE = '日线放量'
export const DAILY_VOLUME_MULTIPLE_THRESHOLD = 5

const CACHE_KEY_PREFIX = 'oi-monitor-daily-volume-scan-v1:'
const DAY_MS = 24 * 60 * 60 * 1000
const TREND_DAYS = 30
const RECENT_DAYS = 3
const BASELINE_DAYS = 7

export type DailyVolumeScanRow = {
  symbol: string
  multiple: number
  recent3Avg: number
  baseline7Avg: number
  candles: KlineCandle[]
}

export type DailyVolumeScanUiState =
  | { phase: 'loading'; progress: string }
  | { phase: 'error'; error: string }
  | {
      phase: 'done'
      rows: DailyVolumeScanRow[]
      totalCount: number
      failedCount: number
      doneAtMs: number
      dateKey: string
      fromCache: boolean
    }

export type DailyVolumeScanSnapshot = {
  rows: DailyVolumeScanRow[]
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

function validCandle(value: unknown): value is KlineCandle {
  if (!value || typeof value !== 'object') return false
  const candle = value as Partial<KlineCandle>
  return (
    typeof candle.openTime === 'number' &&
    typeof candle.open === 'number' &&
    typeof candle.high === 'number' &&
    typeof candle.low === 'number' &&
    typeof candle.close === 'number' &&
    typeof candle.volume === 'number'
  )
}

function validCachedRow(value: unknown): value is DailyVolumeScanRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<DailyVolumeScanRow>
  return (
    typeof row.symbol === 'string' &&
    typeof row.multiple === 'number' &&
    typeof row.recent3Avg === 'number' &&
    typeof row.baseline7Avg === 'number' &&
    Array.isArray(row.candles) &&
    row.candles.every(validCandle)
  )
}

export function readTodayDailyVolumeScan(
  nowMs = Date.now(),
): DailyVolumeScanSnapshot | null {
  if (typeof localStorage === 'undefined') return null
  const dateKey = localDateKey(nowMs)
  try {
    const raw = localStorage.getItem(cacheKey(dateKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DailyVolumeScanSnapshot>
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

export function saveDailyVolumeScan(
  result: Pick<DailyVolumeScanSnapshot, 'rows' | 'totalCount' | 'failedCount'>,
  nowMs = Date.now(),
): DailyVolumeScanSnapshot {
  const snapshot: DailyVolumeScanSnapshot = {
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

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function buildDailyVolumeScanRow(
  symbol: string,
  candles: KlineCandle[],
  nowMs = Date.now(),
): DailyVolumeScanRow | null {
  const complete = candles
    .filter(
      (c) =>
        Number.isFinite(c.openTime) &&
        Number.isFinite(c.volume) &&
        c.volume >= 0 &&
        c.openTime + DAY_MS <= nowMs,
    )
    .sort((a, b) => a.openTime - b.openTime)
    .slice(-TREND_DAYS)

  if (complete.length < RECENT_DAYS + BASELINE_DAYS) return null

  const recent = complete.slice(-RECENT_DAYS)
  const baseline = complete.slice(-(RECENT_DAYS + BASELINE_DAYS), -RECENT_DAYS)
  const recent3Avg = average(recent.map((c) => c.volume))
  const baseline7Avg = average(baseline.map((c) => c.volume))
  if (!(baseline7Avg > 0) || !Number.isFinite(recent3Avg)) return null

  const multiple = recent3Avg / baseline7Avg
  if (multiple < DAILY_VOLUME_MULTIPLE_THRESHOLD) return null

  return { symbol, multiple, recent3Avg, baseline7Avg, candles: complete }
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

export async function scanDailyVolumeSurges(
  onProgress?: (message: string) => void,
  signal?: AbortSignal,
): Promise<{
  rows: DailyVolumeScanRow[]
  totalCount: number
  failedCount: number
}> {
  onProgress?.('加载永续合约与 24h 成交额排名…')
  const [exchangeInfo, tickers] = await Promise.all([
    fetchExchangeInfo(signal),
    fetchTicker24hAll(signal),
  ])
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const universe = perpetualUsdtSymbols(exchangeInfo.symbols)
  const symbols = topSymbolsByQuoteVolume(tickers, universe, universe.size)
  let completed = 0
  let failedCount = 0

  const scanned = await poolMap(symbols, 8, async (symbol) => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const candles = await fetchKlines(symbol, '1d', TREND_DAYS + 1, signal)
      return buildDailyVolumeScanRow(symbol, candles)
    } catch (error) {
      if (signal?.aborted) throw error
      failedCount += 1
      return null
    } finally {
      completed += 1
      if (completed === symbols.length || completed % 8 === 0) {
        onProgress?.(`扫描日 K 成交量 ${completed} / ${symbols.length}…`)
      }
    }
  })

  const rows = scanned.filter((row): row is DailyVolumeScanRow => row !== null)
  rows.sort((a, b) => b.multiple - a.multiple || a.symbol.localeCompare(b.symbol))
  return { rows, totalCount: symbols.length, failedCount }
}
