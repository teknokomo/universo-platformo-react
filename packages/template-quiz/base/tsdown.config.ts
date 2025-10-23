import { defineConfig } from 'tsdown'

export default defineConfig({
    // Multiple entry points for submodules
    entry: {
        index: './src/index.ts',
        'arjs/index': './src/arjs/index.ts',
        'i18n/index': './src/i18n/index.ts'
    },

    // Output formats: ESM + CJS for maximum compatibility
    format: ['esm', 'cjs'],

    // Generate TypeScript declarations
    dts: true,

    // Platform: neutral (library, can be used in browser and Node.js)
    platform: 'neutral',

    // Auto-clean dist before build
    clean: true,

    // Output directory
    outDir: 'dist',

    // CRITICAL: Disable automatic package.json exports modification
    // We manually control exports in package.json with submodules
    exports: false,

    // Tree-shaking for optimal bundle size
    treeshake: true,

    // Keep code readable for debugging (no minification)
    minify: false
})
