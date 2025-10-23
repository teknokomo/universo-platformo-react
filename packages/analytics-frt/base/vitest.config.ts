import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'

import baseConfig from '../../../tools/testing/frontend/vitest.base.config'
import { loadTsconfigAliases } from '../../../tools/testing/frontend/loadTsconfigAliases'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, 'src')
const sharedSetupFiles = (baseConfig.test?.setupFiles ?? []) as string[]
const tsconfigAliases = loadTsconfigAliases(path.resolve(__dirname, 'tsconfig.json'), __dirname)

export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: {
        ...tsconfigAliases,
        '@/store/actions': path.resolve(__dirname, '../../../packages/flowise-ui/src/store/actions.js'),
        '@/store': path.resolve(__dirname, '../../../packages/flowise-ui/src/store'),
        '@universo/spaces-frt': path.resolve(__dirname, '../../spaces-frt/base/src'),
        '@': path.resolve(__dirname, '../../../packages/flowise-ui/src'),
        '@app': srcDir,
      },
    },
    test: {
      globals: true,
      include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
      setupFiles: [...sharedSetupFiles, path.resolve(__dirname, 'setupTests.ts')],
      coverage: {
        enabled: true,
        reporter: ['text', 'json-summary'],
        reportsDirectory: path.resolve(__dirname, 'coverage'),
      },
    },
    esbuild: {
      loader: 'tsx',
      include: [/src\/.*\.[jt]sx?$/, /tools\/testing\/frontend\/.*\.[jt]sx?$/],
      jsx: 'automatic',
    },
  }),
)
