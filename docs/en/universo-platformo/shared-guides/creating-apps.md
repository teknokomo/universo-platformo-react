# Creating New Apps and Packages (Best Practices)

This guide summarizes our proven practices for adding frontend/backends apps and shared/template packages in the monorepo.

## Workspace Imports

- Always import across packages using workspace names (e.g., `@universo/...`), not relative paths.
- Declare `workspace:*` in the consumer `package.json` to establish the build graph.

## Build Order with Turborepo

- Keep `dependsOn: ["^build"]` at the root.
- Ensure consumers declare real dependencies so templates/libs build before UI.
- For cold start, consider server → `publish-frt` if static assets are needed.

## Frontend Packages (TSX)

- TypeScript-first. Dual build (CJS + ESM + Types).
- Provide `main`, `module`, `types` and `exports` map to `dist/*`.
- Place compiled output under `dist/`.

## Backend Packages (TypeORM)

- No direct DB client usage. Use Repository pattern via shared `DataSource`.
- Export `entities` and `migrations` arrays for central registration.
- Mount routers from packages at the main server under proper scopes.

## i18n Format

- Use a TypeScript entry (`index.ts`) for i18n modules in packages.
- Import JSON locales with `resolveJsonModule` or inline small dictionaries.
- Export typed helpers (`getXxxTranslations(lang)`), and keep namespaces stable.

## Vite Integration

- Build libraries before `flowise-ui`.
- Use `optimizeDeps.include`/`build.commonjsOptions.include` sparingly for workspace libs.
- Avoid aliasing packages to `src` in production builds (dev-only fallback).

## Avoiding Cycles

- Feature/frontend packages must not depend on the UI app.
- UI depends on feature packages; not vice versa.

## Uniks Child Modules

- New domains (e.g., Finance) should:
  - export entities + migrations arrays and `createXxxRouter()`;
  - mount under `/api/v1/uniks/:unikId/...` on the server;
  - add nested UI routes and namespaced i18n.

## Quick Checklist

- Workspace imports use `@universo/...` and `workspace:*` deps
- Dual build configured (CJS/ESM/types) and `exports` map points to `dist/*`
- TS i18n entry exists (`src/i18n/index.ts`), JSON locales imported with `resolveJsonModule`
- No cyclic dependency with UI; UI depends on your package, not vice versa
- Server package exports `entities`, `migrations`, and a `createXxxRouter()` if applicable
- Turborepo root keeps `dependsOn: ["^build"]`; consumers declare deps to enforce build order
- Vite: avoid aliasing to `src` in prod; pre-build libs before UI
