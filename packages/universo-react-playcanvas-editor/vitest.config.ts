import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    root: __dirname,
    test: {
        environment: 'node',
        include: ['tests/**/*.{test,spec}.{ts,mts,mjs}', 'src/**/*.{test,spec}.ts'],
        exclude: ['dist/**', 'build/**', '.tmp/**', 'vendor/**', 'node_modules/**']
    }
})
