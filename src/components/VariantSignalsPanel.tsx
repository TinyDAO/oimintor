import type { VariantSignals } from '../lib/signals/variantSignals'

const ROWS: {
  id: keyof Pick<VariantSignals, 'v4a' | 'v7' | 'v8'>
  code: string
  alias: string
  hint: string
}[] = [
  {
    id: 'v4a',
    code: 'V4A',
    alias: '支撑崩塌',
    hint: '拉盘+卖压、K 线短期支撑跌穿（结构）',
  },
  {
    id: 'v7',
    code: 'V7',
    alias: '空头真空',
    hint: '拉盘+卖压、OI 短时骤降',
  },
  {
    id: 'v8',
    code: 'V8',
    alias: '聪明钱撤退',
    hint: '多根 1h：OI 降、价升（背离），不依赖拉盘',
  },
]

export function VariantSignalsPanel({ signals }: { signals: VariantSignals }) {
  return (
    <div className="variant-panel">
      <p className="variant-meta muted small">
        子条件：24h 拉盘 ≥6%、距高回撤 ≥2.5%
        {signals.meta.klinesReady ? '；K 线已就绪' : '；K 线加载中则部分项不准'}
      </p>
      <ul className="variant-list" role="list">
        {ROWS.map((row) => {
          const h = signals[row.id]
          return (
            <li key={row.code} className="variant-item">
              <div
                className={`variant-row ${h.hit ? 'variant-row-hit' : 'variant-row-miss'}`}
              >
                <div className="variant-titles">
                  <span className="variant-code">{row.code}</span>
                  <span className="variant-alias">{row.alias}</span>
                  <span className="variant-hint muted" title={row.hint}>
                    {row.hint}
                  </span>
                </div>
                <span
                  className="variant-verdict"
                  aria-label={h.hit ? '当前符合该类型' : '当前不符合'}
                >
                  {h.hit ? '符合' : '不符合'}
                </span>
              </div>
              {h.reasons.length > 0 ? (
                <ul className="variant-reasons muted small">
                  {h.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
