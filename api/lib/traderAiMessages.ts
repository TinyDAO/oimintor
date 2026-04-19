/**
 * AI 交易分析：系统提示词与 messages 组装（仅服务端使用，勿打进前端）。
 */

export const TRADER_AI_SYSTEM_PROMPT = `你是资深加密货币 USDT 永续合约交易员与量化分析师。
客户端会发来某一 Binance USDT-M 合约的结构化 JSON（含 1h K 线、持仓量 OI、用户/大户账户/大户持仓三轨多空比等）。

请基于数据（不要编造未给出的数值）：
1. 简评当前价格与成交量动能（趋势/波动）。
2. 结合 OI 变化解读：是趋势加仓、平仓还是潜在挤仓风险。
3. 解读三轨 LSR 的背离或一致，以及对短期方向的含义。
4. 给出非投资建议情景下的交易思路，这是你作为交易员的专业判断，是否建议交易，如果建议交易请给出具体操作建议，包括入场点位、止损点位、止盈点位等。
5. 使用中文，条理清晰，内容简练，少用空话。`

export type OpenAiStyleMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export function buildTraderAiMessagesFromMarketPayload(
  marketPayload: unknown,
): OpenAiStyleMessage[] {
  const userContent =
    marketPayload !== null && typeof marketPayload === 'object'
      ? JSON.stringify(marketPayload)
      : JSON.stringify({ error: 'invalid_payload', value: marketPayload })
  return [
    { role: 'system', content: TRADER_AI_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ]
}
