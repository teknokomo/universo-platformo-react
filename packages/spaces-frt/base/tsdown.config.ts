import { defineConfig } from 'tsdown'

export default defineConfig({
    // Entry points - only compile truly independent modules
    // Views and entry routes are too tightly coupled to UI, keep as source
    entry: {
        // Main entry point
        index: './src/index.ts',
        
        // i18n module - standalone, can be compiled
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
    
    // CRITICAL: Disable automatic package.json exports modification
    // We manually control exports in package.json to include source file wildcards
    // (./views/*, ./entry/*, ./src/*) for tightly coupled UI components
    exports: false,
    
    // Source maps for debugging
    sourcemap: true,
    
    // Preserve JSX automatic runtime (React 17+ style)
    // No need to import React in every file
    inputOptions: {
        // jsx: 'automatic' is default - no need to specify
        
        // Configure path aliases from tsconfig.json
        resolve: {
            alias: {
                '@': './src',
            },
        },
    },
    hooks: {
        'build:prepare': (context) => {
            // eslint-disable-next-line no-console
            console.info('[tsdown:spaces-frt] build prepare', {
                entries: context.options.entry,
                external: context.options.external,
                format: context.options.format,
            })
        },
        'build:done': () => {
            // eslint-disable-next-line no-console
            console.info('[tsdown:spaces-frt] build complete')
        },
    },
    // Prevent bundling workspace singletons (auth, query) and React
    external: [
        'react',
        'react-dom',
        '@universo/auth-frt',
        '@tanstack/react-query'
    ]
})
