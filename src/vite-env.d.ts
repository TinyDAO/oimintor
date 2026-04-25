/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 默认 /api/ai/chat；生产需同源反代到 OpenAI 兼容服务 */
  readonly VITE_AI_CHAT_PATH?: string
  /** 是否显示 AI 分析入口；默认打开；仅当为 false / 0 / off / no 时关闭 */
  readonly VITE_ENABLE_AI_ANALYSIS?: string
  /** 设为 0 / false 时跳过 OI 榜单与 V4A/V7/V8 扫描的聚合 API，强制走浏览器多路请求（调试用） */
  readonly VITE_MARKET_INSIGHTS_AGGREGATE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
