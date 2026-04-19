import type { SmartMoneyFuturesRow } from './api/smartMoneyFutures'

/** 净方向：买为正、卖为负，名义取绝对值 */
export function signedSmartMoneyNet(r: SmartMoneyFuturesRow): number {
  const m = Math.abs(r.netNotional)
  return r.side === 'BUY' ? m : -m
}

export type SmDirectionScanHit = {
  symbol: string
  /** |signed24 − signed1h|；两周期反向时等于两档净名义绝对值之和 */
  gapScore: number
  row24h: SmartMoneyFuturesRow
  row1h: SmartMoneyFuturesRow
}

export type SmDirectionScanUiState =
  | { phase: 'loading'; progress: string }
  | { phase: 'error'; progress: string; error: string }
  | {
      phase: 'done'
      progress: string
      hits: SmDirectionScanHit[]
      /** 完成时间（Unix ms） */
      doneAtMs: number
    }

/**
 * 找出 24h 与 1h 聪明钱净方向相反的合约，按 gapScore 降序。
 */
export function buildSmDirectionScanHits(
  rows24h: SmartMoneyFuturesRow[],
  rows1h: SmartMoneyFuturesRow[],
): SmDirectionScanHit[] {
  const bySym = new Map(rows1h.map((r) => [r.symbol, r]))
  const hits: SmDirectionScanHit[] = []
  for (const r24 of rows24h) {
    const r1 = bySym.get(r24.symbol)
    if (!r1) continue
    const s24 = signedSmartMoneyNet(r24)
    const s1 = signedSmartMoneyNet(r1)
    if (s24 === 0 || s1 === 0) continue
    if (s24 * s1 > 0) continue
    const gapScore = Math.abs(s24 - s1)
    hits.push({ symbol: r24.symbol, gapScore, row24h: r24, row1h: r1 })
  }
  hits.sort((a, b) => {
    if (b.gapScore !== a.gapScore) return b.gapScore - a.gapScore
    return a.symbol.localeCompare(b.symbol)
  })
  return hits
}
