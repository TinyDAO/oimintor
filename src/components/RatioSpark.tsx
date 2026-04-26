import { memo, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { RatioRow } from '../lib/api/futures'

/** 缩略图不需要全量点数，减轻 Recharts 在表头排序等整表重绘时的开销 */
const SPARK_MAX_POINTS = 96

function downsampleSeries<T>(sorted: T[], maxLen: number): T[] {
  if (sorted.length <= maxLen) return sorted
  const out: T[] = []
  const last = sorted.length - 1
  for (let i = 0; i < maxLen; i++) {
    const idx = Math.round((i / (maxLen - 1)) * last)
    out.push(sorted[idx]!)
  }
  return out
}

function RatioSparkInner({
  global,
  topPos,
  height = 44,
}: {
  global: RatioRow[]
  topPos: RatioRow[]
  height?: number
}) {
  const data = useMemo(() => {
    const gm = new Map<number, number>()
    for (const r of global) gm.set(r.timestamp, parseFloat(r.longShortRatio))
    const raw: { t: number; g?: number; tp?: number }[] = []
    for (const r of topPos) {
      const g = gm.get(r.timestamp)
      if (g === undefined) continue
      raw.push({
        t: r.timestamp,
        g,
        tp: parseFloat(r.longShortRatio),
      })
    }
    raw.sort((a, b) => a.t - b.t)
    return downsampleSeries(raw, SPARK_MAX_POINTS)
  }, [global, topPos])

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

/** 排序时父组件重绘但各合约 global/topPos 引用不变，避免每行重跑 Recharts */
export const RatioSpark = memo(RatioSparkInner)
