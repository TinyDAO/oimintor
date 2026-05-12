import { useState } from 'react'
import type {
  SmOverviewValueScanRow,
  SmOverviewValueSide,
} from '../lib/smOverviewValueScan'
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

export function SmOverviewValueScanTable({
  longRows,
  shortRows,
  onOpenDetail,
}: {
  longRows: SmOverviewValueScanRow[]
  shortRows: SmOverviewValueScanRow[]
  onOpenDetail?: (symbol: string) => void
}) {
  const [tab, setTab] = useState<SmOverviewValueSide>('long')
  const rows = tab === 'long' ? longRows : shortRows

  return (
    <div className="sm-overview-value-scan">
      <div className="view-tabs sm-scan-tabs" aria-label="聪明扫描方向">
        <button
          type="button"
          className={tab === 'long' ? 'view-tab on' : 'view-tab'}
          onClick={() => setTab('long')}
        >
          多单 {longRows.length}
        </button>
        <button
          type="button"
          className={tab === 'short' ? 'view-tab on' : 'view-tab'}
          onClick={() => setTab('short')}
        >
          空单 {shortRows.length}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="muted small" style={{ margin: '0.35rem 0 0' }}>
          暂无 {sideLabel(tab)} overview 大户名义超过 $10M 的合约。
        </p>
      ) : (
        <div className="table-wrap sm-futures-wrap">
          <table className="sig-table sm-futures-table sm-overview-value-table">
            <thead>
              <tr>
                <th scope="col">合约</th>
                <th scope="col" className="num">
                  {sideLabel(tab)}价值
                </th>
                <th scope="col" className="num">
                  对侧价值
                </th>
                <th scope="col" className="num">
                  大户数
                </th>
                <th scope="col" className="num">
                  交易者数
                </th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.side}-${r.symbol}`}
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
                    {r.isNew ? (
                      <span className="sm-scan-new-badge">NEW</span>
                    ) : null}
                  </td>
                  <td className="mono num">{fmtUsd(r.notional)}</td>
                  <td className="mono num muted-soft">
                    {fmtUsd(r.oppositeNotional)}
                  </td>
                  <td className="mono num muted-soft">
                    {tab === 'long' ? r.longWhales : r.shortWhales}
                  </td>
                  <td className="mono num muted-soft">
                    {tab === 'long' ? r.longTraders : r.shortTraders}
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
      )}
    </div>
  )
}

