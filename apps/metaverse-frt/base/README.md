# Metaverse Frontend (FRONTEND)

Frontend UI for managing Metaverses in Universo Platformo.

## Overview

This package provides a basic management page for Metaverses (MVP):

-   List user-visible metaverses (via membership or public visibility)
-   Search by name
-   Create a new metaverse (owner membership is created automatically)

The page is integrated into the main UI:

-   Left menu: “Metaverses” below Uniboard
-   Route: `/metaverses` (guarded by Auth)

## i18n

The module registers its translation bundle (EN/RU) in the global i18n during UI initialization. Keys used by the list page:

-   Namespace: `metaverse`
-   `list.title`, `list.searchPlaceholder`, `list.create`, `list.newName`

## Usage

-   The page is lazy-loaded through the host app router; no direct import is needed.
-   Backend endpoints must be available on the server:
    -   `GET /api/v1/metaverses` — list
    -   `POST /api/v1/metaverses` — create

## Build

-   Dual build (CJS + ESM) similar to other frontend packages for better bundling:
    -   `tsconfig.json` → CJS output in `dist/`
    -   `tsconfig.esm.json` → ESM output in `dist/esm/`
-   Gulp copies static assets and JSON locales after compilation.

## Commands

-   `pnpm build` – compile TS (CJS + ESM) and copy assets via gulp
-   `pnpm dev` – TypeScript watch (no asset copy)
-   `pnpm lint` – run ESLint checks

## Notes

-   Uses the shared authenticated API client; it forwards the Authorization header and refreshes on 401.
-   No secrets are stored here; server-side RLS enforces access by membership and visibility.
-   Future work: membership management (roles), default metaverse toggle, link editor (create/remove/visualize).

## API Usage

Use the shared `useApi` hook for backend requests. Add the returned `request` function to effect dependency arrays so calls execute only once when components mount:

```javascript
const { request } = useApi(fetchList)

useEffect(() => {
    request()
}, [request])
```
