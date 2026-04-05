import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { KlineCandle } from '../lib/api/futures'

function fmtVol(v: number): string {
  if (!Number.isFinite(v)) return '—'
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function VolumeBars({
  candles,
  height = 140,
}: {
  candles: KlineCandle[]
  height?: number
}) {
  const data = [...candles]
    .sort((a, b) => a.openTime - b.openTime)
    .map((c) => ({
      t: c.openTime,
      vol: c.volume,
    }))
  if (!data.length) return <div className="spark-empty">无成交量数据</div>
  return (
    <div style={{ width: '100%', height }} className="volume-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <XAxis
            dataKey="t"
            minTickGap={40}
            tickFormatter={(ts) =>
              new Date(ts).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })
            }
            stroke="var(--muted)"
            tick={{ fill: 'var(--muted)', fontSize: 10 }}
          />
          <YAxis
            stroke="var(--muted)"
            tick={{ fill: 'var(--muted)', fontSize: 10 }}
            width={52}
            tickFormatter={(v) => fmtVol(typeof v === 'number' ? v : 0)}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--panel2)',
              border: '1px solid var(--border)',
            }}
            formatter={(v) =>
              typeof v === 'number' ? fmtVol(v) : String(v ?? '')
            }
            labelFormatter={(l) => new Date(l as number).toLocaleString()}
          />
          <Bar
            dataKey="vol"
            name="成交量"
            fill="var(--vol-bar)"
            isAnimationActive={false}
            maxBarSize={14}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
