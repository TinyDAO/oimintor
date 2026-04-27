import { bapi } from './paths.js'

const UA = 'binance-alpha/1.1.0 (Skill)'

/** CEX Alpha 全量列表单项（字段随接口扩展，均为可选除 symbol） */
export type AlphaToken = {
  symbol: string
  name?: string
  tokenId?: string
  chainId?: string
  chainName?: string
  contractAddress?: string
  alphaId?: string
  holders?: string
  marketCap?: string
  fdv?: string
  liquidity?: string
  circulatingSupply?: string
  totalSupply?: string
  percentChange24h?: string
  volume24h?: string
  count24h?: string
  decimals?: number
  listingTime?: number
  score?: number
}

let alphaListCache: { at: number; data: AlphaToken[] } | null = null
const ALPHA_LIST_TTL_MS = 5 * 60 * 1000

export async function fetchAlphaTokenListCached(): Promise<AlphaToken[]> {
  const now = Date.now()
  if (alphaListCache && now - alphaListCache.at < ALPHA_LIST_TTL_MS) {
    return alphaListCache.data
  }
  const data = await fetchAlphaTokenList()
  alphaListCache = { at: now, data }
  return data
}

export function findAlphaTokenByBaseSymbol(
  list: AlphaToken[],
  baseSymbol: string,
): AlphaToken | undefined {
  const u = baseSymbol.toUpperCase()
  return list.find((t) => t.symbol?.toUpperCase() === u)
}

type AlphaListResponse = {
  code: string
  data?: AlphaToken[]
  success?: boolean
}

export async function fetchAlphaTokenList(): Promise<AlphaToken[]> {
  const url = bapi(
    '/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list',
  )
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`Alpha list ${r.status}`)
  const j = (await r.json()) as AlphaListResponse
  if (j.code !== '000000' || !j.data) return []
  return j.data
}

export function futuresSymbolsFromAlpha(
  tokens: AlphaToken[],
  perpetualUsdt: Set<string>,
): Set<string> {
  const hit = new Set<string>()
  for (const t of tokens) {
    if (!t.symbol) continue
    const sym = `${t.symbol}USDT`
    if (perpetualUsdt.has(sym)) hit.add(sym)
  }
  return hit
}
