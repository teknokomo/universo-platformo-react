import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: {
        index: './src/index.ts',
        'components/index': './src/components/index.ts',
        'views/index': './src/views/index.ts',
        'i18n/index': './src/i18n/index.ts'
    },
    format: ['esm', 'cjs'],
    platform: 'browser',
    dts: true,
    exports: false,
    external: [
        'react',
        'react-dom',
        'react-router',
        'react-router-dom',
        'react-i18next',
        'i18next',
        'axios',
        /^@mui\//,
        /^@emotion\//,
        /^@universo\//
    ]
})
