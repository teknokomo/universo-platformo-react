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
        /^@mui\//,
        'react-router-dom',
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
    
    // Copy static assets after build
    onSuccess: async () => {
        const fs = await import('fs')
        const path = await import('path')
        
        const copyDir = (src: string, dest: string) => {
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true })
            }
            const entries = fs.readdirSync(src, { withFileTypes: true })
            for (const entry of entries) {
                const srcPath = path.join(src, entry.name)
                const destPath = path.join(dest, entry.name)
                if (entry.isDirectory()) {
                    copyDir(srcPath, destPath)
                } else {
                    fs.copyFileSync(srcPath, destPath)
                }
            }
        }
        
        // Copy assets if they exist
        const assetsSrc = 'src/assets'
        if (fs.existsSync(assetsSrc)) {
            copyDir(assetsSrc, 'dist/assets')
            // eslint-disable-next-line no-console
            console.log('[publish-frt] Assets copied to dist/assets')
        }
    },
})
