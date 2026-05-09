import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { SmNotionalRatioRow } from '../lib/smNotionalRatioScan'
import { BinanceFuturesLink } from './BinanceLink'

function fmtUsd(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

type SortKey =
  | 'symbol'
  | 'ratioLs'
  | 'longNotional'
  | 'shortNotional'
  | 'absNet'
  | 'totalNs'

function ratioSortValue(r: SmNotionalRatioRow): number {
  return Number.isFinite(r.ratioLs) ? r.ratioLs : Number.POSITIVE_INFINITY
}

function compareRows(
  a: SmNotionalRatioRow,
  b: SmNotionalRatioRow,
  key: SortKey,
  dir: 'asc' | 'desc',
): number {
  const mult = dir === 'asc' ? 1 : -1
  if (key === 'symbol') {
    const c = a.symbol.localeCompare(b.symbol)
    return mult * (c || 0)
  }
  if (key === 'ratioLs') {
    const va = ratioSortValue(a)
    const vb = ratioSortValue(b)
    if (va === vb) return a.symbol.localeCompare(b.symbol)
    return mult * (va < vb ? -1 : 1)
  }
  if (key === 'longNotional') {
    const na = a.longNotional
    const nb = b.longNotional
    if (na === nb) return a.symbol.localeCompare(b.symbol)
    return mult * (na < nb ? -1 : 1)
  }
  if (key === 'shortNotional') {
    const na = a.shortNotional
    const nb = b.shortNotional
    if (na === nb) return a.symbol.localeCompare(b.symbol)
    return mult * (na < nb ? -1 : 1)
  }
  if (key === 'totalNs') {
    const na = Math.abs(a.longNotional) + Math.abs(a.shortNotional)
    const nb = Math.abs(b.longNotional) + Math.abs(b.shortNotional)
    if (na === nb) return a.symbol.localeCompare(b.symbol)
    return mult * (na < nb ? -1 : 1)
  }
  const na = Math.abs(a.netNotional)
  const nb = Math.abs(b.netNotional)
  if (na === nb) return a.symbol.localeCompare(b.symbol)
  return mult * (na < nb ? -1 : 1)
}

export function SmNotionalRatioScanTable({
  rows,
  onOpenDetail,
}: {
  rows: SmNotionalRatioRow[]
  onOpenDetail?: (symbol: string) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('ratioLs')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sorted = useMemo(() => {
    const list = [...rows]
    list.sort((a, b) => compareRows(a, b, sortKey, sortDir))
    return list
  }, [rows, sortKey, sortDir])

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(k)
      setSortDir(k === 'symbol' ? 'asc' : 'desc')
    }
  }

  function Th({
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
    <div className="table-wrap sm-futures-wrap">
      <table className="sig-table sm-futures-table sm-notional-ratio-table">
        <thead>
          <tr>
            <Th k="symbol">合约</Th>
            <Th k="ratioLs">
              <span title="overview 快照：多估算名义 ÷ 空估算名义">
                多∶空名义比
              </span>
            </Th>
            <Th k="longNotional">
              <span title="overview 快照：多侧大户 qty × 大户开仓均价（与详情一致）">
                估算名义（多）
              </span>
            </Th>
            <Th k="shortNotional">
              <span title="overview 快照：空侧大户 qty × 大户开仓均价（与详情一致）">
                估算名义（空）
              </span>
            </Th>
            <Th k="totalNs">名义合计</Th>
            <Th k="absNet">净名义</Th>
            <th className="th-no-sort">净方向</th>
            <th className="th-no-sort">操作</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={`${r.symbol}-${i}`}
              className={onOpenDetail ? 'sig-row' : undefined}
              style={{ animationDelay: `${Math.min(i, 20) * 24}ms` }}
              onClick={
                onOpenDetail ? () => onOpenDetail(r.symbol) : undefined
              }
            >
              <td>
                <span className="sym">{r.symbol.replace(/USDT$/i, '')}</span>
              </td>
              <td className="mono num" title="偏多「x∶1」，偏空「1∶x」">
                {r.ratioLabel}
              </td>
              <td className="mono num muted-soft">{fmtUsd(r.longNotional)}</td>
              <td className="mono num muted-soft">{fmtUsd(r.shortNotional)}</td>
              <td className="mono num muted-soft">
                {fmtUsd(Math.abs(r.longNotional) + Math.abs(r.shortNotional))}
              </td>
              <td className="mono num">{fmtUsd(Math.abs(r.netNotional))}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <span
                  className={`sm-side sm-side--${r.side.toLowerCase()}`}
                >
                  {r.side}
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
                <BinanceFuturesLink symbol={r.symbol}>BN →</BinanceFuturesLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
