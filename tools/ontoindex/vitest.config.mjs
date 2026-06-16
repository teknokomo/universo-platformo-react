import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tools/ontoindex/__tests__/**/*.test.mjs']
    }
})
