import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: {
        index: './src/index.ts',
        resolve: './src/resolve.ts'
    },
    format: ['esm', 'cjs'],
    dts: true,
    platform: 'neutral',
    clean: true,
    outDir: 'dist',
    exports: false,
    treeshake: true,
    minify: false
})
