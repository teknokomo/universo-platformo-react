import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    'i18n/index': './src/i18n/index.ts',
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
    'uuid',
    'notistack',
    '@tanstack/react-query',
    /^@mui\//,
    /^@emotion\//,
    /^@tabler\//,
    /^@universo\//,
  ],
});
