import { memo, useMemo } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { KlineCandle } from '../lib/api/futures'

function compactVolume(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return value.toFixed(2)
}

function DailyVolumeSparkInner({
  candles,
  metricLabel = '成交币量',
}: {
  candles: Pick<KlineCandle, 'openTime' | 'volume'>[]
  metricLabel?: string
}) {
  const data = useMemo(
    () =>
      candles.map((c, index) => ({
        t: c.openTime,
        volume: c.volume,
        zone:
          index >= candles.length - 3
            ? 'recent'
            : index >= candles.length - 10
              ? 'baseline'
              : 'history',
      })),
    [candles],
  )

  return (
    <div className="daily-volume-spark" aria-label="最近 30 天日成交币量走势">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 3, right: 2, left: 2, bottom: 0 }}>
          <XAxis dataKey="t" hide />
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            contentStyle={{ fontSize: 11 }}
            formatter={(value) => [
              compactVolume(typeof value === 'number' ? value : Number(value)),
              metricLabel,
            ]}
            labelFormatter={(value) =>
              new Date(Number(value)).toLocaleDateString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
              })
            }
          />
          <Bar dataKey="volume" radius={[1, 1, 0, 0]} isAnimationActive={false}>
            {data.map((point) => (
              <Cell
                key={point.t}
                fill={
                  point.zone === 'recent'
                    ? 'var(--accent)'
                    : point.zone === 'baseline'
                      ? 'var(--chart-user)'
                      : 'rgba(154, 150, 168, 0.38)'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export const DailyVolumeSpark = memo(DailyVolumeSparkInner)
