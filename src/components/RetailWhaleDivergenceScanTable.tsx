import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  RetailWhaleDivergenceKind,
  RetailWhaleDivergenceRow,
} from '../lib/retailWhaleDivergenceScan'
import { BinanceFuturesLink } from './BinanceLink'

type SortKey =
  | 'symbol'
  | 'divergenceScore'
  | 'ratioGap'
  | 'userLsr'
  | 'topPosLsr'
  | 'topAccLsr'

function labelKind(kind: RetailWhaleDivergenceKind): string {
  return kind === 'whaleLongRetailShort'
    ? '大户多 / 散户空'
    : '大户空 / 散户多'
}

function sideClass(kind: RetailWhaleDivergenceKind): string {
  return kind === 'whaleLongRetailShort' ? 'buy' : 'sell'
}

function fmtRatio(n: number): string {
  if (!Number.isFinite(n)) return '-'
  return n.toFixed(3)
}

function fmtScore(n: number): string {
  if (!Number.isFinite(n)) return '-'
  return n.toFixed(2)
}

function compareRows(
  a: RetailWhaleDivergenceRow,
  b: RetailWhaleDivergenceRow,
  key: SortKey,
  dir: 'asc' | 'desc',
): number {
  const mult = dir === 'asc' ? 1 : -1
  if (key === 'symbol') return mult * a.symbol.localeCompare(b.symbol)
  const va = a[key]
  const vb = b[key]
  if (va === vb) return a.symbol.localeCompare(b.symbol)
  return mult * (va < vb ? -1 : 1)
}

export function RetailWhaleDivergenceScanTable({
  rows,
  onOpenDetail,
}: {
  rows: RetailWhaleDivergenceRow[]
  onOpenDetail: (symbol: string) => void
}) {
  const [tab, setTab] = useState<RetailWhaleDivergenceKind | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('divergenceScore')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const longRows = rows.filter((r) => r.kind === 'whaleLongRetailShort')
  const shortRows = rows.filter((r) => r.kind === 'whaleShortRetailLong')

  const sorted = useMemo(() => {
    const filtered = tab === 'all' ? rows : rows.filter((r) => r.kind === tab)
    const list = [...filtered]
    list.sort((a, b) => compareRows(a, b, sortKey, sortDir))
    return list
  }, [rows, sortDir, sortKey, tab])

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(k)
      setSortDir(k === 'symbol' ? 'asc' : 'desc')
    }
  }

  function renderTh({
    k,
    children,
    className = '',
  }: {
    k: SortKey
    children: ReactNode
    className?: string
  }) {
    const active = sortKey === k
    const arrow = active ? (sortDir === 'desc' ? '↓' : '↑') : ''
    return (
      <th>
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

  return (
    <div className="retail-whale-scan">
      <div className="view-tabs sm-scan-tabs" aria-label="背离类型">
        <button
          type="button"
          className={tab === 'all' ? 'view-tab on' : 'view-tab'}
          onClick={() => setTab('all')}
        >
          全部 {rows.length}
        </button>
        <button
          type="button"
          className={tab === 'whaleLongRetailShort' ? 'view-tab on' : 'view-tab'}
          onClick={() => setTab('whaleLongRetailShort')}
        >
          大户多 {longRows.length}
        </button>
        <button
          type="button"
          className={tab === 'whaleShortRetailLong' ? 'view-tab on' : 'view-tab'}
          onClick={() => setTab('whaleShortRetailLong')}
        >
          大户空 {shortRows.length}
        </button>
      </div>

      <div className="table-wrap sm-futures-wrap">
        <table className="sig-table retail-whale-table">
          <thead>
            <tr>
              {renderTh({ k: 'symbol', children: '合约' })}
              <th className="th-no-sort">类型</th>
              {renderTh({
                k: 'divergenceScore',
                children: (
                  <span title="|ln(用户 LSR)| + |ln(大户持仓 LSR)|，越大代表两边离 1 越远">
                    反差
                  </span>
                ),
              })}
              {renderTh({ k: 'ratioGap', children: '差值' })}
              {renderTh({ k: 'topPosLsr', children: '大户持仓' })}
              {renderTh({ k: 'userLsr', children: '用户' })}
              {renderTh({ k: 'topAccLsr', children: '大户账户' })}
              <th className="th-no-sort">操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={`${r.symbol}-${r.kind}`}
                className="sig-row"
                style={{ animationDelay: `${Math.min(i, 20) * 24}ms` }}
                onClick={() => onOpenDetail(r.symbol)}
              >
                <td>
                  <span className="sym">{r.symbol.replace(/USDT$/i, '')}</span>
                </td>
                <td>
                  <span className={`sm-side sm-side--${sideClass(r.kind)}`}>
                    {labelKind(r.kind)}
                  </span>
                </td>
                <td className="mono num">{fmtScore(r.divergenceScore)}</td>
                <td className="mono num muted-soft">{fmtRatio(r.ratioGap)}</td>
                <td className="mono num">{fmtRatio(r.topPosLsr)}</td>
                <td className="mono num">{fmtRatio(r.userLsr)}</td>
                <td className="mono num muted-soft">{fmtRatio(r.topAccLsr)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn btn-ghost small sm-futures-detail-btn"
                    onClick={() => onOpenDetail(r.symbol)}
                  >
                    详情
                  </button>
                  <BinanceFuturesLink symbol={r.symbol}>BN →</BinanceFuturesLink>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
