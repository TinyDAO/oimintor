import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildTraderAiMessagesFromMarketPayload } from '../lib/traderAiMessages'

/**
 * OpenAI 兼容 Chat Completions 代理。
 * 部署到 Vercel 后路径为 POST /api/ai/chat
 * 请求体：{ marketPayload, model? } — 系统提示词在服务端组装。
 * 环境变量：AI_API_KEY（必填）、AI_API_BASE_URL、AI_MODEL
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  let incoming: { marketPayload?: unknown; model?: string }
  try {
    incoming =
      typeof req.body === 'string'
        ? (JSON.parse(req.body) as { marketPayload?: unknown; model?: string })
        : (req.body as { marketPayload?: unknown; model?: string })
  } catch {
    return res.status(400).json({ error: { message: 'Invalid JSON body' } })
  }

  if (incoming.marketPayload === undefined) {
    return res.status(400).json({
      error: {
        message:
          'expected marketPayload: client sends market JSON only; prompts are built server-side',
      },
    })
  }

  const messages = buildTraderAiMessagesFromMarketPayload(incoming.marketPayload)

  const base = (
    process.env.AI_API_BASE_URL ?? 'https://api.openai.com/v1'
  ).replace(/\/$/, '')
  const key = process.env.AI_API_KEY ?? ''
  if (!key) {
    return res.status(503).json({
      error: {
        message:
          'Missing AI_API_KEY: add it in Vercel → Project → Settings → Environment Variables.',
      },
    })
  }

  const model = incoming.model ?? process.env.AI_MODEL ?? 'gpt-4o-mini'

  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.35,
      }),
    })
    const responseText = await r.text()
    res.status(r.status)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.send(responseText)
  } catch (e) {
    return res.status(500).json({
      error: { message: e instanceof Error ? e.message : String(e) },
    })
  }
}
