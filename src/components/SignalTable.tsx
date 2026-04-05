import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { SymbolInsight } from '../lib/signals/compute'
import { BinanceFuturesLink } from './BinanceLink'
import { RatioSpark } from './RatioSpark'

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`sig-flag ${on ? 'on' : ''}`} title={label}>
      {label}
    </span>
  )
}

export type SortKey =
  | 'symbol'
  | 'pricePct'
  | 'pricePct7d'
  | 'oiPct'
  | 'oiPct7d'
  | 'globalLsr'
  | 'topPosLsr'
  | 'spread'
  | 'structure'

function flagCount(r: SymbolInsight): number {
  const f = r.flags
  return (
    Number(f.oiSpike) +
    Number(f.accumulation) +
    Number(f.trendLeverage) +
    Number(f.userTopDivergence)
  )
}

function getVal(r: SymbolInsight, key: SortKey): number | string {
  switch (key) {
    case 'symbol':
      return r.symbol
    case 'pricePct':
      return parseFloat(r.ticker.priceChangePercent)
    case 'pricePct7d':
      return r.priceChange7dPct
    case 'oiPct':
      return r.oiChangePct
    case 'oiPct7d':
      return r.oiChange7dPct
    case 'globalLsr':
      return r.globalLsr
    case 'topPosLsr':
      return r.topPosLsr
    case 'spread':
      return r.spread
    case 'structure':
      return flagCount(r)
    default:
      return 0
  }
}

function compare(
  a: SymbolInsight,
  b: SymbolInsight,
  key: SortKey,
  dir: 'asc' | 'desc',
): number {
  const va = getVal(a, key)
  const vb = getVal(b, key)
  const mult = dir === 'asc' ? 1 : -1
  if (typeof va === 'string' && typeof vb === 'string') {
    return mult * va.localeCompare(vb)
  }
  const na = typeof va === 'number' ? va : 0
  const nb = typeof vb === 'number' ? vb : 0
  if (na === nb) return a.symbol.localeCompare(b.symbol)
  return mult * (na < nb ? -1 : 1)
}

export function SignalTable({
  rows,
  onSelect,
}: {
  rows: SymbolInsight[]
  onSelect: (r: SymbolInsight) => void
}) {
  /** 默认：24h 涨幅倒序（高到低） */
  const [sortKey, setSortKey] = useState<SortKey>('pricePct')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sortedRows = useMemo(() => {
    const list = [...rows]
    list.sort((a, b) => compare(a, b, sortKey, sortDir))
    return list
  }, [rows, sortKey, sortDir])

  function onHeaderClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function SortBtn({
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
      <button
        type="button"
        className={`th-sort ${active ? 'active' : ''} ${className}`}
        onClick={(e) => {
          e.stopPropagation()
          onHeaderClick(k)
        }}
        aria-sort={
          active
            ? sortDir === 'asc'
              ? 'ascending'
              : 'descending'
            : 'none'
        }
      >
        <span>{children}</span>
        {arrow ? <span className="sort-arrow">{arrow}</span> : null}
      </button>
    )
  }

  return (
    <div className="table-wrap">
      <table className="sig-table">
        <thead>
          <tr>
            <th>
              <SortBtn k="symbol">合约</SortBtn>
            </th>
            <th>
              <SortBtn k="pricePct">24h涨跌</SortBtn>
            </th>
            <th>
              <SortBtn k="pricePct7d">7d涨跌</SortBtn>
            </th>
            <th>
              <SortBtn k="oiPct">OI Δ24h</SortBtn>
            </th>
            <th>
              <SortBtn k="oiPct7d">OI Δ7d</SortBtn>
            </th>
            <th>
              <SortBtn k="globalLsr">用户LSR</SortBtn>
            </th>
            <th>
              <SortBtn k="topPosLsr">大户持仓LSR</SortBtn>
            </th>
            <th>
              <SortBtn k="spread">Spread</SortBtn>
            </th>
            <th>
              <SortBtn k="structure">结构</SortBtn>
            </th>
            <th className="th-no-sort">多空曲线</th>
            <th className="th-no-sort"></th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r, i) => (
            <tr
              key={r.symbol}
              className="sig-row"
              style={{ animationDelay: `${Math.min(i, 20) * 28}ms` }}
              onClick={() => onSelect(r)}
            >
              <td>
                <span className="sym">
                  {r.symbol.replace('USDT', '')}
                  {r.isAlpha ? <span className="alpha-badge">α</span> : null}
                </span>
              </td>
              <td className="mono num">
                {parseFloat(r.ticker.priceChangePercent).toFixed(2)}%
              </td>
              <td className="mono num">{r.priceChange7dPct.toFixed(2)}%</td>
              <td className="mono num">{r.oiChangePct.toFixed(1)}%</td>
              <td className="mono num">{r.oiChange7dPct.toFixed(1)}%</td>
              <td className="mono num">{r.globalLsr.toFixed(2)}</td>
              <td className="mono num">{r.topPosLsr.toFixed(2)}</td>
              <td className="mono num">{r.spread.toFixed(3)}</td>
              <td>
                <div className="flags">
                  <Flag on={r.flags.oiSpike} label="OI急拉" />
                  <Flag on={r.flags.accumulation} label="价稳OI" />
                  <Flag on={r.flags.trendLeverage} label="趋势杠杆" />
                  <Flag on={r.flags.userTopDivergence} label="用户/大户背离" />
                </div>
              </td>
              <td className="spark-cell">
                <RatioSpark global={r.global} topPos={r.topPos} height={40} />
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <BinanceFuturesLink symbol={r.symbol}>BN →</BinanceFuturesLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
