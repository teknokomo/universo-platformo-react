import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'

import baseConfig from '../../../tools/testing/frontend/vitest.base.config'
import { loadTsconfigAliases } from '../../../tools/testing/frontend/loadTsconfigAliases'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, 'src')
const tsconfigAliases = loadTsconfigAliases(path.resolve(__dirname, 'tsconfig.json'), __dirname)

const sanitizedBaseConfig = {
  ...baseConfig,
  test: {
    ...(baseConfig.test ?? {}),
    setupFiles: [],
  },
}

export default mergeConfig(
  sanitizedBaseConfig,
  defineConfig({
    resolve: {
      alias: {
        ...tsconfigAliases,
        '@': srcDir,
        '@universo/utils': path.resolve(__dirname, '..', '..', 'universo-utils', 'base', 'src'),
        '@universo/types': path.resolve(__dirname, '..', '..', 'universo-types', 'base', 'src'),
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['dist/**', 'node_modules/**'],
      setupFiles: [],
      coverage: {
        enabled: false,
        reporter: ['text', 'json-summary'],
        reportsDirectory: path.resolve(__dirname, 'coverage'),
      },
    },
  }),
)
