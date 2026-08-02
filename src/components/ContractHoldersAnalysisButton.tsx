import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchTokenHoldersAnalysisApi } from '../lib/api/tokenHolders'
import type { TokenHoldersAnalysis } from '../lib/explorerHolders'
import { shortenAddress, tokenHoldersAnalysisUrl } from '../lib/tokenExplorer'

export function ContractHoldersAnalysisButton({
  chain,
  contractAddress,
  label,
}: {
  chain: string | undefined
  contractAddress: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<TokenHoldersAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()
  const sourceUrl = tokenHoldersAnalysisUrl(chain, contractAddress, page)

  useEffect(() => {
    if (!open || !chain) return
    const ac = new AbortController()
    setLoading(true)
    setError(null)
    fetchTokenHoldersAnalysisApi(chain, contractAddress, page, ac.signal)
      .then((d) => {
        if (!ac.signal.aborted) setData(d)
      })
      .catch((e: Error) => {
        if (!ac.signal.aborted) setError(e.message || '持仓分析加载失败')
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })
    return () => ac.abort()
  }, [chain, contractAddress, open, page])

  if (!sourceUrl) return null

  const title = `${label ?? chain ?? 'Token'} 持仓分析`
  const canPrev = page > 1 && !loading
  const canNext = Boolean(
    data?.totalPages && page < data.totalPages && !loading,
  )

  return (
    <>
      <button
        type="button"
        className="contract-analysis-trigger"
        onClick={() => setOpen(true)}
        title={`查看 ${shortenAddress(contractAddress)} 持仓分析`}
      >
        分析
      </button>
      {open
        ? createPortal(
            <div
              className="contract-analysis-backdrop"
              role="presentation"
              onClick={() => setOpen(false)}
            >
              <div
                className="contract-analysis-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
              >
                <header className="contract-analysis-head">
                  <div>
                    <h2 id={titleId}>{title}</h2>
                    <p className="muted small">
                      {shortenAddress(contractAddress)} · 数据由区块浏览器页面提供
                    </p>
                  </div>
                  <div className="contract-analysis-actions">
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="btn btn-ghost small"
                    >
                      新窗口打开
                    </a>
                    <button
                      type="button"
                      className="btn btn-ghost small"
                      onClick={() => setOpen(false)}
                    >
                      关闭
                    </button>
                  </div>
                </header>
                <div className="contract-analysis-body">
                  {loading ? (
                    <div className="contract-analysis-state muted small">
                      正在读取区块浏览器持仓字段…
                    </div>
                  ) : null}
                  {error ? (
                    <div className="contract-analysis-state banner err">
                      {error}
                    </div>
                  ) : null}
                  {data ? (
                    <>
                      <div className="contract-analysis-summary">
                        <div>
                          <span>总持有人</span>
                          <strong>{data.totalHolders ?? '—'}</strong>
                        </div>
                        <div>
                          <span>样本</span>
                          <strong>{data.topLabel ?? 'Top holders'}</strong>
                        </div>
                        <div>
                          <span>分页</span>
                          <strong>
                            Page {data.page}
                            {data.totalPages ? ` / ${data.totalPages}` : ''}
                          </strong>
                        </div>
                        <div>
                          <span>快照</span>
                          <strong>{data.snapshotAgo ?? '—'}</strong>
                        </div>
                      </div>

                      {data.concentration.length > 0 ? (
                        <section className="contract-analysis-section">
                          <h3>持仓集中度</h3>
                          <table className="contract-analysis-table">
                            <thead>
                              <tr>
                                <th>分组</th>
                                <th>持仓量</th>
                                <th>% Supply</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.concentration.map((r) => (
                                <tr key={r.label}>
                                  <td>{r.label}</td>
                                  <td>{r.amount}</td>
                                  <td>{r.percentage}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </section>
                      ) : null}

                      {data.tiers.length > 0 ? (
                        <section className="contract-analysis-section">
                          <h3>钱包分层</h3>
                          <table className="contract-analysis-table">
                            <thead>
                              <tr>
                                <th>层级</th>
                                <th>钱包数</th>
                                <th>% Holders</th>
                                <th>% Supply</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.tiers.map((r) => (
                                <tr key={r.label}>
                                  <td>{r.label}</td>
                                  <td>{r.holders}</td>
                                  <td>{r.holdersRatio}</td>
                                  <td>{r.supplyRatio}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </section>
                      ) : null}

                      {data.thresholds.length > 0 ? (
                        <section className="contract-analysis-section">
                          <h3>钱包深度</h3>
                          <table className="contract-analysis-table">
                            <thead>
                              <tr>
                                <th>阈值</th>
                                <th>钱包数</th>
                                <th>% Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.thresholds.map((r) => (
                                <tr key={r.threshold}>
                                  <td>{r.threshold}</td>
                                  <td>{r.holders}</td>
                                  <td>{r.ratio}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </section>
                      ) : null}

                      <section className="contract-analysis-section">
                        <div className="contract-analysis-section-head">
                          <h3>Top Holders</h3>
                          <div className="contract-analysis-pager">
                            <button
                              type="button"
                              className="btn btn-ghost small"
                              disabled={!canPrev}
                              onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                              上一页
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost small"
                              disabled={!canNext}
                              onClick={() => setPage((p) => p + 1)}
                            >
                              下一页
                            </button>
                          </div>
                        </div>
                        {data.holders.length > 0 ? (
                          <table className="contract-analysis-table contract-analysis-table-wide">
                            <thead>
                              <tr>
                                <th>Rank</th>
                                <th>Address</th>
                                <th>Name Tag</th>
                                <th>Quantity</th>
                                <th>Percentage</th>
                                <th>Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.holders.map((r) => (
                                <tr key={`${r.rank}:${r.address}`}>
                                  <td>{r.rank}</td>
                                  <td className="mono" title={r.address}>
                                    {shortenAddress(r.address)}
                                  </td>
                                  <td>{r.nameTag ?? '—'}</td>
                                  <td className="mono">{r.quantity}</td>
                                  <td className="mono">{r.percentage}</td>
                                  <td className="mono">{r.value ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="muted small">未解析到 holder 列表。</p>
                        )}
                      </section>
                    </>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
