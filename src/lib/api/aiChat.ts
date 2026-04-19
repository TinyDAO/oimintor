const DEFAULT_PATH = '/api/ai/chat'

function chatPath(): string {
  const p = import.meta.env.VITE_AI_CHAT_PATH
  return typeof p === 'string' && p.length > 0 ? p : DEFAULT_PATH
}

export type ChatCompletionResponse = {
  choices?: { message?: { content?: string } }[]
  error?: { message?: string }
}

/**
 * 将市场数据 POST 至服务端；系统提示词在服务端组装后再调 OpenAI 兼容接口。
 */
export async function fetchTraderAiAnalysis(
  marketPayload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  const path = chatPath()
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ marketPayload }),
    signal,
  })
  const text = await r.text()
  let json: ChatCompletionResponse
  try {
    json = JSON.parse(text) as ChatCompletionResponse
  } catch {
    throw new Error(text.slice(0, 200) || `AI 接口 HTTP ${r.status}`)
  }
  if (!r.ok) {
    const msg =
      json.error?.message ?? (typeof json === 'object' ? text : `HTTP ${r.status}`)
    throw new Error(msg)
  }
  const content = json.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI 返回内容为空')
  }
  return content.trim()
}
