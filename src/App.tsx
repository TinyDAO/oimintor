import { useCallback, useEffect, useState } from 'react'
import { loadMarketInsights } from './lib/loadSignals'
import type { SymbolInsight } from './lib/signals/compute'
import { AppLogo } from './components/AppLogo'
import { SignalTable } from './components/SignalTable'
import { DetailDrawer } from './components/DetailDrawer'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const [insights, setInsights] = useState<SymbolInsight[]>([])
  const [alphaOnly, setAlphaOnly] = useState(false)
  const [selected, setSelected] = useState<SymbolInsight | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const { insights: ins } = await loadMarketInsights(setProgress)
      setInsights(ins)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setProgress('')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const tableRows = alphaOnly
    ? insights.filter((x) => x.isAlpha)
    : insights

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
          <label className="chk">
            <input
              type="checkbox"
              checked={alphaOnly}
              onChange={(e) => setAlphaOnly(e.target.checked)}
            />
            仅 Alpha 标的
          </label>
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
          <SignalTable rows={tableRows} onSelect={setSelected} />
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
