import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { RatioRow } from '../lib/api/futures'

export function RatioSpark({
  global,
  topPos,
  height = 44,
}: {
  global: RatioRow[]
  topPos: RatioRow[]
  height?: number
}) {
  const gm = new Map<number, number>()
  for (const r of global) gm.set(r.timestamp, parseFloat(r.longShortRatio))
  const data: { t: number; g?: number; tp?: number }[] = []
  for (const r of topPos) {
    const g = gm.get(r.timestamp)
    if (g === undefined) continue
    data.push({
      t: r.timestamp,
      g,
      tp: parseFloat(r.longShortRatio),
    })
  }
  data.sort((a, b) => a.t - b.t)
  if (data.length === 0) {
    return <div className="spark-empty">—</div>
  }
  return (
    <div style={{ width: '100%', height }} className="ratio-spark">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="t" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ fontSize: 11 }}
            formatter={(v) =>
              typeof v === 'number' ? v.toFixed(3) : String(v ?? '')
            }
            labelFormatter={() => 'LSR'}
          />
          <Line
            type="monotone"
            dataKey="g"
            stroke="var(--chart-user)"
            strokeWidth={1.2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="tp"
            stroke="var(--chart-top)"
            strokeWidth={1.2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
