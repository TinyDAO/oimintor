import { bapi } from './paths'

/** 与 Binance `timeRange` 查询参数一致 */
export type SmartMoneyTimeRange = '30m' | '1h' | '24h' | '7d'

export const SMART_MONEY_TIME_RANGES: readonly SmartMoneyTimeRange[] = [
  '30m',
  '1h',
  '24h',
  '7d',
] as const

export type SmartMoneyFuturesRow = {
  timeRange: string
  symbol: string
  side: 'BUY' | 'SELL'
  netNotional: number
  longNotional: number
  shortNotional: number
  longTraders: number
  longWhales: number
  shortTraders: number
  shortWhales: number
  longQty: number
  shortQty: number
  longAvgEntryPrice: number
  shortAvgEntryPrice: number
}

type ListResponse = {
  code: string
  message?: string | null
  data?: SmartMoneyFuturesRow[]
}

export async function fetchSmartMoneyFuturesSignals(
  timeRange: SmartMoneyTimeRange,
  signal?: AbortSignal,
): Promise<SmartMoneyFuturesRow[]> {
  const path = `/bapi/futures/v1/public/future/smart-money/signal/list?timeRange=${encodeURIComponent(timeRange)}`
  const r = await fetch(bapi(path), { signal })
  if (!r.ok) throw new Error(`聪明钱接口 HTTP ${r.status}`)
  const j = (await r.json()) as ListResponse
  if (j.code !== '000000' || !Array.isArray(j.data)) {
    throw new Error(j.message ?? '聪明钱接口返回异常')
  }
  return j.data
}

/** GET …/smart-money/signal/overview?symbol= — 与合约页「聪明钱总览」同源 */
export type SmartMoneyOverviewData = {
  symbol: string
  /** 交易员总持仓名义（USDT，接口字段） */
  totalPositions: number
  totalTraders: number
  /** 多头名义 / 空头名义 */
  longShortRatio: number
  longTraders: number
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
  const r = await fetch(url, { signal })
  if (!r.ok) throw new Error(`聪明钱总览 HTTP ${r.status}`)
  const j = (await r.json()) as OverviewResponse
  if (j.code !== '000000' || !j.data) {
    throw new Error(j.message ?? '聪明钱总览返回异常')
  }
  return j.data
}
