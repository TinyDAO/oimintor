import { useCallback, useEffect, useState } from 'react'
import { loadMarketInsights } from './lib/loadSignals'
import type { SymbolInsight } from './lib/signals/compute'
import { fetchSmartMoneySignals, type SmartMoneyRow } from './lib/api/smartMoney'
import { SignalTable } from './components/SignalTable'
import { DetailDrawer } from './components/DetailDrawer'
import { SmartMoneyPanel } from './components/SmartMoneyPanel'

type Tab = 'oi' | 'alpha' | 'sm'

export default function App() {
  const [tab, setTab] = useState<Tab>('oi')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const [insights, setInsights] = useState<SymbolInsight[]>([])
  const [alphaOnly, setAlphaOnly] = useState(false)
  const [selected, setSelected] = useState<SymbolInsight | null>(null)
  const [smSol, setSmSol] = useState<SmartMoneyRow[]>([])
  const [smBsc, setSmBsc] = useState<SmartMoneyRow[]>([])

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

  useEffect(() => {
    if (tab !== 'sm') return
    let cancelled = false
    ;(async () => {
      try {
        const [a, b] = await Promise.all([
          fetchSmartMoneySignals('CT_501', 1, 40),
          fetchSmartMoneySignals('56', 1, 40),
        ])
        if (!cancelled) {
          setSmSol(a)
          setSmBsc(b)
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab])

  const alphaRows = alphaOnly
    ? insights.filter((x) => x.isAlpha)
    : insights

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-top">
          <p className="eyebrow">Binance USDT-M · 山寨结构雷达</p>
          <h1>OI &amp; 多空结构</h1>
          <p className="lede">
            聚合 OI、用户/大户多空比与背离信号；跳转合约前请自行核对风险。
          </p>
        </div>
        <nav className="tabs">
          <button
            type="button"
            className={tab === 'oi' ? 'tab on' : 'tab'}
            onClick={() => setTab('oi')}
          >
            OI 信号榜
          </button>
          <button
            type="button"
            className={tab === 'alpha' ? 'tab on' : 'tab'}
            onClick={() => setTab('alpha')}
          >
            Alpha ∩ 永续
          </button>
          <button
            type="button"
            className={tab === 'sm' ? 'tab on' : 'tab'}
            onClick={() => setTab('sm')}
          >
            链上聪明钱
          </button>
        </nav>
        <div className="toolbar">
          <button type="button" className="btn" onClick={refresh} disabled={loading}>
            {loading ? '加载中…' : '刷新'}
          </button>
          {tab === 'alpha' ? (
            <label className="chk">
              <input
                type="checkbox"
                checked={alphaOnly}
                onChange={(e) => setAlphaOnly(e.target.checked)}
              />
              仅 Alpha 标的
            </label>
          ) : null}
          {progress ? <span className="muted small">{progress}</span> : null}
        </div>
      </header>

      {err ? <div className="banner err">{err}</div> : null}

      <main className="main">
        {loading && (tab === 'oi' || tab === 'alpha') ? (
          <div className="skeleton-stack">
            <div className="sk sk-line" />
            <div className="sk sk-line short" />
            <div className="sk sk-grid" />
          </div>
        ) : null}

        {!loading && tab === 'oi' ? (
          <SignalTable rows={insights} onSelect={setSelected} />
        ) : null}

        {!loading && tab === 'alpha' ? (
          <SignalTable rows={alphaRows} onSelect={setSelected} />
        ) : null}

        {tab === 'sm' ? (
          <>
            <h3 className="subh">Solana</h3>
            <SmartMoneyPanel rows={smSol} />
            <h3 className="subh">BSC</h3>
            <SmartMoneyPanel rows={smBsc} />
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
