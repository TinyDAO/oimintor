import type { KlineCandle, OiHistRow, RatioRow, Ticker24h } from '../api/futures'

export type SignalFlags = {
  oiSpike: boolean
  accumulation: boolean
  trendLeverage: boolean
  userTopDivergence: boolean
  spreadZ: number
}

export type SymbolInsight = {
  symbol: string
  ticker: Ticker24h
  /** 日 K 首尾收盘估算（8 根 1d ≈ 7 日跨度；新币根数少时按可得区间） */
  priceChange7dPct: number
  oiChangePct: number
  /** 最近约 7 日（168 根 1h）OI 涨跌幅 % */
  oiChange7dPct: number
  oiHist: OiHistRow[]
  global: RatioRow[]
  topAcc: RatioRow[]
  topPos: RatioRow[]
  globalLsr: number
  topPosLsr: number
  topAccLsr: number
  spread: number
  spreadSeries: { t: number; spread: number }[]
  flags: SignalFlags
  score: number
  isAlpha: boolean
}

function num(x: string): number {
  return parseFloat(x)
}

function pctChange(first: number, last: number): number {
  if (!first || !Number.isFinite(first)) return 0
  return ((last - first) / first) * 100
}

function meanStd(arr: number[]): { mean: number; std: number } {
  if (arr.length === 0) return { mean: 0, std: 0 }
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  const v =
    arr.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(arr.length, 1)
  return { mean, std: Math.sqrt(v) }
}

function zScore(x: number, arr: number[]): number {
  const { mean, std } = meanStd(arr)
  if (std < 1e-9) return 0
  return (x - mean) / std
}

function alignSpread(
  g: RatioRow[],
  top: RatioRow[],
): { t: number; spread: number }[] {
  const gm = new Map<number, number>()
  for (const r of g) gm.set(r.timestamp, num(r.longShortRatio))
  const out: { t: number; spread: number }[] = []
  for (const r of top) {
    const gv = gm.get(r.timestamp)
    if (gv === undefined) continue
    const tv = num(r.longShortRatio)
    out.push({ t: r.timestamp, spread: tv - gv })
  }
  out.sort((a, b) => a.t - b.t)
  return out
}

function divergence(g: number, top: number): boolean {
  const a = g - 1
  const b = top - 1
  return a * b < 0
}

/** 最近约 24 根 1h → 24h OI 涨跌（长历史图表下仍保持短线含义） */
function oiChangePctRolling24h(sortedOi: OiHistRow[]): number {
  if (sortedOi.length < 2) return 0
  const slice = sortedOi.length >= 24 ? sortedOi.slice(-24) : sortedOi
  const first = num(slice[0].sumOpenInterest)
  const last = num(slice[slice.length - 1].sumOpenInterest)
  return pctChange(first, last)
}

/** 最近约 168 根 1h → 7 日 OI 涨跌；历史不足时按可得区间 */
function oiChangePctRolling7d(sortedOi: OiHistRow[]): number {
  if (sortedOi.length < 2) return 0
  const slice = sortedOi.length >= 168 ? sortedOi.slice(-168) : sortedOi
  const first = num(slice[0].sumOpenInterest)
  const last = num(slice[slice.length - 1].sumOpenInterest)
  return pctChange(first, last)
}

/** 日 K 升序：最早收盘 → 最新收盘 */
export function priceChangeFromDailyKlines(candles: KlineCandle[]): number {
  if (candles.length < 2) return 0
  const sorted = [...candles].sort((a, b) => a.openTime - b.openTime)
  const first = sorted[0].close
  const last = sorted[sorted.length - 1].close
  return pctChange(first, last)
}

export function buildInsight(
  symbol: string,
  ticker: Ticker24h,
  dailyKlines: KlineCandle[],
  oiHist: OiHistRow[],
  global: RatioRow[],
  topAcc: RatioRow[],
  topPos: RatioRow[],
  isAlpha: boolean,
): SymbolInsight {
  const sortedOi = [...oiHist].sort((a, b) => a.timestamp - b.timestamp)
  const priceChange7dPct = priceChangeFromDailyKlines(dailyKlines)
  const oiChangePct = oiChangePctRolling24h(sortedOi)
  const oiChange7dPct = oiChangePctRolling7d(sortedOi)

  const gLast = global.length ? num(global[global.length - 1].longShortRatio) : 1
  const tpLast = topPos.length
    ? num(topPos[topPos.length - 1].longShortRatio)
    : 1
  const taLast = topAcc.length
    ? num(topAcc[topAcc.length - 1].longShortRatio)
    : 1

  const spread = tpLast - gLast
  const spreadSeries = alignSpread(global, topPos)
  const spreads = spreadSeries.map((x) => x.spread)
  const lastSpread = spreads.length ? spreads[spreads.length - 1] : spread
  const spreadZ = zScore(lastSpread, spreads.length > 2 ? spreads : [lastSpread])

  const priceChg = num(ticker.priceChangePercent)
  const oiSpike = oiChangePct > 18
  const accumulation =
    Math.abs(priceChg) < 4.5 && oiChangePct > 10
  const trendLeverage =
    Math.abs(priceChg) > 2 &&
    oiChangePct > 12 &&
    Math.sign(priceChg) === Math.sign(oiChangePct)
  const userTopDivergence = divergence(gLast, tpLast)

  const flags: SignalFlags = {
    oiSpike,
    accumulation,
    trendLeverage,
    userTopDivergence,
    spreadZ,
  }

  let score = 0
  if (oiSpike) score += 2
  if (accumulation) score += 3
  if (trendLeverage) score += 1
  if (userTopDivergence) score += 2
  score += Math.min(3, Math.abs(spreadZ) * 0.8)
  if (isAlpha) score += 0.5

  return {
    symbol,
    ticker,
    priceChange7dPct,
    oiChangePct,
    oiChange7dPct,
    oiHist: sortedOi,
    global,
    topAcc,
    topPos,
    globalLsr: gLast,
    topPosLsr: tpLast,
    topAccLsr: taLast,
    spread,
    spreadSeries,
    flags,
    score,
    isAlpha,
  }
}
