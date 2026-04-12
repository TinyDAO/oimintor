import type { SpotTokenMarketInfo } from '../lib/api/coinGecko'
import { formatCoinPrice } from '../lib/formatPrice'

function fmtUsdCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const a = Math.abs(n)
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `$${(n / 1e3).toFixed(2)}k`
  return `$${n.toFixed(2)}`
}

function fmtPct(n: number | null | undefined, digits = 4): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(digits)}%`
}

function fmtSupply(n: number | null | undefined, sym: string): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${sym}`
}

function fmtMaxSupply(n: number | null | undefined, sym: string): string {
  if (n == null || !Number.isFinite(n)) return `∞ ${sym}`
  return fmtSupply(n, sym)
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toISOString().slice(0, 10)
}

export function SpotTokenInfoPanel({
  baseSymbol,
  info,
  loading,
  error,
}: {
  baseSymbol: string
  info: SpotTokenMarketInfo | null
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
          未在 CoinGecko 检索到「{baseSymbol}」对应条目（新币或符号不一致时常见）。
        </p>
      </div>
    )
  }

  const sym = info.symbol

  return (
    <div className="spot-token-info">
      <p className="muted small spot-token-info-lead">
        {info.name}（{sym}）·{' '}
        <a href={info.cgUrl} target="_blank" rel="noreferrer noopener">
          CoinGecko →
        </a>
      </p>
      <dl className="alpha-dl spot-token-dl">
        <div>
          <dt>排行</dt>
          <dd className="mono">
            {info.rank != null ? `No. ${info.rank}` : '—'}
          </dd>
        </div>
        <div>
          <dt>市值</dt>
          <dd className="mono">{fmtUsdCompact(info.marketCapUsd)}</dd>
        </div>
        <div>
          <dt>完全稀释市值</dt>
          <dd className="mono">{fmtUsdCompact(info.fdvUsd)}</dd>
        </div>
        <div>
          <dt>市场占有率</dt>
          <dd className="mono">{fmtPct(info.marketSharePct)}</dd>
        </div>
        <div>
          <dt>成交量（24h）</dt>
          <dd className="mono">{fmtUsdCompact(info.volume24hUsd)}</dd>
        </div>
        <div>
          <dt>成交量 / 市值</dt>
          <dd className="mono">{fmtPct(info.volToMcapRatioPct, 2)}</dd>
        </div>
        <div>
          <dt>流通数量</dt>
          <dd className="mono">{fmtSupply(info.circulatingSupply, sym)}</dd>
        </div>
        <div>
          <dt>最大供应</dt>
          <dd className="mono">{fmtMaxSupply(info.maxSupply, sym)}</dd>
        </div>
        <div>
          <dt>总供应</dt>
          <dd className="mono">{fmtSupply(info.totalSupply, sym)}</dd>
        </div>
        <div>
          <dt>场内持仓集中度</dt>
          <dd className="muted small">
            —
            <span className="spot-token-note">（CoinGecko 不提供）</span>
          </dd>
        </div>
        <div>
          <dt>发行日期</dt>
          <dd>{fmtDate(info.genesisDate)}</dd>
        </div>
        <div>
          <dt>发行价</dt>
          <dd className="mono">
            {info.icoUsdHint ?? (
              <span className="muted">—</span>
            )}
            {!info.icoUsdHint ? (
              <span className="spot-token-note muted small">
                （多数币种无公开 ICO 价）
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>历史最高价</dt>
          <dd className="mono">
            {info.athUsd != null && Number.isFinite(info.athUsd)
              ? `$${formatCoinPrice(info.athUsd)}`
              : '—'}
            {info.athDate ? (
              <span className="muted small" style={{ marginLeft: '0.35rem' }}>
                ({fmtDate(info.athDate)})
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
    </div>
  )
}
