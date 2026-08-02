import { bapi, spot } from './paths'
import { chainExplorerTokenUrl } from '../tokenExplorer'

const UA = 'oi-monitor/1.0 (binance-spot-public)'

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
    signal,
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    const err = new Error(`${r.status} ${url} ${t.slice(0, 200)}`) as Error & {
      status: number
    }
    err.status = r.status
    throw err
  }
  return r.json() as Promise<T>
}

type ExchangeSymbolRow = {
  symbol: string
  status: string
  baseAsset: string
  quoteAsset: string
}

type ExchangeInfoResp = {
  symbols?: ExchangeSymbolRow[]
}

type NetworkCoinRow = {
  coin: string
  networkList?: NetworkCoinNetwork[]
}

type NetworkCoinNetwork = {
  network: string
  networkDisplay?: string
  name?: string
  contractAddress?: string
  depositEnable?: boolean
  withdrawEnable?: boolean
}

type NetworkCoinResp = {
  code: string
  data?: NetworkCoinRow[]
}

export type SpotTokenContractNetwork = {
  network: string
  networkDisplay: string
  contractAddress: string
  explorerUrl: string | null
}

/** Binance GET /api/v3/ticker/24hr 常用字段 */
type Ticker24hSpot = {
  symbol: string
  priceChange: string
  priceChangePercent: string
  weightedAvgPrice: string
  prevClosePrice: string
  lastPrice: string
  lastQty: string
  openPrice: string
  highPrice: string
  lowPrice: string
  volume: string
  quoteVolume: string
  openTime: number
  closeTime: number
  count: number
}

export type BinanceSpotDrawerInfo = {
  spotSymbol: string
  baseAsset: string
  quoteAsset: string
  status: string
  tradeUrl: string
  lastPrice: string
  priceChange: string
  priceChangePercent: string
  openPrice: string
  highPrice: string
  lowPrice: string
  weightedAvgPrice: string
  /** 基币成交量 24h */
  volumeBase: string
  /** 计价（USDT）成交额 24h */
  quoteVolume: string
  /** 24h 成交笔数 */
  count: number
  contractNetworks: SpotTokenContractNetwork[]
}

function spotPairFromFuturesSymbol(futuresSymbol: string): string {
  const u = futuresSymbol.trim().toUpperCase()
  if (u.endsWith('USDT')) return u
  return `${u}USDT`
}

let networkCoinCache: { at: number; data: NetworkCoinRow[] } | null = null
const NETWORK_COIN_TTL_MS = 10 * 60 * 1000

async function fetchNetworkCoinsCached(
  signal?: AbortSignal,
): Promise<NetworkCoinRow[]> {
  const now = Date.now()
  if (networkCoinCache && now - networkCoinCache.at < NETWORK_COIN_TTL_MS) {
    return networkCoinCache.data
  }

  const url = bapi('/bapi/capital/v2/public/capital/getNetworkCoinAll')
  const j = await getJson<NetworkCoinResp>(url, signal)
  const data = j.code === '000000' && Array.isArray(j.data) ? j.data : []
  networkCoinCache = { at: now, data }
  return data
}

async function fetchSpotTokenContractNetworks(
  baseAsset: string,
  signal?: AbortSignal,
): Promise<SpotTokenContractNetwork[]> {
  const rows = await fetchNetworkCoinsCached(signal)
  const want = baseAsset.trim().toUpperCase()
  const hit = rows.find((r) => r.coin?.toUpperCase() === want)
  if (!hit?.networkList?.length) return []

  return hit.networkList
    .filter((n) => n.contractAddress)
    .map((n) => ({
      network: n.network,
      networkDisplay: n.networkDisplay || n.network || n.name || '—',
      contractAddress: n.contractAddress!,
      explorerUrl: chainExplorerTokenUrl(n.network, n.contractAddress),
    }))
}

/**
 * 拉取与永续同名的 Binance 现货 USDT 交易对 24h 行情与交易规则。
 * 若现货无该交易对或已下架，返回 null（不抛错）。
 */
export async function fetchBinanceSpotMarketInfo(
  futuresSymbol: string,
  signal?: AbortSignal,
): Promise<BinanceSpotDrawerInfo | null> {
  const spotSymbol = spotPairFromFuturesSymbol(futuresSymbol)
  const qs = new URLSearchParams({ symbol: spotSymbol })

  let ex: ExchangeInfoResp
  let tick: Ticker24hSpot
  try {
    ;[ex, tick] = await Promise.all([
      getJson<ExchangeInfoResp>(
        `${spot('/api/v3/exchangeInfo')}?${qs}`,
        signal,
      ),
      getJson<Ticker24hSpot>(
        `${spot('/api/v3/ticker/24hr')}?${qs}`,
        signal,
      ),
    ])
  } catch (e: unknown) {
    const status = (e as { status?: number }).status
    const msg = e instanceof Error ? e.message : String(e)
    if (
      status === 400 ||
      msg.includes('Invalid symbol') ||
      msg.includes('-1121')
    ) {
      return null
    }
    throw e
  }

  const si = ex.symbols?.[0]
  if (!si || si.symbol !== spotSymbol) return null

  const base = si.baseAsset
  const contractNetworks = await fetchSpotTokenContractNetworks(
    base,
    signal,
  ).catch(() => [])

  return {
    spotSymbol: si.symbol,
    baseAsset: base,
    quoteAsset: si.quoteAsset,
    status: si.status,
    tradeUrl: `https://www.binance.com/zh-CN/trade/${base}_USDT?type=spot`,
    lastPrice: tick.lastPrice,
    priceChange: tick.priceChange,
    priceChangePercent: tick.priceChangePercent,
    openPrice: tick.openPrice,
    highPrice: tick.highPrice,
    lowPrice: tick.lowPrice,
    weightedAvgPrice: tick.weightedAvgPrice,
    volumeBase: tick.volume,
    quoteVolume: tick.quoteVolume,
    count: tick.count,
    contractNetworks,
  }
}
