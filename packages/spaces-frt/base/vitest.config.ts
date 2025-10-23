import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'

import baseConfig from '../../../tools/testing/frontend/vitest.base.config'
import { loadTsconfigAliases } from '../../../tools/testing/frontend/loadTsconfigAliases'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, 'src')
const sharedSetupFiles = (baseConfig.test?.setupFiles ?? []) as string[]
const tsconfigAliases = loadTsconfigAliases(path.resolve(__dirname, 'tsconfig.json'), __dirname)
const mocksDir = path.resolve(__dirname, 'src/__mocks__')

export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: {
        ...tsconfigAliases,
        '@': srcDir,
        '@dnd-kit/core': path.resolve(mocksDir, 'dnd-kit-core.tsx'),
        '@dnd-kit/sortable': path.resolve(mocksDir, 'dnd-kit-sortable.tsx'),
        '@dnd-kit/utilities': path.resolve(mocksDir, 'dnd-kit-utilities.ts'),
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
