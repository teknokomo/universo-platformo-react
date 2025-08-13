# Space Builder (Prompt‑to‑Flow)

Turn a natural‑language request into a valid Flow graph built from UPDL nodes.

## Overview

Space Builder consists of two packages:

-   `apps/space-builder-frt` — UI (FAB + MUI Dialog + i18n + hook)
-   `apps/space-builder-srv` — API (meta‑prompt, provider call, JSON extraction, Zod validation)

The UI supports a three‑step workflow for quiz building (Prepare → Preview → Settings → Generate):

-   Prepare: paste study material (1..5000 chars) and optionally add "Additional conditions" (0..500 chars) that strictly guide the LLM; choose counts (N questions, M answers); click Prepare to receive a `quizPlan`
-   Preview: the quiz proposal is shown in a read‑only text field; below it there is a "What to change?" input (0..500 chars) and a "Change" button for iterative revision; the field is cleared when you go Back and re‑Prepare, and also after a successful change
-   Settings: choose generation options (Append to current flow, Collect participant names, Show final score); model selection is available from the gear button in the bottom‑left of the dialog
-   Generate: build a UPDL graph from the plan and apply it to the canvas

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
    -   Request: `{ sourceText: string (1..5000), additionalConditions?: string (0..500), selectedChatModel: { provider: string, modelName: string, credentialId?: string }, options: { questionsCount: 1..10, answersPerQuestion: 2..5 } }`
    -   Response: `{ quizPlan: { items: Array<{ question: string, answers: Array<{ text: string, isCorrect: boolean }> }> } }`
-   `POST /api/v1/space-builder/generate`
    -   Request: either `{ question: string, selectedChatModel: {...} }` or `{ quizPlan: QuizPlan, selectedChatModel: {...} }`
    -   Response: `{ nodes: any[], edges: any[] }`
-   `POST /api/v1/space-builder/revise`
    -   Request: `{ quizPlan: QuizPlan, instructions: string (1..500), selectedChatModel: { provider: string, modelName: string, credentialId?: string } }`
    -   Response: `{ quizPlan: QuizPlan }` (sizes preserved; exactly one correct answer per question)

## Frontend Integration

Register translations once and render the FAB.

Three-step UI (Prepare → Preview → Settings → Generate):

-   Prepare: paste material (1..5000 chars) and optionally provide Additional conditions (0..500); choose N×M, click Prepare; the dialog shows a read‑only quiz preview
-   Preview: use the "What to change?" field to request precise edits; press "Change" to apply; the edit field clears after a successful change and also after going Back and re‑preparing; click Configure to proceed to Settings
-   Settings: pick generation options; model selection is available from the gear button in the bottom‑left of the dialog
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
