# Space Builder Server (BACKEND)

Backend API for prompt-to-flow generation in Universo Platformo (Spaces/Chatflow).

## Endpoints

-   `GET /api/v1/space-builder/health` → `{ ok: true }`
-   `GET /api/v1/space-builder/config` → `{ testMode: boolean }` (auth required)
-   `POST /api/v1/space-builder/prepare`
    -   Body: `{ sourceText: string (1..5000), selectedChatModel: { provider: string, modelName: string, credentialId?: string }, options: { questionsCount: 1..10, answersPerQuestion: 2..5 } }`
    -   Response: `{ quizPlan: { items: Array<{ question: string, answers: Array<{ text: string, isCorrect: boolean }> }> } }`
-   `POST /api/v1/space-builder/generate`
    -   Body: either `{ question: string, selectedChatModel: {...} }` or `{ quizPlan: QuizPlan, selectedChatModel: {...} }`
    -   Response: `{ nodes: any[], edges: any[] }`

## Deterministic builder (stable output)

-   The final UPDL graph is produced by a deterministic local builder from a validated quiz plan (no LLM involved).
-   This stabilizes results, avoids hallucinations, and reduces token usage.
-   Node naming and coordinates are fully assigned by the builder.

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
