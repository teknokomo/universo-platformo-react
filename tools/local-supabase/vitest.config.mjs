import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tools/local-supabase/__tests__/**/*.test.mjs']
    }
})
