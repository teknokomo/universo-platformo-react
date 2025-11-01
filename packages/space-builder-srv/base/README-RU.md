# Space Builder Server (@universo/space-builder-srv)

> 🧬 **TypeScript-first** | Modern Express.js backend for AI-powered UPDL generation

Серверный API для генерации графа из текстового запроса в Universo Platformo с детерминированным билдером и мультипровайдерной поддержкой ИИ.

## Эндпоинты

-   `GET /api/v1/space-builder/health` → `{ ok: true }`
-   `GET /api/v1/space-builder/config` (требуется авторизация)
    -   Ответ: `{ testMode: boolean, disableUserCredentials: boolean, items: Array<{ id, provider, model, label }> }`
-   `POST /api/v1/space-builder/prepare`
-   Тело: `{ sourceText: string (1..5000), additionalConditions?: string (0..500), selectedChatModel: { provider: string, modelName: string, credentialId?: string }, options: { questionsCount: 1..30, answersPerQuestion: 2..5 } }`
    -   Ответ: `{ quizPlan: { items: Array<{ question: string, answers: Array<{ text: string, isCorrect: boolean }> }> } }`
-   `POST /api/v1/space-builder/generate`
    -   Тело: либо `{ question: string, selectedChatModel: {...} }`, либо `{ quizPlan: QuizPlan, selectedChatModel: {...} }`
    -   Ответ: `{ nodes: any[], edges: any[] }`
-   `POST /api/v1/space-builder/revise`
    -   Тело: `{ quizPlan: QuizPlan, instructions: string (1..500), selectedChatModel: { provider: string, modelName: string, credentialId?: string } }`
    -   Ответ: `{ quizPlan: QuizPlan }`

## Детерминированный билдер (стабильный результат)

-   Финальный UPDL‑граф формируется локальным детерминированным билдером из валидированного плана (LLM на этом этапе не используется).
-   Это стабилизирует результат, исключает галлюцинации и уменьшает расход токенов.
-   Именование узлов и координаты полностью назначаются билдером.

## Переменные окружения

Настраиваются в основном env‑файле сервера (`packages/flowise-server/.env`):

-   Флаги тестового режима
    -   `SPACE_BUILDER_TEST_MODE=true|false`
    -   `SPACE_BUILDER_DISABLE_USER_CREDENTIALS=true|false`
-   Включение тест‑провайдеров (ставьте true по мере необходимости)
    -   `SPACE_BUILDER_TEST_ENABLE_OPENAI`
    -   `SPACE_BUILDER_TEST_ENABLE_OPENROUTER`
    -   `SPACE_BUILDER_TEST_ENABLE_GROQ`
    -   `SPACE_BUILDER_TEST_ENABLE_CEREBRAS`
    -   `SPACE_BUILDER_TEST_ENABLE_GIGACHAT`
    -   `SPACE_BUILDER_TEST_ENABLE_YANDEXGPT`
    -   `SPACE_BUILDER_TEST_ENABLE_GOOGLE`
    -   `SPACE_BUILDER_TEST_ENABLE_CUSTOM`
-   Параметры провайдеров (обязательны при включении)
    -   OpenAI: `OPENAI_TEST_MODEL`, `OPENAI_TEST_API_KEY`, `OPENAI_TEST_BASE_URL` (опционально)
    -   OpenRouter: `OPENROUTER_TEST_MODEL`, `OPENROUTER_TEST_API_KEY`, `OPENROUTER_TEST_BASE_URL` (обязателен), `OPENROUTER_TEST_REFERER?`, `OPENROUTER_TEST_TITLE?`
    -   Groq: `GROQ_TEST_MODEL`, `GROQ_TEST_API_KEY`, `GROQ_TEST_BASE_URL`
    -   Cerebras: `CEREBRAS_TEST_MODEL`, `CEREBRAS_TEST_API_KEY`, `CEREBRAS_TEST_BASE_URL`
    -   GigaChat: `GIGACHAT_TEST_MODEL`, `GIGACHAT_TEST_API_KEY`, `GIGACHAT_TEST_BASE_URL`
    -   YandexGPT: `YANDEXGPT_TEST_MODEL`, `YANDEXGPT_TEST_API_KEY`, `YANDEXGPT_TEST_BASE_URL`
    -   Google: `GOOGLE_TEST_MODEL`, `GOOGLE_TEST_API_KEY`, `GOOGLE_TEST_BASE_URL`
    -   Custom: `CUSTOM_TEST_NAME`, `CUSTOM_TEST_MODEL`, `CUSTOM_TEST_API_KEY`, `CUSTOM_TEST_BASE_URL`, `CUSTOM_TEST_EXTRA_HEADERS_JSON`

Примечания:

-   Никаких значений по умолчанию не используется; провайдеры появляются в `/config.items` только когда заданы все требуемые переменные для этого провайдера.
-   Унаследованный `groq_test` работает только при наличии трёх переменных: `GROQ_TEST_MODEL`, `GROQ_TEST_API_KEY`, `GROQ_TEST_BASE_URL`.
-   В обычном режиме реальные ключи провайдеров (OpenAI/Azure/Groq/…) резолвятся из Credentials через сервис платформы.
-   Роутер Space Builder монтируется под `/api/v1/space-builder` и защищён аутентификацией и rate‑limit.

## Валидация

`GraphSchema` (Zod) допускает только узлы `Space | Data | Entity | Component` и ограничивает размер графа. Сервис также нормализует узлы, чтобы гарантировать поля для UI (`inputAnchors`, `inputParams`, `outputAnchors`, `tags`, `selected`, `version`).

## Поведение

-   Когда `SPACE_BUILDER_TEST_MODE=true` и `SPACE_BUILDER_DISABLE_USER_CREDENTIALS=true`, сервер всегда использует один из настроенных тест‑провайдеров (OpenAI‑совместимый клиент через `baseURL + apiKey`).
-   Иначе сервер использует провайдера, выбранного в UI: OpenAI/Azure/Groq с ключами из Credentials; тест‑провайдеры применяются только если UI передаёт `provider: 'test:<id>'`.

## Команды

-   `pnpm build` — компиляция TypeScript
-   `pnpm lint` — проверка ESLint

## Тестирование

Запустите Jest для тестирования логики LLM‑сервиса и REST‑агрегации:

```bash
pnpm --filter @universo/space-builder-srv test
```

Тесты используют моки вызовов провайдеров через реализацию `callProvider` и переиспользуют хелперы из `@testing/backend/mocks` для предсказуемого поведения.

## Примечания

-   Не импортируйте фронтенд‑зависимости в этот пакет
-   Подключите резолвинг ключей к существующей инфраструктуре провайдеров
-   Держите промпты и нормализацию строгими, чтобы избегать невалидных графов
