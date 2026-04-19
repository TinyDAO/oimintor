/** 与 OpenAI Chat Completions 兼容的 message 条目 */
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

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
 * 调用 OpenAI 兼容 Chat Completions（经开发环境 Vite 代理或自建网关，避免密钥进前端）。
 */
export async function fetchChatCompletion(
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const path = chatPath()
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
    }),
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
