import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  SmOverviewValueDelistedRow,
  SmOverviewValueScanRow,
  SmOverviewValueSide,
} from '../lib/smOverviewValueScan'
import {
  SM_OVERVIEW_VALUE_MIN_NOTIONAL,
  formatSmOverviewLongShortRatio,
  smOverviewLongShortRatio,
} from '../lib/smOverviewValueScan'
import {
  SM_STRUCTURE_ORDER,
  classifySmStructureRow,
  formatStructureLs,
  formatStructureUplPct,
  formatStructureUsd,
  groupSmStructure,
  smStructureMeta,
  smStructureReps,
  smStructureStrength,
  type SmStructureBucket,
} from '../lib/smOverviewStructure'
import { BinanceFuturesLink } from './BinanceLink'

function fmtUsd(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

function sideLabel(side: SmOverviewValueSide): string {
  return side === 'long' ? '多单' : '空单'
}

function diffLabel(n: number): string {
  const prefix = n > 0 ? '+' : '-'
  return `${prefix}${fmtUsd(Math.abs(n))}`
}

function pctLabel(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  const prefix = n > 0 ? '+' : '-'
  return `${prefix}${(Math.abs(n) * 100).toFixed(1)}%`
}

function formatScanTime(ms: number): string {
  return new Date(ms).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function csvCell(value: string | number): string {
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function fmtUplCsv(upl: number | undefined, uplPct: number | undefined): string {
  if (upl == null || !Number.isFinite(upl)) return ''
  const sign = upl > 0 ? '+' : upl < 0 ? '−' : ''
  const pct =
    uplPct != null && Number.isFinite(uplPct) ? ` ${pctLabel(uplPct)}` : ''
  return `${sign}${fmtUsd(Math.abs(upl))}${pct}`
}

function buildScanCsv(
  rows: SmOverviewValueScanRow[],
  side: SmOverviewValueSide,
): string {
  const sideName = sideLabel(side)
  const header = [
    '合约',
    '方向',
    '结构类型',
    '解读',
    '绝对强度',
    `${sideName}价值`,
    '大户浮盈',
    '对侧价值',
    '数量多空比',
    '全体人数',
    '大户人数',
    'NEW',
    '昨日差值',
  ]
  const lines = rows.map((r) => {
    const traders = side === 'long' ? r.longTraders : r.shortTraders
    const whales = side === 'long' ? r.longWhales : r.shortWhales
    const hit = classifySmStructureRow(r)
    const meta = smStructureMeta(hit.kind, side)
    const delta =
      r.hasLargeDiff && r.deltaFromYesterday != null
        ? `${diffLabel(r.deltaFromYesterday)}${
            r.deltaPctFromYesterday != null
              ? ` ${pctLabel(r.deltaPctFromYesterday)}`
              : ''
          }`
        : ''
    return [
      r.symbol.replace(/USDT$/i, ''),
      sideName,
      `${meta.mark} ${meta.label}`,
      hit.why,
      fmtUsd(r.notional - r.oppositeNotional),
      fmtUsd(r.notional),
      fmtUplCsv(r.upl, r.uplPct),
      fmtUsd(r.oppositeNotional),
      formatSmOverviewLongShortRatio(smOverviewLongShortRatio(r)),
      traders,
      whales,
      r.isNew ? 'NEW' : '',
      delta,
    ]
      .map(csvCell)
      .join(',')
  })
  return `\uFEFF${[header.map(csvCell).join(','), ...lines].join('\r\n')}`
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)
  if (!ok) throw new Error('copy failed')
}

type ScanSortKey = 'strength' | 'lsRatio' | 'uplPct'
type ScanSortDir = 'asc' | 'desc'

const SCAN_SORT_STORAGE_KEY = 'oi-monitor-sm-overview-scan-sort-v1'

function isScanSortKey(v: string): v is ScanSortKey {
  return v === 'strength' || v === 'lsRatio' || v === 'uplPct'
}

function readStoredScanSort(): { key: ScanSortKey; dir: ScanSortDir } {
  if (typeof localStorage === 'undefined') {
    return { key: 'strength', dir: 'desc' }
  }
  try {
    const raw = localStorage.getItem(SCAN_SORT_STORAGE_KEY)
    if (!raw) return { key: 'strength', dir: 'desc' }
    const parsed = JSON.parse(raw) as { key?: string; dir?: string }
    return {
      key: parsed.key && isScanSortKey(parsed.key) ? parsed.key : 'strength',
      dir: parsed.dir === 'asc' ? 'asc' : 'desc',
    }
  } catch {
    return { key: 'strength', dir: 'desc' }
  }
}

function writeStoredScanSort(key: ScanSortKey, dir: ScanSortDir) {
  try {
    localStorage.setItem(SCAN_SORT_STORAGE_KEY, JSON.stringify({ key, dir }))
  } catch {
    /* ignore */
  }
}

function sortNum(
  a: number | undefined,
  b: number | undefined,
  dir: ScanSortDir,
  tie: number,
): number {
  const aOk = a != null && Number.isFinite(a)
  const bOk = b != null && Number.isFinite(b)
  if (!aOk && !bOk) return tie
  if (!aOk) return 1
  if (!bOk) return -1
  if (a === b) return tie
  const mult = dir === 'asc' ? 1 : -1
  return mult * (a < b ? -1 : 1)
}

function compareScanRows(
  a: SmOverviewValueScanRow,
  b: SmOverviewValueScanRow,
  key: ScanSortKey,
  dir: ScanSortDir,
): number {
  const tie = a.symbol.localeCompare(b.symbol)
  if (key === 'lsRatio') {
    return sortNum(smOverviewLongShortRatio(a), smOverviewLongShortRatio(b), dir, tie)
  }
  if (key === 'uplPct') {
    return sortNum(a.uplPct, b.uplPct, dir, tie)
  }
  return sortNum(
    a.notional - a.oppositeNotional,
    b.notional - b.oppositeNotional,
    dir,
    tie,
  )
}

function StructureBoard({
  side,
  buckets,
  onPickSide,
  onOpenDetail,
}: {
  side: SmOverviewValueSide
  buckets: SmStructureBucket[]
  onPickSide: (side: SmOverviewValueSide) => void
  onOpenDetail?: (symbol: string) => void
}) {
  const legend = SM_STRUCTURE_ORDER.filter((k) => k !== 'other')
  return (
    <div className="sm-struct">
      <div className="sm-struct-toolbar">
        <p className="muted small sm-struct-note">
          聪明钱口径：多空比看倍数，也看强度金额。拥挤要 ≥ 8x 且本侧够大；对侧太薄不当拥挤。
        </p>
        <div className="sm-struct-side" role="group" aria-label="结构数据源">
          <button
            type="button"
            className={side === 'long' ? 'on' : undefined}
            onClick={() => onPickSide('long')}
          >
            多单
          </button>
          <button
            type="button"
            className={side === 'short' ? 'on' : undefined}
            onClick={() => onPickSide('short')}
          >
            空单
          </button>
        </div>
      </div>
      <div className="sm-struct-legend" role="table" aria-label="结构类型说明">
        <div className="sm-struct-legend-row is-head" role="row">
          <span>类型</span>
          <span>代表</span>
          <span>解读</span>
        </div>
        {legend.map((kind) => {
          const bucket = buckets.find((b) => b.kind === kind)
          const meta = smStructureMeta(kind, side)
          return (
            <div key={kind} className={`sm-struct-legend-row tone-${kind}`} role="row">
              <span>
                {meta.mark} {meta.label}
                <em>{bucket?.items.length ?? 0}</em>
              </span>
              <span className="mono">{smStructureReps(bucket?.items ?? []) || '—'}</span>
              <span>{meta.read}</span>
            </div>
          )
        })}
      </div>
      {buckets.map((bucket) => {
        if (bucket.items.length === 0) return null
        const meta = smStructureMeta(bucket.kind, side)
        return (
          <section key={bucket.kind} className={`sm-struct-bucket tone-${bucket.kind}`}>
            <header>
              <h3>
                {meta.mark} {meta.label}
                <small>{bucket.items.length}</small>
              </h3>
              <p>{meta.read}</p>
            </header>
            <ul>
              <li className="is-head">
                <span>合约</span>
                <span>多空比</span>
                <span>强度</span>
                <span>本侧 / 对侧</span>
                <span>浮盈%</span>
                <span>规则命中</span>
                <span />
              </li>
              {bucket.items.map((hit) => {
                const r = hit.row
                const ls = hit.lsRatio ?? smOverviewLongShortRatio(r)
                const strengthUsd = smStructureStrength(r)
                return (
                  <li
                    key={`${r.side}-${r.symbol}`}
                    className={onOpenDetail ? 'is-click' : undefined}
                    onClick={onOpenDetail ? () => onOpenDetail(r.symbol) : undefined}
                  >
                    <span className="sym">{r.symbol.replace(/USDT$/i, '')}</span>
                    <span
                      className={`mono num ${
                        ls != null && ls > 1
                          ? 'sm-net--buy'
                          : ls != null && ls < 1
                            ? 'sm-net--sell'
                            : ''
                      }`}
                    >
                      {formatStructureLs(ls)}
                    </span>
                    <span className="mono num">{formatStructureUsd(strengthUsd)}</span>
                    <span className="mono num muted-soft sm-struct-legs">
                      {formatStructureUsd(r.notional)}
                      <i>/</i>
                      {formatStructureUsd(r.oppositeNotional)}
                    </span>
                    <span
                      className={`mono num ${
                        hit.uplPct != null && hit.uplPct > 0
                          ? 'sm-net--buy'
                          : hit.uplPct != null && hit.uplPct < 0
                            ? 'sm-net--sell'
                            : ''
                      }`}
                    >
                      {formatStructureUplPct(hit.uplPct)}
                    </span>
                    <span className="muted small">{hit.why}</span>
                    <span
                      className="sm-struct-ops"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {onOpenDetail ? (
                        <button
                          type="button"
                          className="btn btn-ghost small sm-futures-detail-btn"
                          onClick={() => onOpenDetail(r.symbol)}
                        >
                          详情
                        </button>
                      ) : null}
                      <BinanceFuturesLink symbol={r.symbol}>BN →</BinanceFuturesLink>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export function SmOverviewValueScanTable({
  longRows,
  shortRows,
  delistedRows,
  onOpenDetail,
}: {
  longRows: SmOverviewValueScanRow[]
  shortRows: SmOverviewValueScanRow[]
  delistedRows: SmOverviewValueDelistedRow[]
  onOpenDetail?: (symbol: string) => void
}) {
  const [side, setSide] = useState<SmOverviewValueSide>('long')
  const [view, setView] = useState<'list' | 'structure'>('list')
  const [hideInverted, setHideInverted] = useState(true)
  const storedSort = useMemo(() => readStoredScanSort(), [])
  const [sortKey, setSortKey] = useState<ScanSortKey>(storedSort.key)
  const [sortDir, setSortDir] = useState<ScanSortDir>(storedSort.dir)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef(0)
  const rawRows = side === 'long' ? longRows : shortRows
  const rows = useMemo(() => {
    const filtered = hideInverted
      ? rawRows.filter((r) => r.oppositeNotional <= r.notional)
      : rawRows
    return [...filtered].sort((a, b) => compareScanRows(a, b, sortKey, sortDir))
  }, [hideInverted, rawRows, sortDir, sortKey])
  const buckets = useMemo(() => groupSmStructure(rows), [rows])

  useEffect(() => {
    writeStoredScanSort(sortKey, sortDir)
  }, [sortDir, sortKey])

  useEffect(() => {
    return () => window.clearTimeout(toastTimer.current)
  }, [])

  function toggleSort(k: ScanSortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(k)
      setSortDir('desc')
    }
  }

  function Th({
    k,
    children,
    className = '',
    title,
  }: {
    k: ScanSortKey
    children: ReactNode
    className?: string
    title?: string
  }) {
    const active = sortKey === k
    const arrow = active ? (sortDir === 'desc' ? '↓' : '↑') : ''
    return (
      <th scope="col" className={className} title={title}>
        <button
          type="button"
          className={`th-sort ${active ? 'active' : ''} ${className}`}
          onClick={(e) => {
            e.stopPropagation()
            toggleSort(k)
          }}
        >
          <span>{children}</span>
          {arrow ? <span className="sort-arrow">{arrow}</span> : null}
        </button>
      </th>
    )
  }

  function showToast(message: string) {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 1800)
  }

  async function copyVisibleCsv() {
    if (rows.length === 0) return
    try {
      await copyText(buildScanCsv(rows, side))
      showToast(`已复制 ${rows.length} 行 CSV`)
    } catch {
      /* clipboard 不可用时不弹成功 toast */
    }
  }

  return (
    <div className="sm-overview-value-scan">
      <div className="view-tabs sm-scan-tabs" aria-label="聪明扫描方向">
        <button
          type="button"
          className={view === 'list' && side === 'long' ? 'view-tab on' : 'view-tab'}
          onClick={() => {
            setSide('long')
            setView('list')
          }}
        >
          多单 {longRows.length}
        </button>
        <button
          type="button"
          className={view === 'list' && side === 'short' ? 'view-tab on' : 'view-tab'}
          onClick={() => {
            setSide('short')
            setView('list')
          }}
        >
          空单 {shortRows.length}
        </button>
        <button
          type="button"
          className={view === 'structure' ? 'view-tab on' : 'view-tab'}
          onClick={() => setView('structure')}
        >
          结构
        </button>
        <label className="chk sm-scan-filter">
          <input
            type="checkbox"
            checked={hideInverted}
            onChange={(e) => setHideInverted(e.target.checked)}
          />
          隐藏红色背景
        </label>
        <button
          type="button"
          className="btn btn-ghost small sm-scan-copy-btn"
          disabled={rows.length === 0}
          onClick={() => {
            void copyVisibleCsv()
          }}
        >
          复制
        </button>
      </div>

      {rawRows.length === 0 ? (
        <p className="muted small" style={{ margin: '0.35rem 0 0' }}>
          暂无 {sideLabel(side)} overview 大户名义超过{' '}
          {fmtUsd(SM_OVERVIEW_VALUE_MIN_NOTIONAL)} 的合约。
        </p>
      ) : rows.length === 0 ? (
        <p className="muted small" style={{ margin: '0.35rem 0 0' }}>
          当前 {sideLabel(side)} 列表已全部被「隐藏红色背景」过滤。
        </p>
      ) : view === 'structure' ? (
        <StructureBoard
          side={side}
          buckets={buckets}
          onPickSide={(next) => setSide(next)}
          onOpenDetail={onOpenDetail}
        />
      ) : (
        <div className="table-wrap sm-futures-wrap">
          <table className="sig-table sm-futures-table sm-overview-value-table">
            <thead>
              <tr>
                <th scope="col">合约</th>
                <Th
                  k="strength"
                  className="num"
                  title="本侧名义 − 对侧名义"
                >
                  绝对强度
                </Th>
                <th scope="col" className="num">
                  {sideLabel(side)}价值
                </th>
                <Th
                  k="uplPct"
                  className="num"
                  title="按大户盈亏比例排序；金额是标记价相对开仓成本"
                >
                  大户浮盈
                </Th>
                <th scope="col" className="num">
                  对侧价值
                </th>
                <Th
                  k="lsRatio"
                  className="num"
                  title="全体聪明钱多头qty / 空头qty，不是全市场"
                >
                  数量多空比
                </Th>
                <th scope="col" className="num">
                  全体人数
                </th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const inverted = r.oppositeNotional > r.notional
                const lsRatio = smOverviewLongShortRatio(r)
                return (
                  <tr
                    key={`${r.side}-${r.symbol}`}
                    className={[
                      onOpenDetail ? 'sig-row' : '',
                      inverted ? 'sm-scan-inverted' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ animationDelay: `${Math.min(i, 20) * 24}ms` }}
                    onClick={
                      onOpenDetail ? () => onOpenDetail(r.symbol) : undefined
                    }
                  >
                    <td>
                      <span className="sym">
                        {r.symbol.replace(/USDT$/i, '')}
                      </span>
                      {r.isNew ? (
                        <span className="sm-scan-new-badge">NEW</span>
                      ) : null}
                      {r.hasLargeDiff && r.deltaFromYesterday != null ? (
                        <span
                          className={`sm-scan-diff-badge ${
                            r.deltaFromYesterday > 0
                              ? 'sm-scan-diff-badge--up'
                              : 'sm-scan-diff-badge--down'
                          }`}
                          title={`与昨天同侧快照差值 ${diffLabel(r.deltaFromYesterday)}${
                            r.deltaPctFromYesterday != null
                              ? ` (${pctLabel(r.deltaPctFromYesterday)})`
                              : ''
                          }`}
                        >
                          Δ {diffLabel(r.deltaFromYesterday)}
                          {r.deltaPctFromYesterday != null
                            ? ` ${pctLabel(r.deltaPctFromYesterday)}`
                            : ''}
                        </span>
                      ) : null}
                    </td>
                    <td className="mono num">
                      {fmtUsd(r.notional - r.oppositeNotional)}
                    </td>
                    <td className="mono num">{fmtUsd(r.notional)}</td>
                    <td
                      className="mono num"
                      title="本侧大户：当前名义 − 成本名义（空头相反）"
                    >
                      {r.upl == null || !Number.isFinite(r.upl) ? (
                        '—'
                      ) : (
                        <span
                          className={
                            r.upl > 0
                              ? 'sm-net--buy'
                              : r.upl < 0
                                ? 'sm-net--sell'
                                : undefined
                          }
                        >
                          {r.upl > 0 ? '+' : r.upl < 0 ? '−' : ''}
                          {fmtUsd(Math.abs(r.upl))}
                          {r.uplPct != null && Number.isFinite(r.uplPct)
                            ? ` ${pctLabel(r.uplPct)}`
                            : ''}
                        </span>
                      )}
                    </td>
                    <td className="mono num muted-soft">
                      {fmtUsd(r.oppositeNotional)}
                    </td>
                    <td
                      className="mono num"
                      title="接口 longShortRatio = 全体多头qty / 全体空头qty；旧缓存无该字段时回退为大户成本名义比"
                    >
                      <span
                        className={
                          lsRatio != null && lsRatio > 1
                            ? 'sm-net--buy'
                            : lsRatio != null && lsRatio < 1
                              ? 'sm-net--sell'
                              : undefined
                        }
                      >
                        {formatSmOverviewLongShortRatio(lsRatio)}
                      </span>
                    </td>
                    <td
                      className="mono num muted-soft"
                      title="全体聪明钱人数；大户是其中子集，已含在全体内"
                    >
                      {side === 'long' ? r.longTraders : r.shortTraders}
                      <span className="sm-wh">
                        （大户 {side === 'long' ? r.longWhales : r.shortWhales}）
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {onOpenDetail ? (
                        <button
                          type="button"
                          className="btn btn-ghost small sm-futures-detail-btn"
                          onClick={() => onOpenDetail(r.symbol)}
                        >
                          详情
                        </button>
                      ) : null}
                      <BinanceFuturesLink symbol={r.symbol}>
                        BN →
                      </BinanceFuturesLink>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {delistedRows.length > 0 ? (
        <div className="sm-scan-delisted">
          <div className="sm-scan-delisted-head">
            <h3>过去 4 天下榜</h3>
            <p className="muted small">
              过去 4 天曾超过阈值、今天同侧未上榜的合约；当前金额来自今天 overview 快照。
            </p>
          </div>
          <div className="table-wrap sm-futures-wrap">
            <table className="sig-table sm-futures-table sm-overview-value-table sm-scan-delisted-table">
              <thead>
                <tr>
                  <th scope="col">合约</th>
                  <th scope="col">方向</th>
                  <th scope="col">最后在榜</th>
                  <th scope="col" className="num">
                    当时金额
                  </th>
                  <th scope="col" className="num">
                    当前金额
                  </th>
                  <th scope="col" className="num">
                    变化
                  </th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {delistedRows.map((r, i) => (
                  <tr
                    key={`${r.side}-${r.symbol}-${r.lastSeenDateKey}`}
                    className={onOpenDetail ? 'sig-row' : undefined}
                    style={{ animationDelay: `${Math.min(i, 20) * 24}ms` }}
                    onClick={
                      onOpenDetail ? () => onOpenDetail(r.symbol) : undefined
                    }
                  >
                    <td>
                      <span className="sym">
                        {r.symbol.replace(/USDT$/i, '')}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`sm-side sm-side--${
                          r.side === 'long' ? 'buy' : 'sell'
                        }`}
                      >
                        {sideLabel(r.side)}
                      </span>
                    </td>
                    <td className="mono muted-soft">
                      {formatScanTime(r.lastSeenAtMs)}
                    </td>
                    <td className="mono num muted-soft">
                      {fmtUsd(r.lastNotional)}
                    </td>
                    <td className="mono num">
                      {fmtUsd(r.currentNotional)}
                    </td>
                    <td className="mono num">
                      <span
                        className={
                          r.deltaFromLastSeen > 0
                            ? 'sm-net--buy'
                            : 'sm-net--sell'
                        }
                        title={
                          r.deltaPctFromLastSeen != null
                            ? pctLabel(r.deltaPctFromLastSeen)
                            : undefined
                        }
                      >
                        {diffLabel(r.deltaFromLastSeen)}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {onOpenDetail ? (
                        <button
                          type="button"
                          className="btn btn-ghost small sm-futures-detail-btn"
                          onClick={() => onOpenDetail(r.symbol)}
                        >
                          详情
                        </button>
                      ) : null}
                      <BinanceFuturesLink symbol={r.symbol}>
                        BN →
                      </BinanceFuturesLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="sm-scan-toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </div>
  )
}

