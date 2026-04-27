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
import { loadSymbolInsight } from '../lib/loadSignals'
import { BinanceFuturesLink, BinanceLogoMark } from './BinanceLink'
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
import type { VariantScanUiState } from '../lib/scanVariantHits'
import type { SmDirectionScanUiState } from '../lib/smDirectionScan'
import { VariantSignalsPanel } from './VariantSignalsPanel'
import { SpotTokenInfoPanel } from './SpotTokenInfoPanel'
import {
  fetchSmartMoneyOverview,
  type SmartMoneyOverviewData,
} from '../lib/api/smartMoneyFutures'
import { SmartMoneyOverviewPanel } from './SmartMoneyOverviewPanel'
import { DrawerAiPanel } from './DrawerAiPanel'
import { isAiAnalysisEntryEnabled } from '../lib/featureFlags'

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

function formatVariantScanSnapshot(ms: number): string {
  return new Date(ms).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtSmUsd(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export function DetailDrawer({
  row,
  variantScan,
  smDirectionScan,
  pendingSymbol,
  openDetailError,
  onCloseAllDrawers,
  onCloseSymbolDrawer,
  onPickFromVariantScan,
  onRefreshVariantScan,
  onPickFromSmDirectionScan,
  onRefreshSmDirectionScan,
}: {
  row: SymbolInsight | null
  variantScan: VariantScanUiState | null
  smDirectionScan: SmDirectionScanUiState | null
  /** 单合约详情拉取中（如从聪明钱列表打开） */
  pendingSymbol?: string | null
  openDetailError?: string | null
  /** 关闭全部（含扫描抽屉） */
  onCloseAllDrawers: () => void
  /** 仅关闭上层合约详情 / 加载 / 错误，保留扫描抽屉 */
  onCloseSymbolDrawer: () => void
  onPickFromVariantScan: (insight: SymbolInsight) => void
  /** 强制重新拉榜扫描（忽略缓存） */
  onRefreshVariantScan: () => void
  /** 从聪明钱净方向扫描打开合约详情（保留扫描抽屉） */
  onPickFromSmDirectionScan: (symbol: string) => void
  onRefreshSmDirectionScan: () => void
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
  /** 聚合 /api 列表无 oiHist 时在抽屉内补全 */
  const [rowEnriched, setRowEnriched] = useState<SymbolInsight | null>(null)

  /** 同 row 有值时非 null（`row` 有值时总有 `row` 作回退） */
  const displayRow: SymbolInsight | null =
    row == null ? null : (rowEnriched ?? row)

  useEffect(() => {
    if (!row) {
      setRowEnriched(null)
      return
    }
    if (row.oiHist.length > 0) {
      setRowEnriched(null)
      return
    }
    const ac = new AbortController()
    setRowEnriched(null)
    void loadSymbolInsight(row.symbol, ac.signal)
      .then((full) => {
        if (ac.signal.aborted) return
        if (full) setRowEnriched(full)
      })
      .catch(() => {
        if (!ac.signal.aborted) setRowEnriched(null)
      })
    return () => ac.abort()
  }, [row?.symbol, row?.oiHist.length])

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
    if (!displayRow) return null
    return computeVariantSignals(displayRow, klines)
  }, [displayRow, klines])

  const ratioData = useMemo(() => {
    if (!displayRow) return []
    return mergeRatio(displayRow.global, displayRow.topAcc, displayRow.topPos)
  }, [displayRow])

  const hasScan = Boolean(variantScan || smDirectionScan)
  const hasTopOverlay = Boolean(
    row || pendingSymbol || openDetailError,
  )
  if (!hasScan && !hasTopOverlay) return null

  const variantScanPanel =
    variantScan ? (
      <div
        className="drawer-backdrop drawer-stack-base"
        onClick={onCloseAllDrawers}
      >
        <aside
          className="drawer drawer-variant-scan"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label={`Top ${variantScan.depth} V4 V7 V8 扫描`}
          aria-busy={variantScan.phase === 'loading'}
        >
          <header className="drawer-head">
            <div>
              <h2>
                Top {variantScan.depth} · V4A / V7 / V8
              </h2>
              <p className="muted small">
                按 24h 成交额取前 {variantScan.depth}{' '}
                个山寨永续（与工具栏「榜单深度」一致），逐合约拉 1h K 线与 OI
                对齐后做启发式命中
              </p>
              {variantScan.phase === 'done' &&
              variantScan.cachedAtMs != null ? (
                <p className="muted small drawer-variant-cache-line">
                  {variantScan.fromCache
                    ? `本地缓存 · ${formatVariantScanSnapshot(variantScan.cachedAtMs)} · 24h 内有效`
                    : `完成时间 · ${formatVariantScanSnapshot(variantScan.cachedAtMs)}`}
                </p>
              ) : null}
            </div>
            <div className="drawer-head-actions">
              <button
                type="button"
                className="btn btn-ghost small"
                disabled={variantScan.phase === 'loading'}
                onClick={(e) => {
                  e.stopPropagation()
                  onRefreshVariantScan()
                }}
                title="忽略缓存，重新拉榜并扫描"
              >
                重新扫描
              </button>
              <button type="button" className="ghost" onClick={onCloseAllDrawers}>
                关闭
              </button>
            </div>
          </header>
          {variantScan.phase === 'loading' ? (
            <section className="drawer-section">
              <p className="muted small" style={{ marginTop: 0 }}>
                {variantScan.progress}
              </p>
              <div
                className="sk sk-line"
                style={{ height: 120, borderRadius: 6, marginTop: 12 }}
              />
            </section>
          ) : null}
          {variantScan.phase === 'error' ? (
            <section className="drawer-section">
              <p className="banner err" style={{ margin: 0 }}>
                {variantScan.error}
              </p>
            </section>
          ) : null}
          {variantScan.phase === 'done' ? (
            <section className="drawer-section">
              {variantScan.hits.length === 0 ? (
                <p className="muted small" style={{ marginTop: 0 }}>
                  Top {variantScan.depth}{' '}
                  范围内暂无命中 V4A、V7 或 V8 任一条件的合约。
                </p>
              ) : (
                <>
                  <p className="muted small" style={{ marginTop: 0 }}>
                    共 {variantScan.hits.length}{' '}
                    个合约至少命中一条；点击行叠开合约详情（列表保留）。
                  </p>
                  <div className="drawer-constituents-table-wrap drawer-variant-scan-table-wrap">
                    <table className="drawer-constituents-table drawer-variant-scan-table">
                      <thead>
                        <tr>
                          <th scope="col">合约</th>
                          <th scope="col" className="num">
                            V4A
                          </th>
                          <th scope="col" className="num">
                            V7
                          </th>
                          <th scope="col" className="num">
                            V8
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {variantScan.hits.map((h) => (
                          <tr
                            key={h.symbol}
                            className="drawer-variant-scan-row"
                            onClick={() => onPickFromVariantScan(h.insight)}
                          >
                            <td className="mono">
                              {h.symbol.replace(/USDT$/i, '')}
                            </td>
                            <td className="num">
                              {h.signals.v4a.hit ? '✓' : '—'}
                            </td>
                            <td className="num">
                              {h.signals.v7.hit ? '✓' : '—'}
                            </td>
                            <td className="num">
                              {h.signals.v8.hit ? '✓' : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          ) : null}
        </aside>
      </div>
    ) : null

  const smDirectionScanPanel =
    smDirectionScan ? (
      <div
        className="drawer-backdrop drawer-stack-base"
        onClick={onCloseAllDrawers}
      >
        <aside
          className="drawer drawer-variant-scan"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="聪明钱 24h 与 1h 净方向扫描"
          aria-busy={smDirectionScan.phase === 'loading'}
        >
          <header className="drawer-head">
            <div>
              <h2>聪明钱 · 24h / 1h 净方向背离</h2>
              <p className="muted small">
                同时拉取 24h 与 1h 聪明钱信号列表，筛出两周期净方向（BUY /
                SELL）相反的合约；按两档有符号净名义之差的绝对值从大到小排序。
              </p>
              {smDirectionScan.phase === 'done' ? (
                <p className="muted small drawer-variant-cache-line">
                  完成时间 ·{' '}
                  {formatVariantScanSnapshot(smDirectionScan.doneAtMs)}
                </p>
              ) : null}
            </div>
            <div className="drawer-head-actions">
              <button
                type="button"
                className="btn btn-ghost small"
                disabled={smDirectionScan.phase === 'loading'}
                onClick={(e) => {
                  e.stopPropagation()
                  onRefreshSmDirectionScan()
                }}
                title="重新拉取 24h 与 1h 列表并计算"
              >
                重新扫描
              </button>
              <button type="button" className="ghost" onClick={onCloseAllDrawers}>
                关闭
              </button>
            </div>
          </header>
          {smDirectionScan.phase === 'loading' ? (
            <section className="drawer-section">
              <p className="muted small" style={{ marginTop: 0 }}>
                {smDirectionScan.progress}
              </p>
              <div
                className="sk sk-line"
                style={{ height: 120, borderRadius: 6, marginTop: 12 }}
              />
            </section>
          ) : null}
          {smDirectionScan.phase === 'error' ? (
            <section className="drawer-section">
              <p className="banner err" style={{ margin: 0 }}>
                {smDirectionScan.error}
              </p>
            </section>
          ) : null}
          {smDirectionScan.phase === 'done' ? (
            <section className="drawer-section">
              {smDirectionScan.hits.length === 0 ? (
                <p className="muted small" style={{ marginTop: 0 }}>
                  当前两档列表的交集内，没有净方向相反的合约。
                </p>
              ) : (
                <>
                  <p className="muted small" style={{ marginTop: 0 }}>
                    共 {smDirectionScan.hits.length}{' '}
                    个合约 24h 与 1h 净方向相反；点击行打开合约详情（列表保留）。
                  </p>
                  <div className="drawer-constituents-table-wrap drawer-variant-scan-table-wrap">
                    <table className="drawer-constituents-table drawer-variant-scan-table">
                      <thead>
                        <tr>
                          <th scope="col">合约</th>
                          <th scope="col">24h</th>
                          <th scope="col">1h</th>
                          <th scope="col" className="num">
                            差值
                          </th>
                          <th scope="col" className="num">
                            |净| 24h
                          </th>
                          <th scope="col" className="num">
                            |净| 1h
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {smDirectionScan.hits.map((h) => (
                          <tr
                            key={h.symbol}
                            className="drawer-variant-scan-row"
                            onClick={() => onPickFromSmDirectionScan(h.symbol)}
                          >
                            <td className="mono">
                              {h.symbol.replace(/USDT$/i, '')}
                            </td>
                            <td>
                              <span
                                className={`sm-side sm-side--${h.row24h.side.toLowerCase()}`}
                              >
                                {h.row24h.side}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`sm-side sm-side--${h.row1h.side.toLowerCase()}`}
                              >
                                {h.row1h.side}
                              </span>
                            </td>
                            <td className="num mono">
                              {fmtSmUsd(h.gapScore)}
                            </td>
                            <td className="num mono">
                              {fmtSmUsd(Math.abs(h.row24h.netNotional))}
                            </td>
                            <td className="num mono">
                              {fmtSmUsd(Math.abs(h.row1h.netNotional))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          ) : null}
        </aside>
      </div>
    ) : null

  const errorOverlay =
    openDetailError && !row ? (
      <div
        className="drawer-backdrop drawer-stack-top"
        onClick={onCloseSymbolDrawer}
      >
        <aside
          className="drawer"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="详情加载失败"
        >
          <header className="drawer-head">
            <div>
              <h2>无法打开详情</h2>
              <p className="banner err" style={{ margin: 0 }}>
                {openDetailError}
              </p>
            </div>
            <button type="button" className="ghost" onClick={onCloseSymbolDrawer}>
              关闭
            </button>
          </header>
        </aside>
      </div>
    ) : null

  const pendingOverlay =
    pendingSymbol && !row && !openDetailError ? (
      <div
        className="drawer-backdrop drawer-stack-top"
        onClick={onCloseSymbolDrawer}
      >
        <aside
          className="drawer"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="合约详情加载中"
          aria-busy
        >
          <header className="drawer-head">
            <div>
              <h2>{pendingSymbol}</h2>
              <p className="muted small">正在加载 OI 结构与图表…</p>
            </div>
            <button type="button" className="ghost" onClick={onCloseSymbolDrawer}>
              关闭
            </button>
          </header>
          <section className="drawer-section">
            <div
              className="sk sk-line"
              style={{ height: 160, borderRadius: 8, marginTop: 0 }}
            />
          </section>
        </aside>
      </div>
    ) : null

  const premiumMatch =
    row && premiumUi && premiumUi.sym === row.symbol
  const premium =
    premiumMatch && premiumUi.kind === 'ok' ? premiumUi.data : null
  const constituents =
    premiumMatch && premiumUi.kind === 'ok' ? premiumUi.constituents : null
  const premiumErr =
    premiumMatch && premiumUi.kind === 'err' ? premiumUi.message : null
  const premiumLoading = !premiumMatch
  const constituentRows = sortedConstituents(constituents)
  const smMarkPriceUsd = premium
    ? parseFloat(premium.markPrice)
    : NaN
  const smMarkPriceOk = Number.isFinite(smMarkPriceUsd) && smMarkPriceUsd > 0

  const mainDetailDrawer =
    row ? (
      <div
        className="drawer-backdrop drawer-stack-top"
        onClick={onCloseSymbolDrawer}
      >
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
          <div className="drawer-head-actions">
            <BinanceFuturesLink
              symbol={row.symbol}
              className="drawer-bn-open"
              title="在 Binance 合约打开"
            >
              <BinanceLogoMark />
            </BinanceFuturesLink>
            <button type="button" className="ghost" onClick={onCloseSymbolDrawer}>
              关闭
            </button>
          </div>
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
          {row.oiHist.length === 0 && !rowEnriched ? (
            <div className="sk sk-line" style={{ height: 176, borderRadius: 6 }} />
          ) : (
            <OiArea rows={displayRow!.oiHist} height={176} />
          )}
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
            <SmartMoneyOverviewPanel
              data={smOverview}
              markPriceUsd={smMarkPriceOk ? smMarkPriceUsd : undefined}
            />
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
        {isAiAnalysisEntryEnabled() ? (
          <DrawerAiPanel
            row={displayRow!}
            klines={klines}
            ratioSeries={ratioData}
          />
        ) : null}
      </aside>
    </div>
    ) : null

  return (
    <>
      {variantScanPanel}
      {smDirectionScanPanel}
      {errorOverlay}
      {pendingOverlay}
      {mainDetailDrawer}
    </>
  )
}
