import type { SmartMoneyOverviewData } from '../lib/api/smartMoneyFutures'
import { formatCoinPrice } from '../lib/formatPrice'

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const a = Math.abs(n)
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

function sideNotional(d: SmartMoneyOverviewData, side: 'long' | 'short'): number {
  if (side === 'long') {
    return (
      d.longTradersQty * d.longTradersAvgEntryPrice +
      d.longWhalesQty * d.longWhalesAvgEntryPrice
    )
  }
  return (
    d.shortTradersQty * d.shortTradersAvgEntryPrice +
    d.shortWhalesQty * d.shortWhalesAvgEntryPrice
  )
}

function weightedEntry(d: SmartMoneyOverviewData, side: 'long' | 'short'): number {
  if (side === 'long') {
    const q = d.longTradersQty + d.longWhalesQty
    if (q <= 0) return 0
    return sideNotional(d, 'long') / q
  }
  const q = d.shortTradersQty + d.shortWhalesQty
  if (q <= 0) return 0
  return sideNotional(d, 'short') / q
}

export function SmartMoneyOverviewPanel({
  data,
}: {
  data: SmartMoneyOverviewData
}) {
  const longN = sideNotional(data, 'long')
  const shortN = sideNotional(data, 'short')
  const sumN = longN + shortN
  const longPct = sumN > 0 ? (longN / sumN) * 100 : 50

  const longPeople = data.longTraders + data.longWhales
  const shortPeople = data.shortTraders + data.shortWhales
  const longProfit =
    data.longProfitTraders + data.longProfitWhales
  const shortProfit =
    data.shortProfitTraders + data.shortProfitWhales
  const longWin =
    longPeople > 0 ? (longProfit / longPeople) * 100 : 0
  const shortWin =
    shortPeople > 0 ? (shortProfit / shortPeople) * 100 : 0

  const longEntry = weightedEntry(data, 'long')
  const shortEntry = weightedEntry(data, 'short')

  const base = data.symbol.replace(/USDT$/i, '')

  return (
    <div className="sm-overview">
      <div className="sm-overview-head">
        <div className="sm-overview-chip">
          <span className="sm-overview-chip-label">总持仓名义</span>
          <span className="sm-overview-chip-value mono">
            {fmtUsd(data.totalPositions)}
          </span>
        </div>
        <div className="sm-overview-chip">
          <span className="sm-overview-chip-label">交易者总数</span>
          <span className="sm-overview-chip-value mono">
            {data.totalTraders.toLocaleString()}
          </span>
        </div>
        <div className="sm-overview-chip sm-overview-chip-wide">
          <span className="sm-overview-chip-label">名义多空比（多/空）</span>
          <span className="sm-overview-chip-value mono" title="接口字段 longShortRatio">
            {Number.isFinite(data.longShortRatio)
              ? `${data.longShortRatio.toFixed(3)}∶1`
              : '—'}
          </span>
        </div>
      </div>

      <div className="sm-overview-bar-wrap" aria-hidden>
        <div
          className="sm-overview-bar sm-overview-bar-long"
          style={{ width: `${longPct}%` }}
        />
        <div
          className="sm-overview-bar sm-overview-bar-short"
          style={{ width: `${100 - longPct}%` }}
        />
      </div>
      <p className="muted small sm-overview-bar-legend">
        条带为按开仓价估算的多空名义占比（{longPct.toFixed(1)}% /{' '}
        {(100 - longPct).toFixed(1)}%）；与上方比值相互校验。
      </p>

      <div className="sm-overview-cols">
        <div className="sm-overview-side sm-overview-side-long">
          <div className="sm-overview-side-head">
            <span className="sm-overview-badge sm-overview-badge-long">
              多
            </span>
            <span className="sm-overview-side-title">
              {longPeople.toLocaleString()} 人
            </span>
            {longWin >= 50 ? (
              <span className="sm-overview-tag sm-overview-tag-up">
                盈利人数占优
              </span>
            ) : (
              <span className="sm-overview-tag sm-overview-tag-mid">
                亏损人数偏多
              </span>
            )}
          </div>
          <dl className="sm-overview-dl">
            <div>
              <dt>估算名义（多）</dt>
              <dd className="mono">{fmtUsd(longN)}</dd>
            </div>
            <div>
              <dt>加权均价（{base}）</dt>
              <dd className="mono">{formatCoinPrice(longEntry)}</dd>
            </div>
            <div>
              <dt>普通 / 大户</dt>
              <dd className="mono">
                {data.longTraders} / {data.longWhales}
              </dd>
            </div>
            <div>
              <dt>持仓量（普通+大户）</dt>
              <dd className="mono">
                {(data.longTradersQty + data.longWhalesQty).toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })}{' '}
                {base}
              </dd>
            </div>
            <div>
              <dt>盈利人数占比</dt>
              <dd className="mono sm-overview-win">
                {longPeople > 0 ? `${longWin.toFixed(2)}%` : '—'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="sm-overview-divider" />

        <div className="sm-overview-side sm-overview-side-short">
          <div className="sm-overview-side-head">
            <span className="sm-overview-badge sm-overview-badge-short">
              空
            </span>
            <span className="sm-overview-side-title">
              {shortPeople.toLocaleString()} 人
            </span>
            {shortWin >= 50 ? (
              <span className="sm-overview-tag sm-overview-tag-up">
                盈利人数占优
              </span>
            ) : (
              <span className="sm-overview-tag sm-overview-tag-down">
                亏损人数偏多
              </span>
            )}
          </div>
          <dl className="sm-overview-dl">
            <div>
              <dt>估算名义（空）</dt>
              <dd className="mono">{fmtUsd(shortN)}</dd>
            </div>
            <div>
              <dt>加权均价（{base}）</dt>
              <dd className="mono">{formatCoinPrice(shortEntry)}</dd>
            </div>
            <div>
              <dt>普通 / 大户</dt>
              <dd className="mono">
                {data.shortTraders} / {data.shortWhales}
              </dd>
            </div>
            <div>
              <dt>持仓量（普通+大户）</dt>
              <dd className="mono">
                {(data.shortTradersQty + data.shortWhalesQty).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 4 },
                )}{' '}
                {base}
              </dd>
            </div>
            <div>
              <dt>盈利人数占比</dt>
              <dd className="mono sm-overview-win">
                {shortPeople > 0 ? `${shortWin.toFixed(2)}%` : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <p className="muted small sm-overview-foot">
        数据来源 Binance 合约聪明钱公开接口；未实现盈亏等字段接口未返回。普通/大户为接口分桶。
      </p>
    </div>
  )
}
