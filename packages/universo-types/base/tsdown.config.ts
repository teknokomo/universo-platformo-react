import { defineConfig } from 'tsdown'

export default defineConfig({
    // Entry point - type-only package
    entry: {
        index: './src/index.ts'
    },

    // Output formats: ESM + CJS (minimal runtime, mostly types)
    format: ['esm', 'cjs'],

    // Generate TypeScript declarations (main purpose of this package)
    dts: true,

    // Platform: neutral (types can be used anywhere)
    platform: 'neutral',

    // Auto-clean dist before build
    clean: true,

    // Output directory
    outDir: 'dist',

    // CRITICAL: Disable automatic package.json exports modification
    // We manually control exports in package.json
    exports: false,

    // Tree-shaking: remove all runtime code (keep only types)
    treeshake: true,

    // Keep code readable (though this is mostly types)
    minify: false
})
