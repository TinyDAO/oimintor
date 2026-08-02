import type { TokenHoldersAnalysis } from '../explorerHolders'

export async function fetchTokenHoldersAnalysisApi(
  chain: string,
  contractAddress: string,
  page: number,
  signal?: AbortSignal,
): Promise<TokenHoldersAnalysis> {
  const q = new URLSearchParams({
    chain,
    address: contractAddress,
    page: String(page),
  })
  const r = await fetch(`/api/token-holders?${q}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!r.ok) {
    const j = (await r.json().catch(() => null)) as { error?: string } | null
    throw new Error(j?.error || `持仓分析加载失败 (${r.status})`)
  }
  return r.json() as Promise<TokenHoldersAnalysis>
}
