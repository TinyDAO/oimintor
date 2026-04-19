import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { SmartMoneyFuturesRow } from '../lib/api/smartMoneyFutures'
import { BinanceFuturesLink } from './BinanceLink'

function fmtUsd(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

type SortKey = 'absNet' | 'symbol' | 'side' | 'netPct'

function netNotionalPct(r: SmartMoneyFuturesRow): number {
  const denom = Math.abs(r.longNotional) + Math.abs(r.shortNotional)
  if (!Number.isFinite(denom) || denom <= 0) return 0
  return (Math.abs(r.netNotional) / denom) * 100
}

function compareRows(
  a: SmartMoneyFuturesRow,
  b: SmartMoneyFuturesRow,
  key: SortKey,
  dir: 'asc' | 'desc',
): number {
  const mult = dir === 'asc' ? 1 : -1
  if (key === 'symbol') {
    const c = a.symbol.localeCompare(b.symbol)
    return mult * (c || 0)
  }
  if (key === 'side') {
    const c = a.side.localeCompare(b.side)
    return mult * (c || a.symbol.localeCompare(b.symbol))
  }
  if (key === 'netPct') {
    const na = netNotionalPct(a)
    const nb = netNotionalPct(b)
    if (na === nb) return a.symbol.localeCompare(b.symbol)
    return mult * (na < nb ? -1 : 1)
  }
  const na = Math.abs(a.netNotional)
  const nb = Math.abs(b.netNotional)
  if (na === nb) return a.symbol.localeCompare(b.symbol)
  return mult * (na < nb ? -1 : 1)
}

export function SmartMoneyFuturesTable({
  rows,
  onOpenDetail,
}: {
  rows: SmartMoneyFuturesRow[]
  /** 打开与 OI 榜相同的合约详情抽屉（拉取单合约结构数据） */
  onOpenDetail?: (symbol: string) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('absNet')
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
      <table className="sig-table sm-futures-table">
        <thead>
          <tr>
            <Th k="symbol">合约</Th>
            <Th k="side">净方向</Th>
            <Th k="absNet">净名义</Th>
            <Th k="netPct">成交量占比</Th>
            <th className="th-no-sort">多名义</th>
            <th className="th-no-sort">空名义</th>
            <th className="th-no-sort">多·人数</th>
            <th className="th-no-sort">空·人数</th>
            <th className="th-no-sort">操作</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const longP = r.longTraders + r.longWhales
            const shortP = r.shortTraders + r.shortWhales
            return (
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
                <td>
                  <span className={`sm-side sm-side--${r.side.toLowerCase()}`}>
                    {r.side}
                  </span>
                </td>
                <td className="mono num">{fmtUsd(Math.abs(r.netNotional))}</td>
                <td className="mono num">{netNotionalPct(r).toFixed(2)}%</td>
                <td className="mono num muted-soft">{fmtUsd(r.longNotional)}</td>
                <td className="mono num muted-soft">{fmtUsd(r.shortNotional)}</td>
                <td className="mono num sm-people">
                  {longP}
                  <span className="sm-wh">
                    （鲸 {r.longWhales}）
                  </span>
                </td>
                <td className="mono num sm-people">
                  {shortP}
                  <span className="sm-wh">
                    （鲸 {r.shortWhales}）
                  </span>
                </td>
                <td
                  className="sm-futures-actions"
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
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
