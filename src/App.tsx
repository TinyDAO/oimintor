import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  loadMarketInsights,
  loadSymbolInsight,
  TOP_N_CHOICES,
  DEFAULT_TOP_N,
  normalizeTopN,
  type TopNChoice,
} from './lib/loadSignals'
import type { SymbolInsight } from './lib/signals/compute'
import {
  fetchSmartMoneyFuturesSignals,
  SMART_MONEY_TIME_RANGES,
  type SmartMoneyFuturesRow,
  type SmartMoneyTimeRange,
} from './lib/api/smartMoneyFutures'
import {
  findOiCrossesAboveThreshold,
  notifyOiCrossesDesktop,
  playOiCrossChime,
  snapshotOiPct24h,
} from './lib/oiCrossAlert'
import { AppLogo } from './components/AppLogo'
import { SignalTable } from './components/SignalTable'
import { SmartMoneyFuturesTable } from './components/SmartMoneyFuturesTable'
import { DetailDrawer } from './components/DetailDrawer'
import {
  scanVariantSignalsForInsights,
  tryScanVariantViaAggregate,
  type VariantScanUiState,
} from './lib/scanVariantHits'
import {
  readVariantScanCacheIfValid,
  writeVariantScanCache,
} from './lib/variantScanCache'
import {
  buildSmDirectionScanHits,
  type SmDirectionScanUiState,
} from './lib/smDirectionScan'

const TOP_N_STORAGE_KEY = 'oi-monitor-top-n'
const AUTO_REFRESH_STORAGE_KEY = 'oi-monitor-auto-refresh'
const SM_RANGE_STORAGE_KEY = 'oi-monitor-sm-range'
/** 自动刷新间隔（毫秒） */
const AUTO_REFRESH_MS = 5 * 60 * 1000

type Panel = 'oi' | 'sm'

function readStoredTopN(): TopNChoice {
  if (typeof localStorage === 'undefined') return DEFAULT_TOP_N
  try {
    const raw = localStorage.getItem(TOP_N_STORAGE_KEY)
    if (raw === null) return DEFAULT_TOP_N
    return normalizeTopN(parseInt(raw, 10))
  } catch {
    return DEFAULT_TOP_N
  }
}

function readStoredAutoRefresh(): boolean {
  if (typeof localStorage === 'undefined') return true
  try {
    const raw = localStorage.getItem(AUTO_REFRESH_STORAGE_KEY)
    if (raw === null) return true
    return raw === '1' || raw === 'true'
  } catch {
    return true
  }
}

function readStoredSmRange(): SmartMoneyTimeRange {
  if (typeof localStorage === 'undefined') return '1h'
  try {
    const raw = localStorage.getItem(SM_RANGE_STORAGE_KEY)
    if (raw && (SMART_MONEY_TIME_RANGES as readonly string[]).includes(raw)) {
      return raw as SmartMoneyTimeRange
    }
  } catch {
    /* ignore */
  }
  return '1h'
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function App() {
  const [panel, setPanel] = useState<Panel>('oi')
  const [topN, setTopN] = useState<TopNChoice>(() => readStoredTopN())
  const [smRange, setSmRange] = useState<SmartMoneyTimeRange>(() => readStoredSmRange())
  const [autoRefresh, setAutoRefresh] = useState(() => readStoredAutoRefresh())
  const [nextDeadline, setNextDeadline] = useState<number | null>(null)
  const [tick, setTick] = useState(0)
  const autoRefreshRef = useRef(autoRefresh)
  const panelRef = useRef<Panel>(panel)

  const [oiLoading, setOiLoading] = useState(true)
  const [oiErr, setOiErr] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const [insights, setInsights] = useState<SymbolInsight[]>([])

  const [smLoading, setSmLoading] = useState(false)
  const [smErr, setSmErr] = useState<string | null>(null)
  const [smRows, setSmRows] = useState<SmartMoneyFuturesRow[]>([])

  const [alphaOnly, setAlphaOnly] = useState(false)
  const [symbolQuery, setSymbolQuery] = useState('')
  const [selected, setSelected] = useState<SymbolInsight | null>(null)
  const [detailPendingSymbol, setDetailPendingSymbol] = useState<string | null>(
    null,
  )
  const [detailOpenError, setDetailOpenError] = useState<string | null>(null)
  const [variantScan, setVariantScan] = useState<VariantScanUiState | null>(
    null,
  )
  const [smDirectionScan, setSmDirectionScan] =
    useState<SmDirectionScanUiState | null>(null)
  const scanAbortRef = useRef<AbortController | null>(null)
  const smScanAbortRef = useRef<AbortController | null>(null)
  const smDetailAbortRef = useRef<AbortController | null>(null)

  /** 上一轮 OI 榜快照（用于检测 24h OI% 是否从下穿 50% 变为上穿 50%） */
  const prevOiPctSnapshotRef = useRef<Map<string, number> | null>(null)
  const [oiCrossAlerts, setOiCrossAlerts] = useState<
    { id: string; symbol: string; prevPct: number; currPct: number }[]
  >([])

  useEffect(() => {
    autoRefreshRef.current = autoRefresh
  }, [autoRefresh])

  useEffect(() => {
    panelRef.current = panel
  }, [panel])

  const scheduleNext = useCallback(() => {
    if (autoRefreshRef.current) {
      setNextDeadline(Date.now() + AUTO_REFRESH_MS)
    }
  }, [])

  const loadOi = useCallback(async () => {
    setOiLoading(true)
    setOiErr(null)
    try {
      const { insights: ins } = await loadMarketInsights(setProgress, topN)
      const prevMap = prevOiPctSnapshotRef.current
      const crosses = findOiCrossesAboveThreshold(prevMap, ins)
      prevOiPctSnapshotRef.current = snapshotOiPct24h(ins)
      setInsights(ins)
      if (crosses.length > 0) {
        const stamp = Date.now()
        setOiCrossAlerts((prev) => {
          const next = [
            ...crosses.map((c, i) => ({
              id: `${stamp}-${c.symbol}-${i}`,
              symbol: c.symbol,
              prevPct: c.prevPct,
              currPct: c.currPct,
            })),
            ...prev,
          ]
          return next.slice(0, 16)
        })
        const notified = notifyOiCrossesDesktop(crosses)
        if (!notified) playOiCrossChime()
      }
    } catch (e) {
      setOiErr(e instanceof Error ? e.message : String(e))
    } finally {
      setOiLoading(false)
      setProgress('')
      scheduleNext()
    }
  }, [topN, scheduleNext])

  const runVariantScanNetwork = useCallback(async () => {
    smScanAbortRef.current?.abort()
    smScanAbortRef.current = null
    const ac = new AbortController()
    scanAbortRef.current = ac
    const depth = topN
    setSelected(null)
    setSmDirectionScan(null)
    setVariantScan({
      phase: 'loading',
      progress: `V4A/V7/V8 聚合扫描（Top ${depth}）…`,
      depth,
    })
    try {
      const aggregatedHits = await tryScanVariantViaAggregate(depth, ac.signal)
      if (aggregatedHits != null) {
        if (ac.signal.aborted) return
        const now = Date.now()
        writeVariantScanCache(depth, aggregatedHits)
        setVariantScan({
          phase: 'done',
          progress: '',
          hits: aggregatedHits,
          depth,
          cachedAtMs: now,
          fromCache: false,
        })
        return
      }

      setVariantScan({
        phase: 'loading',
        progress: `加载 Top ${depth} 榜单…`,
        depth,
      })
      const { insights } = await loadMarketInsights((msg) => {
        setVariantScan((s) =>
          s?.phase === 'loading' ? { ...s, progress: msg } : s,
        )
      }, depth)
      if (ac.signal.aborted) return
      setVariantScan({
        phase: 'loading',
        progress: '拉取 1h K 线并校验…',
        depth,
      })
      const hits = await scanVariantSignalsForInsights(
        insights,
        (done, total) => {
          setVariantScan({
            phase: 'loading',
            progress: `K 线 ${done}/${total}`,
            depth,
          })
        },
        ac.signal,
      )
      if (ac.signal.aborted) return
      const now = Date.now()
      writeVariantScanCache(depth, hits)
      setVariantScan({
        phase: 'done',
        progress: '',
        hits,
        depth,
        cachedAtMs: now,
        fromCache: false,
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setVariantScan({
        phase: 'error',
        progress: '',
        error: e instanceof Error ? e.message : String(e),
        depth,
      })
    } finally {
      if (scanAbortRef.current === ac) scanAbortRef.current = null
    }
  }, [topN])

  const runSmDirectionScan = useCallback(async () => {
    scanAbortRef.current?.abort()
    scanAbortRef.current = null
    const ac = new AbortController()
    smScanAbortRef.current = ac
    setSelected(null)
    setVariantScan(null)
    setSmDirectionScan({ phase: 'loading', progress: '拉取 24h 与 1h 聪明钱列表…' })
    try {
      const [rows24h, rows1h] = await Promise.all([
        fetchSmartMoneyFuturesSignals('24h', ac.signal),
        fetchSmartMoneyFuturesSignals('1h', ac.signal),
      ])
      if (ac.signal.aborted) return
      const hits = buildSmDirectionScanHits(rows24h, rows1h)
      setSmDirectionScan({
        phase: 'done',
        progress: '',
        hits,
        doneAtMs: Date.now(),
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setSmDirectionScan({
        phase: 'error',
        progress: '',
        error: e instanceof Error ? e.message : String(e),
      })
    } finally {
      if (smScanAbortRef.current === ac) smScanAbortRef.current = null
    }
  }, [])

  const openSmDirectionScanDrawer = useCallback(() => {
    void runSmDirectionScan()
  }, [runSmDirectionScan])

  const refreshSmDirectionScan = useCallback(() => {
    void runSmDirectionScan()
  }, [runSmDirectionScan])

  const openVariantScanDrawer = useCallback(() => {
    smScanAbortRef.current?.abort()
    smScanAbortRef.current = null
    const depth = topN
    const cached = readVariantScanCacheIfValid(depth)
    if (cached) {
      setSelected(null)
      setSmDirectionScan(null)
      setVariantScan({
        phase: 'done',
        progress: '',
        hits: cached.hits,
        depth,
        cachedAtMs: cached.cachedAt,
        fromCache: true,
      })
      return
    }
    void runVariantScanNetwork()
  }, [topN, runVariantScanNetwork])

  const refreshVariantScan = useCallback(() => {
    void runVariantScanNetwork()
  }, [runVariantScanNetwork])

  function closeDetailDrawer() {
    scanAbortRef.current?.abort()
    scanAbortRef.current = null
    smScanAbortRef.current?.abort()
    smScanAbortRef.current = null
    smDetailAbortRef.current?.abort()
    smDetailAbortRef.current = null
    setSelected(null)
    setDetailPendingSymbol(null)
    setDetailOpenError(null)
    setVariantScan(null)
    setSmDirectionScan(null)
  }

  /** 仅关闭合约详情 / 加载中 / 错误层；保留 V4/V7/V8 扫描抽屉 */
  function closeSymbolDrawer() {
    smDetailAbortRef.current?.abort()
    smDetailAbortRef.current = null
    setSelected(null)
    setDetailPendingSymbol(null)
    setDetailOpenError(null)
  }

  function onPickFromVariantScan(insight: SymbolInsight) {
    setSelected(insight)
  }

  function openSmSymbolDetail(
    symbol: string,
    clearBackgroundScans: boolean = true,
  ) {
    smDetailAbortRef.current?.abort()
    const ac = new AbortController()
    smDetailAbortRef.current = ac
    setSelected(null)
    setDetailOpenError(null)
    if (clearBackgroundScans) {
      setVariantScan(null)
      setSmDirectionScan(null)
    }
    setDetailPendingSymbol(symbol)
    void loadSymbolInsight(symbol, ac.signal)
      .then((ins) => {
        if (ac.signal.aborted) return
        setDetailPendingSymbol(null)
        if (ins) {
          setSelected(ins)
        } else {
          setDetailOpenError(
            '无法加载该合约详情（可能未在永续列表或接口暂不可用）。',
          )
        }
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return
        setDetailPendingSymbol(null)
        setDetailOpenError(
          e instanceof Error ? e.message : String(e),
        )
      })
  }

  const loadSm = useCallback(async () => {
    setSmLoading(true)
    setSmErr(null)
    try {
      const rows = await fetchSmartMoneyFuturesSignals(smRange)
      setSmRows(rows)
    } catch (e) {
      setSmErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSmLoading(false)
      scheduleNext()
    }
  }, [smRange, scheduleNext])

  useEffect(() => {
    void loadOi()
  }, [loadOi])

  useEffect(() => {
    if (panel !== 'sm') return
    void loadSm()
  }, [panel, smRange, loadSm])

  useEffect(() => {
    if (!autoRefresh) return
    const id = window.setInterval(() => setTick((x) => x + 1), 1000)
    return () => window.clearInterval(id)
  }, [autoRefresh])

  const runScheduledRefresh = useCallback(() => {
    if (panelRef.current === 'oi') {
      void loadOi()
    } else {
      void loadSm()
    }
  }, [loadOi, loadSm])

  const loadingForTimer = panel === 'oi' ? oiLoading : smLoading

  useEffect(() => {
    if (!autoRefresh || loadingForTimer || nextDeadline === null) return
    const ms = nextDeadline - Date.now()
    if (ms <= 0) {
      void runScheduledRefresh()
      return
    }
    const t = window.setTimeout(() => void runScheduledRefresh(), ms)
    return () => window.clearTimeout(t)
  }, [autoRefresh, loadingForTimer, nextDeadline, runScheduledRefresh])

  const countdownLabel = useMemo(() => {
    if (!autoRefresh || nextDeadline === null) return null
    const loading = panel === 'oi' ? oiLoading : smLoading
    if (loading) return '刷新中…'
    const sec = Math.max(0, Math.ceil((nextDeadline - Date.now()) / 1000))
    return `约 ${formatCountdown(sec)} 后自动刷新`
  }, [autoRefresh, nextDeadline, panel, oiLoading, smLoading, tick])

  const tableRows = useMemo(() => {
    let rows = alphaOnly ? insights.filter((x) => x.isAlpha) : insights
    const q = symbolQuery.trim().toLowerCase()
    if (q) {
      rows = rows.filter((r) => {
        const sym = r.symbol.toLowerCase()
        const base = sym.replace(/usdt$/, '')
        return sym.includes(q) || base.includes(q)
      })
    }
    return rows
  }, [insights, alphaOnly, symbolQuery])

  const smFiltered = useMemo(() => {
    const q = symbolQuery.trim().toLowerCase()
    if (!q) return smRows
    return smRows.filter((r) => {
      const sym = r.symbol.toLowerCase()
      const base = sym.replace(/usdt$/, '')
      return sym.includes(q) || base.includes(q)
    })
  }, [smRows, symbolQuery])

  const loading = panel === 'oi' ? oiLoading : smLoading
  const bannerErr = panel === 'oi' ? oiErr : smErr

  function goPanel(next: Panel) {
    setPanel(next)
    closeDetailDrawer()
  }

  function onRefreshClick() {
    if (panel === 'oi') void loadOi()
    else void loadSm()
  }

  async function requestDesktopNotifyPermission() {
    if (typeof Notification === 'undefined') return
    try {
      await Notification.requestPermission()
    } catch {
      /* ignore */
    }
  }

  function dismissOiCross(id: string) {
    setOiCrossAlerts((rows) => rows.filter((r) => r.id !== id))
  }

  function clearAllOiCrossAlerts() {
    setOiCrossAlerts([])
  }

  return (
    <div className="app">
      <header className="app-top">
        <div className="app-brand">
          <AppLogo className="app-brand-logo" />
          <div className="app-brand-text">
            <span className="app-brand-name">OI Monitor</span>
            <span className="app-brand-sub">永续合约 · 结构雷达</span>
          </div>
        </div>
      </header>

      <header className="hero">
        <div className="hero-top">
          <p className="eyebrow">Binance USDT-M · 山寨结构雷达</p>
          <h1>OI &amp; 多空结构</h1>
          <p className="lede">
            聚合 OI、用户/大户多空比与背离信号；跳转合约前请自行核对风险。
          </p>
        </div>

        <nav className="view-tabs" aria-label="主视图">
          <button
            type="button"
            className={panel === 'oi' ? 'view-tab on' : 'view-tab'}
            onClick={() => goPanel('oi')}
          >
            OI 结构榜
          </button>
          <button
            type="button"
            className={panel === 'sm' ? 'view-tab on' : 'view-tab'}
            onClick={() => goPanel('sm')}
          >
            聪明钱流向
          </button>
        </nav>

        <div className="toolbar">
          <button type="button" className="btn" onClick={onRefreshClick} disabled={loading}>
            {loading ? '加载中…' : '刷新'}
          </button>
          <label className="chk">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => {
                const on = e.target.checked
                setAutoRefresh(on)
                try {
                  localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, on ? '1' : '0')
                } catch {
                  /* ignore */
                }
                if (on) {
                  setNextDeadline(Date.now() + AUTO_REFRESH_MS)
                } else {
                  setNextDeadline(null)
                }
              }}
            />
            每 5 分钟自动刷新
          </label>
          {countdownLabel ? (
            <span className="auto-refresh-countdown muted small">{countdownLabel}</span>
          ) : null}

          {panel === 'oi' ? (
            <>
              <label className="toolbar-field">
                <span className="toolbar-label">榜单深度</span>
                <select
                  className="toolbar-select"
                  value={topN}
                  disabled={oiLoading}
                  onChange={(e) => {
                    const n = normalizeTopN(Number(e.target.value))
                    setTopN(n)
                    try {
                      localStorage.setItem(TOP_N_STORAGE_KEY, String(n))
                    } catch {
                      /* ignore */
                    }
                  }}
                  aria-label="按成交额取前 N 个合约"
                >
                  {TOP_N_CHOICES.map((n) => (
                    <option key={n} value={n}>
                      Top {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="chk">
                <input
                  type="checkbox"
                  checked={alphaOnly}
                  onChange={(e) => setAlphaOnly(e.target.checked)}
                />
                仅 Alpha 标的
              </label>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={oiLoading || variantScan?.phase === 'loading'}
                onClick={() => void openVariantScanDrawer()}
                title={`按当前榜单深度 Top ${topN} 打开扫描；若有 24h 内缓存则直接展示，否则拉榜并校验 V4A/V7/V8`}
              >
                扫描 V4A/V7/V8
              </button>
              {typeof Notification !== 'undefined' &&
              Notification.permission === 'default' ? (
                <button
                  type="button"
                  className="btn btn-ghost small"
                  onClick={() => void requestDesktopNotifyPermission()}
                >
                  启用桌面通知（OI 突破 50%）
                </button>
              ) : null}
            </>
          ) : (
            <>
              <label className="toolbar-field">
                <span className="toolbar-label">统计周期</span>
                <select
                  className="toolbar-select"
                  value={smRange}
                  disabled={smLoading}
                  onChange={(e) => {
                    const v = e.target.value as SmartMoneyTimeRange
                    setSmRange(v)
                    try {
                      localStorage.setItem(SM_RANGE_STORAGE_KEY, v)
                    } catch {
                      /* ignore */
                    }
                  }}
                  aria-label="聪明钱信号时间范围"
                >
                  {SMART_MONEY_TIME_RANGES.map((r) => (
                    <option key={r} value={r}>
                      {r === '30m'
                        ? '30 分钟'
                        : r === '1h'
                          ? '1 小时'
                          : r === '24h'
                            ? '24 小时'
                            : '7 日'}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={smLoading || smDirectionScan?.phase === 'loading'}
                onClick={() => void openSmDirectionScanDrawer()}
                title="拉取 24h 与 1h 聪明钱列表，筛出净方向相反合约，按两档净名义差排序"
              >
                净方向扫描
              </button>
            </>
          )}

          <input
            type="search"
            className="symbol-search"
            placeholder={
              panel === 'oi'
                ? '搜索合约（如 PEPE、1000PEPE）'
                : '筛选合约…'
            }
            value={symbolQuery}
            onChange={(e) => setSymbolQuery(e.target.value)}
            aria-label="按合约名筛选"
            autoComplete="off"
            spellCheck={false}
          />
          {panel === 'oi' && progress ? (
            <span className="muted small">{progress}</span>
          ) : null}
        </div>
      </header>

      {bannerErr ? <div className="banner err">{bannerErr}</div> : null}

      <main className="main">
        {panel === 'oi' && oiLoading ? (
          <div className="skeleton-stack">
            <div className="sk sk-line" />
            <div className="sk sk-line short" />
            <div className="sk sk-grid" />
          </div>
        ) : null}

        {panel === 'sm' && smLoading ? (
          <div className="skeleton-stack">
            <div className="sk sk-line" />
            <div className="sk sk-line short" />
            <div className="sk sk-grid" />
          </div>
        ) : null}

        {panel === 'oi' && !oiLoading ? (
          <>
            {insights.length > 0 && tableRows.length === 0 ? (
              <p className="filter-empty muted small">
                当前筛选下无合约，请修改搜索词或取消「仅 Alpha」。
              </p>
            ) : null}
            {oiCrossAlerts.length > 0 ? (
              <div className="oi-cross-strip" role="region" aria-label="24h OI 突破提醒">
                <div className="oi-cross-strip-head">
                  <span className="oi-cross-strip-title">24h OI% 刚突破 50%</span>
                  <button
                    type="button"
                    className="btn btn-ghost small"
                    onClick={clearAllOiCrossAlerts}
                  >
                    全部关闭
                  </button>
                </div>
                <div className="oi-cross-cards">
                  {oiCrossAlerts.map((a) => (
                    <div key={a.id} className="oi-cross-card">
                      <div className="oi-cross-card-body">
                        <span className="oi-cross-sym">
                          {a.symbol.replace('USDT', '')}
                        </span>
                        <span className="oi-cross-arrow mono" aria-hidden>
                          →
                        </span>
                        <span className="oi-cross-pcts mono">
                          {a.prevPct.toFixed(1)}% → {a.currPct.toFixed(1)}%
                        </span>
                      </div>
                      <button
                        type="button"
                        className="oi-cross-dismiss"
                        onClick={() => dismissOiCross(a.id)}
                        aria-label={`关闭 ${a.symbol} 提醒`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <SignalTable
              rows={tableRows}
              onSelect={
                variantScan?.phase === 'loading' ? () => {} : setSelected
              }
            />
          </>
        ) : null}

        {panel === 'sm' && !smLoading ? (
          <>
            {smRows.length > 0 && smFiltered.length === 0 ? (
              <p className="filter-empty muted small">当前筛选下无结果，请修改搜索词。</p>
            ) : null}
            <SmartMoneyFuturesTable
              rows={smFiltered}
              onOpenDetail={openSmSymbolDetail}
            />
          </>
        ) : null}
      </main>

      <footer className="foot">
        <p>
          数据来自 Binance 公开接口；本页不构成投资建议。生产环境需配置与开发相同的
          /api 反向代理。
        </p>
      </footer>

      <DetailDrawer
        row={selected}
        variantScan={variantScan}
        smDirectionScan={smDirectionScan}
        pendingSymbol={detailPendingSymbol}
        openDetailError={detailOpenError}
        onCloseAllDrawers={closeDetailDrawer}
        onCloseSymbolDrawer={closeSymbolDrawer}
        onPickFromVariantScan={onPickFromVariantScan}
        onRefreshVariantScan={refreshVariantScan}
        onPickFromSmDirectionScan={(sym) => openSmSymbolDetail(sym, false)}
        onRefreshSmDirectionScan={refreshSmDirectionScan}
      />
    </div>
  )
}
