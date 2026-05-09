import {
  overviewSideNotional,
  type SmartMoneyOverviewData,
  type SmartMoneyTimeRange,
} from './api/smartMoneyFutures'

export type SmNotionalRatioRow = {
  symbol: string
  /** overview 快照口径：多侧大户 qty × 大户开仓均价 */
  longNotional: number
  /** overview 快照口径：空侧大户 qty × 大户开仓均价 */
  shortNotional: number
  /** longNotional / shortNotional；一侧趋近 0 时为 Infinity */
  ratioLs: number
  /** 偏多显示「x∶1」，偏空显示「1∶x」 */
  ratioLabel: string
  /** 多 − 空（USDT，带符号） */
  netNotional: number
  /** 偏多 BUY / 偏空 SELL，由 long-short 符号决定 */
  side: 'BUY' | 'SELL'
  longTraders: number
  longWhales: number
  shortTraders: number
  shortWhales: number
}

/** 聪明天平：与详情「聪明钱总览 · 估算名义」同源（overview 大户分桶 qty × 均价） */
export const SM_NOTIONAL_RATIO_SCAN_TITLE = '聪明天平'

export function computeLsRatio(longN: number, shortN: number): number {
  const L = Math.abs(longN)
  const S = Math.abs(shortN)
  if (S < 1e-12) return L > 1e-12 ? Number.POSITIVE_INFINITY : 1
  return L / S
}

/** 展示为多∶空 或 1∶空（偏空时更易读） */
export function formatRatioLabel(ratioLs: number): string {
  if (!Number.isFinite(ratioLs)) return '∞∶1'
  if (ratioLs >= 1) return `${ratioLs.toFixed(2)}∶1`
  const inv = 1 / ratioLs
  return `1∶${inv.toFixed(2)}`
}

export function rowFromOverview(d: SmartMoneyOverviewData): SmNotionalRatioRow {
  const longN = overviewSideNotional(d, 'long')
  const shortN = overviewSideNotional(d, 'short')
  const ratioLs = computeLsRatio(longN, shortN)
  const net = longN - shortN
  return {
    symbol: d.symbol,
    longNotional: longN,
    shortNotional: shortN,
    ratioLs,
    ratioLabel: formatRatioLabel(ratioLs),
    netNotional: net,
    side: net >= 0 ? 'BUY' : 'SELL',
    longTraders: d.longTraders,
    longWhales: d.longWhales,
    shortTraders: d.shortTraders,
    shortWhales: d.shortWhales,
  }
}

/** 入参：每个 symbol 的 overview 快照；按比值降序，零金额项放最末 */
export function rowsFromOverviews(
  list: { symbol: string; data: SmartMoneyOverviewData }[],
): SmNotionalRatioRow[] {
  const rows = list.map(({ data }) => rowFromOverview(data))
  rows.sort((a, b) => {
    const aZero = a.longNotional === 0 && a.shortNotional === 0
    const bZero = b.longNotional === 0 && b.shortNotional === 0
    if (aZero && !bZero) return 1
    if (!aZero && bZero) return -1
    const va = Number.isFinite(a.ratioLs) ? a.ratioLs : Number.POSITIVE_INFINITY
    const vb = Number.isFinite(b.ratioLs) ? b.ratioLs : Number.POSITIVE_INFINITY
    if (va === vb) return a.symbol.localeCompare(b.symbol)
    return vb - va
  })
  return rows
}

export type SmNotionalRatioScanUiState =
  | {
      phase: 'loading'
      progress: string
      timeRange: SmartMoneyTimeRange
    }
  | {
      phase: 'error'
      error: string
      timeRange: SmartMoneyTimeRange
    }
  | {
      phase: 'done'
      rows: SmNotionalRatioRow[]
      timeRange: SmartMoneyTimeRange
      doneAtMs: number
      /** 拉取失败的 symbol 数（不影响已完成行展示） */
      failedCount: number
      totalCount: number
    }
