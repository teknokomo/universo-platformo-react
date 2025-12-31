# Space Builder Frontend (@universo/space-builder-frontend)

> 🧬 **TypeScript-first** | Modern React frontend for AI-powered UPDL flow generation

Frontend UI components for prompt-to-flow generation in Universo Platformo с детерминированным билдером и мультипровайдерной поддерыжкой ИИ.

## Package Information

| Property          | Value                   |
| ----------------- | ----------------------- |
| **Version**       | `0.1.0`                 |
| **Package Type**  | Workspace Package       |
| **Status**        | ✅ Active Development   |

### Key Features
- 🤖 AI-powered prompt-to-flow generation with multi-provider support
- 🎯 Deterministic UPDL builder for stable, hallucination-free results
- 🔧 Configurable test mode with server-side provider management
- 🌐 Full i18n support (EN/RU) with translation helpers
- ⚙️ Reusable React components for space building UI
- 🔄 Comprehensive API integration with revision capabilities

## Core Components

### SpaceBuilderFab
Floating action button component to trigger space generation dialog:
```tsx
import { SpaceBuilderFab } from '@universo/space-builder-frontend'

function MyCanvas() {
  return (
    <div>
      <SpaceBuilderFab onGenerate={handleGenerate} />
    </div>
  )
}
```

### SpaceBuilderDialog  
Modal dialog for prompt input and AI model selection:
```tsx
import { SpaceBuilderDialog } from '@universo/space-builder-frontend'

function GeneratorInterface() {
  return (
    <SpaceBuilderDialog
      open={isOpen}
      onClose={() => setIsOpen(false)}
      onGenerate={handleGenerate}
    />
  )
}
```

### useSpaceBuilder Hook
React hook for backend API integration:
```tsx
import { useSpaceBuilder } from '@universo/space-builder-frontend'

function SpaceGenerator() {
  const { prepare, revise, generate, isLoading } = useSpaceBuilder()
  
  const handleGenerate = async (prompt: string) => {
    const result = await generate(prompt)
    console.log('Generated UPDL:', result.updlFlow)
  }
}

## Deterministic builder (stable output)

-   The final UPDL graph is built by a deterministic local builder from a validated quiz plan (no LLM involved at this stage).
-   This stabilizes results, avoids hallucinations and reduces token usage.
-   Node naming and coordinates are fully assigned by our builder.

## Environment

The Space Builder UI reads a server-side config to toggle and configure Test mode:

-   On the server (`packages/flowise-core-backend/base/.env`):
    -   `SPACE_BUILDER_TEST_MODE=true|false`
    -   `SPACE_BUILDER_DISABLE_USER_CREDENTIALS=true|false`
    -   Enable one or more test providers via `SPACE_BUILDER_TEST_ENABLE_*` and set per‑provider `*_TEST_MODEL`, `*_TEST_API_KEY`, and `*_TEST_BASE_URL` when required (OpenAI base URL is optional).
-   Endpoint: `GET /api/v1/space-builder/config` (auth required) returns `{ testMode, disableUserCredentials, items }` where `items` is a list of test providers/models.

Credentials-based models are discovered from existing platform credentials and shown along with test models. When `disableUserCredentials=true`, only test models are available for selection.

## Behavior (creation mode)

-   The Settings step exposes a "Creation mode" select with three options:
    -   "Clear current canvas" — replaces the current canvas with the generated graph
    -   "Create a new space" — if the canvas has nodes, opens a new tab and transfers the graph there via `localStorage`; if empty, behaves like replace
    -   "Append to current canvas (as separate nodes)" — appends with ID remap and safe vertical offset below the lowest nodes

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
import { registerSpaceBuilderI18n } from '@universo/space-builder-frontend'
registerSpaceBuilderI18n(i18n)
```

```tsx
// Render FAB and handle onApply
import { SpaceBuilderFab } from '@universo/space-builder-frontend'
;<SpaceBuilderFab
    models={availableChatModels}
    onApply={(graph, mode) => {
        if (mode === 'append') return handleAppendGeneratedGraphBelow(graph)
        if (mode === 'newSpace') return handleNewSpaceFromGeneratedGraph(graph)
        handleApplyGeneratedGraph(graph) // replace
    }}
/>
```

## Commands

-   `pnpm build` – compile TS (CJS + ESM) and copy assets via gulp
-   `pnpm dev` – TypeScript watch (no asset copy)
-   `pnpm lint` – run ESLint checks

## Notes

-   Keep UI code isolated from server dependencies
-   Use the shared authenticated API client; the client refreshes on 401 automatically
-   No secrets are stored in this package; model keys are resolved on the server side
-   In Test mode, test providers/models are provided by `/api/v1/space-builder/config`; when credentials are disabled only test models can be selected; otherwise, the UI merges and deduplicates by label.

## Three-step flow (Prepare → Preview → Settings → Generate)

1. Prepare

-   Paste study material into the input (limit 5000 characters)
-   Optionally provide "Additional conditions" (limit 500 chars) to strictly guide the LLM
-   Choose number of questions (1–10) and answers per question (2–5)
-   Click "Prepare" → the UI calls `POST /api/v1/space-builder/prepare` and receives a `quizPlan`

2. Preview

-   The dialog shows the proposed questions and answers in a read‑only text field (exactly one correct per question)
-   Use the "What to change?" field (limit 500 chars) to request iterative edits via `/revise`; the field is cleared after a successful change and when returning Back and re‑preparing
-   You can click "Back" to adjust the source text or settings

3. Settings

-   Click "Configure" to open the generation settings (creation mode/collect names/show final)
-   Model selection is available from the gear icon in the bottom-left (Model settings modal)

4. Generate

-   Click "Generate" → the UI calls `POST /api/v1/space-builder/generate` with the `quizPlan`
-   The resulting UPDL graph is applied according to the chosen mode (Append / Replace / New Space)
