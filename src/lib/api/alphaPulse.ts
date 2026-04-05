import { web3 } from './paths'

const UA = 'binance-web3/2.1 (Skill)'

/** Pulse Alpha 榜（rankType=20）单条，含 Top10 集中度等 */
export type AlphaPulseToken = {
  symbol: string
  chainId: string
  contractAddress: string
  holders?: string
  holdersTop10Percent?: string | number
  kycHolders?: string
  marketCap?: string
  liquidity?: string
  percentChange24h?: string
  volume24h?: string
  count24h?: string
}

type PulseResponse = {
  code: string
  data?: { tokens?: AlphaPulseToken[] }
}

/**
 * 按代币简称拉取 Alpha 榜条目（用于 Top10 占比、KYC 持币人数等）。
 * 公开接口无 Top10「地址」列表，仅有 Top10 持仓占总供应比例。
 */
export async function fetchAlphaPulseToken(
  baseSymbol: string,
  signal?: AbortSignal,
): Promise<AlphaPulseToken | null> {
  const url = web3(
    '/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/pulse/unified/rank/list/ai',
  )
  const r = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'identity',
      'User-Agent': UA,
    },
    body: JSON.stringify({
      rankType: 20,
      page: 1,
      size: 40,
      keywords: [baseSymbol],
    }),
  })
  if (!r.ok) throw new Error(`Alpha Pulse ${r.status}`)
  const j = (await r.json()) as PulseResponse
  if (j.code !== '000000' || !j.data?.tokens?.length) return null
  const want = baseSymbol.toUpperCase()
  const hit = j.data.tokens.find(
    (t) => t.symbol?.toUpperCase() === want,
  )
  return hit ?? null
}
