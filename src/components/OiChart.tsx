import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { OiHistRow } from '../lib/api/futures'
import {
  DRAWER_CHART_MARGIN_OI,
  DRAWER_X_MIN_TICK_GAP,
  DRAWER_Y_LEFT_W,
  DRAWER_Y_RIGHT_W,
} from '../lib/chartDrawerLayout'

function fmtOi(v: number): string {
  if (!Number.isFinite(v)) return '—'
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`
  return v.toLocaleString()
}

function fmtUsd(v: number): string {
  if (!Number.isFinite(v)) return '—'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}k`
  return `$${v.toFixed(0)}`
}

export function OiArea({
  rows,
  height = 160,
}: {
  rows: OiHistRow[]
  height?: number
}) {
  const data = [...rows]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((r) => ({
      t: r.timestamp,
      oi: parseFloat(r.sumOpenInterest),
      oiValue: parseFloat(r.sumOpenInterestValue),
    }))
  if (!data.length) return <div className="spark-empty">无 OI 数据</div>
  return (
    <div style={{ width: '100%', height }} className="oi-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ ...DRAWER_CHART_MARGIN_OI }}
        >
          <XAxis
            dataKey="t"
            minTickGap={DRAWER_X_MIN_TICK_GAP}
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
            yAxisId="oi"
            stroke="var(--accent)"
            tick={{ fill: 'var(--accent)', fontSize: 10 }}
            width={DRAWER_Y_LEFT_W}
            tickFormatter={(v) => fmtOi(typeof v === 'number' ? v : 0)}
          />
          <YAxis
            yAxisId="usd"
            orientation="right"
            stroke="var(--oi-value)"
            tick={{ fill: 'var(--oi-value)', fontSize: 10 }}
            width={DRAWER_Y_RIGHT_W}
            tickFormatter={(v) => fmtUsd(typeof v === 'number' ? v : 0)}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--panel2)',
              border: '1px solid var(--border)',
            }}
            formatter={(value, name) => {
              const v = typeof value === 'number' ? value : Number(value)
              if (name === '持仓量') return [fmtOi(v), name]
              if (name === '名义价值') return [fmtUsd(v), name]
              return [String(value), String(name)]
            }}
            labelFormatter={(l) => new Date(l as number).toLocaleString()}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => (
              <span style={{ color: 'var(--muted)' }}>{value}</span>
            )}
          />
          <Area
            yAxisId="oi"
            name="持仓量"
            type="monotone"
            dataKey="oi"
            stroke="var(--accent)"
            fill="var(--accent-dim)"
            strokeWidth={1.5}
            isAnimationActive={false}
          />
          <Line
            yAxisId="usd"
            name="名义价值"
            type="monotone"
            dataKey="oiValue"
            stroke="var(--oi-value)"
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
