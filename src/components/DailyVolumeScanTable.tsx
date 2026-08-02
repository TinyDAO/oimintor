import type { DailyVolumeScanRow } from '../lib/dailyVolumeScan'
import { BinanceFuturesLink } from './BinanceLink'
import { DailyVolumeSpark } from './DailyVolumeSpark'

function compactVolume(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return value.toFixed(2)
}

export function DailyVolumeScanTable({
  rows,
  onOpenDetail,
}: {
  rows: DailyVolumeScanRow[]
  onOpenDetail: (symbol: string) => void
}) {
  return (
    <div className="table-wrap sm-futures-wrap">
      <table className="sig-table daily-volume-table">
        <thead>
          <tr>
            <th>#</th>
            <th>合约</th>
            <th>放量倍数</th>
            <th>近 3 日均量</th>
            <th>此前 7 日均量</th>
            <th>30 日成交量走势</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.symbol}
              className="sig-row"
              style={{ animationDelay: `${Math.min(index, 20) * 24}ms` }}
              onClick={() => onOpenDetail(row.symbol)}
            >
              <td className="mono num muted-soft">{index + 1}</td>
              <td>
                <span className="sym">{row.symbol.replace(/USDT$/i, '')}</span>
              </td>
              <td className="mono num daily-volume-multiple">
                {row.multiple.toFixed(2)}x
              </td>
              <td className="mono num">{compactVolume(row.recent3Avg)}</td>
              <td className="mono num muted-soft">
                {compactVolume(row.baseline7Avg)}
              </td>
              <td className="daily-volume-chart-cell">
                <DailyVolumeSpark candles={row.candles} />
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
