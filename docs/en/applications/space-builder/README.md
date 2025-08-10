# Space Builder (Prompt‑to‑Flow)

Turn a natural‑language request into a valid Flow graph built from UPDL nodes.

## Overview

Space Builder consists of two packages:

-   `apps/space-builder-frt` — UI (FAB + MUI Dialog + i18n + hook)
-   `apps/space-builder-srv` — API (meta‑prompt, provider call, JSON extraction, Zod validation)

The UI can generate a graph in two modes:

-   Append: merge with the current canvas (ID remap + position offset)
-   Replace: clear current canvas and set the generated graph

## Environment

Configure in `packages/server/.env`:

```
SPACE_BUILDER_TEST_MODE=true|false
GROQ_TEST_API_KEY=...
```

-   `SPACE_BUILDER_TEST_MODE` toggles the Test mode entry in the UI
-   `GROQ_TEST_API_KEY` is used only when test mode is enabled (provider `groq_test`)

`GET /api/v1/space-builder/config` returns `{ testMode: boolean }` and is used by the UI to decide whether to display Test mode.

## Endpoints

-   `GET /api/v1/space-builder/health` → `{ ok: true }`
-   `GET /api/v1/space-builder/config` → `{ testMode: boolean }`
-   `POST /api/v1/space-builder/generate`
    -   Request: `{ question: string, selectedChatModel: { provider: string, modelName: string, credentialId?: string } }`
    -   Response: `{ nodes: any[], edges: any[] }`

## Frontend Integration

Register translations once and render the FAB:

```ts
import i18n from '@/i18n'
import { registerSpaceBuilderI18n } from '@universo/space-builder-frt'
registerSpaceBuilderI18n(i18n)
```

```tsx
import { SpaceBuilderFab } from '@universo/space-builder-frt'
;<SpaceBuilderFab
    models={availableChatModels}
    onApply={(graph, mode) => {
        if (mode === 'append') return handleAppendGeneratedGraph(graph)
        handleApplyGeneratedGraph(graph)
    }}
/>
```

The UI fetches available models from existing Credentials and reads Test mode from `/api/v1/space-builder/config` using the shared authenticated API client.

## Build

-   Frontend: dual build (CJS + ESM); `tsconfig.esm.json` improves bundling and tree‑shaking for ESM toolchains
-   Backend: single CJS build

Workspace commands:

```
pnpm build --filter @universo/space-builder-frt
pnpm build --filter @universo/space-builder-srv
```

## Notes

-   No secrets are stored on the frontend; all keys are resolved server‑side
-   The server validates output JSON with Zod and normalizes nodes for stable UI rendering
