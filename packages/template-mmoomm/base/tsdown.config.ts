import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: './src/index.ts',
    'playcanvas/index': './src/playcanvas/index.ts',
    'i18n/index': './src/i18n/index.ts',
  },
  format: ['esm', 'cjs'],
  platform: 'browser',  // Target browser environment (prevent Node.js polyfills)
  dts: true,
  
  // CRITICAL: Disable automatic package.json exports modification
  // We manually control exports in package.json
  exports: false,
  
  external: [
    /^@universo\//,
  ],
  // No copy option needed:
  // - JSON i18n files are ES imports and bundle automatically
  // - MD files are documentation for developers, not needed in dist/
});
