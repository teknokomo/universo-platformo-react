import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'

import baseConfig from '../../tools/testing/frontend/vitest.base.config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default mergeConfig(
    baseConfig,
    defineConfig({
        root: __dirname,
        test: {
            globals: true,
            include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}']
        }
    })
)
