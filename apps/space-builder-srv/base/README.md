# Space Builder Server (BACKEND)

Backend API for prompt-to-flow generation in Universo Platformo (Spaces/Chatflow).

## Endpoints

-   `GET /api/v1/space-builder/health` → `{ ok: true }`
-   `GET /api/v1/space-builder/config` → `{ testMode: boolean }` (auth required)
-   `POST /api/v1/space-builder/generate`
    -   Body: `{ question: string, selectedChatModel: { provider: string, modelName: string, credentialId?: string } }`
    -   Response: `{ nodes: any[], edges: any[] }`

The service constructs a meta‑prompt, calls the selected LLM provider, extracts RAW JSON safely, validates using Zod (`GraphSchema`), and returns a graph ready to insert on the canvas.

## Environment

Configure in the main server env (`packages/server/.env`):

-   `SPACE_BUILDER_TEST_MODE=true|false` — toggles a synthetic "Test mode" provider in the UI
-   `GROQ_TEST_API_KEY=<key>` — optional test key for the `groq_test` provider used by Test mode

Notes:

-   Real provider keys (OpenAI/Azure/Groq) are resolved from Credentials via the platform’s credential service. No keys are stored in this package.
-   The Space Builder router is mounted at `/api/v1/space-builder` with authentication and rate‑limit middleware.

## Validation

`GraphSchema` (Zod) allows only `Space | Data | Entity | Component` nodes and limits graph size. The service also normalizes nodes to include safe defaults for UI rendering (`inputAnchors`, `inputParams`, `outputAnchors`, `tags`, `selected`, `version`).

## Behavior

-   The UI supports two modes: append (merge with ID remap and position offset) or replace (clear current canvas and apply).

## Commands

-   `pnpm build` – compile TypeScript
-   `pnpm lint` – run ESLint checks

## Notes

-   Do not import frontend dependencies here
-   Wire provider/credential lookup to the platform’s existing model providers
-   Keep prompts and normalization strict to prevent invalid graphs
