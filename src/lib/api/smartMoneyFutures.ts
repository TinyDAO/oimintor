import { bapi } from './paths'

/** 与 Binance `timeRange` 查询参数一致 */
export type SmartMoneyTimeRange = '30m' | '1h' | '24h' | '7d'

export const SMART_MONEY_TIME_RANGES: readonly SmartMoneyTimeRange[] = [
  '30m',
  '1h',
  '24h',
  '7d',
] as const

/** GET …/smart-money/signal/list — 按 timeRange 聚合；long/shortNotional 为接口给出的多空名义（与 overview 持仓快照不同） */
export type SmartMoneyFuturesRow = {
  timeRange: string
  symbol: string
  side: 'BUY' | 'SELL'
  netNotional: number
  longNotional: number
  shortNotional: number
  /** 全体聪明钱人数；whales 是其中大户，勿相加 */
  longTraders: number
  /** 其中大户人数，已含在 longTraders 内，勿与全体相加 */
  longWhales: number
  shortTraders: number
  /** 其中大户人数，已含在 shortTraders 内 */
  shortWhales: number
  longQty: number
  shortQty: number
  longAvgEntryPrice: number
  shortAvgEntryPrice: number
}

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function str(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v
  if (v == null) return fallback
  return String(v)
}

/** 将 Binance JSON 行规范为 camelCase 数字；兼容 snake_case。多空名义优先采用接口字段 longNotional / shortNotional（与官网 signal/list 一致）；仅当字段缺失或非数字时用 qty×均价对齐接口口径。 */
export function normalizeSmartMoneyFuturesRow(
  raw: Record<string, unknown>,
): SmartMoneyFuturesRow {
  const longQty = num(raw.longQty ?? raw.long_qty)
  const shortQty = num(raw.shortQty ?? raw.short_qty)
  const longAvg = num(raw.longAvgEntryPrice ?? raw.long_avg_entry_price)
  const shortAvg = num(raw.shortAvgEntryPrice ?? raw.short_avg_entry_price)

  const hasLongN =
    raw.longNotional !== undefined || raw.long_notional !== undefined
  const hasShortN =
    raw.shortNotional !== undefined || raw.short_notional !== undefined

  let longNotional = num(raw.longNotional ?? raw.long_notional)
  if (!hasLongN || !Number.isFinite(longNotional)) {
    longNotional = longQty * longAvg
  }

  let shortNotional = num(raw.shortNotional ?? raw.short_notional)
  if (!hasShortN || !Number.isFinite(shortNotional)) {
    shortNotional = shortQty * shortAvg
  }

  const hasNet =
    raw.netNotional !== undefined || raw.net_notional !== undefined
  let netNotional = num(raw.netNotional ?? raw.net_notional)
  if (!hasNet || !Number.isFinite(netNotional)) {
    netNotional = longNotional - shortNotional
  }

  const sideRaw = str(raw.side).toUpperCase()
  const side: 'BUY' | 'SELL' = sideRaw === 'SELL' ? 'SELL' : 'BUY'

  return {
    timeRange: str(raw.timeRange ?? raw.time_range),
    symbol: str(raw.symbol).trim().toUpperCase(),
    side,
    netNotional,
    longNotional,
    shortNotional,
    longTraders: Math.round(num(raw.longTraders ?? raw.long_traders)),
    longWhales: Math.round(num(raw.longWhales ?? raw.long_whales)),
    shortTraders: Math.round(num(raw.shortTraders ?? raw.short_traders)),
    shortWhales: Math.round(num(raw.shortWhales ?? raw.short_whales)),
    longQty,
    shortQty,
    longAvgEntryPrice: longAvg,
    shortAvgEntryPrice: shortAvg,
  }
}

type ListResponse = {
  code: string
  message?: string | null
  data?: unknown[]
}

export async function fetchSmartMoneyFuturesSignals(
  timeRange: SmartMoneyTimeRange,
  signal?: AbortSignal,
): Promise<SmartMoneyFuturesRow[]> {
  const path = `/bapi/futures/v1/public/future/smart-money/signal/list?timeRange=${encodeURIComponent(timeRange)}`
  const r = await fetch(bapi(path), {
    signal,
    cache: 'no-store',
  })
  if (!r.ok) throw new Error(`聪明钱接口 HTTP ${r.status}`)
  const j = (await r.json()) as ListResponse
  if (j.code !== '000000' || !Array.isArray(j.data)) {
    throw new Error(j.message ?? '聪明钱接口返回异常')
  }
  return j.data.map((item) =>
    normalizeSmartMoneyFuturesRow(item as Record<string, unknown>),
  )
}

/**
 * GET …/smart-money/signal/overview?symbol= — 与合约页「聪明钱总览」同源。
 * 无 timeRange。*Traders* 为聪明钱全体，*Whales* 为其中大户（子集，不可相加）。
 * 聪明天平 / 聪明扫描的「大户名义」用 whales qty × 均价，勿与全体 qty 再加总。
 */
export type SmartMoneyOverviewData = {
  symbol: string
  /** 交易员总持仓名义（USDT，接口字段） */
  totalPositions: number
  totalTraders: number
  /** 多头数量 / 空头数量（全体聪明钱 qty，不是名义、也不是大户） */
  longShortRatio: number
  /** 多头全体人数（聪明钱 traders） */
  longTraders: number
  /** 多头其中大户人数（whales ⊂ traders） */
  longWhales: number
  longTradersQty: number
  longWhalesQty: number
  longTradersAvgEntryPrice: number
  longWhalesAvgEntryPrice: number
  shortTraders: number
  shortWhales: number
  shortTradersQty: number
  shortWhalesQty: number
  shortTradersAvgEntryPrice: number
  shortWhalesAvgEntryPrice: number
  longProfitTraders: number
  shortProfitTraders: number
  /** 其中大户浮盈人数，已含在对应 *ProfitTraders 内 */
  longProfitWhales: number
  shortProfitWhales: number
}

type OverviewResponse = {
  code: string
  message?: string | null
  data?: SmartMoneyOverviewData
  success?: boolean
}

export async function fetchSmartMoneyOverview(
  symbol: string,
  signal?: AbortSignal,
): Promise<SmartMoneyOverviewData> {
  const q = new URLSearchParams({ symbol: symbol.toUpperCase() })
  const url = bapi(
    `/bapi/futures/v1/public/future/smart-money/signal/overview?${q}`,
  )
  const r = await fetch(url, { signal, cache: 'no-store' })
  if (!r.ok) throw new Error(`聪明钱总览 HTTP ${r.status}`)
  const j = (await r.json()) as OverviewResponse
  if (j.code !== '000000' || !j.data) {
    throw new Error(j.message ?? '聪明钱总览返回异常')
  }
  return j.data
}

/**
 * trader = 聪明钱全体（接口 *Traders*）；whale = 其中大户（*Whales*，子集）。
 * all 与 trader 同义。两套不能相加，否则把大户算两遍。
 */
export type OverviewBucket = 'trader' | 'whale' | 'all'

function resolveBucket(bucket: OverviewBucket): 'trader' | 'whale' {
  return bucket === 'whale' ? 'whale' : 'trader'
}

/** overview 快照口径的多/空估算名义（仅大户：qty × 开仓均价） */
export function overviewSideNotional(
  d: SmartMoneyOverviewData,
  side: 'long' | 'short',
): number {
  return overviewSideNotionalByBucket(d, side, 'whale')
}

/** overview 快照：聪明钱全体 qty × 开仓均价 */
export function overviewSideNotionalTraders(
  d: SmartMoneyOverviewData,
  side: 'long' | 'short',
): number {
  return overviewSideNotionalByBucket(d, side, 'trader')
}

export function overviewSideQty(
  d: SmartMoneyOverviewData,
  side: 'long' | 'short',
  bucket: OverviewBucket,
): number {
  const b = resolveBucket(bucket)
  if (side === 'long') {
    return b === 'whale' ? d.longWhalesQty : d.longTradersQty
  }
  return b === 'whale' ? d.shortWhalesQty : d.shortTradersQty
}

export function overviewSideAvgEntry(
  d: SmartMoneyOverviewData,
  side: 'long' | 'short',
  bucket: OverviewBucket,
): number {
  const b = resolveBucket(bucket)
  if (b === 'whale') {
    return side === 'long' ? d.longWhalesAvgEntryPrice : d.shortWhalesAvgEntryPrice
  }
  return side === 'long' ? d.longTradersAvgEntryPrice : d.shortTradersAvgEntryPrice
}

/** 分桶估算名义：qty × 开仓均价。全体与大户是包含关系，不可相加。 */
export function overviewSideNotionalByBucket(
  d: SmartMoneyOverviewData,
  side: 'long' | 'short',
  bucket: OverviewBucket,
): number {
  return overviewSideQty(d, side, bucket) * overviewSideAvgEntry(d, side, bucket)
}

export function overviewSidePeople(
  d: SmartMoneyOverviewData,
  side: 'long' | 'short',
  bucket: OverviewBucket,
): number {
  const b = resolveBucket(bucket)
  if (side === 'long') {
    return b === 'whale' ? d.longWhales : d.longTraders
  }
  return b === 'whale' ? d.shortWhales : d.shortTraders
}

export function overviewSideProfitPeople(
  d: SmartMoneyOverviewData,
  side: 'long' | 'short',
  bucket: OverviewBucket,
): number {
  const b = resolveBucket(bucket)
  if (side === 'long') {
    return b === 'whale' ? d.longProfitWhales : d.longProfitTraders
  }
  return b === 'whale' ? d.shortProfitWhales : d.shortProfitTraders
}

/** 当前持仓名义（标记价 × qty），与开仓成本名义不同 */
export function overviewSideMarkNotional(
  d: SmartMoneyOverviewData,
  side: 'long' | 'short',
  bucket: OverviewBucket,
  mark: number,
): number {
  if (!(mark > 0)) return 0
  return overviewSideQty(d, side, bucket) * mark
}

/** 多头：当前名义 − 成本名义；空头：成本名义 − 当前名义 */
export function overviewSideUpl(
  d: SmartMoneyOverviewData,
  side: 'long' | 'short',
  bucket: OverviewBucket,
  mark: number,
): number {
  const cost = overviewSideNotionalByBucket(d, side, bucket)
  const now = overviewSideMarkNotional(d, side, bucket, mark)
  if (!(cost > 0) && !(now > 0)) return 0
  return side === 'long' ? now - cost : cost - now
}

/** 并发拉取多个 symbol 的 overview，单个失败不阻塞其它 */
export async function fetchSmartMoneyOverviews(
  symbols: string[],
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
  concurrency: number = 8,
): Promise<{
  ok: { symbol: string; data: SmartMoneyOverviewData }[]
  failed: { symbol: string; error: string }[]
}> {
  const ok: { symbol: string; data: SmartMoneyOverviewData }[] = []
  const failed: { symbol: string; error: string }[] = []
  const total = symbols.length
  let done = 0
  let i = 0
  async function worker() {
    while (true) {
      if (signal?.aborted) return
      const j = i++
      if (j >= total) return
      const sym = symbols[j]
      try {
        const data = await fetchSmartMoneyOverview(sym, signal)
        ok.push({ symbol: sym, data })
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        failed.push({
          symbol: sym,
          error: e instanceof Error ? e.message : String(e),
        })
      } finally {
        done++
        onProgress?.(done, total)
      }
    }
  }
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), total) },
    () => worker(),
  )
  await Promise.all(workers)
  return { ok, failed }
}
