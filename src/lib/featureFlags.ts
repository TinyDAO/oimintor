/** 未配置环境变量时：AI 分析入口默认打开 */
const AI_ANALYSIS_DEFAULT_ON = true

/**
 * 是否展示抽屉内的「AI 交易视角」入口。
 * 默认打开：`VITE_ENABLE_AI_ANALYSIS` 未设置、空字符串、或 true/1/yes/on 等均视为开启。
 * 仅当设为 false、0、off、no 时关闭。
 */
export function isAiAnalysisEntryEnabled(): boolean {
  const raw = import.meta.env.VITE_ENABLE_AI_ANALYSIS
  if (raw === undefined || raw === '') return AI_ANALYSIS_DEFAULT_ON
  const s = String(raw).trim().toLowerCase()
  if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false
  return AI_ANALYSIS_DEFAULT_ON
}
