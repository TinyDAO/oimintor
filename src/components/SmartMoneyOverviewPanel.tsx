import { useState } from 'react'
import {
  overviewSideAvgEntry,
  overviewSideMarkNotional,
  overviewSideNotionalByBucket,
  overviewSidePeople,
  overviewSideProfitPeople,
  overviewSideQty,
  overviewSideUpl,
  type OverviewBucket,
  type SmartMoneyOverviewData,
} from '../lib/api/smartMoneyFutures'
import { formatCoinPrice } from '../lib/formatPrice'

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const a = Math.abs(n)
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

function fmtUsdSigned(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}${fmtUsd(Math.abs(n))}`
}

function fmtQty(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

const BUCKET_TABS: { id: Exclude<OverviewBucket, 'all'>; label: string }[] = [
  { id: 'trader', label: '全体聪明钱' },
  { id: 'whale', label: '其中大户' },
]

function sidePct(part: number, whole: number): string {
  if (!(whole > 0)) return '—'
  return `${Math.min(100, (Math.max(0, part) / whole) * 100).toFixed(0)}%`
}

function IconPos() {
  return (
    <svg className="sm-ov-ico" viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="10" width="6" height="11" rx="1.2" />
      <rect x="11" y="5" width="6" height="16" rx="1.2" />
      <rect x="19" y="13" width="2.4" height="8" rx="0.8" />
    </svg>
  )
}

function IconPnl() {
  return (
    <svg className="sm-ov-ico" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 16.5 10 10l4 3.5 6-8" fill="none" />
      <path d="M16 5.5h4.5V10" fill="none" />
    </svg>
  )
}

function IconPeople() {
  return (
    <svg className="sm-ov-ico" viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="8" r="3.1" fill="none" />
      <circle cx="16.2" cy="9.2" r="2.4" fill="none" />
      <path d="M3.5 19.5c.6-3.2 3-5 5.5-5s4.9 1.8 5.5 5" fill="none" />
      <path d="M13.2 19.5c.4-2.2 1.8-3.5 3.4-3.5 1.7 0 3.1 1.3 3.5 3.5" fill="none" />
    </svg>
  )
}

function WinRing({
  profit,
  total,
  tone,
}: {
  profit: number
  total: number
  tone: 'long' | 'short'
}) {
  const r = 18
  const c = 2 * Math.PI * r
  const win = total > 0 ? Math.min(1, Math.max(0, profit / total)) : 0
  const dash = `${(win * c).toFixed(2)} ${(c - win * c).toFixed(2)}`
  return (
    <svg className={`sm-ov-ring sm-ov-ring-${tone}`} viewBox="0 0 48 48">
      <circle className="sm-ov-ring-track" cx="24" cy="24" r={r} />
      <circle
        className="sm-ov-ring-win"
        cx="24"
        cy="24"
        r={r}
        strokeDasharray={dash}
        transform="rotate(-90 24 24)"
      />
      <text x="24" y="26" textAnchor="middle">
        {total > 0 ? `${(win * 100).toFixed(0)}%` : '—'}
      </text>
    </svg>
  )
}

function PriceTiles({
  longAvg,
  shortAvg,
  mark,
  base,
}: {
  longAvg: number
  shortAvg: number
  mark: number
  base: string
}) {
  const longPct = longAvg > 0 ? ((mark - longAvg) / longAvg) * 100 : 0
  const shortPct = shortAvg > 0 ? ((shortAvg - mark) / shortAvg) * 100 : 0
  return (
    <div className="sm-ov-prices">
      <div className={`sm-ov-price-tile ${longPct >= 0 ? 'is-up' : 'is-down'}`}>
        <span>多头均价 · {base}</span>
        <b className="mono">{formatCoinPrice(longAvg)}</b>
        <small>相对标记 {longPct >= 0 ? '+' : '−'}{Math.abs(longPct).toFixed(1)}%</small>
      </div>
      <div className="sm-ov-price-tile is-mark">
        <span>标记价</span>
        <b className="mono">{formatCoinPrice(mark)}</b>
        <small>现价锚点，不是持仓</small>
      </div>
      <div className={`sm-ov-price-tile ${shortPct >= 0 ? 'is-up' : 'is-down'}`}>
        <span>空头均价 · {base}</span>
        <b className="mono">{formatCoinPrice(shortAvg)}</b>
        <small>相对标记 {shortPct >= 0 ? '+' : '−'}{Math.abs(shortPct).toFixed(1)}%</small>
      </div>
    </div>
  )
}

function NestedLsBar({
  longAll,
  longWhale,
  shortAll,
  shortWhale,
  unit,
}: {
  longAll: number
  longWhale: number
  shortAll: number
  shortWhale: number
  unit?: 'usd'
}) {
  const long = Math.max(0, longAll)
  const short = Math.max(0, shortAll)
  const whaleL = Math.max(0, longWhale)
  const whaleS = Math.max(0, shortWhale)
  const sum = long + short
  const longW = sum > 0 ? (long / sum) * 100 : 0
  const shortW = sum > 0 ? (short / sum) * 100 : 0
  const whaleLShare = long > 0 ? Math.min(100, (whaleL / long) * 100) : 0
  const whaleSShare = short > 0 ? Math.min(100, (whaleS / short) * 100) : 0
  const ratio = short > 0 && Number.isFinite(long / short) ? long / short : undefined
  const fmt = unit === 'usd' ? fmtUsd : fmtQty
  return (
    <div className="sm-ov-stack">
      <div className="sm-ov-nest-bar" role="img" aria-label="多空总额，其中深色为大户">
        {longW > 0 ? (
          <div
            className="sm-ov-nest-long"
            style={{ width: `${longW}%` }}
            title={`多头全体 ${fmt(long)} · ${sidePct(long, sum)}；其中大户 ${fmt(whaleL)} · 占本侧 ${sidePct(whaleL, long)}`}
          >
            <div className="sm-ov-nest-whale-l" style={{ width: `${whaleLShare}%` }} />
          </div>
        ) : null}
        {shortW > 0 ? (
          <div
            className="sm-ov-nest-short"
            style={{ width: `${shortW}%` }}
            title={`空头全体 ${fmt(short)} · ${sidePct(short, sum)}；其中大户 ${fmt(whaleS)} · 占本侧 ${sidePct(whaleS, short)}`}
          >
            <div className="sm-ov-nest-whale-s" style={{ width: `${whaleSShare}%` }} />
          </div>
        ) : null}
      </div>
      <p className="sm-ov-stack-ratio mono">
        {ratio != null ? `多/空 ${ratio.toFixed(3)}∶1` : '—'}
        {sum > 0 ? ` · 合计 ${fmt(sum)}` : ''}
      </p>
      <ul className="sm-ov-legend">
        <li>
          <i className="seg-long-trader" />
          <span>多头全体</span>
          <b className="mono">{fmt(long)}</b>
          <em>{sidePct(long, sum)}</em>
        </li>
        <li>
          <i className="seg-short-trader" />
          <span>空头全体</span>
          <b className="mono">{fmt(short)}</b>
          <em>{sidePct(short, sum)}</em>
        </li>
        <li>
          <i className="seg-long-whale" />
          <span>多·大户</span>
          <b className="mono">{fmt(whaleL)}</b>
          <em>{sidePct(whaleL, long)}</em>
        </li>
        <li>
          <i className="seg-short-whale" />
          <span>空·大户</span>
          <b className="mono">{fmt(whaleS)}</b>
          <em>{sidePct(whaleS, short)}</em>
        </li>
      </ul>
    </div>
  )
}

function UplRows({
  rows,
}: {
  rows: { label: string; value: number; cls: string }[]
}) {
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.value)))
  return (
    <ul className="sm-ov-upl">
      {rows.map((r) => {
        const pct = (Math.abs(r.value) / maxAbs) * 100
        const pos = r.value >= 0
        return (
          <li key={r.label} className={r.cls}>
            <span className="sm-ov-upl-lab">{r.label}</span>
            <div className="sm-ov-upl-track">
              <div className="sm-ov-upl-mid" />
              <div
                className={`sm-ov-upl-fill ${pos ? 'is-up' : 'is-down'}`}
                style={{
                  width: `${pct / 2}%`,
                  [pos ? 'left' : 'right']: '50%',
                }}
              />
            </div>
            <b className={`mono ${pos ? 'is-up' : 'is-down'}`}>{fmtUsdSigned(r.value)}</b>
          </li>
        )
      })}
    </ul>
  )
}

export function SmartMoneyOverviewPanel({
  data,
  markPriceUsd,
}: {
  data: SmartMoneyOverviewData
  markPriceUsd?: number
}) {
  const [bucketTab, setBucketTab] = useState<Exclude<OverviewBucket, 'all'>>('trader')
  const base = data.symbol.replace(/USDT$/i, '')
  const markOk =
    markPriceUsd != null && Number.isFinite(markPriceUsd) && markPriceUsd > 0
  const mark = markOk ? markPriceUsd! : 0

  const costLong = overviewSideNotionalByBucket(data, 'long', bucketTab)
  const costShort = overviewSideNotionalByBucket(data, 'short', bucketTab)
  const markLong = markOk
    ? overviewSideMarkNotional(data, 'long', bucketTab, mark)
    : 0
  const markShort = markOk
    ? overviewSideMarkNotional(data, 'short', bucketTab, mark)
    : 0
  const qtyLong = overviewSideQty(data, 'long', bucketTab)
  const qtyShort = overviewSideQty(data, 'short', bucketTab)
  const peopleLong = overviewSidePeople(data, 'long', bucketTab)
  const peopleShort = overviewSidePeople(data, 'short', bucketTab)
  const winLong = overviewSideProfitPeople(data, 'long', bucketTab)
  const winShort = overviewSideProfitPeople(data, 'short', bucketTab)
  const loseLong = Math.max(0, peopleLong - winLong)
  const loseShort = Math.max(0, peopleShort - winShort)
  const longAvg = overviewSideAvgEntry(data, 'long', bucketTab)
  const shortAvg = overviewSideAvgEntry(data, 'short', bucketTab)
  const uplLong = markOk ? overviewSideUpl(data, 'long', bucketTab, mark) : NaN
  const uplShort = markOk ? overviewSideUpl(data, 'short', bucketTab, mark) : NaN

  const qtyLongAll = overviewSideQty(data, 'long', 'trader')
  const qtyShortAll = overviewSideQty(data, 'short', 'trader')
  const costLongAll = overviewSideNotionalByBucket(data, 'long', 'trader')
  const costShortAll = overviewSideNotionalByBucket(data, 'short', 'trader')
  const costLongWhale = overviewSideNotionalByBucket(data, 'long', 'whale')
  const costShortWhale = overviewSideNotionalByBucket(data, 'short', 'whale')
  const qtyLongWhale = overviewSideQty(data, 'long', 'whale')
  const qtyShortWhale = overviewSideQty(data, 'short', 'whale')
  const qtyRatio =
    qtyShortAll > 0 && Number.isFinite(qtyLongAll / qtyShortAll)
      ? qtyLongAll / qtyShortAll
      : undefined

  const uplRows = [
    {
      label: bucketTab === 'whale' ? '多·大户' : '多·全体',
      value: markOk ? uplLong : 0,
      cls: 'row-long',
    },
    {
      label: bucketTab === 'whale' ? '空·大户' : '空·全体',
      value: markOk ? uplShort : 0,
      cls: 'row-short',
    },
  ]
  if (bucketTab === 'trader' && markOk) {
    uplRows.splice(1, 0, {
      label: '多·其中大户',
      value: overviewSideUpl(data, 'long', 'whale', mark),
      cls: 'row-long is-nested',
    })
    uplRows.push({
      label: '空·其中大户',
      value: overviewSideUpl(data, 'short', 'whale', mark),
      cls: 'row-short is-nested',
    })
  }

  return (
    <div className="sm-overview">
      <nav className="view-tabs sm-overview-bucket-tabs" aria-label="分桶">
        {BUCKET_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={bucketTab === tab.id}
            className={bucketTab === tab.id ? 'view-tab on' : 'view-tab'}
            onClick={() => setBucketTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="sm-ov-card sm-ov-card-pos">
        <header className="sm-ov-card-h">
          <IconPos />
          <div>
            <h4>持仓</h4>
            <p>
              接口没有散户。traders 是聪明钱全体，whales 是其中大户（子集，已含在全体里，不能相加）。
              成本名义 = 数量 × 均价；当前名义 = 数量 × 标记价。
            </p>
          </div>
        </header>
        <div className="sm-ov-kpis">
          <div>
            <span>{bucketTab === 'whale' ? '大户成本名义' : '全体成本名义'}</span>
            <b className="mono">{fmtUsd(costLong + costShort)}</b>
            <small>
              多 {fmtUsd(costLong)} · 空 {fmtUsd(costShort)}
            </small>
          </div>
          <div>
            <span>{bucketTab === 'whale' ? '大户当前名义' : '全体当前名义'}</span>
            <b className="mono">{markOk ? fmtUsd(markLong + markShort) : '—'}</b>
            <small>
              {markOk
                ? `多 ${fmtUsd(markLong)} · 空 ${fmtUsd(markShort)}`
                : '待标记价'}
            </small>
          </div>
          <div>
            <span>持仓数量（{base}）</span>
            <b className="mono">{fmtQty(qtyLong + qtyShort)}</b>
            <small>
              多 {fmtQty(qtyLong)} · 空 {fmtQty(qtyShort)}
            </small>
          </div>
          <div>
            <span>接口总名义</span>
            <b className="mono">{fmtUsd(data.totalPositions)}</b>
            <small>
              多空比 {Number.isFinite(data.longShortRatio) ? `${data.longShortRatio.toFixed(3)}∶1` : '—'}
              {qtyRatio != null ? ` · 数量比 ${qtyRatio.toFixed(3)}∶1` : ''}
            </small>
          </div>
        </div>
        <h5>全体多空 · 成本名义（深绿/深红 = 大户）</h5>
        <NestedLsBar
          longAll={costLongAll}
          longWhale={costLongWhale}
          shortAll={costShortAll}
          shortWhale={costShortWhale}
          unit="usd"
        />
        <h5>全体多空 · 持仓数量（{base}，深绿/深红 = 大户）</h5>
        <NestedLsBar
          longAll={qtyLongAll}
          longWhale={qtyLongWhale}
          shortAll={qtyShortAll}
          shortWhale={qtyShortWhale}
        />
        {markOk ? (
          <PriceTiles longAvg={longAvg} shortAvg={shortAvg} mark={mark} base={base} />
        ) : (
          <p className="muted small sm-overview-pnl-wait">标记价加载后显示均价相对位置。</p>
        )}
      </section>

      <section className="sm-ov-card sm-ov-card-pnl">
        <header className="sm-ov-card-h">
          <IconPnl />
          <div>
            <h4>浮盈金额</h4>
            <p>
              净额按当前 Tab。其中大户已包含在全体里，不要把两行再加总。
            </p>
          </div>
          {markOk ? (
            <strong className={`sm-ov-net mono ${uplLong + uplShort >= 0 ? 'is-up' : 'is-down'}`}>
              净额 {fmtUsdSigned(uplLong + uplShort)}
            </strong>
          ) : null}
        </header>
        {markOk ? (
          <UplRows rows={uplRows} />
        ) : (
          <p className="muted small sm-overview-pnl-wait">待标记价后估算浮盈金额。</p>
        )}
      </section>

      <section className="sm-ov-card sm-ov-card-people">
        <header className="sm-ov-card-h">
          <IconPeople />
          <div>
            <h4>盈亏人数</h4>
            <p>
              totalTraders = 多头全体 + 空头全体（{data.totalTraders.toLocaleString()}）。大户是其中人数，不是另一批散户。
            </p>
          </div>
        </header>
        <div className="sm-ov-people">
          <div className="sm-ov-people-col">
            <WinRing profit={winLong} total={peopleLong} tone="long" />
            <div>
              <h5>多头 {peopleLong.toLocaleString()} 人</h5>
              <div className="sm-ov-people-bar">
                <span style={{ width: `${peopleLong ? (winLong / peopleLong) * 100 : 0}%` }} />
              </div>
              <small>
                盈利 {winLong} · 亏损 {loseLong}
              </small>
            </div>
          </div>
          <div className="sm-ov-people-col">
            <WinRing profit={winShort} total={peopleShort} tone="short" />
            <div>
              <h5>空头 {peopleShort.toLocaleString()} 人</h5>
              <div className="sm-ov-people-bar is-short">
                <span style={{ width: `${peopleShort ? (winShort / peopleShort) * 100 : 0}%` }} />
              </div>
              <small>
                盈利 {winShort} · 亏损 {loseShort}
              </small>
            </div>
          </div>
        </div>
        <ul className="sm-ov-people-split">
          <li>
            多头全体 {overviewSidePeople(data, 'long', 'trader')} · 其中大户{' '}
            {overviewSidePeople(data, 'long', 'whale')}（盈{' '}
            {overviewSideProfitPeople(data, 'long', 'whale')}）
          </li>
          <li>
            空头全体 {overviewSidePeople(data, 'short', 'trader')} · 其中大户{' '}
            {overviewSidePeople(data, 'short', 'whale')}（盈{' '}
            {overviewSideProfitPeople(data, 'short', 'whale')}）
          </li>
        </ul>
      </section>
    </div>
  )
}
