import { useMemo, useState } from 'react'
import type {
  SmOverviewValueDelistedRow,
  SmOverviewValueScanRow,
  SmOverviewValueSide,
} from '../lib/smOverviewValueScan'
import { SM_OVERVIEW_VALUE_MIN_NOTIONAL } from '../lib/smOverviewValueScan'
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
  const [tab, setTab] = useState<SmOverviewValueSide>('long')
  const [hideInverted, setHideInverted] = useState(false)
  const rawRows = tab === 'long' ? longRows : shortRows
  const rows = useMemo(() => {
    const filtered = hideInverted
      ? rawRows.filter((r) => r.oppositeNotional <= r.notional)
      : rawRows
    return [...filtered].sort((a, b) => {
      const strengthA = a.notional - a.oppositeNotional
      const strengthB = b.notional - b.oppositeNotional
      if (strengthB !== strengthA) return strengthB - strengthA
      return a.symbol.localeCompare(b.symbol)
    })
  }, [hideInverted, rawRows])

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
        <label className="chk sm-scan-filter">
          <input
            type="checkbox"
            checked={hideInverted}
            onChange={(e) => setHideInverted(e.target.checked)}
          />
          隐藏红色背景
        </label>
      </div>

      {rawRows.length === 0 ? (
        <p className="muted small" style={{ margin: '0.35rem 0 0' }}>
          暂无 {sideLabel(tab)} overview 大户名义超过{' '}
          {fmtUsd(SM_OVERVIEW_VALUE_MIN_NOTIONAL)} 的合约。
        </p>
      ) : rows.length === 0 ? (
        <p className="muted small" style={{ margin: '0.35rem 0 0' }}>
          当前 {sideLabel(tab)} 列表已全部被「隐藏红色背景」过滤。
        </p>
      ) : (
        <div className="table-wrap sm-futures-wrap">
          <table className="sig-table sm-futures-table sm-overview-value-table">
            <thead>
              <tr>
                <th scope="col">合约</th>
                <th scope="col" className="num">
                  绝对强度
                </th>
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
              {rows.map((r, i) => {
                const inverted = r.oppositeNotional > r.notional
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
                        </span>
                      ) : null}
                    </td>
                    <td className="mono num">
                      {fmtUsd(r.notional - r.oppositeNotional)}
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
    </div>
  )
}

