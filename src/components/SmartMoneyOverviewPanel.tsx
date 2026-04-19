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

/** 带符号的 USDT 金额（盈亏），用于估算展示 */
function fmtUsdSigned(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  const a = Math.abs(n)
  let body: string
  if (a >= 1e9) body = `${(a / 1e9).toFixed(2)}B`
  else if (a >= 1e6) body = `${(a / 1e6).toFixed(2)}M`
  else if (a >= 1e3) body = `${(a / 1e3).toFixed(1)}k`
  else body = a.toFixed(0)
  return `${sign}$${body}`
}

function pnlClass(n: number): string {
  if (!Number.isFinite(n) || n === 0) return 'sm-overview-pnl-val-flat'
  return n > 0 ? 'sm-overview-pnl-val-up' : 'sm-overview-pnl-val-down'
}

function estimateBucketUpl(
  d: SmartMoneyOverviewData,
  mark: number,
): {
  longTrader: number
  longWhale: number
  shortTrader: number
  shortWhale: number
} {
  return {
    longTrader:
      (mark - d.longTradersAvgEntryPrice) * d.longTradersQty,
    longWhale: (mark - d.longWhalesAvgEntryPrice) * d.longWhalesQty,
    shortTrader:
      (d.shortTradersAvgEntryPrice - mark) * d.shortTradersQty,
    shortWhale:
      (d.shortWhalesAvgEntryPrice - mark) * d.shortWhalesQty,
  }
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
  markPriceUsd,
}: {
  data: SmartMoneyOverviewData
  /** 永续标记价（USDT）；用于估算分桶未实现盈亏 */
  markPriceUsd?: number
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

  const markOk =
    markPriceUsd != null && Number.isFinite(markPriceUsd) && markPriceUsd > 0
  const upl = markOk
    ? estimateBucketUpl(data, markPriceUsd!)
    : null
  const longUplTotal = upl
    ? upl.longTrader + upl.longWhale
    : NaN
  const shortUplTotal = upl
    ? upl.shortTrader + upl.shortWhale
    : NaN
  const netUpl =
    upl != null ? longUplTotal + shortUplTotal : NaN

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

      <div className="sm-overview-pnl">
        <div className="sm-overview-pnl-title">
          估算未实现盈亏（USDT）
          {markOk ? (
            <span className="sm-overview-pnl-mark muted small">
              标记价 {formatCoinPrice(markPriceUsd!)}
            </span>
          ) : (
            <span className="sm-overview-pnl-mark muted small">
              待标记价加载后按均价估算
            </span>
          )}
        </div>
        {markOk && upl ? (
          <dl className="sm-overview-pnl-dl">
            <div>
              <dt>多头 · 普通</dt>
              <dd className={`mono ${pnlClass(upl.longTrader)}`}>
                {fmtUsdSigned(upl.longTrader)}
              </dd>
            </div>
            <div>
              <dt>多头 · 大户</dt>
              <dd className={`mono ${pnlClass(upl.longWhale)}`}>
                {fmtUsdSigned(upl.longWhale)}
              </dd>
            </div>
            <div className="sm-overview-pnl-subtotal">
              <dt>多头 · 合计</dt>
              <dd className={`mono ${pnlClass(longUplTotal)}`}>
                {fmtUsdSigned(longUplTotal)}
              </dd>
            </div>
            <div>
              <dt>空头 · 普通</dt>
              <dd className={`mono ${pnlClass(upl.shortTrader)}`}>
                {fmtUsdSigned(upl.shortTrader)}
              </dd>
            </div>
            <div>
              <dt>空头 · 大户</dt>
              <dd className={`mono ${pnlClass(upl.shortWhale)}`}>
                {fmtUsdSigned(upl.shortWhale)}
              </dd>
            </div>
            <div className="sm-overview-pnl-subtotal">
              <dt>空头 · 合计</dt>
              <dd className={`mono ${pnlClass(shortUplTotal)}`}>
                {fmtUsdSigned(shortUplTotal)}
              </dd>
            </div>
            <div className="sm-overview-pnl-net">
              <dt>多空净额（聪明钱侧）</dt>
              <dd className={`mono ${pnlClass(netUpl)}`}>
                {fmtUsdSigned(netUpl)}
              </dd>
            </div>
          </dl>
        ) : null}
        {markOk &&
        upl &&
        longUplTotal < 0 &&
        shortUplTotal < 0 &&
        longEntry > markPriceUsd! &&
        shortEntry < markPriceUsd! ? (
          <p className="muted small sm-overview-pnl-note">
            标记价介于多空加权均价之间时，聪明钱多头与空头可同时为浮亏：多头开仓整体偏高、空头开仓整体偏低，现价落在中间则两侧相对入场价都吃亏。全市场近似零和，此处未计入对手盘（非聪明钱）。
          </p>
        ) : null}
        {!markOk || !upl ? (
          <p className="muted small sm-overview-pnl-wait">
            接口不直接返回盈亏金额；指数区标记价就绪后，此处用「持仓量 ×（标记价 −
            分桶均价）」估算多头，空头方向相反。
          </p>
        ) : null}
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
        数据来源 Binance 合约聪明钱公开接口。盈亏金额为按标记价与分桶持仓均价的估算，非官方逐笔汇总；普通/大户为接口分桶。聪明钱仅为市场子集，多空两侧估算盈亏之和不必为零（对手多为非聪明钱）。
      </p>
    </div>
  )
}
