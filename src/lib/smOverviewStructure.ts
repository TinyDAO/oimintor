import {
  smOverviewLongShortRatio,
  type SmOverviewValueScanRow,
  type SmOverviewValueSide,
} from './smOverviewValueScan'

export type SmStructureKind =
  | 'core'
  | 'strong'
  | 'crowded'
  | 'watch'
  | 'decay'
  | 'fresh'
  | 'other'

export type SmStructureHit = {
  row: SmOverviewValueScanRow
  kind: SmStructureKind
  why: string
  lsRatio?: number
  uplPct?: number
}

export type SmStructureBucket = {
  kind: SmStructureKind
  items: SmStructureHit[]
}

export const SM_STRUCTURE_ORDER: SmStructureKind[] = [
  'core',
  'strong',
  'crowded',
  'watch',
  'decay',
  'fresh',
  'other',
]

/**
 * 聪明钱多空比（traders qty），不是全市场账户比。
 * 聪明钱比散户更一边倒才有意义：1.2x 在全市场算偏多，在这里只是噪声。
 */
const DOMINANT_BIAS = 2
const STRONG_BIAS = 4
const CROWDED_BIAS = 8
/** 浮盈很厚、比硬线稍低也算拥挤出货盘 */
const CROWDED_RICH_BIAS = 6
const CROWDED_RICH_UPL = 0.3
/** 聪明钱对侧很薄时比值会虚高，拥挤必须有足够名义 */
const CROWD_MIN_NOTIONAL = 10_000_000
const CROWD_MIN_STRENGTH = 8_000_000
/** 聪明钱均价更好，-20% 才算被套 */
const DECAY_UPL_PCT = -0.2
const STRONG_UPL_PCT = 0.2
const SOFT_RED_UPL_PCT = -0.08

/** 本侧数量 / 对侧数量；缺接口比时回退名义比 */
export function smStructureSideBias(
  row: SmOverviewValueScanRow,
): number | undefined {
  const ls = smOverviewLongShortRatio(row)
  if (ls != null && ls > 0) {
    return row.side === 'long' ? ls : 1 / ls
  }
  if (row.oppositeNotional > 0) return row.notional / row.oppositeNotional
  if (row.notional > 0) return Number.POSITIVE_INFINITY
  return undefined
}

export function smStructureUplPct(
  row: SmOverviewValueScanRow,
): number | undefined {
  if (row.uplPct != null && Number.isFinite(row.uplPct)) return row.uplPct
  return undefined
}

/** 币圈习惯：2.77x，不是股票里的 2.769∶1 长格式 */
export function formatStructureLs(ls: number | undefined): string {
  if (ls == null || !Number.isFinite(ls)) return '—'
  return `${ls.toFixed(2)}x`
}

export function formatStructureUsd(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const a = Math.abs(n)
  const core =
    a >= 1e9 ? `$${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `$${(a / 1e3).toFixed(1)}k` : `$${a.toFixed(0)}`
  return n < 0 ? `−${core}` : core
}

export function smStructureStrength(row: SmOverviewValueScanRow): number {
  return row.notional - row.oppositeNotional
}

export function formatStructureUplPct(pct: number | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '—'
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : ''
  return `${sign}${(Math.abs(pct) * 100).toFixed(1)}%`
}

export function smStructureMeta(
  kind: SmStructureKind,
  side: SmOverviewValueSide,
): { mark: string; label: string; read: string } {
  const who = side === 'long' ? '多头' : '空头'
  switch (kind) {
    case 'core':
      return {
        mark: '🟢',
        label: '核心趋势',
        read: `聪明钱${who}占优（多空比 ≥ 2），浮盈未亏，没有明显减仓`,
      }
    case 'strong':
      return {
        mark: '🟢',
        label: '强势趋势',
        read: `聪明钱多空比 ≥ 4 且浮盈 ≥ +20%，还在加仓`,
      }
    case 'crowded':
      return {
        mark: '🟡',
        label: '高风险拥挤',
        read: `聪明钱多空比 ≥ 8 且本侧够大（名义 ≥ $10M、强度 ≥ $8M）；对侧太薄只算一边倒，不算拥挤`,
      }
    case 'watch':
      return {
        mark: '🟡',
        label: '观察',
        read: `聪明钱还占优，浮亏没到 -20%，但在减仓或盘面变弱`,
      }
    case 'decay':
      return {
        mark: '🔴',
        label: `${who}结构恶化`,
        read: `还占优，但浮盈 ≤ -20%（聪明钱被套）或大幅减仓`,
      }
    case 'fresh':
      return {
        mark: '🆕',
        label: '新资金',
        read: '今天新上榜的聪明钱，更像轮动/新叙事，还不是稳趋势',
      }
    default:
      return {
        mark: '⚪',
        label: '其他',
        read: '聪明钱多空比没到 2x，或浮盈缺失，先不当趋势看',
      }
  }
}

function metricWhy(
  base: string,
  lsRatio: number | undefined,
  uplPct: number | undefined,
  strengthUsd: number,
): string {
  return `${base} · 多空 ${formatStructureLs(lsRatio)} · 强度 ${formatStructureUsd(strengthUsd)} · 浮盈 ${formatStructureUplPct(uplPct)}`
}

export function classifySmStructureRow(
  row: SmOverviewValueScanRow,
): Omit<SmStructureHit, 'row'> {
  const lsRatio = smOverviewLongShortRatio(row)
  const bias = smStructureSideBias(row)
  const uplPct = smStructureUplPct(row)
  const strengthUsd = smStructureStrength(row)
  const notionalDominant = row.notional >= row.oppositeNotional
  const ratioDominant = bias != null && bias >= DOMINANT_BIAS
  const dominant = ratioDominant || (bias == null && notionalDominant)
  const delta = row.deltaFromYesterday
  const outflow = delta != null && delta < 0
  const inflow = delta != null && delta > 0
  const largeOut = Boolean(row.hasLargeDiff && outflow)
  const largeIn = Boolean(row.hasLargeDiff && inflow)
  const decayByPct = uplPct != null && uplPct <= DECAY_UPL_PCT
  const softRed =
    uplPct != null && uplPct > DECAY_UPL_PCT && uplPct < SOFT_RED_UPL_PCT
  const healthyPct = uplPct != null && uplPct >= 0
  const strongPct = uplPct != null && uplPct >= STRONG_UPL_PCT
  const crowdSize =
    row.notional >= CROWD_MIN_NOTIONAL && strengthUsd >= CROWD_MIN_STRENGTH
  const crowded =
    dominant &&
    crowdSize &&
    bias != null &&
    (bias >= CROWDED_BIAS ||
      (bias >= CROWDED_RICH_BIAS &&
        uplPct != null &&
        uplPct >= CROWDED_RICH_UPL))

  const hit = (kind: SmStructureKind, base: string): Omit<SmStructureHit, 'row'> => ({
    kind,
    why: metricWhy(base, lsRatio, uplPct, strengthUsd),
    lsRatio,
    uplPct,
  })

  if (!dominant) {
    return hit('other', '多空比没占优，先当震荡')
  }
  if (decayByPct || largeOut) {
    const base =
      decayByPct && largeOut
        ? '浮亏超过 20% 且聪明钱大幅减仓'
        : decayByPct
          ? '浮盈 ≤ -20%，聪明钱已被套'
          : '聪明钱大幅减仓'
    return hit('decay', base)
  }
  if (row.isNew) {
    return hit('fresh', '今日新上榜，更像轮动/新叙事')
  }
  if (outflow || softRed) {
    return hit(
      'watch',
      outflow ? '筹码还在，聪明钱在减仓' : '浮亏还不深，盘面开始变弱',
    )
  }
  if (crowded) {
    return hit('crowded', '聪明钱一侧堆得够大，拥挤')
  }
  if (strongPct && (bias ?? 0) >= STRONG_BIAS && (largeIn || inflow)) {
    return hit('strong', '多空比 ≥ 4 且浮盈 ≥ +20%，聪明钱加仓')
  }
  if (healthyPct || (uplPct == null && !outflow)) {
    return hit('core', '筹码占优，浮盈没亏，结构还在')
  }
  return hit('other', '多空比或浮盈不够清楚')
}

function strength(row: SmOverviewValueScanRow): number {
  return smStructureStrength(row)
}

export function groupSmStructure(
  rows: SmOverviewValueScanRow[],
): SmStructureBucket[] {
  const hits: SmStructureHit[] = rows.map((row) => ({
    row,
    ...classifySmStructureRow(row),
  }))
  hits.sort((a, b) => {
    const d = strength(b.row) - strength(a.row)
    if (d !== 0) return d
    return a.row.symbol.localeCompare(b.row.symbol)
  })
  return SM_STRUCTURE_ORDER.map((kind) => ({
    kind,
    items: hits.filter((h) => h.kind === kind),
  })).filter((b) => b.kind !== 'other' || b.items.length > 0)
}

export function smStructureReps(items: SmStructureHit[], n = 3): string {
  return items
    .slice(0, n)
    .map((h) => h.row.symbol.replace(/USDT$/i, ''))
    .join(' · ')
}
