import { fapi } from './paths.js'

const UA_FUTURES = 'binance-derivatives-trading-usds-futures/1.1.0 (Skill)'

/** 币安用 HTTP 418 + code -1003 表示 IP 被临时封禁，不是路由错误。 */
export class BinanceRequestError extends Error {
  readonly banUntilMs: number | null

  constructor(message: string, banUntilMs: number | null) {
    super(message)
    this.name = 'BinanceRequestError'
    this.banUntilMs = banUntilMs
  }
}

function banUntilFrom(body: string, retryAfter: string | null): number | null {
  const match = body.match(/until (\d{13})/)
  if (match) {
    const until = Number(match[1])
    if (Number.isFinite(until)) return until
  }
  const seconds = retryAfter ? Number(retryAfter) : NaN
  if (Number.isFinite(seconds) && seconds > 0) return Date.now() + seconds * 1000
  return null
}

function banMessage(untilMs: number): string {
  const minutes = Math.max(1, Math.ceil((untilMs - Date.now()) / 60000))
  const clock = new Date(untilMs).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `币安合约接口限流：当前 IP 请求过多，大约 ${minutes} 分钟后（${clock}）恢复。在此之前刷新或重新扫描会把封禁延长。`
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA_FUTURES },
    signal,
  })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    const banUntilMs = banUntilFrom(body, r.headers.get('retry-after'))
    if (banUntilMs) throw new BinanceRequestError(banMessage(banUntilMs), banUntilMs)
    let detail = ''
    try {
      const parsed = JSON.parse(body) as { msg?: string }
      if (parsed.msg) detail = parsed.msg
    } catch {
      detail = ''
    }
    throw new BinanceRequestError(
      detail ? `${r.status} ${detail}` : `${r.status} ${r.statusText} ${url}`,
      null,
    )
  }
  return r.json() as Promise<T>
}

export type ExchangeSymbol = {
  symbol: string
  contractType: string
  quoteAsset: string
  status: string
}

export type ExchangeInfo = {
  symbols: ExchangeSymbol[]
}

export async function fetchExchangeInfo(signal?: AbortSignal): Promise<ExchangeInfo> {
  return getJson<ExchangeInfo>(fapi('/fapi/v1/exchangeInfo'), signal)
}

export type Ticker24h = {
  symbol: string
  lastPrice: string
  priceChangePercent: string
  quoteVolume: string
  highPrice: string
  lowPrice: string
}

export async function fetchTicker24hAll(signal?: AbortSignal): Promise<Ticker24h[]> {
  return getJson<Ticker24h[]>(fapi('/fapi/v1/ticker/24hr'), signal)
}

/** 指数价、标记价等（USDT-M 永续） */
export type PremiumIndex = {
  symbol: string
  markPrice: string
  indexPrice: string
  lastFundingRate: string
  nextFundingTime: number
  time: number
}

export async function fetchPremiumIndex(
  symbol: string,
  signal?: AbortSignal,
): Promise<PremiumIndex> {
  const q = new URLSearchParams({ symbol })
  return getJson<PremiumIndex>(
    `${fapi('/fapi/v1/premiumIndex')}?${q}`,
    signal,
  )
}

/** 不带 symbol：全部 USDT-M 标记价 */
export async function fetchPremiumIndexAll(
  signal?: AbortSignal,
): Promise<PremiumIndex[]> {
  const data = await getJson<PremiumIndex | PremiumIndex[]>(
    fapi('/fapi/v1/premiumIndex'),
    signal,
  )
  return Array.isArray(data) ? data : [data]
}

/** Binance 合约指数成分（各所现货/指数源及权重） */
export type IndexConstituentRow = {
  exchange: string
  symbol: string
  price: string
  weight: string
}

export type IndexConstituents = {
  symbol: string
  time: number
  constituents: IndexConstituentRow[]
}

export async function fetchIndexConstituents(
  symbol: string,
  signal?: AbortSignal,
): Promise<IndexConstituents> {
  const q = new URLSearchParams({ symbol })
  return getJson<IndexConstituents>(
    `${fapi('/fapi/v1/constituents')}?${q}`,
    signal,
  )
}

export type OiHistRow = {
  symbol: string
  sumOpenInterest: string
  sumOpenInterestValue: string
  timestamp: number
}

export async function fetchOpenInterestHist(
  symbol: string,
  period: '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d' = '1h',
  limit = 30,
): Promise<OiHistRow[]> {
  const q = new URLSearchParams({ symbol, period, limit: String(limit) })
  return getJson<OiHistRow[]>(
    `${fapi('/futures/data/openInterestHist')}?${q}`,
  )
}

/** USDT-M K 线（与 OI 同周期便于对照） */
export type KlineCandle = {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  /** 成交数量（标的基币，Binance kline 第 6 字段） */
  volume: number
  /** 成交额（计价币，USDT 永续为 USDT，Binance kline 第 8 字段） */
  quoteVolume: number
}

type RawKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
]

export async function fetchKlines(
  symbol: string,
  interval:
    | '1m'
    | '3m'
    | '5m'
    | '15m'
    | '30m'
    | '1h'
    | '2h'
    | '4h'
    | '6h'
    | '8h'
    | '12h'
    | '1d'
    | '3d'
    | '1w'
    | '1M' = '1h',
  limit = 336,
  signal?: AbortSignal,
): Promise<KlineCandle[]> {
  const q = new URLSearchParams({
    symbol,
    interval,
    limit: String(limit),
  })
  const rows = await getJson<RawKline[]>(
    `${fapi('/fapi/v1/klines')}?${q}`,
    signal,
  )
  return rows.map((k) => ({
    openTime: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    quoteVolume: parseFloat(k[7]),
  }))
}

export type RatioRow = {
  symbol: string
  longAccount: string
  shortAccount: string
  longShortRatio: string
  timestamp: number
}

export async function fetchGlobalLongShort(
  symbol: string,
  period: string,
  limit = 30,
  signal?: AbortSignal,
): Promise<RatioRow[]> {
  const q = new URLSearchParams({ symbol, period, limit: String(limit) })
  return getJson<RatioRow[]>(
    `${fapi('/futures/data/globalLongShortAccountRatio')}?${q}`,
    signal,
  )
}

export async function fetchTopLongShortAccount(
  symbol: string,
  period: string,
  limit = 30,
  signal?: AbortSignal,
): Promise<RatioRow[]> {
  const q = new URLSearchParams({ symbol, period, limit: String(limit) })
  return getJson<RatioRow[]>(
    `${fapi('/futures/data/topLongShortAccountRatio')}?${q}`,
    signal,
  )
}

export async function fetchTopLongShortPosition(
  symbol: string,
  period: string,
  limit = 30,
  signal?: AbortSignal,
): Promise<RatioRow[]> {
  const q = new URLSearchParams({ symbol, period, limit: String(limit) })
  return getJson<RatioRow[]>(
    `${fapi('/futures/data/topLongShortPositionRatio')}?${q}`,
    signal,
  )
}
