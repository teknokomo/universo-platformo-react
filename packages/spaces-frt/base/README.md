# @universo/spaces-frt

Frontend for Spaces/Canvases. Extracted and refactored from Flowise UI with minimal coupling.

## Tech Stack
- React 18, React Router
- MUI (Material UI) components and theme overrides
- ReactFlow for node graph editing
- dnd-kit for sortable Canvas tabs
- Axios HTTP client with JWT + refresh

## Structure
- `src/api` – HTTP client (`client.js`) and Spaces/Canvases APIs
- `src/hooks` – `useApi`, `useCanvases` (local copy, detached from Flowise)
- `src/views/canvas` – Canvas screen, styles and subcomponents
- `src/views/spaces` – Spaces list
- `src/components` – shared UI for this package
- `src/entry/routes.jsx` – route config for mounting under `/uniks/:unikId`

## Aliases
Configured in `tsconfig.json`:
- `@/*` → local `src/*` (primary)
- `@ui/*` → Flowise `packages/flowise-ui/src/*` (temporary bridge until full migration)

## Build & Test
```
pnpm --filter @universo/spaces-frt build     # produces dist/cjs, dist/esm, dist/types
pnpm --filter @universo/spaces-frt test      # Vitest + testing-library setup
pnpm --filter @universo/spaces-frt lint
```

### TypeScript packaging
- `tsconfig.json` — emits CommonJS bundle (`dist/cjs`)
- `tsconfig.esm.json` — emits ES Module bundle (`dist/esm`)
- `tsconfig.types.json` — emits declaration files (`dist/types`)

## Migration Notes
- Localized HTTP client and `useCanvases` to remove tight coupling to Flowise.
- Gradually replace `@ui/*` imports with local components; remove Flowise files once unused.
