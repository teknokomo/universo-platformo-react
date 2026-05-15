import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: {
        index: './src/index.ts',
        'i18n/index': './src/i18n/index.ts'
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    external: [
        'react',
        'react-dom',
        'react-router-dom',
        '@mui/material',
        '@mui/icons-material',
        '@emotion/react',
        '@emotion/styled',
        '@tanstack/react-query',
        '@universo/i18n',
        '@universo/template-mui',
        '@universo/types',
        'axios',
        'i18next',
        'react-i18next'
    ]
})
