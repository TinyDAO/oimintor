import type { AlphaToken } from '../lib/api/alpha'
import type { AlphaPulseToken } from '../lib/api/alphaPulse'

function fmtPct(v: string | number | undefined): string {
  if (v === undefined || v === '') return '—'
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!Number.isFinite(n)) return '—'
  return `${n.toFixed(2)}%`
}

function fmtNum(v: string | undefined): string {
  if (v === undefined || v === '') return '—'
  const n = parseFloat(v)
  if (!Number.isFinite(n)) return String(v)
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function fmtInt(v: string | undefined): string {
  if (v === undefined || v === '') return '—'
  const n = parseInt(v, 10)
  if (!Number.isFinite(n)) return String(v)
  return n.toLocaleString()
}

export function AlphaInfoPanel({
  pulse,
  cex,
  loading,
  error,
}: {
  pulse: AlphaPulseToken | null
  cex: AlphaToken | null
  loading: boolean
  error: string | null
}) {
  const holders = pulse?.holders ?? cex?.holders
  const top10 = pulse?.holdersTop10Percent
  const kyc = pulse?.kycHolders
  const mcap = pulse?.marketCap ?? cex?.marketCap
  const liq = pulse?.liquidity ?? cex?.liquidity
  const vol24 = pulse?.volume24h ?? cex?.volume24h
  const cnt24 = pulse?.count24h ?? cex?.count24h
  const pct24 = pulse?.percentChange24h ?? cex?.percentChange24h

  if (loading) {
    return (
      <div className="alpha-info">
        <div className="sk sk-line" style={{ height: 72, borderRadius: 6 }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="alpha-info">
        <p className="muted small">{error}</p>
      </div>
    )
  }

  return (
    <div className="alpha-info">
      <p className="alpha-info-note muted small">
        公开接口仅提供 <strong>Top10 持仓占比</strong>（集中度），不提供 Top10 地址列表。
      </p>
      <dl className="alpha-dl">
        <div>
          <dt>持币人数</dt>
          <dd>{fmtInt(holders)}</dd>
        </div>
        <div>
          <dt>Top10 持仓占比</dt>
          <dd>{fmtPct(top10)}</dd>
        </div>
        <div>
          <dt>KYC 持币人数</dt>
          <dd>{fmtInt(kyc)}</dd>
        </div>
        <div>
          <dt>24h 涨跌</dt>
          <dd className="mono">
            {pct24 !== undefined && pct24 !== ''
              ? String(pct24).includes('%')
                ? String(pct24)
                : `${fmtNum(pct24)}%`
              : '—'}
          </dd>
        </div>
        <div>
          <dt>市值</dt>
          <dd className="mono">${fmtNum(mcap)}</dd>
        </div>
        <div>
          <dt>流动性</dt>
          <dd className="mono">${fmtNum(liq)}</dd>
        </div>
        <div>
          <dt>24h 成交额</dt>
          <dd className="mono">${fmtNum(vol24)}</dd>
        </div>
        <div>
          <dt>24h 成交笔数</dt>
          <dd>{fmtInt(cnt24)}</dd>
        </div>
        {cex?.chainName ? (
          <div>
            <dt>链</dt>
            <dd>{cex.chainName}</dd>
          </div>
        ) : null}
        {cex?.alphaId ? (
          <div>
            <dt>Alpha ID</dt>
            <dd className="mono">{cex.alphaId}</dd>
          </div>
        ) : null}
      </dl>
      <div className="alpha-info-links">
        <a
          href="https://www.binance.com/zh-CN/alpha"
          target="_blank"
          rel="noreferrer noopener"
          className="alpha-link"
        >
          Binance Alpha 市场 →
        </a>
      </div>
    </div>
  )
}
