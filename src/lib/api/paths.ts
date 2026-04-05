/** Dev/prod: same-origin proxy paths (see vite.config + netlify.toml). */
export const fapi = (path: string) =>
  `/api/fapi${path.startsWith('/') ? path : `/${path}`}`

export const bapi = (path: string) =>
  `/api/bapi${path.startsWith('/') ? path : `/${path}`}`

export const web3 = (path: string) =>
  `/api/web3${path.startsWith('/') ? path : `/${path}`}`
