# Space Builder Server (Бэкенд)

Серверный API для генерации графа из текстового запроса (Spaces/Chatflow) в Universo Platformo.

## Эндпоинты

-   `GET /api/v1/space-builder/health` → `{ ok: true }`
-   `GET /api/v1/space-builder/config` → `{ testMode: boolean }` (требуется авторизация)
-   `POST /api/v1/space-builder/prepare`
    -   Тело: `{ sourceText: string (1..5000), selectedChatModel: { provider: string, modelName: string, credentialId?: string }, options: { questionsCount: 1..10, answersPerQuestion: 2..5 } }`
    -   Ответ: `{ quizPlan: { items: Array<{ question: string, answers: Array<{ text: string, isCorrect: boolean }> }> } }`
-   `POST /api/v1/space-builder/generate`
    -   Тело: либо `{ question: string, selectedChatModel: {...} }`, либо `{ quizPlan: QuizPlan, selectedChatModel: {...} }`
    -   Ответ: `{ nodes: any[], edges: any[] }`

## Детерминированный билдер (стабильный результат)

-   Финальный UPDL‑граф формируется локальным детерминированным билдером из валидированного плана квиза (LLM на этом этапе не используется).
-   Это стабилизирует результат, исключает галлюцинации и уменьшает расход токенов.
-   Именование узлов и координаты полностью назначаются билдером.

## Переменные окружения

Настраиваются в основном env‑файле сервера (`packages/server/.env`):

-   `SPACE_BUILDER_TEST_MODE=true|false` — включает синтетический провайдер "Test mode" в UI
-   `GROQ_TEST_API_KEY=<key>` — необязательный тестовый ключ для провайдера `groq_test` (используется в тестовом режиме)

Примечания:

-   Реальные ключи провайдеров (OpenAI/Azure/Groq) резолвятся из Credentials через сервис платформы. В этом пакете ключи не хранятся.
-   Роутер Space Builder монтируется под `/api/v1/space-builder` и защищён аутентификацией и rate‑limit.

## Валидация

`GraphSchema` (Zod) допускает только узлы `Space | Data | Entity | Component` и ограничивает размер графа. Сервис также нормализует узлы, чтобы гарантировать поля для UI (`inputAnchors`, `inputParams`, `outputAnchors`, `tags`, `selected`, `version`).

## Поведение

-   UI поддерживает 2 режима: дополнение (append, с ремапом ID и сдвигом позиций) и замена (replace, полная очистка холста).

## Команды

-   `pnpm build` — компиляция TypeScript
-   `pnpm lint` — проверка ESLint

## Примечания

-   Не импортируйте фронтенд‑зависимости в этот пакет
-   Подключите резолвинг ключей к существующей инфраструктуре провайдеров
-   Держите промпты и нормализацию строгими, чтобы избегать невалидных графов
