import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    utils: './src/utils.ts',
  },
  format: ['esm', 'cjs'],
  platform: 'browser',
  dts: true,
  exports: false,
  external: [
    'react',
    'react-dom',
    /^@mui\//,
    /^@tanstack\//,
    /^@universo\//,
  ],
})
