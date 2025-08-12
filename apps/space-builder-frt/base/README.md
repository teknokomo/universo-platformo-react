# Space Builder Frontend (FRONTEND)

Frontend UI components for prompt-to-flow generation in Universo Platformo (Spaces/Chatflow).

## Overview

This package provides reusable React components:

-   SpaceBuilderFab: floating action button to open the generator dialog
-   SpaceBuilderDialog: modal to type a request and select a chat model/credential
-   Hook `useSpaceBuilder` to call the backend API `/api/v1/space-builder/generate`
-   I18n helper `registerSpaceBuilderI18n` to merge translations (EN/RU) into the host app

## Deterministic builder (stable output)

-   The final UPDL graph is built by a deterministic local builder from a validated quiz plan (no LLM involved at this stage).
-   This stabilizes results, avoids hallucinations and reduces token usage.
-   Node naming and coordinates are fully assigned by our builder.

## Environment

The Space Builder UI reads a server-side config to toggle Test mode:

-   On the server (`packages/server/.env`):
    -   `SPACE_BUILDER_TEST_MODE=true|false` — enables a synthetic provider entry "Test mode" in the UI
    -   `GROQ_TEST_API_KEY=<key>` — optional key for Test mode (only used when test mode is enabled)
-   Endpoint: `GET /api/v1/space-builder/config` (auth required) returns `{ testMode: boolean }`

Credentials-based models are discovered from existing Flowise credentials (OpenAI, AzureOpenAI, Groq) and shown in the model dropdown.

## Behavior (append vs replace)

-   When the option "Append to current flow" is enabled, the generated graph is merged:
    -   New node IDs are remapped to avoid collisions
    -   Node positions are offset so the new graph appears near the current one
-   When the option is disabled, the current canvas is replaced entirely by the generated graph

## Why `tsconfig.esm.json`

This package is used as a library inside the Flow editor. For better bundling and tree-shaking in ESM-aware toolchains (Vite/ESBuild), we produce a dual build:

-   `tsconfig.json` → CommonJS output in `dist/`
-   `tsconfig.esm.json` → ESM output in `dist/esm/`

The `package.json` `exports` field points imports to ESM and `require` to CJS. This avoids interop pitfalls and results in smaller bundles. If you prefer a single build, you may remove the ESM step and `exports.import`, but tree-shaking quality may degrade.

## Usage

1. Add this package as a workspace dependency and build it.
2. Register translations once at app startup and render the FAB on the canvas.

```ts
// Register translations once
import i18n from '@/i18n'
import { registerSpaceBuilderI18n } from '@universo/space-builder-frt'
registerSpaceBuilderI18n(i18n)
```

```tsx
// Render FAB and handle onApply
import { SpaceBuilderFab } from '@universo/space-builder-frt'
;<SpaceBuilderFab
    models={availableChatModels}
    onApply={(graph, mode) => {
        if (mode === 'append') return handleAppendGeneratedGraph(graph)
        handleApplyGeneratedGraph(graph)
    }}
/>
```

## Commands

-   `pnpm build` – compile TS (CJS + ESM) and copy assets via gulp
-   `pnpm dev` – TypeScript watch (no asset copy)
-   `pnpm lint` – run ESLint checks

## Notes

-   Keep UI code isolated from server dependencies
-   Use the shared Axios client in the host app for authenticated calls
-   No secrets are stored in this package; model keys are resolved on the server side

## Two-step flow (Prepare → Preview → Generate)

1. Prepare

-   Paste study material into the input (limit 5000 characters)
-   Select a chat model/credential
-   Choose number of questions (1–10, default 1) and answers per question (2–5, default 2)
-   Click "Prepare" → the UI calls `POST /api/v1/space-builder/prepare` and receives a `quizPlan`

2. Preview

-   The dialog shows the proposed questions and answers (exactly one correct per question)
-   Editing is not available at this stage
-   You can click "Back" to adjust the source text or settings

3. Generate

-   Click "Generate" → the UI calls `POST /api/v1/space-builder/generate` with the `quizPlan`
-   The resulting UPDL graph is applied to the canvas (Append or Replace based on the checkbox)

Notes:

-   In test mode (`SPACE_BUILDER_TEST_MODE=true` on the server), if the host app supplies no models, the UI exposes a synthetic provider entry `Groq Test: llama-3-8b-8192` so that the feature works without user credentials.
-   Endpoints are protected; the client uses a refresh flow on 401 to retry requests.
