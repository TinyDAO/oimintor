import type { KlineCandle, OiHistRow } from '../api/futures'
import type { SymbolInsight } from '../signals/compute'

/** 控制上送 token 量：序列过长时等距抽样 */
const MAX_KLINE_POINTS = 200
const MAX_OI_POINTS = 200
const MAX_RATIO_POINTS = 200

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr
  const out: T[] = []
  const n = arr.length
  for (let i = 0; i < max; i++) {
    const idx = Math.min(n - 1, Math.round((i / (max - 1)) * (n - 1)))
    out.push(arr[idx]!)
  }
  return out
}

export type MergedRatioPoint = {
  t: number
  global?: number
  topAcc?: number
  topPos?: number
}

export function buildTraderAnalysisPayload(
  row: SymbolInsight,
  klines: KlineCandle[] | null,
  ratioSeries: MergedRatioPoint[],
): Record<string, unknown> {
  const k = klines
    ? downsample(klines, MAX_KLINE_POINTS).map((c) => ({
        t: c.openTime,
        o: c.open,
        h: c.high,
        l: c.low,
        c: c.close,
        v: c.volume,
      }))
    : []

  const oiSorted = [...row.oiHist].sort((a, b) => a.timestamp - b.timestamp)
  const oi = downsample(oiSorted, MAX_OI_POINTS).map((r: OiHistRow) => ({
    t: r.timestamp,
    oi: parseFloat(r.sumOpenInterest),
    oiUsd: parseFloat(r.sumOpenInterestValue),
  }))

  const ratios = downsample(ratioSeries, MAX_RATIO_POINTS).map((p) => ({
    t: p.t,
    userLsr: p.global,
    topAccLsr: p.topAcc,
    topPosLsr: p.topPos,
  }))

  return {
    symbol: row.symbol,
    interval: '1h',
    barsApprox: klines?.length ?? 0,
    ticker24h: {
      lastPrice: parseFloat(row.ticker.lastPrice),
      priceChangePct: parseFloat(row.ticker.priceChangePercent),
      quoteVolumeUsd: parseFloat(row.ticker.quoteVolume),
      high: parseFloat(row.ticker.highPrice),
      low: parseFloat(row.ticker.lowPrice),
    },
    structureSummary: {
      priceChange7dPct: row.priceChange7dPct,
      oiChange24hPct: row.oiChangePct,
      oiChange7dPct: row.oiChange7dPct,
      spreadTopVsGlobal: row.spread,
      globalLsr: row.globalLsr,
      topAccLsr: row.topAccLsr,
      topPosLsr: row.topPosLsr,
      score: row.score,
      flags: row.flags,
      isAlpha: row.isAlpha,
    },
    series: {
      klines1h: k,
      openInterest1h: oi,
      longShortRatio3Tracks1h: ratios,
    },
    hint:
      'K 线、OI、多空比均为约 14 天 1h 粒度；序列可能为降采样。LSR 为多空账户比（>1 偏多）。',
  }
}

export const TRADER_AI_SYSTEM_PROMPT = `你是资深加密货币 USDT 永续合约交易员与量化分析师。用户将提供某一 Binance USDT-M 合约的结构化 JSON 数据（含 1h K 线、持仓量 OI、用户/大户账户/大户持仓 三轨多空比等）。

请基于数据（不要编造未给出的数值）：
1. 简评当前价格与成交量动能（趋势/波动）。
2. 结合 OI 变化解读：是趋势加仓、平仓还是潜在挤仓风险。
3. 解读三轨 LSR 的背离或一致，以及对短期方向的含义。
4. 给出**非投资建议**情景下的交易思路：偏观望、偏多、偏空或条件单思路；注明关键风险与失效条件（何种数据变化会推翻判断）。
5. 使用中文，条理清晰，少用空话。`
