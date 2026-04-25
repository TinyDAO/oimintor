function inBrowser(): boolean {
  const g = globalThis as Record<string, unknown>
  return typeof g.window !== 'undefined' && g.window != null
}

/** Node / Vercel Function：直连 Binance；浏览器仍走同源 /api 代理（vite / vercel rewrites）。 */
const FAPI_ORIGIN = 'https://fapi.binance.com'
const BAPI_ORIGIN = 'https://www.binance.com'
const WEB3_ORIGIN = 'https://web3.binance.com'
const SPOT_ORIGIN = 'https://api.binance.com'

/** Dev/prod 浏览器：/api/fapi + path；服务端：fapi.binance.com + path */
export const fapi = (path: string) =>
  inBrowser() ? `/api/fapi${path.startsWith('/') ? path : `/${path}`}` : `${FAPI_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`

export const bapi = (path: string) =>
  inBrowser()
    ? `/api/bapi${path.startsWith('/') ? path : `/${path}`}`
    : `${BAPI_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`

export const web3 = (path: string) =>
  inBrowser()
    ? `/api/web3${path.startsWith('/') ? path : `/${path}`}`
    : `${WEB3_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`

/** Binance 现货 REST（api.binance.com，经 /api/spot 同源代理） */
export const spot = (path: string) =>
  inBrowser()
    ? `/api/spot${path.startsWith('/') ? path : `/${path}`}`
    : `${SPOT_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
