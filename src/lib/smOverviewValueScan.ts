import {
  overviewSideNotional,
  type SmartMoneyOverviewData,
} from './api/smartMoneyFutures'

export const SM_OVERVIEW_VALUE_SCAN_TITLE = '聪明扫描'
export const SM_OVERVIEW_VALUE_MIN_NOTIONAL = 5_000_000
export const SM_OVERVIEW_VALUE_DIFF_MARK_NOTIONAL = 2_000_000
export const SM_OVERVIEW_VALUE_DIFF_MARK_RATIO = 0.1

const STORAGE_KEY = 'oi-monitor-sm-overview-value-scan-v1'
const RETAIN_DAYS = 5

export type SmOverviewValueSide = 'long' | 'short'

export type SmOverviewValueScanRow = {
  symbol: string
  side: SmOverviewValueSide
  notional: number
  oppositeNotional: number
  longNotional: number
  shortNotional: number
  /** 接口 longShortRatio：全体多头qty/空头qty；旧缓存可能缺失，回退用大户成本名义比 */
  longShortRatio?: number
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
  allRows?: SmOverviewValueCurrentRow[]
  totalCount: number
  failedCount: number
}

export type SmOverviewValueCurrentRow = {
  symbol: string
  longNotional: number
  shortNotional: number
}

export type SmOverviewValueDelistedRow = {
  symbol: string
  side: SmOverviewValueSide
  lastSeenDateKey: string
  lastSeenAtMs: number
  lastNotional: number
  currentNotional: number
  deltaFromLastSeen: number
  deltaPctFromLastSeen?: number
}

export type SmOverviewValueScanResult = {
  today: {
    dateKey: string
    scannedAtMs: number
    longRows: SmOverviewValueScanRow[]
    shortRows: SmOverviewValueScanRow[]
    delistedRows: SmOverviewValueDelistedRow[]
    totalCount: number
    failedCount: number
  }
  compareDays: SmOverviewValueScanDaySnapshot[]
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

function dateKeyToTime(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map((x) => parseInt(x, 10))
  return new Date(y, m - 1, d).getTime()
}

function daysBetween(a: string, b: string): number {
  const dayMs = 24 * 60 * 60 * 1000
  return Math.round((dateKeyToTime(a) - dateKeyToTime(b)) / dayMs)
}

function isInRetainWindow(dateKey: string, todayKey: string): boolean {
  const diff = daysBetween(todayKey, dateKey)
  return diff >= 0 && diff < RETAIN_DAYS
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
        .map((d) => ({
          ...d,
          allRows: Array.isArray(d.allRows) ? d.allRows : undefined,
        }))
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
  const longShortRatio = Number(d.longShortRatio)
  return {
    symbol: d.symbol.toUpperCase(),
    side,
    notional: side === 'long' ? longNotional : shortNotional,
    oppositeNotional: side === 'long' ? shortNotional : longNotional,
    longNotional,
    shortNotional,
    longShortRatio: Number.isFinite(longShortRatio) ? longShortRatio : undefined,
    longWhales: d.longWhales,
    shortWhales: d.shortWhales,
    longTraders: d.longTraders,
    shortTraders: d.shortTraders,
  }
}

/** 优先接口数量比；无字段时用大户成本名义比回退（旧缓存） */
export function smOverviewLongShortRatio(
  row: Pick<SmOverviewValueScanRow, 'longNotional' | 'shortNotional' | 'longShortRatio'>,
): number | undefined {
  if (Number.isFinite(row.longShortRatio)) return row.longShortRatio
  if (row.shortNotional > 0 && Number.isFinite(row.longNotional)) {
    return row.longNotional / row.shortNotional
  }
  return undefined
}

export function formatSmOverviewLongShortRatio(ratio: number | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—'
  return `${ratio.toFixed(3)}∶1`
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
  const allRows: SmOverviewValueCurrentRow[] = []

  for (const { symbol, data } of list) {
    const normalized = { ...data, symbol: (data.symbol || symbol).toUpperCase() }
    const longNotional = overviewSideNotional(normalized, 'long')
    const shortNotional = overviewSideNotional(normalized, 'short')
    allRows.push({
      symbol: normalized.symbol,
      longNotional,
      shortNotional,
    })
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
    allRows: sortRows(allRows.map((r) => ({ ...r, notional: Math.max(r.longNotional, r.shortNotional) }))).map(
      ({ symbol, longNotional, shortNotional }) => ({
        symbol,
        longNotional,
        shortNotional,
      }),
    ),
    totalCount,
    failedCount,
  }
}

function sideNotional(
  r: SmOverviewValueCurrentRow,
  side: SmOverviewValueSide,
): number {
  return side === 'long' ? r.longNotional : r.shortNotional
}

function currentRowsMap(
  snapshot: SmOverviewValueScanDaySnapshot,
): Map<string, SmOverviewValueCurrentRow> {
  return new Map((snapshot.allRows ?? []).map((r) => [r.symbol, r]))
}

function rowsForSide(
  snapshot: SmOverviewValueScanDaySnapshot,
  side: SmOverviewValueSide,
): Omit<SmOverviewValueScanRow, 'isNew'>[] {
  return side === 'long' ? snapshot.longRows : snapshot.shortRows
}

function buildDelistedRows(
  today: SmOverviewValueScanDaySnapshot,
  compareDays: SmOverviewValueScanDaySnapshot[],
): SmOverviewValueDelistedRow[] {
  const currentMap = currentRowsMap(today)
  const out: SmOverviewValueDelistedRow[] = []

  for (const side of ['long', 'short'] as const) {
    const todaySymbols = new Set(rowsForSide(today, side).map((r) => r.symbol))
    const latestBySymbol = new Map<
      string,
      {
        day: SmOverviewValueScanDaySnapshot
        row: Omit<SmOverviewValueScanRow, 'isNew'>
      }
    >()

    for (const day of compareDays) {
      for (const row of rowsForSide(day, side)) {
        if (todaySymbols.has(row.symbol)) continue
        const existing = latestBySymbol.get(row.symbol)
        if (!existing || day.dateKey > existing.day.dateKey) {
          latestBySymbol.set(row.symbol, { day, row })
        }
      }
    }

    for (const { day, row } of latestBySymbol.values()) {
      const current = currentMap.get(row.symbol)
      if (!current) continue
      const currentNotional = sideNotional(current, side)
      const delta = currentNotional - row.notional
      const lastAbs = Math.abs(row.notional)
      out.push({
        symbol: row.symbol,
        side,
        lastSeenDateKey: day.dateKey,
        lastSeenAtMs: day.scannedAtMs,
        lastNotional: row.notional,
        currentNotional,
        deltaFromLastSeen: delta,
        deltaPctFromLastSeen: lastAbs > 0 ? delta / lastAbs : undefined,
      })
    }
  }

  out.sort((a, b) => {
    if (b.lastSeenDateKey !== a.lastSeenDateKey) {
      return b.lastSeenDateKey.localeCompare(a.lastSeenDateKey)
    }
    const absDiff = Math.abs(b.deltaFromLastSeen) - Math.abs(a.deltaFromLastSeen)
    if (absDiff !== 0) return absDiff
    return a.symbol.localeCompare(b.symbol)
  })
  return out
}

function withHistoryFlags(
  today: SmOverviewValueScanDaySnapshot,
  compareDays: SmOverviewValueScanDaySnapshot[],
): SmOverviewValueScanResult['today'] {
  const yesterday = compareDays[0]
  const delistedRows = buildDelistedRows(today, compareDays)
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
      delistedRows,
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
    delistedRows,
  }
}

export function saveSmOverviewValueScan(
  snapshot: SmOverviewValueScanDaySnapshot,
): SmOverviewValueScanResult {
  if (typeof localStorage === 'undefined') {
    return { today: withHistoryFlags(snapshot, []), compareDays: [] }
  }

  const todayKey = snapshot.dateKey
  const yesterdayKey = previousDateKey(todayKey)
  const stored = parseStoredScan(localStorage.getItem(STORAGE_KEY))
  const yesterday = stored.days.find((d) => d.dateKey === yesterdayKey)
  const compareDays = stored.days.filter(
    (d) => d.dateKey < todayKey && isInRetainWindow(d.dateKey, todayKey),
  )
  const days = [
    snapshot,
    ...stored.days.filter(
      (d) => d.dateKey !== todayKey && isInRetainWindow(d.dateKey, todayKey),
    ),
  ].slice(0, RETAIN_DAYS)

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ days }))
  } catch {
    /* ignore quota/private-mode failures; the current scan can still render */
  }

  return {
    today: withHistoryFlags(snapshot, compareDays),
    compareDays,
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
  if (!Array.isArray(today.allRows)) return null

  const yesterday = stored.days.find((d) => d.dateKey === yesterdayKey)
  const compareDays = stored.days.filter(
    (d) => d.dateKey < todayKey && isInRetainWindow(d.dateKey, todayKey),
  )
  return {
    today: withHistoryFlags(today, compareDays),
    compareDays,
    yesterday,
  }
}

