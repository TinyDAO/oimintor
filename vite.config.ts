import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { aiChatProxyPlugin } from './vite-plugins/aiChatProxy'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), aiChatProxyPlugin(env)],
    server: {
    proxy: {
      '/api/fapi': {
        target: 'https://fapi.binance.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fapi/, ''),
      },
      '/api/bapi': {
        target: 'https://www.binance.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bapi/, ''),
      },
      '/api/web3': {
        target: 'https://web3.binance.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/web3/, ''),
      },
      '/api/spot': {
        target: 'https://api.binance.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/spot/, ''),
      },
    },
  },
  }
})
