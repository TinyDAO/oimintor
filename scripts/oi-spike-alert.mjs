#!/usr/bin/env node
/**
 * 扫描 Binance USDT 永续成交量 Top N，若 24h 滚动 OI 涨幅 ≥ 阈值则发 Telegram。
 * 「只推一次」：同一合约在仍处于 ≥ 阈值期间不会重复推送；OI 跌回阈值以下后清除记录，下次再达标可再推。
 *
 * GitHub Actions：配合 schedule cron 每小时跑；用 actions/cache 持久化状态文件（见 .github/workflows）。
 *
 * 环境变量：
 *   TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID — 必填（除非 DRY_RUN=1）
 *   TOP_N — 默认 100
 *   OI_THRESHOLD_PCT — 默认 50（24h 滚动 OI 变化 %）
 *   OI_ALERT_STATE_FILE — 状态 JSON 路径，默认本目录下 .oi-alert-state.json
 *   DRY_RUN=1 — 只打印，不发 Telegram、不写状态
 *   BINANCE_FAPI_BASE — FAPI 根路径。默认走 Vercel 同源代理（与站点 /api/fapi 一致），避免部分地区直连 fapi.binance.com 返回 451。
 *     例：直连 `https://fapi.binance.com`；代理 `https://oimintor.vercel.app/api/fapi`（路径仍带 /fapi/v1、/futures/...）
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** 与 vercel.json 中 /api/fapi → fapi.binance.com 一致；本地/受限地区可省略环境变量即用代理 */
const DEFAULT_FAPI_PROXY = 'https://oimintor.vercel.app/api/fapi'
const FAPI =
  process.env.BINANCE_FAPI_BASE?.replace(/\/$/, '') || DEFAULT_FAPI_PROXY
const UA = 'oi-monitor/oi-spike-alert (github-actions)'

const TOP_N = Math.max(1, parseInt(process.env.TOP_N || '100', 10) || 100)
const THRESHOLD = parseFloat(process.env.OI_THRESHOLD_PCT || '50')
const STATE_FILE =
  process.env.OI_ALERT_STATE_FILE || join(__dirname, '.oi-alert-state.json')
const DRY = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

const OI_PERIOD = '1h'
const OI_LIMIT = 30

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`${r.status} ${url} ${t.slice(0, 200)}`)
  }
  return r.json()
}

function num(x) {
  return parseFloat(x)
}

/** 与 src/lib/signals/compute.ts 中 oiChangePctRolling24h 一致 */
function oiChangePctRolling24h(rows) {
  if (!rows || rows.length < 2) return 0
  const sorted = [...rows].sort((a, b) => a.timestamp - b.timestamp)
  const slice = sorted.length >= 24 ? sorted.slice(-24) : sorted
  const first = num(slice[0].sumOpenInterest)
  const last = num(slice[slice.length - 1].sumOpenInterest)
  if (!first || !Number.isFinite(first)) return 0
  return ((last - first) / first) * 100
}

function perpetualUsdtSymbols(symbols) {
  const s = new Set()
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

function topSymbolsByQuoteVolume(tickers, universe, topN) {
  const rows = tickers.filter((t) => universe.has(t.symbol))
  rows.sort((a, b) => num(b.quoteVolume) - num(a.quoteVolume))
  return rows.slice(0, topN).map((t) => t.symbol)
}

async function loadState() {
  if (DRY) return { alerted: {} }
  try {
    const raw = await readFile(STATE_FILE, 'utf8')
    const j = JSON.parse(raw)
    return {
      alerted:
        j && typeof j.alerted === 'object' && j.alerted
          ? j.alerted
          : {},
    }
  } catch {
    return { alerted: {} }
  }
}

async function saveState(state) {
  if (DRY) return
  const out = JSON.stringify(
    { version: 1, updatedAt: new Date().toISOString(), alerted: state.alerted },
    null,
    0,
  )
  await writeFile(STATE_FILE, out, 'utf8')
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    throw new Error('缺少 TELEGRAM_BOT_TOKEN 或 TELEGRAM_CHAT_ID')
  }
  const url = new URL(`https://api.telegram.org/bot${token}/sendMessage`)
  const body = new URLSearchParams({
    chat_id: String(chatId),
    text,
    disable_web_page_preview: 'true',
  })
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`Telegram ${r.status}: ${t.slice(0, 300)}`)
  }
}

async function poolMap(items, concurrency, fn) {
  const ret = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      ret[idx] = await fn(items[idx], idx)
    }
  }
  const n = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: n }, () => worker()))
  return ret
}

async function main() {
  const [info, tickers] = await Promise.all([
    getJson(`${FAPI}/fapi/v1/exchangeInfo`),
    getJson(`${FAPI}/fapi/v1/ticker/24hr`),
  ])

  const perp = perpetualUsdtSymbols(info.symbols)
  const topSyms = topSymbolsByQuoteVolume(tickers, perp, TOP_N)
  const tickerBySym = new Map(tickers.map((t) => [t.symbol, t]))

  const state = await loadState()
  const alerted = { ...state.alerted }
  const pending = []

  const results = await poolMap(topSyms, 6, async (symbol) => {
    const q = new URLSearchParams({
      symbol,
      period: OI_PERIOD,
      limit: String(OI_LIMIT),
    })
    const rows = await getJson(
      `${FAPI}/futures/data/openInterestHist?${q}`,
    )
    const oiPct = oiChangePctRolling24h(rows)
    const t = tickerBySym.get(symbol)
    const priceChg = t ? num(t.priceChangePercent) : null
    return { symbol, oiPct, priceChg }
  })

  for (const r of results) {
    const { symbol, oiPct, priceChg } = r
    const wasAlerted = Boolean(alerted[symbol])

    if (oiPct < THRESHOLD) {
      if (symbol in alerted) delete alerted[symbol]
      continue
    }

    // oiPct >= THRESHOLD
    if (wasAlerted) continue

    const line =
      `🔔 OI 24h +${oiPct.toFixed(2)}% ≥ ${THRESHOLD}% — ${symbol}` +
      (priceChg != null && Number.isFinite(priceChg)
        ? ` | 币价 24h ${priceChg >= 0 ? '+' : ''}${priceChg.toFixed(2)}%`
        : '')
    pending.push({ symbol, line, oiPct })
  }

  if (pending.length) {
    const text = [`[OI Monitor] Top${TOP_N} 合约`, ...pending.map((p) => p.line)].join(
      '\n',
    )
    console.log(text)
    if (!DRY) await sendTelegram(text)
    for (const p of pending) {
      alerted[p.symbol] = {
        at: new Date().toISOString(),
        oiPct24h: p.oiPct,
      }
    }
  } else {
    console.log(
      DRY ? `[dry-run] 无新达标合约（阈值 ${THRESHOLD}%）` : `无新推送（阈值 ${THRESHOLD}%）`,
    )
  }

  state.alerted = alerted
  await saveState(state)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
