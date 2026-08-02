import { tokenHoldersAnalysisUrl } from './tokenExplorer'

export type HolderRow = {
  rank: string
  address: string
  nameTag: string | null
  quantity: string
  percentage: string
  value: string | null
}

export type HolderConcentrationRow = {
  label: string
  amount: string
  percentage: string
}

export type HolderTierRow = {
  label: string
  holders: string
  holdersRatio: string
  supplyRatio: string
}

export type HolderThresholdRow = {
  threshold: string
  holders: string
  ratio: string
}

export type TokenHoldersAnalysis = {
  sourceUrl: string
  page: number
  totalPages: number | null
  totalHolders: string | null
  topLabel: string | null
  snapshotAgo: string | null
  holders: HolderRow[]
  concentration: HolderConcentrationRow[]
  tiers: HolderTierRow[]
  thresholds: HolderThresholdRow[]
}

function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d: string) =>
      String.fromCharCode(parseInt(d, 10)),
    )
}

function cleanText(html: string): string {
  return decodeHtml(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function extractText(html: string, re: RegExp): string | null {
  const m = html.match(re)
  return m ? cleanText(m[1]) : null
}

function rowsByAttr(html: string, attr: string): string[] {
  const rows: string[] = []
  const re = new RegExp(`<tr[^>]*\\b${attr}\\b[^>]*>([\\s\\S]*?)<\\/tr>`, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) rows.push(m[1])
  return rows
}

function cellByAttr(rowHtml: string, attr: string): string {
  return (
    extractText(
      rowHtml,
      new RegExp(`<td[^>]*\\b${attr}\\b[^>]*>([\\s\\S]*?)<\\/td>`, 'i'),
    ) ?? '—'
  )
}

function parseQuickExportRows(html: string): HolderRow[] {
  const m = html.match(/quickExportTokenHolerData\s*=\s*'([\s\S]*?)';/)
  if (!m) return []

  try {
    const rows = JSON.parse(m[1].replace(/\\'/g, "'")) as unknown[]
    if (!Array.isArray(rows)) return []
    return rows
      .filter((r): r is unknown[] => Array.isArray(r))
      .map((r) => ({
        rank: String(r[0] ?? ''),
        address: String(r[1] ?? ''),
        nameTag: r[2] == null || r[2] === '' ? null : String(r[2]),
        quantity: String(r[3] ?? ''),
        percentage: String(r[4] ?? ''),
        value: r[5] == null || r[5] === '' ? null : String(r[5]),
      }))
      .filter((r) => r.rank && r.address)
  } catch {
    return []
  }
}

function parseConcentration(html: string): HolderConcentrationRow[] {
  return rowsByAttr(html, 'data-holders-concentration-row').map((row) => ({
    label: cellByAttr(row, 'data-holders-concentration-label'),
    amount: cellByAttr(row, 'data-holders-concentration-value-usd'),
    percentage: cellByAttr(row, 'data-holders-concentration-value'),
  }))
}

function parseTiers(html: string): HolderTierRow[] {
  return rowsByAttr(html, 'data-holders-tier-row').map((row) => ({
    label: cellByAttr(row, 'data-holders-tier-label'),
    holders: cellByAttr(row, 'data-holders-tier-holders'),
    holdersRatio: cellByAttr(row, 'data-holders-tier-holders-ratio'),
    supplyRatio: cellByAttr(row, 'data-holders-tier-market-ratio'),
  }))
}

function parseThresholds(html: string): HolderThresholdRow[] {
  return rowsByAttr(html, 'data-holders-threshold-row').map((row) => ({
    threshold: cellByAttr(row, 'data-holders-threshold-label'),
    holders: cellByAttr(row, 'data-holders-threshold-holders'),
    ratio: cellByAttr(row, 'data-holders-threshold-ratio'),
  }))
}

export function parseTokenHoldersHtml(
  html: string,
  sourceUrl: string,
  page: number,
): TokenHoldersAnalysis {
  const pageInfo = html.match(/Page\s+(\d+)\s+of\s+(\d+)/i)
  return {
    sourceUrl,
    page: pageInfo ? parseInt(pageInfo[1], 10) : page,
    totalPages: pageInfo ? parseInt(pageInfo[2], 10) : null,
    totalHolders: extractText(html, /From a total of\s+([\d,]+)\s+holders/i),
    topLabel: extractText(html, /(Top\s+[\d,]+\s+holders)/i),
    snapshotAgo: extractText(
      html,
      /\(Analytics Snapshot taken\s+([^)]+)\)/i,
    ),
    holders: parseQuickExportRows(html),
    concentration: parseConcentration(html),
    tiers: parseTiers(html),
    thresholds: parseThresholds(html),
  }
}

export async function fetchTokenHoldersAnalysis(
  chain: string,
  contractAddress: string,
  page = 1,
): Promise<TokenHoldersAnalysis> {
  const sourceUrl = tokenHoldersAnalysisUrl(chain, contractAddress, page)
  if (!sourceUrl) throw new Error('Unsupported chain for holder analysis')

  const r = await fetch(sourceUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Encoding': 'identity',
      'User-Agent': 'oi-monitor/1.0 (token-holder-analysis)',
    },
  })
  if (!r.ok) throw new Error(`Explorer holders ${r.status}`)
  return parseTokenHoldersHtml(await r.text(), sourceUrl, page)
}
