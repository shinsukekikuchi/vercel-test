import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { loadEnv } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 環境変数を読み込む
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tsconfigPaths(),
      nodePolyfills({
        // Node.js core modules polyfill for browser
        include: [
          'crypto',
          'stream',
          'buffer',
          'process',
          'util',
          'events',
          'assert'
        ],
        // Polyfill protocol imports (node:crypto, etc.)
        protocolImports: true,
        // Inject global variables
        globals: {
          Buffer: true,
          process: true,
          global: true,
        },
      }),
    ],
    // 環境変数をクライアント側で使用できるようにする
    define: {
      'process.env.BYBIT_TESTNET_API_KEY': JSON.stringify(env.BYBIT_TESTNET_API_KEY),
      'process.env.BYBIT_TESTNET_PRIVATE_KEY': JSON.stringify(env.BYBIT_TESTNET_PRIVATE_KEY),
      'global': 'window',
      // Ensure process flags for readable-stream
      'process.browser': JSON.stringify(true),
      'process.version': JSON.stringify('0.0.0'),
    },
    resolve: {
      alias: {
        stream: 'stream-browserify',
        buffer: 'buffer',
        process: 'process/browser',
        util: 'util',
        events: 'events',
        assert: 'assert'
      }
    },
    optimizeDeps: {
      include: [
        'process/browser',
        'stream',
        'stream-browserify',
        'buffer',
        'util',
        'events',
        'assert'
      ],
      exclude: [
        'embedded-wallet',
        'email',
        'socials',
        'swaps',
        'send',
        'receive',
        'onramp',
        'transactions',
        'exports',
        'w3m-modal',
        'dist'
      ]
    }
  }
})
