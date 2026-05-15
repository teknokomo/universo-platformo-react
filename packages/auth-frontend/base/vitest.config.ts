import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'

import baseConfig from '../../../tools/testing/frontend/vitest.base.config'
import { loadTsconfigAliases } from '../../../tools/testing/frontend/loadTsconfigAliases'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const tsconfigAliases = loadTsconfigAliases(path.resolve(__dirname, 'tsconfig.json'), __dirname)
const coverageEnabled = process.env.VITEST_COVERAGE !== 'false'
const enforceCoverageThresholds = process.env.VITEST_ENFORCE_COVERAGE === 'true'

export default mergeConfig(
    baseConfig,
    defineConfig({
        root: __dirname,
        resolve: {
            alias: {
                ...tsconfigAliases
            }
        },
        test: {
            globals: true,
            include: ['src/**/*.{test,spec}.{ts,tsx}'],
            exclude: ['dist/**', 'node_modules/**'],
            coverage: {
                enabled: coverageEnabled,
                reporter: ['text', 'json-summary'],
                reportsDirectory: path.resolve(__dirname, 'coverage'),
                include: ['src/**/*.{ts,tsx}'],
                exclude: ['src/**/__tests__/**', 'src/**/__mocks__/**', 'src/i18n/**'],
                ...(enforceCoverageThresholds
                    ? {
                          thresholds: {
                              statements: 70,
                              branches: 70,
                              functions: 70,
                              lines: 70
                          }
                      }
                    : {})
            }
        }
    })
)
