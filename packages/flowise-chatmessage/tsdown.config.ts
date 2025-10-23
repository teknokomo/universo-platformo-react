import { defineConfig } from 'tsdown'

export default defineConfig({
    // Entry point - main export file
    entry: {
        index: './base/src/index.js',
    },

    // Output formats: ESM + CJS for maximum compatibility
    format: ['esm', 'cjs'],

    // No TypeScript declarations needed (source files are plain JS/JSX)
    dts: false,

    // Platform: browser (React components for web)
    platform: 'browser',

    // Auto-clean dist before build
    clean: true,

    // Output directory
    outDir: 'dist',

    // CRITICAL: Disable automatic package.json exports modification
    // We manually control exports in package.json
    exports: false,

    // Source maps for debugging
    sourcemap: true,

    // Preserve JSX automatic runtime (React 17+ style)
    // No need to import React in every file
    inputOptions: {
        // jsx: 'automatic' is default in tsdown
        
        // Configure path aliases if needed
        resolve: {
            alias: {
                '@': './base/src',
            },
        },
    },

    // CRITICAL: External dependencies (do NOT bundle these)
    // These should be provided by the consuming application
    external: [
        'react',
        'react-dom',
        'react-device-detect',
        '@mui/material',
        '@mui/icons-material',
        '@mui/x-date-pickers',
        '@universo/template-mui',
        '@universo/auth-frt',
        '@universo/api-client',
        '@flowise/store',
        '@universo/i18n',
        'react-markdown',
        'rehype-mathjax',
        'rehype-raw',
        'remark-gfm',
        'remark-math',
    ],
})
