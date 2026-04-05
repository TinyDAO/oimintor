import type { SmartMoneyRow } from '../lib/api/smartMoney'
import { logoUrlFull } from '../lib/api/smartMoney'

function tags(row: SmartMoneyRow): string[] {
  const out: string[] = []
  if (!row.tokenTag) return out
  for (const [, arr] of Object.entries(row.tokenTag)) {
    for (const t of arr) out.push(t.tagName)
  }
  return out
}

export function SmartMoneyPanel({ rows }: { rows: SmartMoneyRow[] }) {
  return (
    <div className="table-wrap">
      <p className="muted small sm-note">
        链上 Smart Money 与 CEX 合约 OI 无稳定映射；仅作独立参考。
      </p>
      <table className="sig-table sm-table">
        <thead>
          <tr>
            <th></th>
            <th>代币</th>
            <th>方向</th>
            <th>聪明钱数</th>
            <th>标签</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.signalId} style={{ animationDelay: `${Math.min(i, 24) * 24}ms` }}>
              <td className="logo-cell">
                {logoUrlFull(r.logoUrl) ? (
                  <img src={logoUrlFull(r.logoUrl)} alt="" width={28} height={28} />
                ) : (
                  <span className="logo-ph">{r.ticker.slice(0, 1)}</span>
                )}
              </td>
              <td className="sym">{r.ticker}</td>
              <td className={r.direction === 'buy' ? 'buy' : 'sell'}>{r.direction}</td>
              <td className="mono">{r.smartMoneyCount}</td>
              <td className="tag-cell">{tags(r).join(' · ') || '—'}</td>
              <td className="muted">{r.status ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
