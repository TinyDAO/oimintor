import { useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { SymbolInsight } from '../lib/signals/compute'
import {
  fetchIndexConstituents,
  fetchKlines,
  fetchPremiumIndex,
  type IndexConstituents,
  type KlineCandle,
  type PremiumIndex,
} from '../lib/api/futures'
import { BinanceFuturesLink } from './BinanceLink'
import { OiArea } from './OiChart'
import { PriceLine } from './PriceChart'
import { VolumeBars } from './VolumeBars'
import { AlphaInfoPanel } from './AlphaInfoPanel'
import {
  fetchAlphaPulseToken,
  type AlphaPulseToken,
} from '../lib/api/alphaPulse'
import {
  fetchAlphaTokenListCached,
  findAlphaTokenByBaseSymbol,
  type AlphaToken,
} from '../lib/api/alpha'
import {
  fetchBinanceSpotMarketInfo,
  type BinanceSpotDrawerInfo,
} from '../lib/api/binanceSpot'
import {
  DRAWER_CHART_MARGIN_RATIO,
  DRAWER_X_MIN_TICK_GAP,
  DRAWER_Y_LEFT_W,
} from '../lib/chartDrawerLayout'
import { formatCoinPrice } from '../lib/formatPrice'
import type { VariantSignals } from '../lib/signals/variantSignals'
import { computeVariantSignals } from '../lib/signals/variantSignals'
import { VariantSignalsPanel } from './VariantSignalsPanel'
import { SpotTokenInfoPanel } from './SpotTokenInfoPanel'
import {
  fetchSmartMoneyOverview,
  type SmartMoneyOverviewData,
} from '../lib/api/smartMoneyFutures'
import { SmartMoneyOverviewPanel } from './SmartMoneyOverviewPanel'

function mergeRatio(
  g: SymbolInsight['global'],
  ta: SymbolInsight['topAcc'],
  tp: SymbolInsight['topPos'],
) {
  const keys = new Set<number>()
  for (const x of g) keys.add(x.timestamp)
  for (const x of ta) keys.add(x.timestamp)
  for (const x of tp) keys.add(x.timestamp)
  const ts = [...keys].sort((a, b) => a - b)
  const gm = new Map(g.map((r) => [r.timestamp, parseFloat(r.longShortRatio)]))
  const tam = new Map(ta.map((r) => [r.timestamp, parseFloat(r.longShortRatio)]))
  const tpm = new Map(tp.map((r) => [r.timestamp, parseFloat(r.longShortRatio)]))
  return ts.map((t) => ({
    t,
    global: gm.get(t),
    topAcc: tam.get(t),
    topPos: tpm.get(t),
  }))
}

const KLINE_LIMIT = 336

const INDEX_EXCHANGE_LABEL: Record<string, string> = {
  binance: 'Binance',
  okex: 'Okex',
  okx: 'Okex',
  gateio: 'Gateio',
  kucoin: 'Kucoin',
  mxc: 'Mxc',
  bitget: 'Bitget',
  coinbase: 'Coinbase',
  bybit: 'Bybit',
  huobi: 'Huobi',
  kraken: 'Kraken',
}

function labelIndexExchange(ex: string): string {
  const k = ex.trim().toLowerCase()
  if (INDEX_EXCHANGE_LABEL[k]) return INDEX_EXCHANGE_LABEL[k]
  if (!ex) return '—'
  return ex.charAt(0).toUpperCase() + ex.slice(1).toLowerCase()
}

function formatConstituentWeightPct(w: string): string {
  const n = parseFloat(w)
  if (!Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(2)}%`
}

function sortedConstituents(
  c: IndexConstituents | null,
): IndexConstituents['constituents'] {
  if (!c?.constituents?.length) return []
  return [...c.constituents].sort(
    (a, b) => parseFloat(b.weight) - parseFloat(a.weight),
  )
}

type PremiumUi =
  | {
      sym: string
      kind: 'ok'
      data: PremiumIndex
      constituents: IndexConstituents | null
    }
  | { sym: string; kind: 'err'; message: string }

export function DetailDrawer({
  row,
  onClose,
}: {
  row: SymbolInsight | null
  onClose: () => void
}) {
  const [klines, setKlines] = useState<KlineCandle[] | null>(null)
  const [klErr, setKlErr] = useState<string | null>(null)
  const [alphaPulse, setAlphaPulse] = useState<AlphaPulseToken | null>(null)
  const [alphaCex, setAlphaCex] = useState<AlphaToken | null>(null)
  const [alphaLoading, setAlphaLoading] = useState(false)
  const [alphaErr, setAlphaErr] = useState<string | null>(null)
  const [premiumUi, setPremiumUi] = useState<PremiumUi | null>(null)
  const [spotInfo, setSpotInfo] = useState<BinanceSpotDrawerInfo | null>(null)
  const [spotLoading, setSpotLoading] = useState(false)
  const [spotErr, setSpotErr] = useState<string | null>(null)
  const [smOverview, setSmOverview] = useState<SmartMoneyOverviewData | null>(
    null,
  )
  const [smOvLoading, setSmOvLoading] = useState(false)
  const [smOvErr, setSmOvErr] = useState<string | null>(null)

  useEffect(() => {
    if (!row) {
      setKlines(null)
      setKlErr(null)
      setAlphaPulse(null)
      setAlphaCex(null)
      setAlphaErr(null)
      return
    }
    const ac = new AbortController()
    setKlines(null)
    setKlErr(null)
    fetchKlines(row.symbol, '1h', KLINE_LIMIT, ac.signal)
      .then((data) => {
        if (!ac.signal.aborted) setKlines(data)
      })
      .catch((e: Error) => {
        if (ac.signal.aborted) return
        setKlErr(e.message ?? 'K 线加载失败')
      })
    return () => ac.abort()
  }, [row?.symbol])

  useEffect(() => {
    if (!row) return
    const sym = row.symbol
    const ac = new AbortController()
    Promise.all([
      fetchPremiumIndex(sym, ac.signal),
      fetchIndexConstituents(sym, ac.signal).catch(() => null),
    ])
      .then(([data, constituents]) => {
        if (ac.signal.aborted) return
        setPremiumUi({ sym, kind: 'ok', data, constituents })
      })
      .catch((e: Error) => {
        if (ac.signal.aborted) return
        setPremiumUi({
          sym,
          kind: 'err',
          message: e.message ?? '指数加载失败',
        })
      })
    return () => ac.abort()
  }, [row?.symbol])

  useEffect(() => {
    if (!row?.isAlpha) {
      setAlphaPulse(null)
      setAlphaCex(null)
      setAlphaLoading(false)
      setAlphaErr(null)
      return
    }
    const base = row.symbol.replace(/USDT$/i, '')
    const ac = new AbortController()
    setAlphaLoading(true)
    setAlphaErr(null)
    setAlphaPulse(null)
    setAlphaCex(null)
    Promise.all([
      fetchAlphaPulseToken(base, ac.signal),
      fetchAlphaTokenListCached().then((list) =>
        findAlphaTokenByBaseSymbol(list, base),
      ),
    ])
      .then(([pulse, cex]) => {
        if (ac.signal.aborted) return
        setAlphaPulse(pulse)
        setAlphaCex(cex ?? null)
      })
      .catch((e: Error) => {
        if (ac.signal.aborted) return
        setAlphaErr(e.message ?? 'Alpha 信息加载失败')
      })
      .finally(() => {
        if (!ac.signal.aborted) setAlphaLoading(false)
      })
    return () => ac.abort()
  }, [row?.isAlpha, row?.symbol])

  useEffect(() => {
    if (!row?.symbol || row.isAlpha) {
      setSpotInfo(null)
      setSpotErr(null)
      setSpotLoading(false)
      return
    }
    const ac = new AbortController()
    setSpotLoading(true)
    setSpotErr(null)
    setSpotInfo(null)
    fetchBinanceSpotMarketInfo(row.symbol, ac.signal)
      .then((d) => {
        if (!ac.signal.aborted) setSpotInfo(d)
      })
      .catch((e: Error) => {
        if (!ac.signal.aborted) setSpotErr(e.message ?? '现货信息加载失败')
      })
      .finally(() => {
        if (!ac.signal.aborted) setSpotLoading(false)
      })
    return () => ac.abort()
  }, [row?.symbol, row?.isAlpha])

  useEffect(() => {
    if (!row?.symbol) {
      setSmOverview(null)
      setSmOvErr(null)
      setSmOvLoading(false)
      return
    }
    const sym = row.symbol
    const ac = new AbortController()
    setSmOvLoading(true)
    setSmOvErr(null)
    setSmOverview(null)
    fetchSmartMoneyOverview(sym, ac.signal)
      .then((d) => {
        if (!ac.signal.aborted) setSmOverview(d)
      })
      .catch((e: Error) => {
        if (!ac.signal.aborted) setSmOvErr(e.message ?? '聪明钱总览加载失败')
      })
      .finally(() => {
        if (!ac.signal.aborted) setSmOvLoading(false)
      })
    return () => ac.abort()
  }, [row?.symbol])

  const variantSignals: VariantSignals | null = useMemo(() => {
    if (!row) return null
    return computeVariantSignals(row, klines)
  }, [row, klines])

  if (!row) return null
  const ratioData = mergeRatio(row.global, row.topAcc, row.topPos)
  const premiumMatch = premiumUi && premiumUi.sym === row.symbol
  const premium =
    premiumMatch && premiumUi.kind === 'ok' ? premiumUi.data : null
  const constituents =
    premiumMatch && premiumUi.kind === 'ok' ? premiumUi.constituents : null
  const premiumErr =
    premiumMatch && premiumUi.kind === 'err' ? premiumUi.message : null
  const premiumLoading = !premiumMatch
  const constituentRows = sortedConstituents(constituents)

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="详情"
      >
        <header className="drawer-head">
          <div>
            <h2>
              {row.symbol}
              {row.isAlpha ? <span className="alpha-badge">Alpha</span> : null}
            </h2>
            <p className="muted small">
              以下为公开市场数据聚合，非投资建议。
            </p>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            关闭
          </button>
        </header>
        {!row.isAlpha ? (
          <section className="drawer-section">
            <h3>现货行情（Binance）</h3>
            <p className="muted small" style={{ marginTop: 0 }}>
              与永续同名的 USDT 现货对（/api/v3），与合约行情可能不同。
            </p>
            <SpotTokenInfoPanel
              baseSymbol={row.symbol.replace(/USDT$/i, '')}
              info={spotInfo}
              loading={spotLoading}
              error={spotErr}
            />
          </section>
        ) : null}
        {row.isAlpha ? (
          <section className="drawer-section">
            <h3>Alpha 市场信息</h3>
            <AlphaInfoPanel
              pulse={alphaPulse}
              cex={alphaCex}
              loading={alphaLoading}
              error={alphaErr}
            />
          </section>
        ) : null}
        <div className="drawer-charts-row">
          <section className="drawer-section">
            <h3>合约价格（1h 收盘，约 14 天）</h3>
            {klErr ? (
              <p className="muted small">{klErr}</p>
            ) : klines === null ? (
              <div className="sk sk-line" style={{ height: 148, borderRadius: 6 }} />
            ) : (
              <PriceLine candles={klines} height={148} />
            )}
          </section>
          <section className="drawer-section">
            <h3>成交量（1h，基币数量，约 14 天）</h3>
            {klErr ? (
              <p className="muted small">—</p>
            ) : klines === null ? (
              <div className="sk sk-line" style={{ height: 148, borderRadius: 6 }} />
            ) : (
              <VolumeBars candles={klines} height={148} />
            )}
          </section>
        </div>
        <section className="drawer-section">
          <h3>未平仓 OI 与名义价值（1h，约 14 天）</h3>
          <OiArea rows={row.oiHist} height={176} />
        </section>
        <section className="drawer-section">
          <h3>聪明钱总览</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            Binance 合约聪明钱聚合（普通 / 大户分桶）；与站内列表接口同源 overview。
          </p>
          {smOvLoading ? (
            <div className="sk sk-line" style={{ height: 140, borderRadius: 8 }} />
          ) : smOvErr ? (
            <p className="muted small">{smOvErr}</p>
          ) : smOverview ? (
            <SmartMoneyOverviewPanel data={smOverview} />
          ) : (
            <p className="muted small">暂无数据</p>
          )}
        </section>
        <section className="drawer-section">
          <h3>多空比三轨（1h，约 14 天 · 用户 / 大户账户 / 大户持仓）</h3>
          <div className="drawer-chart-tall">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={ratioData}
                margin={{ ...DRAWER_CHART_MARGIN_RATIO }}
              >
                <XAxis
                  dataKey="t"
                  minTickGap={DRAWER_X_MIN_TICK_GAP}
                  tickFormatter={(x) =>
                    new Date(x).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                  stroke="var(--muted)"
                  tick={{ fill: 'var(--muted)', fontSize: 10 }}
                />
                <YAxis
                  stroke="var(--muted)"
                  tick={{ fontSize: 10 }}
                  width={DRAWER_Y_LEFT_W}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--panel2)',
                    border: '1px solid var(--border)',
                  }}
                  labelFormatter={(label) => {
                    const n =
                      typeof label === 'number' ? label : Number(label)
                    if (!Number.isFinite(n)) return String(label)
                    return new Date(n).toLocaleString('zh-CN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })
                  }}
                  formatter={(value: unknown) => {
                    if (value == null) return '—'
                    const n =
                      typeof value === 'number'
                        ? value
                        : parseFloat(String(value))
                    return Number.isFinite(n) ? n.toFixed(3) : String(value)
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 2 }} />
                <Line
                  name="用户(账户)"
                  type="monotone"
                  dataKey="global"
                  stroke="var(--chart-user)"
                  dot={false}
                  strokeWidth={1.5}
                  connectNulls
                />
                <Line
                  name="大户(账户)"
                  type="monotone"
                  dataKey="topAcc"
                  stroke="var(--chart-mid)"
                  dot={false}
                  strokeWidth={1.5}
                  connectNulls
                />
                <Line
                  name="大户(持仓)"
                  type="monotone"
                  dataKey="topPos"
                  stroke="var(--chart-top)"
                  dot={false}
                  strokeWidth={1.5}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <footer className="drawer-foot">
          <h3 className="drawer-foot-title">指数信息</h3>
          <div className="drawer-index-strip" aria-label="合约指数与标记价格">
            {premiumErr ? (
              <p className="muted small" style={{ margin: '0 0 0.5rem' }}>
                {premiumErr}
              </p>
            ) : premium ? (
              <div className="drawer-index-grid">
                <div className="drawer-index-cell">
                  <span className="drawer-index-label">指数价格</span>
                  <span className="drawer-index-value">
                    {formatCoinPrice(parseFloat(premium.indexPrice))}
                  </span>
                </div>
                <div className="drawer-index-cell">
                  <span className="drawer-index-label">标记价格</span>
                  <span className="drawer-index-value drawer-index-value-muted">
                    {formatCoinPrice(parseFloat(premium.markPrice))}
                  </span>
                </div>
              </div>
            ) : premiumLoading ? (
              <div
                className="sk sk-line drawer-index-skel"
                style={{ borderRadius: 6 }}
              />
            ) : null}
          </div>
          {premium && constituentRows.length > 0 ? (
            <div
              className="drawer-constituents"
              aria-label="指数成分与权重"
            >
              <p className="drawer-constituents-hint muted small">
                以下为 Binance 指数成分权重（各所交易对及占比），非独立行情对比。
              </p>
              <div className="drawer-constituents-table-wrap">
                <table className="drawer-constituents-table">
                  <thead>
                    <tr>
                      <th scope="col">交易所</th>
                      <th scope="col">交易对</th>
                      <th scope="col" className="num">
                        百分比
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {constituentRows.map((r, i) => (
                      <tr key={`${r.exchange}-${r.symbol}-${i}`}>
                        <td>{labelIndexExchange(r.exchange)}</td>
                        <td className="mono">{r.symbol}</td>
                        <td className="num">
                          {formatConstituentWeightPct(r.weight)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : premium && !premiumLoading && constituentRows.length === 0 ? (
            <p className="muted small drawer-constituents-empty">
              暂无指数成分数据（部分合约无第三方成分或未返回）。
            </p>
          ) : null}
          <BinanceFuturesLink symbol={row.symbol}>在 Binance 合约打开</BinanceFuturesLink>
        </footer>
        {variantSignals &&
        (variantSignals.v4a.hit ||
          variantSignals.v7.hit ||
          variantSignals.v8.hit) ? (
          <section className="drawer-section drawer-variant-bottom">
            <h3>信号类型（启发式）</h3>
            <p className="muted small" style={{ marginTop: 0 }}>
              对照 V4A / V7 / V8 框架的近似校验（基于 24h 行情、1h OI
              与 K 线），非投资建议。
            </p>
            <VariantSignalsPanel signals={variantSignals} />
          </section>
        ) : null}
      </aside>
    </div>
  )
}
