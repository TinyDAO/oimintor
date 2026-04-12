import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
      '/api/cg': {
        target: 'https://api.coingecko.com/api/v3',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cg/, ''),
      },
    },
  },
})
