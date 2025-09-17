# Frontend testing utilities

This directory centralises reusable tooling for unit and integration tests that run in the browser with [Vitest](https://vitest.dev/). It contains a shared Vitest base configuration, setup files and helpers that make it easier to align testing patterns across every React surface in the monorepo.

## Vitest base configuration

`vitest.base.config.ts` exports a `defineConfig` instance that enables the `jsdom` environment, registers common `setupFiles`, and exposes the `@testing/frontend` alias that resolves to this folder. The setup file loads `@testing-library/jest-dom` so that extended DOM matchers are available everywhere.

Each React application should extend the base file rather than duplicating configuration. This keeps the defaults (environment, aliases, setup) in one place and allows apps to layer on their own entry points or resolver rules.

### Extending the base config from an app

Create a `vitest.config.ts` (or `.js`) next to the app/package you want to test and merge it with the base configuration:

```ts
import path from 'node:path'
import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from '@testing/frontend/vitest.base.config'

const appDir = path.resolve(__dirname, 'src')

export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: {
        '@': appDir,
      },
    },
    test: {
      include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
      environmentOptions: {
        jsdom: { url: 'http://localhost' },
      },
    },
    esbuild: {
      loader: 'tsx',
      include: /src\/.+\.[jt]sx?$/,
    },
  })
)
```

Key points:

- `mergeConfig` keeps the shared defaults from the base file while letting each app apply its own overrides.
- Use `resolve.alias` to register aliases that are specific to the app (`'@'`, `'@components'`, etc.).
- `esbuild.loader` enables TypeScript/TSX transpilation for files matched by `include` so Vitest can execute React components without a bundler step.

### Handling CSS modules and static assets

Vitest can stub CSS modules or asset imports so that style lookups do not break during tests. Extend the config with the appropriate mock strategy:

```ts
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      css: {
        modules: {
          classNameStrategy: 'non-scoped',
        },
      },
    },
    resolve: {
      alias: [
        {
          find: /\.(css|scss)$/,
          replacement: path.resolve(__dirname, 'tests/__mocks__/styleMock.ts'),
        },
      ],
    },
  })
)
```

Alternatively, create manual mocks (e.g. `tests/__mocks__/styleMock.ts`) that export empty objects or proxy handlers and point the alias at those mocks.

### Customising setup per app

If an application needs extra global setup (polyfills, `ResizeObserver`, `IntersectionObserver`, etc.), append files to the `test.setupFiles` array in the local config while keeping the shared setup from the base file:

```ts
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      setupFiles: [
        ...baseConfig.test!.setupFiles!,
        path.resolve(__dirname, 'tests/setupFiles.ts'),
      ],
    },
  })
)
```

Local setup files can import utilities from `@testing/frontend` (e.g. shared mocks or helper functions).

## Rendering helpers

`renderWithProviders.tsx` exposes a `renderWithProviders` helper that wraps React components with commonly used providers: Material UI theming, an i18n test instance, a Redux store, optional router and notification providers, and any custom wrappers you pass in. It re-exports everything from `@testing-library/react`, so tests can import `renderWithProviders`, `screen`, and friends from the same module.

Usage example:

```tsx
import { renderWithProviders } from '@testing/frontend'
import MyComponent from '@/components/MyComponent'

const { store, i18n } = await renderWithProviders(<MyComponent />, {
  routerProps: { initialEntries: ['/demo'] },
  preloadedState: { feature: { flag: true } },
})

expect(screen.getByText(/demo/i)).toBeInTheDocument()
```

Because `renderWithProviders` initialises i18n asynchronously, remember to `await` it in your tests. You can extend or replace providers by passing `additionalWrappers`, injecting custom Redux stores, overriding the generated theme, or supplying your own i18n instance created via `createTestI18n`.
