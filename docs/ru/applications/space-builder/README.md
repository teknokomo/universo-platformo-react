# Space Builder (Prompt‑to‑Flow)

Преобразует текстовый запрос пользователя в валидный граф Flow из узлов UPDL.

## Обзор

Space Builder состоит из двух пакетов:

-   `apps/space-builder-frt` — UI (FAB + MUI Dialog + i18n + hook)
-   `apps/space-builder-srv` — API (мета‑промпт, вызов провайдера, извлечение JSON, валидация Zod)

UI реализует трёхшаговый сценарий для создания квиза (Подготовить → Предпросмотр → Настройки → Сгенерировать):

-   Подготовить: вставьте учебный материал (1..5000 символов) и при необходимости добавьте «Дополнительные условия» (0..500 символов), которые строго направляют LLM; укажите числа (N вопросов, M ответов); нажмите «Подготовить», чтобы получить `quizPlan`
-   Предпросмотр: предложение квиза отображается в нередактируемом поле; ниже доступно поле «Что изменить?» (0..500 символов) и кнопка «Изменить» для итеративной правки; поле очищается при возврате «Назад» и повторной подготовке, а также после успешного применения
-   Настройки: выберите опции генерации (Вариант создания графа, Собирать имена пользователей, Показывать финальный результат); выбор модели доступен по кнопке‑шестерёнке внизу слева диалога
-   Сгенерировать: соберите UPDL‑граф по плану и примените его на холст

UI может применить сгенерированный граф в трёх режимах (Вариант создания графа):

-   Append: дополнение текущего холста (ремап ID + безопасный вертикальный отступ ниже самых нижних узлов)
-   Replace: полная замена текущего холста
-   Создать новое пространство: если на холсте есть узлы, открыть новую вкладку `.../chatflows/new` и передать граф через `localStorage.duplicatedFlowData`; если холст пуст, действовать как Replace

## Детерминированный билдер

-   Финальный UPDL‑граф строится локальным детерминированным билдером из валидированного плана (на этом шаге LLM не используется).
-   Это стабилизирует результат, исключает галлюцинации и уменьшает расход токенов.
-   Имена узлов и их координаты назначаются билдером для консистентной раскладки.

## Переменные окружения

Настройка в `packages/server/.env`:

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
    -   GigaChat: `GIGACHAT_TEST_MODEL`, `GIGACHAT_TEST_API_KEY`, `GIGACHAT_TEST_BASE_URL` (OpenAI‑совместимый endpoint)
    -   YandexGPT: `YANDEXGPT_TEST_MODEL`, `YANDEXGPT_TEST_API_KEY`, `YANDEXGPT_TEST_BASE_URL` (OpenAI‑совместимый endpoint)
    -   Google: `GOOGLE_TEST_MODEL`, `GOOGLE_TEST_API_KEY`, `GOOGLE_TEST_BASE_URL` (OpenAI‑совместимый endpoint)
    -   Custom: `CUSTOM_TEST_NAME`, `CUSTOM_TEST_MODEL`, `CUSTOM_TEST_API_KEY`, `CUSTOM_TEST_BASE_URL`, `CUSTOM_TEST_EXTRA_HEADERS_JSON` (опционально JSON)

Примечания:

-   Никаких значений по умолчанию не используется. Провайдеры появляются в UI только если заданы все требуемые переменные для этого провайдера.
-   Унаследованный `groq_test` работает только если заданы все три: `GROQ_TEST_MODEL`, `GROQ_TEST_API_KEY`, `GROQ_TEST_BASE_URL`.

## Эндпоинты и конфигурация

-   `GET /api/v1/space-builder/health` → `{ ok: true }`
-   `GET /api/v1/space-builder/config` → `{ testMode: boolean, disableUserCredentials: boolean, items: Array<{ id, provider, model, label }> }`
    -   UI запрашивает эндпоинт с Authorization (Bearer) и при 401 выполняет `/api/v1/auth/refresh`, затем повторяет запрос.
    -   Если `testMode=true` и `disableUserCredentials=true`, показываются только тестовые модели.
    -   В ином случае UI объединяет тестовые модели с моделями из Credentials, сортирует по label и удаляет дубликаты по label.
-   `POST /api/v1/space-builder/prepare`
    -   Тело: `{ sourceText: string (1..5000), additionalConditions?: string (0..500), selectedChatModel: { provider: string, modelName: string, credentialId?: string }, options: { questionsCount: 1..10, answersPerQuestion: 2..5 } }`
    -   Ответ: `{ quizPlan: { items: Array<{ question: string, answers: Array<{ text: string, isCorrect: boolean }> }> } }`
-   `POST /api/v1/space-builder/generate`
    -   Тело: либо `{ question: string, selectedChatModel: {...} }`, либо `{ quizPlan: QuizPlan, selectedChatModel: {...} }`
    -   Ответ: `{ nodes: any[], edges: any[] }`
-   `POST /api/v1/space-builder/revise`
    -   Тело: `{ quizPlan: QuizPlan, instructions: string (1..500), selectedChatModel: { provider: string, modelName: string, credentialId?: string } }`
    -   Ответ: `{ quizPlan: QuizPlan }` (сохранены размеры; ровно один правильный ответ на вопрос)

## Интеграция фронтенда

Зарегистрируйте переводы и отрендерьте FAB.

Трёхшаговый UI (Подготовить → Предпросмотр → Настройки → Сгенерировать):

-   Подготовить: вставьте материал (1..5000 символов) и при необходимости добавьте «Дополнительные условия» (0..500); укажите N×M, нажмите «Подготовить»; диалог покажет нередактируемый предпросмотр
-   Предпросмотр: используйте поле «Что изменить?» для точечных правок; нажмите «Изменить», чтобы применить; поле очищается после успешной правки, а также после возврата «Назад» и повторной подготовки; нажмите «Настроить», чтобы перейти к настройкам
-   Настройки: выберите опции генерации; выбор модели доступен по кнопке‑шестерёнке внизу слева диалога
-   Сгенерировать: нажмите «Сгенерировать», чтобы построить UPDL‑граф из плана; примените Append / Replace / New Space на холсте

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

UI получает список моделей из Credentials и читает параметры тестового режима из `/api/v1/space-builder/config` через общий авторизованный клиент.

## Сборка

-   Фронтенд: двойная сборка (CJS + ESM); `tsconfig.esm.json` улучшает бандлинг и tree‑shaking в ESM‑инструментах
-   Бэкенд: одиночная CJS‑сборка

Команды:

```
pnpm build --filter @universo/space-builder-frt
pnpm build --filter @universo/space-builder-srv
```

## Примечания

-   Секреты не хранятся на фронтенде; ключи резолвятся на сервере
-   Сервер валидирует JSON через Zod и нормализует узлы для стабильного рендера в UI
