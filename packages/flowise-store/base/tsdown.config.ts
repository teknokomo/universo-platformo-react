import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: {
        index: './src/index.ts',
        actions: './src/actions.js',
        constant: './src/constant.js'
    },
    format: ['esm'],
    dts: false, // Disable dts generation to avoid circular dependency issues
    platform: 'neutral',
    clean: true,
    outDir: 'dist',
    splitting: false, // Important: compile into single file to avoid path resolution issues
    treeshake: true,
    minify: false,
    external: [
        'react',
        'react-dom',
        'react-redux',
        'redux'
    ],
    outExtensions: ({ format }) => (format === 'esm' ? '.mjs' : '.js')
})
