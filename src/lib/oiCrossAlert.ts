import type { SymbolInsight } from './signals/compute'

/** 与榜单/脚本约定一致：24h 滚动 OI% 突破阈值 */
export const OI_CROSS_THRESHOLD_PCT = 30

export type OiCrossEvent = {
  symbol: string
  prevPct: number
  currPct: number
}

export function snapshotOiPct24h(insights: SymbolInsight[]): Map<string, number> {
  return new Map(insights.map((r) => [r.symbol, r.oiChangePct]))
}

/** 仅当上一轮快照里已有该合约，且此前低于阈值、当前高于阈值时视为突破（排除首次进入榜单的币）。 */
export function findOiCrossesAboveThreshold(
  prev: Map<string, number> | null,
  insights: SymbolInsight[],
  threshold = OI_CROSS_THRESHOLD_PCT,
): OiCrossEvent[] {
  if (!prev || prev.size === 0) return []
  const out: OiCrossEvent[] = []
  for (const row of insights) {
    const p = prev.get(row.symbol)
    if (p === undefined) continue
    if (p < threshold && row.oiChangePct > threshold) {
      out.push({ symbol: row.symbol, prevPct: p, currPct: row.oiChangePct })
    }
  }
  return out
}

/** 短促提示音（不依赖静态资源；部分浏览器需用户交互后才可发声） */
export function playOiCrossChime() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.23)
    osc.onended = () => void ctx.close().catch(() => {})
  } catch {
    /* ignore */
  }
}

/**
 * 已授权时使用系统通知（含默认提示音）；未授权时调用方应自行播放网页提示音。
 */
export function notifyOiCrossesDesktop(crosses: OiCrossEvent[]): boolean {
  if (crosses.length === 0) return false
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
  const title = `OI Monitor · 24h OI% 突破 ${OI_CROSS_THRESHOLD_PCT}%`
  const body = crosses
    .map((c) => `${c.symbol}  ${c.prevPct.toFixed(1)}% → ${c.currPct.toFixed(1)}%`)
    .join('\n')
  try {
    new Notification(title, { body, silent: false })
    return true
  } catch {
    return false
  }
}
