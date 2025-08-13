# Space Builder Server (BACKEND)

Backend API for prompt-to-flow generation in Universo Platformo (Spaces/Chatflow).

## Endpoints

-   `GET /api/v1/space-builder/health` → `{ ok: true }`
-   `GET /api/v1/space-builder/config` (auth required)
    -   Response: `{ testMode: boolean, disableUserCredentials: boolean, items: Array<{ id, provider, model, label }> }`
-   `POST /api/v1/space-builder/prepare`
    -   Body: `{ sourceText: string (1..5000), additionalConditions?: string (0..500), selectedChatModel: { provider: string, modelName: string, credentialId?: string }, options: { questionsCount: 1..10, answersPerQuestion: 2..5 } }`
    -   Response: `{ quizPlan: { items: Array<{ question: string, answers: Array<{ text: string, isCorrect: boolean }> }> } }`
-   `POST /api/v1/space-builder/generate`
    -   Body: either `{ question: string, selectedChatModel: {...} }` or `{ quizPlan: QuizPlan, selectedChatModel: {...} }`
    -   Response: `{ nodes: any[], edges: any[] }`
-   `POST /api/v1/space-builder/revise`
    -   Body: `{ quizPlan: QuizPlan, instructions: string (1..500), selectedChatModel: { provider: string, modelName: string, credentialId?: string } }`
    -   Response: `{ quizPlan: QuizPlan }`

## Deterministic builder (stable output)

-   The final UPDL graph is produced by a deterministic local builder from a validated quiz plan (no LLM involved).
-   This stabilizes results, avoids hallucinations, and reduces token usage.
-   Node naming and coordinates are fully assigned by the builder.

## Environment

Configure in the main server env (`packages/server/.env`):

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
    -   GigaChat: `GIGACHAT_TEST_MODEL`, `GIGACHAT_TEST_API_KEY`, `GIGACHAT_TEST_BASE_URL`
    -   YandexGPT: `YANDEXGPT_TEST_MODEL`, `YANDEXGPT_TEST_API_KEY`, `YANDEXGPT_TEST_BASE_URL`
    -   Google: `GOOGLE_TEST_MODEL`, `GOOGLE_TEST_API_KEY`, `GOOGLE_TEST_BASE_URL`
    -   Custom: `CUSTOM_TEST_NAME`, `CUSTOM_TEST_MODEL`, `CUSTOM_TEST_API_KEY`, `CUSTOM_TEST_BASE_URL`, `CUSTOM_TEST_EXTRA_HEADERS_JSON`

Notes:

-   No defaults are applied; providers appear in `/config.items` only when all required variables are set for that provider.
-   Legacy `groq_test` works only if `GROQ_TEST_MODEL`, `GROQ_TEST_API_KEY`, and `GROQ_TEST_BASE_URL` are set.
-   Real provider keys (OpenAI/Azure/Groq/…) are resolved from Credentials via the platform’s credential service in non‑test mode.
-   The Space Builder router is mounted at `/api/v1/space-builder` with authentication and rate‑limit middleware.

## Validation

`GraphSchema` (Zod) allows only `Space | Data | Entity | Component` nodes and limits graph size. The service also normalizes nodes to include safe defaults for UI rendering (`inputAnchors`, `inputParams`, `outputAnchors`, `tags`, `selected`, `version`).

## Behavior

-   When `SPACE_BUILDER_TEST_MODE=true` and `SPACE_BUILDER_DISABLE_USER_CREDENTIALS=true`, the server always uses one of the configured test providers (OpenAI‑compatible client via `baseURL + apiKey`).
-   Otherwise, the server uses the provider selected by the UI: OpenAI/Azure/Groq with credentials resolved via the platform service; test providers are used only when the UI passes `provider: 'test:<id>'`.

## Commands

-   `pnpm build` – compile TypeScript
-   `pnpm lint` – run ESLint checks

## Notes

-   Do not import frontend dependencies here
-   Wire provider/credential lookup to the platform’s existing model providers
-   Keep prompts and normalization strict to prevent invalid graphs
