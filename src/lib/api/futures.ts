import { fapi } from './paths'

const UA_FUTURES = 'binance-derivatives-trading-usds-futures/1.1.0 (Skill)'

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA_FUTURES },
    signal,
  })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} ${url}`)
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

export async function fetchExchangeInfo(): Promise<ExchangeInfo> {
  return getJson<ExchangeInfo>(fapi('/fapi/v1/exchangeInfo'))
}

export type Ticker24h = {
  symbol: string
  lastPrice: string
  priceChangePercent: string
  quoteVolume: string
  highPrice: string
  lowPrice: string
}

export async function fetchTicker24hAll(): Promise<Ticker24h[]> {
  return getJson<Ticker24h[]>(fapi('/fapi/v1/ticker/24hr'))
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
): Promise<RatioRow[]> {
  const q = new URLSearchParams({ symbol, period, limit: String(limit) })
  return getJson<RatioRow[]>(
    `${fapi('/futures/data/globalLongShortAccountRatio')}?${q}`,
  )
}

export async function fetchTopLongShortAccount(
  symbol: string,
  period: string,
  limit = 30,
): Promise<RatioRow[]> {
  const q = new URLSearchParams({ symbol, period, limit: String(limit) })
  return getJson<RatioRow[]>(
    `${fapi('/futures/data/topLongShortAccountRatio')}?${q}`,
  )
}

export async function fetchTopLongShortPosition(
  symbol: string,
  period: string,
  limit = 30,
): Promise<RatioRow[]> {
  const q = new URLSearchParams({ symbol, period, limit: String(limit) })
  return getJson<RatioRow[]>(
    `${fapi('/futures/data/topLongShortPositionRatio')}?${q}`,
  )
}
