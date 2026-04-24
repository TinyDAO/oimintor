import type { IncomingMessage } from 'node:http'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
import { buildTraderAiMessagesFromMarketPayload } from '../api/ai/traderAiMessages.js'

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

function attachAiProxy(
  middlewares: ViteDevServer['middlewares'] | PreviewServer['middlewares'],
  env: Record<string, string>,
) {
  middlewares.use(async (req, res, next) => {
    const pathOnly = req.url?.split('?')[0] ?? ''
    if (pathOnly !== '/api/ai/chat' || req.method !== 'POST') {
      next()
      return
    }
    try {
      const raw = await readBody(req as IncomingMessage)
      const incoming = JSON.parse(raw) as {
        marketPayload?: unknown
        model?: string
      }
      if (incoming.marketPayload === undefined) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(
          JSON.stringify({
            error: {
              message:
                'expected marketPayload: 客户端只上传市场 JSON，系统提示词由服务端组装',
            },
          }),
        )
        return
      }
      const messages = buildTraderAiMessagesFromMarketPayload(
        incoming.marketPayload,
      )
      const base = (env.AI_API_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')
      const key = env.AI_API_KEY ?? ''
      if (!key) {
        res.statusCode = 503
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(
          JSON.stringify({
            error: {
              message:
                '未配置 AI_API_KEY：在 oi-monitor/.env 中设置 AI_API_KEY（可选 AI_API_BASE_URL、AI_MODEL）。生产环境需自行反代 /api/ai/chat。',
            },
          }),
        )
        return
      }
      const model = incoming.model ?? env.AI_MODEL ?? 'gpt-4o-mini'
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
      res.statusCode = r.status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(responseText)
    } catch (e) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(
        JSON.stringify({
          error: { message: e instanceof Error ? e.message : String(e) },
        }),
      )
    }
  })
}

export function aiChatProxyPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'ai-chat-proxy',
    configureServer(server) {
      attachAiProxy(server.middlewares, env)
    },
    configurePreviewServer(server) {
      attachAiProxy(server.middlewares, env)
    },
  }
}
