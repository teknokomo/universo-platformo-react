import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: {
        index: './src/index.ts'
    },
    format: ['esm', 'cjs'],
    platform: 'browser',
    dts: true,
    exports: false,
    external: ['react', 'react-dom', /^@editorjs\//, /^@mui\//, /^@universo\//]
})
