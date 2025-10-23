import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: './src/index.ts',
  },
  format: ['esm', 'cjs'],
  platform: 'browser',  // Target browser environment (prevent Node.js polyfills)
  dts: true,
  
  // CRITICAL: Disable automatic package.json exports modification
  // We manually control exports in package.json
  exports: false,
  
  external: [
    'react',
    'react-dom',
    /^@universo\//,
  ],
  // No copy option needed - no assets in this package
});
