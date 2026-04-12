import type { KlineCandle, OiHistRow } from '../api/futures'
import type { SymbolInsight } from './compute'

/**
 * 抽屉内展示的 V4A / V7 / V8 启发式判定（与 Autoresearch / 社区框架对应，非精确回测）。
 * 仅使用 24h ticker、1h OI 历史、可选 1h K 线。
 */

const PUMP_MIN_24H_PCT = 6
const PULLBACK_FROM_HIGH_MIN_PCT = 2.5
/** 近 24h 内 OI 峰值相对近 4 根均值的回落比例（瞬时卸仓） */
const V7_OI_DROP_FROM_PEAK_RATIO = 0.78
/** V8：近 N 根上 OI 斜率负、价格斜率正 */
const V8_WINDOW = 12
const V8_OI_SLOPE_MAX = -0.0008
const V8_PRICE_SLOPE_MIN = 0.0003

export type VariantHit = {
  hit: boolean
  /** 简短说明，便于 UI 展示 */
  reasons: string[]
}

export type VariantSignals = {
  v4a: VariantHit
  v7: VariantHit
  v8: VariantHit
  /** 子条件，便于理解 */
  meta: {
    pump24hOk: boolean
    sellPressureOk: boolean
    klinesReady: boolean
  }
}

function n(s: string): number {
  return parseFloat(s)
}

function mean(arr: number[]): number {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

/** 按小时对齐（毫秒时间戳落在同一 UTC 小时） */
function hourlyBucket(ts: number): number {
  return Math.floor(ts / 3_600_000)
}

/**
 * 取最近 window 根 OI 与 K 线收盘价（按小时对齐，不足则跳过）
 */
function alignOiClose(
  oi: OiHistRow[],
  klines: KlineCandle[],
  window: number,
): { oi: number[]; close: number[] } | null {
  const kSorted = [...klines].sort((a, b) => a.openTime - b.openTime)
  const kMap = new Map<number, number>()
  for (const k of kSorted) {
    kMap.set(hourlyBucket(k.openTime), k.close)
  }
  const oiSorted = [...oi].sort((a, b) => a.timestamp - b.timestamp)
  const pairs: { o: number; c: number }[] = []
  for (const r of oiSorted) {
    const c = kMap.get(hourlyBucket(r.timestamp))
    if (c !== undefined && Number.isFinite(c)) {
      pairs.push({ o: n(r.sumOpenInterest), c })
    }
  }
  if (pairs.length < window) return null
  const tail = pairs.slice(-window)
  return {
    oi: tail.map((x) => x.o),
    close: tail.map((x) => x.c),
  }
}

function linearSlope(y: number[]): number {
  const m = y.length
  if (m < 3) return 0
  const xMean = (m - 1) / 2
  const yMean = mean(y)
  let num = 0
  let den = 0
  for (let i = 0; i < m; i++) {
    const xd = i - xMean
    num += xd * (y[i] - yMean)
    den += xd * xd
  }
  return den > 1e-12 ? num / den : 0
}

/** 归一化斜率：相对均价，便于跨币种比较 */
function normSlope(values: number[]): number {
  const mu = mean(values.map(Math.abs))
  if (mu < 1e-12) return 0
  return linearSlope(values) / mu
}

/**
 * 短期支撑：取倒数第 4～18 根收盘最低价作参考带，当前收盘跌破则视为「跌穿」
 */
function shortTermSupportBroken(closes: number[]): boolean {
  if (closes.length < 20) return false
  const tail = closes.slice(-20)
  const current = tail[tail.length - 1]
  const supportBand = tail.slice(0, -3)
  const floor = Math.min(...supportBand)
  if (!(floor > 0)) return false
  return current < floor * 0.997
}

export function computeVariantSignals(
  row: SymbolInsight,
  klines: KlineCandle[] | null,
): VariantSignals {
  const t = row.ticker
  const priceChg24 = n(t.priceChangePercent)
  const high = n(t.highPrice)
  const last = n(t.lastPrice)
  const pullbackPct =
    high > 0 ? ((high - last) / high) * 100 : 0

  const pump24hOk = priceChg24 >= PUMP_MIN_24H_PCT
  const sellPressureOk = pullbackPct >= PULLBACK_FROM_HIGH_MIN_PCT
  const baseManip = pump24hOk && sellPressureOk

  const oiSorted = [...row.oiHist].sort((a, b) => a.timestamp - b.timestamp)
  const oiVals = oiSorted.map((r) => n(r.sumOpenInterest))

  const reasonsV7: string[] = []
  let v7Hit = false
  if (oiVals.length >= 24) {
    const last24 = oiVals.slice(-24)
    const max24 = Math.max(...last24)
    const last4 = last24.slice(-4)
    const avg4 = mean(last4)
    const ratio = max24 > 0 ? avg4 / max24 : 1
    if (baseManip && ratio < V7_OI_DROP_FROM_PEAK_RATIO) {
      v7Hit = true
      reasonsV7.push(
        `OI 峰值/近4h 均比约 ${(ratio * 100).toFixed(1)}%（< ${(V7_OI_DROP_FROM_PEAK_RATIO * 100).toFixed(0)}%）`,
      )
    } else if (!baseManip) {
      if (!pump24hOk) reasonsV7.push(`24h 涨幅 ${priceChg24.toFixed(2)}% < ${PUMP_MIN_24H_PCT}%`)
      if (!sellPressureOk) reasonsV7.push(`距 24h 高点回撤 ${pullbackPct.toFixed(2)}% < ${PULLBACK_FROM_HIGH_MIN_PCT}%`)
    } else {
      reasonsV7.push(
        `OI 峰值/近4h 均比 ${(ratio * 100).toFixed(1)}%，未达「骤降」阈值（< ${(V7_OI_DROP_FROM_PEAK_RATIO * 100).toFixed(0)}%）`,
      )
    }
  } else {
    reasonsV7.push('OI 历史不足 24 根 1h')
  }

  let v4aHit = false
  const reasonsV4a: string[] = []
  if (!baseManip) {
    if (!pump24hOk) reasonsV4a.push(`24h 涨幅 ${priceChg24.toFixed(2)}% < ${PUMP_MIN_24H_PCT}%`)
    if (!sellPressureOk) reasonsV4a.push(`距 24h 高点回撤 ${pullbackPct.toFixed(2)}% < ${PULLBACK_FROM_HIGH_MIN_PCT}%`)
  } else if (klines && klines.length >= 24) {
    const closes = [...klines]
      .sort((a, b) => a.openTime - b.openTime)
      .map((k) => k.close)
    const broken = shortTermSupportBroken(closes)
    if (broken) {
      v4aHit = true
      reasonsV4a.push('1h 收盘跌破近端支撑带')
    } else {
      reasonsV4a.push('拉盘+卖压具备，未检出明显支撑跌穿')
    }
  } else {
    reasonsV4a.push('K 线加载完整后判断支撑跌穿更准确')
  }

  let v8Hit = false
  const reasonsV8: string[] = []
  if (klines && klines.length >= 16 && oiSorted.length >= 16) {
    const aligned = alignOiClose(oiSorted, klines, V8_WINDOW)
    if (aligned) {
      const so = normSlope(aligned.oi)
      const sp = normSlope(aligned.close)
      if (so < V8_OI_SLOPE_MAX && sp > V8_PRICE_SLOPE_MIN) {
        v8Hit = true
        reasonsV8.push(
          `近 ${V8_WINDOW}h OI 下行、价格上涨（归一化斜率 OI ${so.toFixed(4)} / 价 ${sp.toFixed(4)}）`,
        )
      } else {
        reasonsV8.push(
          `近 ${V8_WINDOW}h：OI 斜率 ${so.toFixed(4)}，价格斜率 ${sp.toFixed(4)}（需 OI 降、价升）`,
        )
      }
    }
  } else {
    reasonsV8.push('需足够 1h K 线与 OI 对齐样本')
  }

  return {
    v4a: { hit: v4aHit, reasons: reasonsV4a.filter(Boolean) },
    v7: { hit: v7Hit, reasons: reasonsV7 },
    v8: { hit: v8Hit, reasons: reasonsV8 },
    meta: {
      pump24hOk,
      sellPressureOk,
      klinesReady: Boolean(klines && klines.length >= 24),
    },
  }
}
