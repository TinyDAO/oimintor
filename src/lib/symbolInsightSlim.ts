import type { SymbolInsight } from './signals/compute.js'

const LIST_RATIO_POINTS = 120

function sortByTs<T extends { timestamp: number }>(rows: T[]): T[] {
  if (rows.length <= 1) return [...rows]
  return [...rows].sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * 列表聚合 API 用：去掉 OI 全序列、压缩多空比序列，将 JSON 压到 Vercel 4.5MB
 * 限制以下，避免 res.json 失败成 502。
 * 无 oiHist 行由 DetailDrawer 内 `loadSymbolInsight` 在打开时补全。
 */
export function slimSymbolInsightForList(
  i: SymbolInsight,
  ratioMax = LIST_RATIO_POINTS,
): SymbolInsight {
  const g = sortByTs(i.global)
  const ta = sortByTs(i.topAcc)
  const tp = sortByTs(i.topPos)
  return {
    ...i,
    oiHist: [],
    spreadSeries: [],
    global: g.length > ratioMax ? g.slice(-ratioMax) : g,
    topAcc: ta.length > ratioMax ? ta.slice(-ratioMax) : ta,
    topPos: tp.length > ratioMax ? tp.slice(-ratioMax) : tp,
  }
}

export function mapInsightsSlimForList(
  list: SymbolInsight[],
): SymbolInsight[] {
  return list.map(slimSymbolInsightForList)
}
