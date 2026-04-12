import { cg } from './paths'

const UA = 'oi-monitor/1.0 (spot info; CoinGecko)'

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
    signal,
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`${r.status} ${url} ${t.slice(0, 120)}`)
  }
  return r.json() as Promise<T>
}

type SearchCoin = {
  id: string
  name: string
  symbol: string
  market_cap_rank?: number | null
}

type SearchRes = {
  coins?: SearchCoin[]
}

type CoinDetail = {
  id: string
  name: string
  symbol: string
  genesis_date?: string | null
  market_cap_rank?: number | null
  market_data?: {
    market_cap?: { usd?: number | null }
    fully_diluted_valuation?: { usd?: number | null }
    total_volume?: { usd?: number | null }
    circulating_supply?: number | null
    total_supply?: number | null
    max_supply?: number | null
    ath?: { usd?: number | null }
    ath_date?: { usd?: string | null }
  }
  /** 部分币种有 ICO 参考价 */
  ico_data?: {
    total_raised?: { usd?: string }
    quote_preference?: string
  }
}

type GlobalRes = {
  data?: {
    total_market_cap?: { usd?: number }
  }
}

export type SpotTokenMarketInfo = {
  coinId: string
  name: string
  symbol: string
  /** CoinGecko 页 */
  cgUrl: string
  rank: number | null
  marketCapUsd: number | null
  fdvUsd: number | null
  /** 占全球加密总市值比例 */
  marketSharePct: number | null
  volume24hUsd: number | null
  volToMcapRatioPct: number | null
  circulatingSupply: number | null
  totalSupply: number | null
  maxSupply: number | null
  genesisDate: string | null
  /** 有则展示，多为 ICO 相关汇总价 */
  icoUsdHint: string | null
  athUsd: number | null
  athDate: string | null
}

function pickCoinId(base: string, coins: SearchCoin[]): string | null {
  const u = base.toUpperCase()
  const symMatch = coins.filter((c) => c.symbol?.toUpperCase() === u)
  const pool = symMatch.length ? symMatch : []
  if (!pool.length) return null
  pool.sort((a, b) => {
    const ra = a.market_cap_rank ?? 999999
    const rb = b.market_cap_rank ?? 999999
    return ra - rb
  })
  return pool[0]?.id ?? null
}

async function searchCoinId(base: string, signal?: AbortSignal): Promise<string | null> {
  const q = new URLSearchParams({ query: base })
  const url = `${cg('/search')}?${q}`
  const j = await getJson<SearchRes>(url, signal)
  const coins = j.coins ?? []
  return pickCoinId(base, coins)
}

export async function fetchSpotTokenMarketInfo(
  baseAsset: string,
  signal?: AbortSignal,
): Promise<SpotTokenMarketInfo | null> {
  const base = baseAsset.replace(/USDT$/i, '').trim()
  if (!base) return null

  const id = await searchCoinId(base, signal)
  if (!id) return null

  const qs = new URLSearchParams({
    localization: 'false',
    tickers: 'false',
    market_data: 'true',
    community_data: 'false',
    developer_data: 'false',
    sparkline: 'false',
  })
  const [detail, global] = await Promise.all([
    getJson<CoinDetail>(`${cg(`/coins/${encodeURIComponent(id)}`)}?${qs}`, signal),
    getJson<GlobalRes>(cg('/global'), signal).catch(() => ({} as GlobalRes)),
  ])

  const md = detail.market_data
  const mcap = md?.market_cap?.usd ?? null
  const vol = md?.total_volume?.usd ?? null
  const totalGlob = global.data?.total_market_cap?.usd
  let share: number | null = null
  if (
    mcap != null &&
    Number.isFinite(mcap) &&
    totalGlob != null &&
    totalGlob > 0
  ) {
    share = (mcap / totalGlob) * 100
  }

  let volToMcap: number | null = null
  if (
    vol != null &&
    mcap != null &&
    mcap > 0 &&
    Number.isFinite(vol) &&
    Number.isFinite(mcap)
  ) {
    volToMcap = (vol / mcap) * 100
  }

  let icoHint: string | null = null
  const raised = detail.ico_data?.total_raised?.usd
  if (raised != null && raised !== '') {
    const n = parseFloat(String(raised))
    if (Number.isFinite(n)) icoHint = `$${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
  }

  const ath = md?.ath?.usd ?? null
  const athDate = md?.ath_date?.usd ?? null

  return {
    coinId: detail.id,
    name: detail.name,
    symbol: detail.symbol?.toUpperCase() ?? base.toUpperCase(),
    cgUrl: `https://www.coingecko.com/en/coins/${encodeURIComponent(detail.id)}`,
    rank: detail.market_cap_rank ?? null,
    marketCapUsd: mcap,
    fdvUsd: md?.fully_diluted_valuation?.usd ?? null,
    marketSharePct: share,
    volume24hUsd: vol,
    volToMcapRatioPct: volToMcap,
    circulatingSupply: md?.circulating_supply ?? null,
    totalSupply: md?.total_supply ?? null,
    maxSupply: md?.max_supply ?? null,
    genesisDate: detail.genesis_date ?? null,
    icoUsdHint: icoHint,
    athUsd: ath,
    athDate: athDate,
  }
}
