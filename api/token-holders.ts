import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchTokenHoldersAnalysis } from '../src/lib/explorerHolders.js'

export const config = {
  maxDuration: 20,
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const chain = Array.isArray(req.query.chain)
    ? req.query.chain[0]
    : req.query.chain
  const address = Array.isArray(req.query.address)
    ? req.query.address[0]
    : req.query.address
  const rawPage = Array.isArray(req.query.page)
    ? req.query.page[0]
    : req.query.page
  const page = Math.max(1, parseInt(rawPage ?? '1', 10) || 1)

  if (!chain || !address) {
    return res.status(400).json({ error: 'Missing chain or address' })
  }

  try {
    const data = await fetchTokenHoldersAnalysis(chain, address, page)
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return res.status(200).json(data)
  } catch (e) {
    return res.status(502).json({
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
