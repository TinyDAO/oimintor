/** 前端 AI 交易分析结果缓存（按合约），过期后自动丢弃 */

const KEY_PREFIX = 'oi.monitor.traderAi.v1:'
export const TRADER_AI_CACHE_TTL_MS = 60 * 60 * 1000

type Entry = { savedAt: number; text: string }

function key(symbol: string) {
  return KEY_PREFIX + symbol
}

export function readTraderAiCache(symbol: string): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(key(symbol))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Entry
    if (
      !parsed ||
      typeof parsed.text !== 'string' ||
      typeof parsed.savedAt !== 'number'
    ) {
      localStorage.removeItem(key(symbol))
      return null
    }
    if (Date.now() - parsed.savedAt > TRADER_AI_CACHE_TTL_MS) {
      localStorage.removeItem(key(symbol))
      return null
    }
    return parsed.text
  } catch {
    try {
      localStorage.removeItem(key(symbol))
    } catch {
      /* ignore */
    }
    return null
  }
}

export function writeTraderAiCache(symbol: string, text: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    const payload: Entry = { savedAt: Date.now(), text }
    localStorage.setItem(key(symbol), JSON.stringify(payload))
  } catch {
    /* quota or private mode */
  }
}

export function clearTraderAiCache(symbol: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(key(symbol))
  } catch {
    /* ignore */
  }
}
