import type { BinanceSpotDrawerInfo } from '../lib/api/binanceSpot'
import { formatCoinPrice } from '../lib/formatPrice'

function n(s: string): number {
  return parseFloat(s)
}

function fmtUsdVol(s: string): string {
  const v = n(s)
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `$${(v / 1e3).toFixed(2)}k`
  return `$${v.toFixed(2)}`
}

function fmtBaseVol(s: string, sym: string): string {
  const v = n(s)
  if (!Number.isFinite(v)) return '—'
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${sym}`
}

function fmtPriceStr(s: string): string {
  const v = n(s)
  if (!Number.isFinite(v)) return '—'
  return formatCoinPrice(v)
}

export function SpotTokenInfoPanel({
  baseSymbol,
  info,
  loading,
  error,
}: {
  baseSymbol: string
  info: BinanceSpotDrawerInfo | null
  loading: boolean
  error: string | null
}) {
  if (loading) {
    return (
      <div className="spot-token-info">
        <div className="sk sk-line" style={{ height: 120, borderRadius: 6 }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="spot-token-info">
        <p className="muted small">{error}</p>
      </div>
    )
  }

  if (!info) {
    return (
      <div className="spot-token-info">
        <p className="muted small">
          Binance 现货无「{baseSymbol}USDT」交易对，或已下架 / 与合约标的命名不一致。
        </p>
      </div>
    )
  }

  const base = info.baseAsset
  const pct = n(info.priceChangePercent)

  return (
    <div className="spot-token-info">
      <p className="muted small spot-token-info-lead">
        现货 {info.spotSymbol}（{info.status}）·{' '}
        <a href={info.tradeUrl} target="_blank" rel="noreferrer noopener">
          Binance 现货 →
        </a>
      </p>
      <p className="muted small" style={{ marginBottom: '0.45rem' }}>
        数据来自 Binance 现货公开 REST（/api/v3），不含市值排行、流通量等字段。
      </p>
      <dl className="alpha-dl spot-token-dl">
        <div>
          <dt>最新价</dt>
          <dd className="mono">{fmtPriceStr(info.lastPrice)} USDT</dd>
        </div>
        <div>
          <dt>24h 涨跌</dt>
          <dd className="mono">
            {Number.isFinite(pct) ? (
              <span
                style={{
                  color:
                    pct > 0 ? '#3fb950' : pct < 0 ? '#f85149' : undefined,
                }}
              >
                {pct >= 0 ? '+' : ''}
                {pct.toFixed(2)}%
              </span>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt>24h 高低</dt>
          <dd className="mono">
            {fmtPriceStr(info.highPrice)} / {fmtPriceStr(info.lowPrice)}
          </dd>
        </div>
        <div>
          <dt>24h 开盘价</dt>
          <dd className="mono">{fmtPriceStr(info.openPrice)}</dd>
        </div>
        <div>
          <dt>加权平均价（24h）</dt>
          <dd className="mono">{fmtPriceStr(info.weightedAvgPrice)}</dd>
        </div>
        <div>
          <dt>24h 成交额（计价）</dt>
          <dd className="mono">{fmtUsdVol(info.quoteVolume)}</dd>
        </div>
        <div>
          <dt>24h 成交量（基币）</dt>
          <dd className="mono">{fmtBaseVol(info.volumeBase, base)}</dd>
        </div>
        <div>
          <dt>24h 成交笔数</dt>
          <dd className="mono">
            {info.count != null ? info.count.toLocaleString() : '—'}
          </dd>
        </div>
      </dl>
    </div>
  )
}
