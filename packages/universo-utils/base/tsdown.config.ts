import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: {
        index: './src/index.ts',
        'index.browser': './src/index.browser.ts',
        'env/index': './src/env/index.ts',
        'ui-utils': './src/ui-utils/index.js',
        'rate-limiting': './src/rate-limiting/index.ts',
        'captcha/index': './src/captcha/index.ts'
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    // External dependencies that should not be bundled
    // lodash and moment are kept external to avoid CommonJS runtime helpers
    external: ['lodash', 'moment']
})
