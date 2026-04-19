import { useEffect, useRef, useState } from 'react'
import type { KlineCandle } from '../lib/api/futures'
import { fetchChatCompletion } from '../lib/api/aiChat'
import {
  buildTraderAnalysisPayload,
  TRADER_AI_SYSTEM_PROMPT,
  type MergedRatioPoint,
} from '../lib/ai/buildTraderAnalysisPayload'
import type { SymbolInsight } from '../lib/signals/compute'

export function DrawerAiPanel({
  row,
  klines,
  ratioSeries,
}: {
  row: SymbolInsight
  klines: KlineCandle[] | null
  ratioSeries: MergedRatioPoint[]
}) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'err'>(
    'idle',
  )
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const acRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => acRef.current?.abort()
  }, [])

  async function runAnalysis() {
    acRef.current?.abort()
    const ac = new AbortController()
    acRef.current = ac
    setPhase('loading')
    setErr(null)
    try {
      const payload = buildTraderAnalysisPayload(row, klines, ratioSeries)
      const userContent = JSON.stringify(payload)
      const out = await fetchChatCompletion(
        [
          { role: 'system', content: TRADER_AI_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        ac.signal,
      )
      if (ac.signal.aborted) return
      setText(out)
      setPhase('done')
    } catch (e) {
      if (ac.signal.aborted) return
      setErr(e instanceof Error ? e.message : String(e))
      setPhase('err')
    } finally {
      if (acRef.current === ac) acRef.current = null
    }
  }

  function clearResult() {
    setPhase('idle')
    setText('')
    setErr(null)
  }

  return (
    <section className="drawer-section drawer-ai-panel" aria-label="AI 交易分析">
      <h3>AI 交易视角</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        点击下方按钮将本页 1h K 线（价量）、OI 与三轨多空比等结构化数据发送至配置的
        OpenAI 兼容接口，由模型从专业交易员视角解读动能与风险。输出仅供学习，不构成投资建议。
      </p>
      <div className="drawer-ai-actions">
        <button
          type="button"
          className="btn drawer-ai-primary"
          disabled={phase === 'loading'}
          onClick={() => void runAnalysis()}
        >
          {phase === 'loading' ? '分析中…' : '请求 AI 分析'}
        </button>
        {(phase === 'done' || phase === 'err') && (
          <button type="button" className="btn btn-ghost small" onClick={clearResult}>
            清空结果
          </button>
        )}
      </div>
      {phase === 'loading' ? (
        <div
          className="sk sk-line drawer-ai-skel"
          style={{ borderRadius: 8, marginTop: 12 }}
          aria-busy
        />
      ) : null}
      {phase === 'err' && err ? (
        <p className="banner err drawer-ai-err" style={{ marginTop: 12 }}>
          {err}
        </p>
      ) : null}
      {phase === 'done' && text ? (
        <div className="drawer-ai-output-wrap">
          <pre className="drawer-ai-output">{text}</pre>
        </div>
      ) : null}
    </section>
  )
}
