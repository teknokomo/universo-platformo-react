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
        plugins: [
            react(),
            supportedLanguagesPlugin()
        ],
        esbuild: {
            target: 'es2022'
        },
        optimizeDeps: {
            noDiscovery: true,
            include: [
                '@universo/template-mui',
                '@universo/utils',
                '@universo/types',
                '@universo/profile-frontend',
                '@universo/applications-frontend',
                '@universo/metahubs-frontend'
            ],
            // Do not prebundle auth singleton to avoid duplicate copies across optimized deps
            exclude: [
                '@universo/auth-frontend',
                'react-i18next',
                'i18next'
            ],
            // Force Vite to pre-bundle CJS dependencies properly
            esbuildOptions: {
                mainFields: ['browser', 'module', 'main'],
                resolveExtensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
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
                '@universo/template-mui',
                '@universo/store',
                '@universo/i18n'
            ],
            alias: [
                { find: '@', replacement: resolve(__dirname, 'src') },
                { find: '@ui', replacement: resolve(__dirname, 'src') },
                { find: '@tabler/icons-react', replacement: tablerIconsEsm },
                // Force browser version of @universo/utils (only bare import)
                { find: /^@universo\/utils$/, replacement: resolve(__dirname, '../../universo-utils/base/src/index.browser.ts') },
                { find: /^@universo\/utils\/env$/, replacement: resolve(__dirname, '../../universo-utils/base/src/env/index.browser.ts') },
                {
                    find: /^@universo\/utils\/validation\/codename$/,
                    replacement: resolve(__dirname, '../../universo-utils/base/src/validation/codename.ts')
                },
                { find: /^@universo\/utils\/vlc$/, replacement: resolve(__dirname, '../../universo-utils/base/src/vlc/index.ts') },
                {
                    find: /^@universo\/utils\/optimistic-crud$/,
                    replacement: resolve(__dirname, '../../universo-utils/base/src/optimisticCrud.ts')
                }
            ]
        },
        root: resolve(__dirname),
        build: {
            outDir: './build',
            sourcemap: true,
            target: 'es2022',
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
