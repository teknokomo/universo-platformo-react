# Space Builder (Prompt‑to‑Flow)

Преобразует текстовый запрос пользователя в валидный граф Flow из узлов UPDL.

## Обзор

Space Builder состоит из двух пакетов:

-   `apps/space-builder-frt` — UI (FAB + MUI Dialog + i18n + hook)
-   `apps/space-builder-srv` — API (мета‑промпт, вызов провайдера, извлечение JSON, валидация Zod)

UI реализует трёхшаговый сценарий для создания квиза (Подготовить → Предпросмотр → Настройки → Сгенерировать):

-   Подготовить: вставьте учебный материал (1..5000 символов) и при необходимости добавьте «Дополнительные условия» (0..500 символов), которые строго направляют LLM; укажите числа (N вопросов, M ответов); нажмите «Подготовить», чтобы получить `quizPlan`
-   Предпросмотр: предложение квиза отображается в нередактируемом текстовом поле; ниже доступно поле «Что изменить?» (0..500 символов) и кнопка «Изменить» для итеративной правки; поле «Что изменить?» очищается при возврате «Назад» и повторной подготовке, а также после успешного применения изменений
-   Настройки: выберите опции генерации (Добавить к текущему графу, Собирать имена пользователей, Показывать финальный результат); выбор модели доступен по кнопке‑шестерёнке внизу слева диалога
-   Сгенерировать: создайте UPDL‑граф по плану и примените его на холст

UI может применить сгенерированный граф в двух режимах:

-   Append: дополнение текущего холста (ремап ID + сдвиг позиций)
-   Replace: полная замена текущего холста

## Детерминированный билдер

-   Финальный UPDL‑граф строится локальным детерминированным билдером из валидированного плана (на этом шаге LLM не используется).
-   Это стабилизирует результат, исключает галлюцинации и уменьшает расход токенов.
-   Имена узлов и их координаты назначаются билдером для консистентной раскладки.

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
-   `POST /api/v1/space-builder/prepare`
    -   Тело: `{ sourceText: string (1..5000), additionalConditions?: string (0..500), selectedChatModel: { provider: string, modelName: string, credentialId?: string }, options: { questionsCount: 1..10, answersPerQuestion: 2..5 } }`
    -   Ответ: `{ quizPlan: { items: Array<{ question: string, answers: Array<{ text: string, isCorrect: boolean }> }> } }`
-   `POST /api/v1/space-builder/generate`
    -   Тело: либо `{ question: string, selectedChatModel: {...} }`, либо `{ quizPlan: QuizPlan, selectedChatModel: {...} }`
    -   Ответ: `{ nodes: any[], edges: any[] }`
-   `POST /api/v1/space-builder/revise`
    -   Тело: `{ quizPlan: QuizPlan, instructions: string (1..500), selectedChatModel: { provider: string, modelName: string, credentialId?: string } }`
    -   Ответ: `{ quizPlan: QuizPlan }` (сохранены размеры; по одному правильному ответу на вопрос)

## Интеграция фронтенда

Зарегистрируйте переводы и отрендерьте FAB.

Трёхшаговый UI (Подготовить → Предпросмотр → Настройки → Сгенерировать):

-   Подготовить: вставьте материал (1..5000 символов) и при необходимости добавьте Дополнительные условия (0..500); задайте N×M, нажмите «Подготовить»; диалог покажет нередактируемый предпросмотр квиза
-   Предпросмотр: используйте поле «Что изменить?» для точечных правок; нажмите «Изменить», чтобы применить; поле очищается после успешной правки, а также после возврата «Назад» и повторной подготовки; затем нажмите «Настроить», чтобы перейти к экрану настроек
-   Настройки: выберите опции генерации; выбор модели доступен по кнопке‑шестерёнке внизу слева диалога
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
