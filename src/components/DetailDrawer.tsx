import { useEffect, useState } from 'react'
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
import { fetchKlines, type KlineCandle } from '../lib/api/futures'
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

  if (!row) return null
  const ratioData = mergeRatio(row.global, row.topAcc, row.topPos)
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
          <h3>多空比三轨（1h，约 14 天 · 用户 / 大户账户 / 大户持仓）</h3>
          <div className="drawer-chart-tall">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ratioData} margin={{ top: 4, right: 8, left: 0, bottom: 2 }}>
                <XAxis
                  dataKey="t"
                  minTickGap={36}
                  tickFormatter={(x) =>
                    new Date(x).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                  stroke="var(--muted)"
                  tick={{ fill: 'var(--muted)', fontSize: 10 }}
                />
                <YAxis stroke="var(--muted)" tick={{ fontSize: 10 }} width={40} />
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
          <BinanceFuturesLink symbol={row.symbol}>在 Binance 合约打开</BinanceFuturesLink>
        </footer>
      </aside>
    </div>
  )
}
