import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'

import baseConfig from '../../../tools/testing/frontend/vitest.base.config'
import { loadTsconfigAliases } from '../../../tools/testing/frontend/loadTsconfigAliases'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, 'src')
const tsconfigAliases = loadTsconfigAliases(path.resolve(__dirname, 'tsconfig.json'), __dirname)

export default mergeConfig(
    baseConfig,
    defineConfig({
        root: __dirname,
        resolve: {
            alias: {
                ...tsconfigAliases,
                '@': srcDir
            }
        },
        test: {
            globals: true,
            include: ['src/**/*.{test,spec}.{ts,tsx}'],
            exclude: ['dist/**', 'node_modules/**']
        }
    })
)
