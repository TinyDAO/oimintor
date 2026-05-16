import {
  overviewSideNotional,
  type SmartMoneyOverviewData,
} from './api/smartMoneyFutures'

export const SM_OVERVIEW_VALUE_SCAN_TITLE = '聪明扫描'
export const SM_OVERVIEW_VALUE_MIN_NOTIONAL = 5_000_000
export const SM_OVERVIEW_VALUE_DIFF_MARK_NOTIONAL = 2_000_000
export const SM_OVERVIEW_VALUE_DIFF_MARK_RATIO = 0.1

const STORAGE_KEY = 'oi-monitor-sm-overview-value-scan-v1'

export type SmOverviewValueSide = 'long' | 'short'

export type SmOverviewValueScanRow = {
  symbol: string
  side: SmOverviewValueSide
  notional: number
  oppositeNotional: number
  longNotional: number
  shortNotional: number
  longWhales: number
  shortWhales: number
  longTraders: number
  shortTraders: number
  isNew: boolean
  yesterdayNotional?: number
  deltaFromYesterday?: number
  deltaPctFromYesterday?: number
  hasLargeDiff?: boolean
}

export type SmOverviewValueScanDaySnapshot = {
  dateKey: string
  scannedAtMs: number
  longRows: Omit<SmOverviewValueScanRow, 'isNew'>[]
  shortRows: Omit<SmOverviewValueScanRow, 'isNew'>[]
  totalCount: number
  failedCount: number
}

export type SmOverviewValueScanResult = {
  today: {
    dateKey: string
    scannedAtMs: number
    longRows: SmOverviewValueScanRow[]
    shortRows: SmOverviewValueScanRow[]
    totalCount: number
    failedCount: number
  }
  yesterday?: SmOverviewValueScanDaySnapshot
}

export type SmOverviewValueScanUiState =
  | {
      phase: 'loading'
      progress: string
    }
  | {
      phase: 'error'
      error: string
    }
  | {
      phase: 'done'
      result: SmOverviewValueScanResult
    }

type StoredScan = {
  days: SmOverviewValueScanDaySnapshot[]
}

function dateKeyFromMs(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function previousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map((x) => parseInt(x, 10))
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - 1)
  return dateKeyFromMs(dt.getTime())
}

function parseStoredScan(raw: string | null): StoredScan {
  if (!raw) return { days: [] }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredScan>
    if (!Array.isArray(parsed.days)) return { days: [] }
    return {
      days: parsed.days
        .filter((d): d is SmOverviewValueScanDaySnapshot => {
          return (
            typeof d?.dateKey === 'string' &&
            typeof d.scannedAtMs === 'number' &&
            Array.isArray(d.longRows) &&
            Array.isArray(d.shortRows)
          )
        })
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    }
  } catch {
    return { days: [] }
  }
}

function rowForSide(
  d: SmartMoneyOverviewData,
  side: SmOverviewValueSide,
): Omit<SmOverviewValueScanRow, 'isNew'> {
  const longNotional = overviewSideNotional(d, 'long')
  const shortNotional = overviewSideNotional(d, 'short')
  return {
    symbol: d.symbol.toUpperCase(),
    side,
    notional: side === 'long' ? longNotional : shortNotional,
    oppositeNotional: side === 'long' ? shortNotional : longNotional,
    longNotional,
    shortNotional,
    longWhales: d.longWhales,
    shortWhales: d.shortWhales,
    longTraders: d.longTraders,
    shortTraders: d.shortTraders,
  }
}

function sortRows<T extends { symbol: string; notional: number }>(rows: T[]): T[] {
  rows.sort((a, b) => {
    if (b.notional !== a.notional) return b.notional - a.notional
    return a.symbol.localeCompare(b.symbol)
  })
  return rows
}

export function buildSmOverviewValueSnapshot(
  list: { symbol: string; data: SmartMoneyOverviewData }[],
  totalCount: number,
  failedCount: number,
  nowMs: number = Date.now(),
): SmOverviewValueScanDaySnapshot {
  const longRows: Omit<SmOverviewValueScanRow, 'isNew'>[] = []
  const shortRows: Omit<SmOverviewValueScanRow, 'isNew'>[] = []

  for (const { symbol, data } of list) {
    const normalized = { ...data, symbol: (data.symbol || symbol).toUpperCase() }
    const longNotional = overviewSideNotional(normalized, 'long')
    const shortNotional = overviewSideNotional(normalized, 'short')
    if (longNotional >= SM_OVERVIEW_VALUE_MIN_NOTIONAL) {
      longRows.push(rowForSide(normalized, 'long'))
    }
    if (shortNotional >= SM_OVERVIEW_VALUE_MIN_NOTIONAL) {
      shortRows.push(rowForSide(normalized, 'short'))
    }
  }

  return {
    dateKey: dateKeyFromMs(nowMs),
    scannedAtMs: nowMs,
    longRows: sortRows(longRows),
    shortRows: sortRows(shortRows),
    totalCount,
    failedCount,
  }
}

function withNewFlags(
  today: SmOverviewValueScanDaySnapshot,
  yesterday?: SmOverviewValueScanDaySnapshot,
): SmOverviewValueScanResult['today'] {
  if (!yesterday) {
    return {
      ...today,
      longRows: today.longRows.map((r) => ({
        ...r,
        isNew: false,
        hasLargeDiff: false,
      })),
      shortRows: today.shortRows.map((r) => ({
        ...r,
        isNew: false,
        hasLargeDiff: false,
      })),
    }
  }
  const prevLong = new Map(yesterday.longRows.map((r) => [r.symbol, r]))
  const prevShort = new Map(yesterday.shortRows.map((r) => [r.symbol, r]))
  function withYesterdayDiff(
    r: Omit<SmOverviewValueScanRow, 'isNew'>,
    prevRows: Map<string, Omit<SmOverviewValueScanRow, 'isNew'>>,
  ): SmOverviewValueScanRow {
    const prev = prevRows.get(r.symbol)
    if (!prev) return { ...r, isNew: true, hasLargeDiff: false }
    const delta = r.notional - prev.notional
    const prevAbs = Math.abs(prev.notional)
    const deltaPct = prevAbs > 0 ? delta / prevAbs : 0
    return {
      ...r,
      isNew: false,
      yesterdayNotional: prev.notional,
      deltaFromYesterday: delta,
      deltaPctFromYesterday: deltaPct,
      hasLargeDiff:
        Math.abs(delta) >= SM_OVERVIEW_VALUE_DIFF_MARK_NOTIONAL ||
        Math.abs(deltaPct) >= SM_OVERVIEW_VALUE_DIFF_MARK_RATIO,
    }
  }
  return {
    ...today,
    longRows: today.longRows.map((r) => withYesterdayDiff(r, prevLong)),
    shortRows: today.shortRows.map((r) => withYesterdayDiff(r, prevShort)),
  }
}

export function saveSmOverviewValueScan(
  snapshot: SmOverviewValueScanDaySnapshot,
): SmOverviewValueScanResult {
  if (typeof localStorage === 'undefined') {
    return { today: withNewFlags(snapshot), yesterday: undefined }
  }

  const todayKey = snapshot.dateKey
  const yesterdayKey = previousDateKey(todayKey)
  const stored = parseStoredScan(localStorage.getItem(STORAGE_KEY))
  const yesterday = stored.days.find((d) => d.dateKey === yesterdayKey)
  const days = [
    snapshot,
    ...stored.days.filter((d) => d.dateKey === yesterdayKey),
  ].slice(0, 2)

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ days }))
  } catch {
    /* ignore quota/private-mode failures; the current scan can still render */
  }

  return {
    today: withNewFlags(snapshot, yesterday),
    yesterday,
  }
}

export function readTodaySmOverviewValueScanCache(
  nowMs: number = Date.now(),
): SmOverviewValueScanResult | null {
  if (typeof localStorage === 'undefined') return null

  const todayKey = dateKeyFromMs(nowMs)
  const yesterdayKey = previousDateKey(todayKey)
  const stored = parseStoredScan(localStorage.getItem(STORAGE_KEY))
  const today = stored.days.find((d) => d.dateKey === todayKey)
  if (!today) return null

  const yesterday = stored.days.find((d) => d.dateKey === yesterdayKey)
  return {
    today: withNewFlags(today, yesterday),
    yesterday,
  }
}

