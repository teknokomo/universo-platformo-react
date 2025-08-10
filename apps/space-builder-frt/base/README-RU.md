# Space Builder Frontend (Фронтенд)

Компоненты UI для генерации графа из текстового запроса (Spaces/Chatflow) в Universo Platformo.

## Обзор

Пакет предоставляет переиспользуемые React‑компоненты:

-   SpaceBuilderFab: плавающая кнопка для открытия диалога генерации
-   SpaceBuilderDialog: модальное окно для ввода запроса и выбора модели/credential
-   Хук `useSpaceBuilder` для вызова серверного API `/api/v1/space-builder/generate`
-   Помощник i18n `registerSpaceBuilderI18n` для слияния переводов (EN/RU) в хост‑приложение

## Переменные окружения

UI Space Builder читает серверную конфигурацию, чтобы включать тестовый режим:

-   На сервере (`packages/server/.env`):
    -   `SPACE_BUILDER_TEST_MODE=true|false` — включает синтетический пункт провайдера "Test mode" в UI
    -   `GROQ_TEST_API_KEY=<key>` — необязательный ключ для тестового режима (используется только если режим включён)
-   Эндпоинт: `GET /api/v1/space-builder/config` (требуется авторизация) возвращает `{ testMode: boolean }`

Модели на основе Credentials подтягиваются из существующих учетных данных Flowise (OpenAI, AzureOpenAI, Groq) и отображаются в выпадающем списке моделей.

## Поведение (append vs replace)

-   Если включена опция "Добавить к текущему графу", сгенерированный граф дополняет текущий:
    -   Новые ID узлов ремапятся, чтобы избежать конфликтов
    -   Позиции узлов сдвигаются, чтобы новый граф появился рядом
-   Если опция выключена — текущий холст полностью заменяется сгенерированным графом

## Зачем нужен `tsconfig.esm.json`

Пакет используется как библиотека внутри редактора Flow. Чтобы улучшить бандлинг и tree‑shaking в ESM‑инструментах (Vite/ESBuild), собираем два таргета:

-   `tsconfig.json` → CommonJS‑сборка в `dist/`
-   `tsconfig.esm.json` → ESM‑сборка в `dist/esm/`

Поле `exports` в `package.json` указывает импортам на ESM, а `require` — на CJS. Это предотвращает проблемы interop и уменьшает размер бандла. Если необходим один таргет, можно убрать ESM‑шаг и `exports.import`, но качество tree‑shaking может снизиться.

## Использование

1. Подключите пакет как зависимость воркспейса и соберите его.
2. Один раз зарегистрируйте переводы при старте приложения и отрендерьте FAB на холсте.

```ts
// Регистрация переводов
import i18n from '@/i18n'
import { registerSpaceBuilderI18n } from '@universo/space-builder-frt'
registerSpaceBuilderI18n(i18n)
```

```tsx
// Рендер FAB и обработка onApply
import { SpaceBuilderFab } from '@universo/space-builder-frt'

;<SpaceBuilderFab
    models={availableChatModels}
    onApply={(graph, mode) => {
        if (mode === 'append') return handleAppendGeneratedGraph(graph)
        handleApplyGeneratedGraph(graph)
    }}
/>
```

## Команды

-   `pnpm build` — компиляция TS (CJS + ESM) и копирование ассетов через gulp
-   `pnpm dev` — watch TypeScript (без копирования ассетов)
-   `pnpm lint` — проверка ESLint

## Примечания

-   Изолируйте UI‑код от серверных зависимостей
-   Для авторизованных запросов используйте общий Axios‑клиент хост‑приложения
-   Секреты не хранятся в этом пакете; ключи моделей резолвятся на стороне сервера
