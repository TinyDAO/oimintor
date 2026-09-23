import { useMemo, useState } from 'react'
import type { AlphaFuturesScanRow } from '../lib/alphaFuturesScan'
import { BinanceFuturesLink } from './BinanceLink'
import { DailyVolumeSpark } from './DailyVolumeSpark'

type SortKey =
  | 'marketCap'
  | 'priceChange24h'
  | 'fundingRate'
  | 'accountLongShort'
  | 'topPositionLongShort'
  | 'smartLongShort'
  | 'quoteVolume30d'
  | 'volumeMultiple'

function compactUsd(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  const n = abs
  if (n >= 1e12) return `${sign}$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `${sign}$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${sign}$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${sign}$${(n / 1e3).toFixed(1)}K`
  return `${sign}$${n.toFixed(0)}`
}

function compactCount(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return String(Math.round(value))
}

function ratioText(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(2)
}

function ratioClass(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'muted-soft'
  if (value >= 1.15) return 'value-up'
  if (value <= 0.87) return 'value-down'
  return ''
}

function changeClass(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value === 0) return 'value-flat'
  return value > 0 ? 'value-up' : 'value-down'
}

function sortValue(row: AlphaFuturesScanRow, key: SortKey): number {
  const value = row[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return key === 'marketCap' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
  }
  if (key === 'marketCap' && value <= 0) return Number.POSITIVE_INFINITY
  return value
}

export function AlphaFuturesScanTable({
  rows,
  onOpenDetail,
}: {
  rows: AlphaFuturesScanRow[]
  onOpenDetail: (symbol: string) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('marketCap')
  const [sortAsc, setSortAsc] = useState(true)

  const sorted = useMemo(() => {
    const next = [...rows]
    next.sort((a, b) => {
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      if (av !== bv) return sortAsc ? av - bv : bv - av
      return a.symbol.localeCompare(b.symbol)
    })
    return next
  }, [rows, sortAsc, sortKey])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v)
      return
    }
    setSortKey(key)
    setSortAsc(key === 'marketCap')
  }

  function sortMark(key: SortKey): string {
    if (sortKey !== key) return ''
    return sortAsc ? ' ↑' : ' ↓'
  }

  return (
    <div className="table-wrap sm-futures-wrap">
      <table className="sig-table daily-volume-table alpha-futures-table">
        <thead>
          <tr>
            <th>#</th>
            <th>合约</th>
            <th>
              <button type="button" className="th-sort" onClick={() => toggleSort('marketCap')}>
                市值{sortMark('marketCap')}
              </button>
            </th>
            <th>
              <button
                type="button"
                className="th-sort"
                onClick={() => toggleSort('priceChange24h')}
              >
                24h{sortMark('priceChange24h')}
              </button>
            </th>
            <th>
              <button
                type="button"
                className="th-sort"
                onClick={() => toggleSort('fundingRate')}
                title="最近一次资金费率。正值表示多头付给空头"
              >
                资金费率{sortMark('fundingRate')}
              </button>
            </th>
            <th>
              <button
                type="button"
                className="th-sort"
                onClick={() => toggleSort('accountLongShort')}
                title="全体账户多空比：多头账户数 / 空头账户数，大于 1 偏多"
              >
                账户多空{sortMark('accountLongShort')}
              </button>
            </th>
            <th>
              <button
                type="button"
                className="th-sort"
                onClick={() => toggleSort('topPositionLongShort')}
                title="大户持仓多空比：大户多头持仓 / 大户空头持仓"
              >
                大户持仓{sortMark('topPositionLongShort')}
              </button>
            </th>
            <th>
              <button
                type="button"
                className="th-sort"
                onClick={() => toggleSort('smartLongShort')}
                title="聪明钱全体持仓数量比：多头 qty / 空头 qty"
              >
                聪明钱多空{sortMark('smartLongShort')}
              </button>
            </th>
            <th>聪明钱名义</th>
            <th>
              <button
                type="button"
                className="th-sort"
                onClick={() => toggleSort('quoteVolume30d')}
              >
                30日成交额{sortMark('quoteVolume30d')}
              </button>
            </th>
            <th>30日成交额走势</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr
              key={row.symbol}
              className="sig-row"
              style={{ animationDelay: `${Math.min(index, 20) * 24}ms` }}
              onClick={() => onOpenDetail(row.symbol)}
            >
              <td className="mono num muted-soft">{index + 1}</td>
              <td>
                <span className="sym">{row.symbol.replace(/USDT$/i, '')}</span>
                <span className="alpha-futures-sub muted-soft">
                  {row.name}
                  {row.holders != null ? ` · ${compactCount(row.holders)} 持有` : ''}
                </span>
              </td>
              <td className="mono num">
                {row.marketCap > 0 ? compactUsd(row.marketCap) : '—'}
              </td>
              <td className={`mono num ${changeClass(row.priceChange24h)}`}>
                {row.priceChange24h == null
                  ? '—'
                  : `${row.priceChange24h > 0 ? '+' : ''}${row.priceChange24h.toFixed(2)}%`}
              </td>
              <td className={`mono num ${changeClass(row.fundingRate)}`}>
                {row.fundingRate == null
                  ? '—'
                  : `${row.fundingRate > 0 ? '+' : ''}${(row.fundingRate * 100).toFixed(4)}%`}
              </td>
              <td className={`mono num ${ratioClass(row.accountLongShort)}`}>
                {ratioText(row.accountLongShort)}
              </td>
              <td className={`mono num ${ratioClass(row.topPositionLongShort)}`}>
                {ratioText(row.topPositionLongShort)}
              </td>
              <td className={`mono num ${ratioClass(row.smartLongShort)}`}>
                <div>{ratioText(row.smartLongShort)}</div>
                {row.smartLongTraders != null || row.smartShortTraders != null ? (
                  <div className="alpha-futures-sub muted-soft">
                    多 {row.smartLongTraders ?? 0} / 空 {row.smartShortTraders ?? 0}
                  </div>
                ) : null}
              </td>
              <td className="mono num">
                {row.smartLongNotional == null && row.smartShortNotional == null ? (
                  <span className="muted-soft">—</span>
                ) : (
                  <>
                    <div className="value-up">
                      多 {row.smartLongNotional != null ? compactUsd(row.smartLongNotional) : '—'}
                    </div>
                    <div className="value-down">
                      空 {row.smartShortNotional != null ? compactUsd(row.smartShortNotional) : '—'}
                    </div>
                  </>
                )}
              </td>
              <td className="mono num">
                <div>{compactUsd(row.quoteVolume30d)}</div>
                {row.volumeMultiple != null ? (
                  <div
                    className={`alpha-futures-sub ${row.volumeMultiple >= 3 ? 'daily-volume-multiple' : 'muted-soft'}`}
                    title="最近 3 个完整日平均成交额 / 此前 7 个完整日"
                  >
                    近3/前7 {row.volumeMultiple.toFixed(2)}x
                  </div>
                ) : null}
              </td>
              <td className="daily-volume-chart-cell">
                {row.volumeBars.length > 0 ? (
                  <DailyVolumeSpark
                    candles={row.volumeBars}
                    metricLabel="成交额 USDT"
                  />
                ) : (
                  <span className="spark-empty">暂无完整日</span>
                )}
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn btn-ghost small sm-futures-detail-btn"
                  onClick={() => onOpenDetail(row.symbol)}
                >
                  详情
                </button>
                <BinanceFuturesLink symbol={row.symbol}>BN →</BinanceFuturesLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
