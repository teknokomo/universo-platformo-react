import { defineConfig } from 'tsdown'

export default defineConfig({
    // Entry points - compile only truly independent modules
    // Pages depend on UI components, keep as source
    entry: {
        // i18n module - standalone
        'i18n/index': './src/i18n/index.ts',
    },

    // Output formats: ESM + CJS for maximum compatibility
    format: ['esm', 'cjs'],
    
    // Generate TypeScript declarations
    dts: true,
    
    // Platform: neutral (library, not node-specific)
    platform: 'neutral',
    
    // Auto-clean dist before build
    clean: true,
    
    // Output directory
    outDir: 'dist',
    
    // Source maps for debugging
    sourcemap: true,
    
    // External dependencies
    external: [
        'react',
        'react-dom',
        /^@universo\//,
    ],
    
    // Preserve JSX automatic runtime (React 17+ style)
    inputOptions: {
        resolve: {
            alias: {
                '@': './src',
            },
        },
    },
})
