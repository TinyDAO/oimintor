import type { ReactNode } from 'react'

const BN_FUTURES = 'https://www.binance.com/zh-CN/futures'

export function BinanceFuturesLink({
  symbol,
  children,
}: {
  symbol: string
  children: ReactNode
}) {
  return (
    <a
      href={`${BN_FUTURES}/${symbol}`}
      target="_blank"
      rel="noreferrer noopener"
      className="bn-link"
    >
      {children}
    </a>
  )
}
