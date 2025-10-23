import { defineConfig } from 'tsdown'

export default defineConfig({
    // Entry points - compile only truly independent modules
    // Main index.ts depends on features (UI-coupled), keep as source
    entry: {
        // Builders - core functionality (independent)
        'builders/index': './src/builders/index.ts',
        
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
    
    // External dependencies - don't bundle peer dependencies and workspace packages
    external: [
        'react',
        'react-dom',
        'typeorm',
        /^@universo\//,
    ],
    
    // Preserve JSX automatic runtime (React 17+ style)
    inputOptions: {
        // Configure path aliases from tsconfig.json
        resolve: {
            alias: {
                '@': './src',
            },
        },
    },
})
