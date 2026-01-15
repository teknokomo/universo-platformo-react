import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { createRequire } from 'module'
import dotenv from 'dotenv'
import fs from 'fs'

const require = createRequire(import.meta.url)
const tablerIconsEsm = require.resolve('@tabler/icons-react/dist/esm/tabler-icons-react.mjs')
const supportedLanguagesPath = require.resolve('@universo/i18n/supported-languages.json')
const supportedLanguages = JSON.parse(fs.readFileSync(supportedLanguagesPath, 'utf-8'))

const supportedLanguagesPlugin = () => ({
    name: 'inject-supported-languages',
    transformIndexHtml(html) {
        if (!html.includes('__SUPPORTED_LANGS__')) {
            return html
        }

        return html.replace('__SUPPORTED_LANGS__', JSON.stringify(supportedLanguages))
    }
})

export default defineConfig(async ({ mode }) => {
    let proxy = undefined
    if (mode === 'development') {
        const serverEnv = dotenv.config({ processEnv: {}, path: '../server/.env' }).parsed
        const serverHost = serverEnv?.['HOST'] ?? 'localhost'
        const serverPort = parseInt(serverEnv?.['PORT'] ?? 3000)
        if (!Number.isNaN(serverPort) && serverPort > 0 && serverPort < 65535) {
            proxy = {
                '^/api(/|$).*': {
                    target: `http://${serverHost}:${serverPort}`,
                    changeOrigin: true
                }
            }
        }
    }

    dotenv.config()
    return {
        plugins: [react(), supportedLanguagesPlugin()],
        optimizeDeps: {
            // Disable pre-bundling to eliminate accidental duplicate singletons during dev
            // Re-enable later if needed after full stabilization
            disabled: true,
            include: [
                '@flowise/template-mui',
                '@flowise/chatmessage',
                '@universo/utils',
                '@universo/types',
                '@universo/template-mmoomm',
                '@universo/template-quiz',
                '@universo/publish-frontend',
                '@universo/analytics-frontend',
                '@universo/profile-frontend',
                '@universo/uniks-frontend',
                '@universo/metaverses-frontend',
                '@universo/applications-frontend',
                '@universo/metahubs-frontend',
                '@universo/organizations-frontend',
                '@universo/spaces-frontend',
                '@universo/space-builder-frontend'
            ],
            // Do not prebundle auth singleton (and other shims) to avoid duplicate copies across optimized deps
            exclude: [
                '@universo/auth-frontend',
                'react-i18next',
                'i18next',
                'use-sync-external-store',
                'use-sync-external-store/shim',
                'use-sync-external-store/with-selector'
            ],
            // Force Vite to pre-bundle CJS dependencies properly
            esbuildOptions: {
                mainFields: ['browser', 'module', 'main'],
                resolveExtensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
                // Force ESM for all dependencies
                platform: 'browser',
                conditions: ['browser', 'module', 'import', 'default']
            }
        },

        resolve: {
            conditions: ['browser', 'module', 'import', 'default'],
            mainFields: ['browser', 'module', 'main'],
            // Ensure singletons across workspace to avoid duplicated React/contexts
            dedupe: [
                'react',
                'react-dom',
                'react-i18next',
                'i18next',
                '@universo/auth-frontend',
                '@universo/spaces-frontend',
                '@flowise/template-mui',
                '@flowise/chatmessage',
                '@flowise/store',
                '@universo/i18n'
            ],
            alias: [
                { find: '@', replacement: resolve(__dirname, 'src') },
                { find: '@ui', replacement: resolve(__dirname, 'src') },
                // Source alias removed - all @universo/auth-frontend imports now resolve via package.json dist
                {
                    find: 'use-sync-external-store/with-selector',
                    replacement: resolve(__dirname, 'src/shims/useSyncExternalStore/with-selector.js')
                },
                {
                    find: 'use-sync-external-store/with-selector.js',
                    replacement: resolve(__dirname, 'src/shims/useSyncExternalStore/with-selector.js')
                },
                {
                    find: 'use-sync-external-store/shim/with-selector',
                    replacement: resolve(__dirname, 'src/shims/useSyncExternalStore/with-selector.js')
                },
                {
                    find: 'use-sync-external-store/shim/with-selector.js',
                    replacement: resolve(__dirname, 'src/shims/useSyncExternalStore/with-selector.js')
                },
                {
                    find: 'use-sync-external-store/shim/index.js',
                    replacement: resolve(__dirname, 'src/shims/useSyncExternalStore/index.js')
                },
                { find: 'use-sync-external-store/shim', replacement: resolve(__dirname, 'src/shims/useSyncExternalStore/index.js') },
                { find: 'use-sync-external-store/index.js', replacement: resolve(__dirname, 'src/shims/useSyncExternalStore/index.js') },
                { find: /^use-sync-external-store$/, replacement: resolve(__dirname, 'src/shims/useSyncExternalStore/index.js') },
                { find: '@tabler/icons-react', replacement: tablerIconsEsm },
                // Force browser version of @universo/utils (only bare import)
                { find: /^@universo\/utils$/, replacement: resolve(__dirname, '../../universo-utils/base/src/index.browser.ts') },
                // CodeMirror deduplication (technical necessity)
                { find: '@codemirror/state', replacement: resolve(__dirname, '../../../node_modules/@codemirror/state') },
                { find: '@codemirror/view', replacement: resolve(__dirname, '../../../node_modules/@codemirror/view') },
                { find: '@codemirror/language', replacement: resolve(__dirname, '../../../node_modules/@codemirror/language') },
                { find: '@codemirror/lang-javascript', replacement: resolve(__dirname, '../../../node_modules/@codemirror/lang-javascript') },
                { find: '@codemirror/lang-json', replacement: resolve(__dirname, '../../../node_modules/@codemirror/lang-json') },
                { find: '@uiw/react-codemirror', replacement: resolve(__dirname, '../../../node_modules/@uiw/react-codemirror') },
                {
                    find: '@uiw/codemirror-theme-vscode',
                    replacement: resolve(__dirname, '../../../node_modules/@uiw/codemirror-theme-vscode')
                },
                {
                    find: '@uiw/codemirror-theme-sublime',
                    replacement: resolve(__dirname, '../../../node_modules/@uiw/codemirror-theme-sublime')
                },
                { find: '@lezer/common', replacement: resolve(__dirname, '../../../node_modules/@lezer/common') },
                { find: '@lezer/highlight', replacement: resolve(__dirname, '../../../node_modules/@lezer/highlight') }
            ]
        },
        root: resolve(__dirname),
        build: {
            outDir: './build',
            sourcemap: true,
            commonjsOptions: {
                include: [/@universo\//, /node_modules/],
                transformMixedEsModules: true
            },
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        // Prevent auth-frontend from being split into separate chunk
                        // by NOT returning a chunk name - let Rollup decide based on first import
                        if (id.includes('auth-frontend')) {
                            console.log('[vite-manualChunks] auth-frontend detected, using default chunking:', id)
                            return undefined // Let Rollup include it where it's first imported
                        }
                    }
                }
            }
        },
        server: {
            open: true,
            proxy,
            port: process.env.VITE_PORT ?? 8080,
            host: process.env.VITE_HOST
        }
    }
})
