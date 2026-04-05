import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { KlineCandle } from '../lib/api/futures'

/** 合约币价展示：按量级给足小数位，低价币也能看清变动 */
function formatCoinPrice(v: number): string {
  if (!Number.isFinite(v)) return String(v)
  const a = Math.abs(v)
  if (a >= 1_000_000) {
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  if (a >= 1000) {
    return v.toLocaleString(undefined, { maximumFractionDigits: 3 })
  }
  if (a >= 1) {
    return v.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })
  }
  if (a >= 0.01) {
    return v.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    })
  }
  if (a >= 1e-8) {
    return v.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 12,
    })
  }
  return v.toExponential(4)
}

export function PriceLine({
  candles,
  height = 180,
}: {
  candles: KlineCandle[]
  height?: number
}) {
  const data = [...candles]
    .sort((a, b) => a.openTime - b.openTime)
    .map((c) => ({
      t: c.openTime,
      close: c.close,
    }))
  if (!data.length) return <div className="spark-empty">无 K 线数据</div>
  return (
    <div style={{ width: '100%', height }} className="price-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
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
            width={56}
            domain={['auto', 'auto']}
            tickFormatter={(v) =>
              typeof v === 'number' ? formatCoinPrice(v) : String(v)
            }
          />
          <Tooltip
            contentStyle={{
              background: 'var(--panel2)',
              border: '1px solid var(--border)',
            }}
            formatter={(v) =>
              typeof v === 'number' ? formatCoinPrice(v) : String(v ?? '')
            }
            labelFormatter={(l) => new Date(l as number).toLocaleString()}
          />
          <Line
            type="monotone"
            dataKey="close"
            name="收盘"
            stroke="var(--price-line)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
