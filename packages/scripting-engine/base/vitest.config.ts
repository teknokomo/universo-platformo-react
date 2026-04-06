import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

import { loadTsconfigAliases } from '../../../tools/testing/frontend/loadTsconfigAliases'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, 'src')
const tsconfigAliases = loadTsconfigAliases(path.resolve(__dirname, 'tsconfig.json'), __dirname)
const coverageEnabled = process.env.VITEST_COVERAGE !== 'false'
const enforceCoverageThresholds = process.env.VITEST_ENFORCE_COVERAGE === 'true'

export default defineConfig({
    root: __dirname,
    resolve: {
        alias: {
            ...tsconfigAliases,
            '@': srcDir
        }
    },
    test: {
        environment: 'node',
        include: ['src/**/*.{test,spec}.ts'],
        exclude: ['dist/**', 'node_modules/**'],
        coverage: {
            enabled: coverageEnabled,
            reporter: ['text', 'json-summary'],
            reportsDirectory: path.resolve(__dirname, 'coverage'),
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.{test,spec}.ts', 'src/**/__tests__/**'],
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