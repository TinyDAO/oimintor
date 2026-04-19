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
