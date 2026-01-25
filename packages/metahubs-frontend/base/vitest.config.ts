import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'

import baseConfig from '../../../tools/testing/frontend/vitest.base.config'
import { loadTsconfigAliases } from '../../../tools/testing/frontend/loadTsconfigAliases'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, 'src')
const coreFrontendSrcDir = path.resolve(__dirname, '../../flowise-core-frontend/base/src')
const sharedSetupFiles = (baseConfig.test?.setupFiles ?? []) as string[]
const tsconfigAliases = loadTsconfigAliases(path.resolve(__dirname, 'tsconfig.json'), __dirname)

// Merge with baseConfig (now uses happy-dom from base)
export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: [
        {
          find: '@universo/metahubs-frontend',
          replacement: path.resolve(__dirname, 'src/index.ts'),
        },
        {
          find: /^@\/views\//,
          replacement: `${path.resolve(coreFrontendSrcDir, 'views')}/`,
        },
        ...Object.entries(tsconfigAliases).map(([find, replacement]) => ({ find, replacement })),
        {
          find: '@',
          replacement: srcDir,
        },
      ],
    },
    test: {
      globals: true,
      include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
      setupFiles: [...sharedSetupFiles, path.resolve(__dirname, 'setupTests.ts')],
      coverage: {
        enabled: true,
        reporter: ['text', 'json-summary'],
        reportsDirectory: path.resolve(__dirname, 'coverage'),
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/__tests__/**',
          'src/**/__mocks__/**',
          'src/pages/**',
          'src/components/**',
          'src/hooks/**',
          'src/menu-items/**',
          'src/i18n/**',
          'src/constants/**',
          'src/types.ts',
          'src/domains/attributes/**',
          'src/domains/catalogs/**',
          'src/domains/hubs/**',
          'src/domains/elements/**',
          'src/domains/publications/**',
          'src/domains/metahubs/ui/MetahubActions.tsx',
        ],
        thresholds: {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70,
        },
      },
    },
    esbuild: {
      loader: 'tsx',
      include: [/src\/.*\.[jt]sx?$/, /tools\/testing\/frontend\/.*\.[jt]sx?$/],
      jsx: 'automatic',
    },
  })
)
