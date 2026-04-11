/** 合约币价展示：按量级给足小数位，低价币也能看清变动 */
export function formatCoinPrice(v: number): string {
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
