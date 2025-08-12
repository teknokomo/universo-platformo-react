# Space Builder (Prompt‑to‑Flow)

Turn a natural‑language request into a valid Flow graph built from UPDL nodes.

## Overview

Space Builder consists of two packages:

-   `apps/space-builder-frt` — UI (FAB + MUI Dialog + i18n + hook)
-   `apps/space-builder-srv` — API (meta‑prompt, provider call, JSON extraction, Zod validation)

The UI supports a two‑step workflow for quiz building:

-   Prepare: paste study material (1..5000 chars), select model and counts (N questions, M answers), receive a `quizPlan`
-   Generate: review the quiz preview and then generate a UPDL graph from the plan

The UI can apply the generated graph in two modes:

-   Append: merge with the current canvas (ID remap + position offset)
-   Replace: clear current canvas and set the generated graph

## Deterministic builder

-   The final UPDL graph is built by a deterministic local builder from the validated quiz plan (no LLM step here).
-   This stabilizes results, avoids hallucinations and reduces token usage.
-   Node names and coordinates are assigned by the builder for consistent layouts.

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
-   `POST /api/v1/space-builder/prepare`
    -   Request: `{ sourceText: string (1..5000), selectedChatModel: { provider: string, modelName: string, credentialId?: string }, options: { questionsCount: 1..10, answersPerQuestion: 2..5 } }`
    -   Response: `{ quizPlan: { items: Array<{ question: string, answers: Array<{ text: string, isCorrect: boolean }> }> } }`
-   `POST /api/v1/space-builder/generate`
    -   Request: either `{ question: string, selectedChatModel: {...} }` or `{ quizPlan: QuizPlan, selectedChatModel: {...} }`
    -   Response: `{ nodes: any[], edges: any[] }`

## Frontend Integration

Register translations once and render the FAB.

Two-step UI (Prepare → Preview → Generate):

-   Prepare: paste material (1..5000 chars), pick model, choose N×M, click Prepare; the dialog shows a non-editable quiz preview
-   Generate: click Generate to build a UPDL graph from the plan; choose Append or Replace to apply to the canvas

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
