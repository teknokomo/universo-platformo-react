# Space Builder (Prompt‑to‑Flow)

Преобразует текстовый запрос пользователя в валидный граф Flow из узлов UPDL.

## Обзор

Space Builder состоит из двух пакетов:

-   `apps/space-builder-frt` — UI (FAB + MUI Dialog + i18n + hook)
-   `apps/space-builder-srv` — API (мета‑промпт, вызов провайдера, извлечение JSON, валидация Zod)

UI реализует двухшаговый сценарий для создания квиза:

-   Подготовить: вставьте учебный материал (1..2000 символов), выберите модель и числа (N вопросов, M ответов), получите `quizPlan`
-   Сгенерировать: просмотрите предпросмотр квиза и затем сгенерируйте UPDL‑граф из плана

UI может применить сгенерированный граф в двух режимах:

-   Append: дополнение текущего холста (ремап ID + сдвиг позиций)
-   Replace: полная замена текущего холста

## Переменные окружения

Настройка в `packages/server/.env`:

```
SPACE_BUILDER_TEST_MODE=true|false
GROQ_TEST_API_KEY=...
```

-   `SPACE_BUILDER_TEST_MODE` включает пункт "Test mode" в UI
-   `GROQ_TEST_API_KEY` используется только при включённом тестовом режиме (провайдер `groq_test`)

`GET /api/v1/space-builder/config` возвращает `{ testMode: boolean }` и используется UI, чтобы решить, показывать ли тестовый режим.

## Эндпоинты

-   `GET /api/v1/space-builder/health` → `{ ok: true }`
-   `GET /api/v1/space-builder/config` → `{ testMode: boolean }`
-   `POST /api/v1/space-builder/generate`
    -   Тело: `{ question: string, selectedChatModel: { provider: string, modelName: string, credentialId?: string } }`
    -   Ответ: `{ nodes: any[], edges: any[] }`

## Интеграция фронтенда

Зарегистрируйте переводы и отрендерьте FAB.

Двухшаговый UI (Подготовить → Предпросмотр → Сгенерировать):

-   Подготовить: вставьте материал (1..2000 символов), выберите модель, задайте N×M, нажмите «Подготовить»; диалог покажет нередактируемый предпросмотр квиза
-   Сгенерировать: нажмите «Сгенерировать», чтобы построить UPDL‑граф из плана; примените «Добавить» или «Заменить» на холсте

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

UI получает список моделей из существующих Credentials и читает флаг тестового режима из `/api/v1/space-builder/config` через общий авторизованный API‑клиент.

## Сборка

-   Фронтенд: двойная сборка (CJS + ESM); `tsconfig.esm.json` улучшает бандлинг и tree‑shaking в ESM‑инструментах
-   Бэкенд: одиночная CJS‑сборка

Команды:

```
pnpm build --filter @universo/space-builder-frt
pnpm build --filter @universo/space-builder-srv
```

## Примечания

-   Секреты не хранятся на фронтенде; ключи резолвятся на стороне сервера
-   Сервер валидирует JSON через Zod и нормализует узлы для стабильного рендера в UI
