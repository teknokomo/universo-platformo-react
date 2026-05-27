import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: {
        index: './src/index.ts'
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    platform: 'neutral',
    exports: false,
    external: ['playcanvas']
})
