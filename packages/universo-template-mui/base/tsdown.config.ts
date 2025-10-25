import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: './src/index.ts',
  },
  format: ['esm', 'cjs'],
  outDir: 'dist',
  platform: 'browser',  // Target browser environment (prevent Node.js polyfills)
  dts: false,  // Use tsc --emitDeclarationOnly for type definitions (better JSX support)
  
  // CRITICAL: Disable automatic package.json exports modification
  // We manually control exports in package.json
  exports: false,
  
  external: [
    'react',
    'react-dom',
    'react-router',
    'react-router-dom',
    'react-i18next',
    'i18next',
    'dayjs',
    'notistack',
    '@tanstack/react-query',
    'canvas',  // Native module from transitive dependency
    '@/utils/genericHelper',  // flowise-ui internal utility (must be resolved by consuming app)
    '@/views/docstore/DocumentStoreStatus',  // flowise-ui internal component (must be resolved by consuming app)
    /^@ui\//,  // Imports from flowise-ui via @ui alias
    /^@mui\//,
    /^@emotion\//,
    /^@universo\//,  // CRITICAL: All @universo/* packages must be external to prevent bundling (especially auth-frt)
    /\.svg$/,  // Treat assets as external
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.gif$/,
    /\.node$/,  // Native modules
  ],
  // Manual type definitions will be copied
  copy: [
    'src/components/cards',  // Contains manual .d.ts files for JSX components
    'src/types',  // Manual type definitions directory
  ],
  // Copy images after build
  hooks: {
    'build:prepare': async (context) => {
      const payload = {
        entries: context.options.entry,
        external: context.options.external,
        format: context.options.format,
      };
      // eslint-disable-next-line no-console
      console.info('[tsdown:universo-template-mui] build prepare', payload);
    },
    'build:done': async () => {
      // eslint-disable-next-line no-console
      console.info('[tsdown:universo-template-mui] build complete');
    },
  },
  onSuccess: async () => {
    const fs = await import('fs');
    const path = await import('path');
    
    const copyDir = (src, dest) => {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyDir(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };
    
    copyDir('src/assets', 'dist/assets');
  },
});
