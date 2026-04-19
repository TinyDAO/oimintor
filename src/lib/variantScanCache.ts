import type { VariantScanHit } from './scanVariantHits'

const STORAGE_KEY = 'oi-monitor-variant-scan-v1'
/** 缓存有效期：24 小时 */
export const VARIANT_SCAN_CACHE_TTL_MS = 24 * 60 * 60 * 1000

type StoredPayload = {
  v: 1
  depth: number
  ts: number
  hits: VariantScanHit[]
}

function isStoredPayload(x: unknown): x is StoredPayload {
  if (x === null || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    o.v === 1 &&
    typeof o.depth === 'number' &&
    typeof o.ts === 'number' &&
    Array.isArray(o.hits)
  )
}

/**
 * 读取未过期的扫描缓存（按榜单深度区分）。
 * 过期或解析失败返回 null。
 */
export function readVariantScanCacheIfValid(
  depth: number,
): { hits: VariantScanHit[]; cachedAt: number } | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredPayload(parsed)) return null
    if (parsed.depth !== depth) return null
    const age = Date.now() - parsed.ts
    if (age < 0 || age > VARIANT_SCAN_CACHE_TTL_MS) return null
    return { hits: parsed.hits, cachedAt: parsed.ts }
  } catch {
    return null
  }
}

export function writeVariantScanCache(depth: number, hits: VariantScanHit[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    const payload: StoredPayload = {
      v: 1,
      depth,
      ts: Date.now(),
      hits,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}
