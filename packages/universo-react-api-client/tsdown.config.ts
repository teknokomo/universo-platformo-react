import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: false, // Using tsc for .d.ts generation
    clean: true,
    splitting: false,
    minify: false,
    sourcemap: false,
    platform: 'neutral',
    // Prevent bundling workspace singletons
    external: ['@universo-react/auth-frontend', '@universo-react/utils', '@tanstack/react-query']
})
