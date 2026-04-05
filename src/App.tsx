import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  loadMarketInsights,
  TOP_N_CHOICES,
  DEFAULT_TOP_N,
  normalizeTopN,
  type TopNChoice,
} from './lib/loadSignals'
import type { SymbolInsight } from './lib/signals/compute'
import { AppLogo } from './components/AppLogo'
import { SignalTable } from './components/SignalTable'
import { DetailDrawer } from './components/DetailDrawer'

const TOP_N_STORAGE_KEY = 'oi-monitor-top-n'

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

export default function App() {
  const [topN, setTopN] = useState<TopNChoice>(() => readStoredTopN())
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const [insights, setInsights] = useState<SymbolInsight[]>([])
  const [alphaOnly, setAlphaOnly] = useState(false)
  const [symbolQuery, setSymbolQuery] = useState('')
  const [selected, setSelected] = useState<SymbolInsight | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const { insights: ins } = await loadMarketInsights(setProgress, topN)
      setInsights(ins)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setProgress('')
    }
  }, [topN])

  useEffect(() => {
    refresh()
  }, [refresh])

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
        <div className="toolbar">
          <button type="button" className="btn" onClick={refresh} disabled={loading}>
            {loading ? '加载中…' : '刷新'}
          </button>
          <label className="toolbar-field">
            <span className="toolbar-label">榜单深度</span>
            <select
              className="toolbar-select"
              value={topN}
              disabled={loading}
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
          <input
            type="search"
            className="symbol-search"
            placeholder="搜索合约（如 PEPE、1000PEPE）"
            value={symbolQuery}
            onChange={(e) => setSymbolQuery(e.target.value)}
            aria-label="按合约名筛选"
            autoComplete="off"
            spellCheck={false}
          />
          {progress ? <span className="muted small">{progress}</span> : null}
        </div>
      </header>

      {err ? <div className="banner err">{err}</div> : null}

      <main className="main">
        {loading ? (
          <div className="skeleton-stack">
            <div className="sk sk-line" />
            <div className="sk sk-line short" />
            <div className="sk sk-grid" />
          </div>
        ) : null}

        {!loading ? (
          <>
            {insights.length > 0 && tableRows.length === 0 ? (
              <p className="filter-empty muted small">
                当前筛选下无合约，请修改搜索词或取消「仅 Alpha」。
              </p>
            ) : null}
            <SignalTable rows={tableRows} onSelect={setSelected} />
          </>
        ) : null}
      </main>

      <footer className="foot">
        <p>
          数据来自 Binance 公开接口；本页不构成投资建议。生产环境需配置与开发相同的
          /api 反向代理。
        </p>
      </footer>

      <DetailDrawer row={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
