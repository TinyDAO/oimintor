import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { KlineCandle } from '../lib/api/futures'
import { fetchTraderAiAnalysis } from '../lib/api/aiChat'
import {
  buildTraderAnalysisPayload,
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
  const [tallOutput, setTallOutput] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const acRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => acRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!fullscreen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [fullscreen])

  async function runAnalysis() {
    acRef.current?.abort()
    const ac = new AbortController()
    acRef.current = ac
    setPhase('loading')
    setErr(null)
    try {
      const payload = buildTraderAnalysisPayload(row, klines, ratioSeries)
      const out = await fetchTraderAiAnalysis(payload, ac.signal)
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
    setTallOutput(false)
    setFullscreen(false)
  }

  const fsTitleId = 'drawer-ai-fs-title'

  return (
    <section className="drawer-section drawer-ai-panel" aria-label="AI 交易分析">
      <h3>AI 交易视角</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        点击下方按钮将本页 1h K 线（价量）、OI 与三轨多空比等结构化数据发往服务端；
        服务端组装提示词后调用模型，从专业交易员视角解读动能与风险。输出仅供学习，不构成投资建议。
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
        <>
          <div className="drawer-ai-output-toolbar">
            <button
              type="button"
              className="btn btn-ghost small"
              onClick={() => setTallOutput((v) => !v)}
              aria-pressed={tallOutput}
            >
              {tallOutput ? '恢复默认高度' : '加大显示区域'}
            </button>
            <button
              type="button"
              className="btn btn-ghost small"
              onClick={() => setFullscreen(true)}
            >
              全屏阅读
            </button>
          </div>
          <div
            className={
              tallOutput
                ? 'drawer-ai-output-wrap drawer-ai-output-wrap--tall'
                : 'drawer-ai-output-wrap'
            }
          >
            <pre className="drawer-ai-output">{text}</pre>
          </div>
        </>
      ) : null}
      {fullscreen && text
        ? createPortal(
            <div
              className="drawer-ai-fs-backdrop"
              role="presentation"
              onClick={() => setFullscreen(false)}
            >
              <div
                className="drawer-ai-fs-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={fsTitleId}
                onClick={(e) => e.stopPropagation()}
              >
                <header className="drawer-ai-fs-head">
                  <h2 id={fsTitleId} className="drawer-ai-fs-title">
                    AI 分析 · {row.symbol}
                  </h2>
                  <button
                    type="button"
                    className="btn btn-ghost small"
                    onClick={() => setFullscreen(false)}
                  >
                    关闭
                  </button>
                </header>
                <div className="drawer-ai-fs-body">
                  <pre className="drawer-ai-output drawer-ai-output--fs">{text}</pre>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}
