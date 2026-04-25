import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { aiChatProxyPlugin } from './vite-plugins/aiChatProxy'
import { marketInsightsDevApiPlugin } from './vite-plugins/marketInsightsDevApi'

const binanceProxy = {
  '/api/fapi': {
    target: 'https://fapi.binance.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/fapi/, ''),
  },
  '/api/bapi': {
    target: 'https://www.binance.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/bapi/, ''),
  },
  '/api/web3': {
    target: 'https://web3.binance.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/web3/, ''),
  },
  '/api/spot': {
    target: 'https://api.binance.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/spot/, ''),
  },
} as const

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [marketInsightsDevApiPlugin(), react(), aiChatProxyPlugin(env)],
    server: {
      proxy: { ...binanceProxy },
    },
    /** 与 dev 一致，否则 `vite preview` 下 /api/fapi/* 会 404 */
    preview: {
      proxy: { ...binanceProxy },
    },
  }
})
