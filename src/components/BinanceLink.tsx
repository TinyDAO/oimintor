import type { ReactNode } from 'react'

const BN_FUTURES = 'https://www.binance.com/zh-CN/futures'

/** Binance 菱形标（填充色为 currentColor；路径来自 Simple Icons，MIT） */
export function BinanceLogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7154 2.7164L18.5682 12l2.6924-2.7164zm-9.272.001l2.7163 2.6914-2.7164 2.7174v-.001L9.2721 12l2.7164-2.7154zm-9.2722-.001L5.4088 12l-2.6914 2.6924L0 12l2.7164-2.7164zM11.9885.0115l7.353 7.329-2.7174 2.7154-4.6356-4.6356-4.6355 4.6595-2.7174-2.7154 7.353-7.353z"
      />
    </svg>
  )
}

export function BinanceFuturesLink({
  symbol,
  children,
  className,
  title,
  'aria-label': ariaLabel,
}: {
  symbol: string
  children: ReactNode
  className?: string
  title?: string
  'aria-label'?: string
}) {
  const label =
    ariaLabel ?? title ?? `在 Binance 合约打开 ${symbol.replace(/USDT$/i, '')}`
  return (
    <a
      href={`${BN_FUTURES}/${symbol}`}
      target="_blank"
      rel="noreferrer noopener"
      className={['bn-link', className].filter(Boolean).join(' ')}
      title={title}
      aria-label={label}
    >
      {children}
    </a>
  )
}
