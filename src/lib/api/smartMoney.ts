import { web3 } from './paths'

const UA = 'binance-web3/1.1 (Skill)'

export type SmartMoneyRow = {
  signalId: number
  ticker: string
  direction: string
  smartMoneyCount: number
  chainId: string
  contractAddress: string
  logoUrl?: string
  currentPrice?: string
  alertPrice?: string
  maxGain?: string
  exitRate?: number
  status?: string
  tokenTag?: Record<string, { tagName: string }[]>
}

type SmartMoneyResponse = {
  code: string
  data?: SmartMoneyRow[]
  success?: boolean
}

export async function fetchSmartMoneySignals(
  chainId: '56' | 'CT_501',
  page = 1,
  pageSize = 50,
): Promise<SmartMoneyRow[]> {
  const url = web3(
    '/bapi/defi/v1/public/wallet-direct/buw/wallet/web/signal/smart-money/ai',
  )
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'identity',
      'User-Agent': UA,
    },
    body: JSON.stringify({ smartSignalType: '', page, pageSize, chainId }),
  })
  if (!r.ok) throw new Error(`Smart money ${r.status}`)
  const j = (await r.json()) as SmartMoneyResponse
  if (j.code !== '000000' || !j.data) return []
  return j.data
}

export function logoUrlFull(path?: string): string | undefined {
  if (!path) return undefined
  if (path.startsWith('http')) return path
  return `https://bin.bnbstatic.com${path}`
}
