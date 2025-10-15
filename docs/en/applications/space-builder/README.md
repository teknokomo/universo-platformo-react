# Space Builder (Prompt‑to‑Flow)

Turn a natural‑language request into a valid Flow graph built from UPDL nodes.

## Overview

Space Builder consists of two packages:

-   `apps/space-builder-frt` — UI (FAB + MUI Dialog + i18n + hook)
-   `apps/space-builder-srv` — API (meta‑prompt, provider call, JSON extraction, Zod validation)

The UI supports a three‑step workflow for quiz building (Prepare → Preview → Settings → Generate):

-   Prepare: paste study material (1..5000 chars) and optionally add "Additional conditions" (0..500 chars) that strictly guide the LLM; choose counts (N questions, M answers); click Prepare to receive a `quizPlan`
-   Preview: the quiz proposal is shown in a read‑only text field; below it there is a "What to change?" input (0..500 chars) and a "Change" button for iterative revision; the field is cleared when you go Back and re‑Prepare, and also after a successful change
-   Settings: choose generation options (Creation mode, Collect participant names, Show final score); model selection is available from the gear button in the bottom‑left of the dialog
-   Generate: build a UPDL graph from the plan and apply it to the canvas

The UI can apply the generated graph in three modes (Creation mode):

-   Append: merge with the current canvas (ID remap + safe vertical offset below the lowest nodes)
-   Replace: clear current canvas and set the generated graph
-   Create a new space: if the current canvas has nodes, open a new tab for `.../chatflows/new` and pass the graph via `localStorage.duplicatedFlowData`; if the canvas is empty, behave like Replace

## Deterministic builder

-   The final UPDL graph is built by a deterministic local builder from the validated quiz plan (no LLM step here).
-   This stabilizes results, avoids hallucinations and reduces token usage.
-   Node names and coordinates are assigned by the builder for consistent layouts.
-   **Graph capacity**: supports up to 250 nodes and 500 edges (sufficient for 30 questions × 5 answers)

## Environment

Configure in `packages/server/.env`:

-   Test mode flags
    -   `SPACE_BUILDER_TEST_MODE=true|false`
    -   `SPACE_BUILDER_DISABLE_USER_CREDENTIALS=true|false`
-   Enable test providers (set to true as needed)
    -   `SPACE_BUILDER_TEST_ENABLE_OPENAI`
    -   `SPACE_BUILDER_TEST_ENABLE_OPENROUTER`
    -   `SPACE_BUILDER_TEST_ENABLE_GROQ`
    -   `SPACE_BUILDER_TEST_ENABLE_CEREBRAS`
    -   `SPACE_BUILDER_TEST_ENABLE_GIGACHAT`
    -   `SPACE_BUILDER_TEST_ENABLE_YANDEXGPT`
    -   `SPACE_BUILDER_TEST_ENABLE_GOOGLE`
    -   `SPACE_BUILDER_TEST_ENABLE_CUSTOM`
-   Per‑provider settings (required when enabled)
    -   OpenAI: `OPENAI_TEST_MODEL`, `OPENAI_TEST_API_KEY`, `OPENAI_TEST_BASE_URL` (optional)
    -   OpenRouter: `OPENROUTER_TEST_MODEL`, `OPENROUTER_TEST_API_KEY`, `OPENROUTER_TEST_BASE_URL` (required), `OPENROUTER_TEST_REFERER?`, `OPENROUTER_TEST_TITLE?`
    -   Groq: `GROQ_TEST_MODEL`, `GROQ_TEST_API_KEY`, `GROQ_TEST_BASE_URL`
    -   Cerebras: `CEREBRAS_TEST_MODEL`, `CEREBRAS_TEST_API_KEY`, `CEREBRAS_TEST_BASE_URL`
    -   GigaChat: `GIGACHAT_TEST_MODEL`, `GIGACHAT_TEST_API_KEY`, `GIGACHAT_TEST_BASE_URL` (OpenAI‑compatible endpoint)
    -   YandexGPT: `YANDEXGPT_TEST_MODEL`, `YANDEXGPT_TEST_API_KEY`, `YANDEXGPT_TEST_BASE_URL` (OpenAI‑compatible endpoint)
    -   Google: `GOOGLE_TEST_MODEL`, `GOOGLE_TEST_API_KEY`, `GOOGLE_TEST_BASE_URL` (OpenAI‑compatible endpoint)
    -   Custom: `CUSTOM_TEST_NAME`, `CUSTOM_TEST_MODEL`, `CUSTOM_TEST_API_KEY`, `CUSTOM_TEST_BASE_URL`, `CUSTOM_TEST_EXTRA_HEADERS_JSON` (optional JSON)

Notes:

-   No defaults are applied. Providers appear in the UI only when all required variables for that provider are set.
-   Legacy `groq_test` works only if `GROQ_TEST_MODEL`, `GROQ_TEST_API_KEY`, and `GROQ_TEST_BASE_URL` are all set.

## Endpoints and config

-   `GET /api/v1/space-builder/health` → `{ ok: true }`
-   `GET /api/v1/space-builder/config` → `{ testMode: boolean, disableUserCredentials: boolean, items: Array<{ id, provider, model, label }> }`
    -   The UI requests this endpoint with Authorization (Bearer) and retries after `/api/v1/auth/refresh` on 401.
    -   When `testMode=true` and `disableUserCredentials=true`, only the test items are shown.
    -   Otherwise, the UI merges test items with credential‑based models, sorts by label, and de‑duplicates by label.
-   `POST /api/v1/space-builder/prepare`
    -   Request: `{ sourceText: string (1..5000), additionalConditions?: string (0..500), selectedChatModel: { provider: string, modelName: string, credentialId?: string }, options: { questionsCount: 1..30, answersPerQuestion: 2..5 } }`
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
-   Generate: click Generate to build a UPDL graph from the plan; choose Append / Replace / New Space to apply to the canvas

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
        if (mode === 'append') return handleAppendGeneratedGraphBelow(graph)
        if (mode === 'newSpace') return handleNewSpaceFromGeneratedGraph(graph)
        handleApplyGeneratedGraph(graph)
    }}
/>
```

The UI fetches available models from existing Credentials and reads Test mode and options from `/api/v1/space-builder/config` using the shared authenticated API client.

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
