import type { ExchangeSymbol } from '../api/futures'
import type { Ticker24h } from '../api/futures'

const DEFAULT_EXCLUDE = new Set(['BTCUSDT', 'ETHUSDT', 'BNBUSDT'])

export function perpetualUsdtSymbols(symbols: ExchangeSymbol[]): Set<string> {
  const s = new Set<string>()
  for (const x of symbols) {
    if (
      x.contractType === 'PERPETUAL' &&
      x.quoteAsset === 'USDT' &&
      x.status === 'TRADING'
    ) {
      s.add(x.symbol)
    }
  }
  return s
}

export function filterAltUniverse(
  perpetual: Set<string>,
  exclude: Set<string> = DEFAULT_EXCLUDE,
): Set<string> {
  const out = new Set<string>()
  for (const sym of perpetual) {
    if (!exclude.has(sym)) out.add(sym)
  }
  return out
}

export function topSymbolsByQuoteVolume(
  tickers: Ticker24h[],
  universe: Set<string>,
  topN: number,
): string[] {
  const rows = tickers.filter((t) => universe.has(t.symbol))
  rows.sort(
    (a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume),
  )
  return rows.slice(0, topN).map((t) => t.symbol)
}

export function tickerMap(tickers: Ticker24h[]): Map<string, Ticker24h> {
  const m = new Map<string, Ticker24h>()
  for (const t of tickers) m.set(t.symbol, t)
  return m
}
