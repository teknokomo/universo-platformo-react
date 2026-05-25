import { defineConfig } from 'tsdown'

export default defineConfig({
    // Entry points - main package export and subpath exports
    entry: {
        index: './src/index.ts',
        'pages/AuthPage': './src/pages/AuthPage.tsx'
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
    // We manually control exports in package.json
    exports: false,

    // Tree-shaking for optimal bundle size
    treeshake: true,

    // Keep code readable for debugging (no minification)
    minify: false
})
