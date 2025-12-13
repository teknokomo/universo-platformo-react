import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        'i18n/index': 'src/i18n/index.ts'
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    external: [
        'react',
        'react-dom',
        'react-router-dom',
        '@mui/material',
        '@emotion/react',
        '@emotion/styled',
        '@tabler/icons-react',
        '@tanstack/react-query',
        '@universo/template-mui',
        '@universo/types',
        '@universo/utils',
        '@flowise/template-mui',
        'axios',
        'i18next',
        'react-i18next',
        'notistack',
        /\.svg$/,
        /\.png$/,
        /\.jpg$/,
        /\.jpeg$/,
        /\.gif$/
    ]
})
