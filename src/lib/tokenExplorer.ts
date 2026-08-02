export function shortenAddress(addr: string): string {
  if (addr.length <= 14) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function chainExplorerTokenUrl(
  chainIdOrNetwork: string | undefined,
  contractAddress: string | undefined,
): string | null {
  if (!chainIdOrNetwork || !contractAddress) return null
  const chain = String(chainIdOrNetwork).trim().toUpperCase()
  const address = encodeURIComponent(contractAddress)
  switch (chain) {
    case '1':
    case 'ETH':
    case 'ERC20':
    case 'ETHEREUM':
      return `https://etherscan.io/token/${address}`
    case '56':
    case 'BSC':
    case 'BEP20':
    case 'BNB':
    case 'BNB SMART CHAIN':
      return `https://bscscan.com/token/${address}`
    case '137':
    case 'MATIC':
    case 'POLYGON':
      return `https://polygonscan.com/token/${address}`
    case '8453':
    case 'BASE':
      return `https://basescan.org/token/${address}`
    case '42161':
    case 'ARBITRUM':
    case 'ARB':
      return `https://arbiscan.io/token/${address}`
    case '10':
    case 'OPTIMISM':
    case 'OP':
      return `https://optimistic.etherscan.io/token/${address}`
    case '43114':
    case 'AVAXC':
    case 'AVALANCHE':
      return `https://snowtrace.io/token/${address}`
    case 'TRX':
    case 'TRC20':
    case 'TRON':
      return `https://tronscan.org/#/token20/${address}`
    case 'CT_501':
    case '501':
    case 'SOL':
    case 'SOLANA':
      return `https://solscan.io/token/${address}`
    default:
      return null
  }
}

function etherscanFamilyHost(chainIdOrNetwork: string | undefined): string | null {
  if (!chainIdOrNetwork) return null
  const chain = String(chainIdOrNetwork).trim().toUpperCase()
  switch (chain) {
    case '1':
    case 'ETH':
    case 'ERC20':
    case 'ETHEREUM':
      return 'etherscan.io'
    case '56':
    case 'BSC':
    case 'BEP20':
    case 'BNB':
    case 'BNB SMART CHAIN':
      return 'bscscan.com'
    case '137':
    case 'MATIC':
    case 'POLYGON':
      return 'polygonscan.com'
    case '8453':
    case 'BASE':
      return 'basescan.org'
    case '42161':
    case 'ARBITRUM':
    case 'ARB':
      return 'arbiscan.io'
    case '10':
    case 'OPTIMISM':
    case 'OP':
      return 'optimistic.etherscan.io'
    case '43114':
    case 'AVAXC':
    case 'AVALANCHE':
      return 'snowtrace.io'
    default:
      return null
  }
}

export function tokenHoldersAnalysisUrl(
  chainIdOrNetwork: string | undefined,
  contractAddress: string | undefined,
  page = 1,
): string | null {
  if (!contractAddress) return null
  const host = etherscanFamilyHost(chainIdOrNetwork)
  if (!host) return null
  const address = encodeURIComponent(contractAddress)
  const pageNo = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  return `https://${host}/token/generic-tokenholders2?m=dark&a=${address}&p=${pageNo}`
}
