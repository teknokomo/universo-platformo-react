import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from '../../../tools/testing/frontend/vitest.base.config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, 'src')
const sharedSetupFiles = (baseConfig.test?.setupFiles ?? []) as string[]

export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: {
        '@': srcDir,
        '@ui': path.resolve(__dirname, '../../../packages/ui/src'),
        '@types': path.resolve(__dirname, '../../../apps/universo-platformo-types/base/src'),
        '@utils': path.resolve(__dirname, '../../../apps/universo-platformo-utils/base/src'),
        '@api': path.resolve(srcDir, 'api'),
        '@components': path.resolve(srcDir, 'components'),
        '@hooks': path.resolve(srcDir, 'hooks'),
        '@pages': path.resolve(srcDir, 'pages'),
        '@i18n': path.resolve(srcDir, 'i18n'),
      },
    },
    test: {
      globals: true,
      include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
      setupFiles: [...sharedSetupFiles, path.resolve(__dirname, 'setupTests.ts')],
    },
    esbuild: {
      loader: 'tsx',
      include: [/src\/.*\.[jt]sx?$/, /tools\/testing\/frontend\/.*\.[jt]sx?$/],
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
    },
  }),
)
