# Publish Service (@universo/publish-srv)

Бэкенд-сервис для системы публикаций в Universo Platformo, рефакторизованный в workspace package для модульности, чистой интеграции и совместного использования типов.

## Структура проекта

Проект структурирован как **workspace package** (`@universo/publish-srv`), обеспечивая чёткое разделение и управление зависимостями внутри монорепозитория:

```
packages/publish-srv/base/
├── package.json              # Конфигурация пакета со scoped именем "@universo/publish-srv"
├── tsconfig.json             # Конфигурация TypeScript
└── src/
   ├── controllers/
   │  └── publishController.ts   # REST API контроллер (экспортируется)
   ├── services/
   │  └── FlowDataService.ts     # Бизнес-логика для получения данных потока
   ├── routes/
   │  └── createPublishRoutes.ts # Фабрика Express маршрутов (экспортируется)
   ├── types/
   │  └── publication.types.ts  # Общие UPDL типы (экспортируются)
   └── index.ts                 # Точка входа со всеми экспортами пакета
```

### Архитектура Workspace Package

Этот сервис реализован как **pnpm workspace package**, который:

-   **Имя пакета**: `@universo/publish-srv` (scoped имя для организации)
-   **Интеграция**: Используется как зависимость `"@universo/publish-srv": "workspace:*"` в основном сервере.
-   **Экспорты**: Ключевые модули (routes, types, services, controllers) экспортируются через `src/index.ts` для чистого контролируемого импорта.
-   **Совместное использование типов**: Выступает в качестве источника истины для UPDL типов (`IUPDLSpace`, `IUPDLObject` и т.д.), которые используются фронтенд-пакетом `@universo/publish-frt`.

## Возможности

-   **Управление публикациями**: Предоставляет API endpoints для создания и получения записей публикаций.
-   **Провайдер данных потока**: Предоставляет сырые `flowData` из базы данных, делегируя всю обработку UPDL фронтенду.
-   **Централизованные типы**: Экспортирует общие UPDL и типы, связанные с публикацией, для использования на всей платформе.
-   **Модульность и развязанность**: Полностью независим от бизнес-логики `packages/flowise-server`. Больше не содержит код генерации UPDL.
-   **Готовность к PlayCanvas**: Те же endpoints для сырых данных используются строителем и шаблонами PlayCanvas.
-   **Интеграция Canvas**: Полностью поддерживает новую структуру Canvas при сохранении обратной совместимости с ChatFlow.
-   **Публикация чатботов**: Обрабатывает публикацию чатботов, используя конфигурацию на основе Canvas, хранящуюся в поле `chatbotConfig`.

## Интеграция с основным сервером Flowise

Сервис тесно интегрирован с основным сервером Flowise, используя его основную инфраструктуру, оставаясь при этом модульным.

### Асинхронная инициализация маршрутов

**Критическое исправление**: Для решения race conditions, когда маршруты регистрировались до готовности подключения к базе данных, этот пакет использует **асинхронную фабрику маршрутов**, аналогично `@universo/profile-srv`.

// Основной сервер (упрощённо)
import { createPublishRoutes } from '@universo/publish-srv'

// ... после AppDataSource.initialize()
const publishRoutes = createPublishRoutes(AppDataSource)
this.app.use('/api/v1/publish', publishRoutes)
```

### Ключевые точки интеграции

1.  **Регистрация маршрутов**: Асинхронная функция `createPublishRoutes` обеспечивает безопасную регистрацию маршрутов.
2.  **Доступ к базе данных**: `FlowDataService` напрямую обращается к базе данных Flowise через TypeORM `DataSource`, переданный из основного сервера.
3.  **Аутентификация**: Наследует middleware JWT-аутентификации основного сервера, который применяется перед маршрутами пакета.

## REST API

API теперь упрощён для обработки записей публикаций и предоставления сырых данных потока.

### Endpoints:

#### Canvas-based Endpoints (Новые)
-   `POST /api/v1/publish/canvas` - Создаёт или обновляет запись публикации Canvas.
-   `GET /api/v1/publish/canvas/public/:canvasId` - Получает сырые `flowData` для заданного Canvas.
-   `GET /api/v1/publish/canvas/:canvasId` - Прямой доступ к данным потока Canvas для streaming.

#### Legacy Endpoints (Обратная совместимость)
-   `POST /api/v1/publish/arjs` - Создаёт или обновляет запись публикации. Принимает `canvasId` (устаревший `chatflowId` всё ещё принимается для совместимости).
-   `GET /api/v1/publish/arjs/public/:publicationId` - Получает сырые `flowData` для заданной публикации.
-   `GET /api/v1/publish/arjs/stream/:canvasId` - Устаревший streaming endpoint (deprecated, используйте Canvas endpoints).

#### Chatbot Endpoints
-   `GET /api/v1/bots/:canvasId/config` - Получает конфигурацию чатбота из Canvas.
-   `GET /api/v1/bots/:canvasId` - Рендерит интерфейс чатбота для Canvas.
-   `GET /api/v1/bots/:canvasId/stream/:sessionId?` - Предоставляет функциональность streaming чата.

### `POST /api/v1/publish/canvas` (Новый)

Создаёт запись публикации, связанную с `canvasId`. Тело должно содержать ID canvas и любые метаданные, требуемые фронтендом.

**Пример запроса:**

```json
{
    "canvasId": "778d565f-e9cc-4dd8-b8ef-7a097ecb18f3",
    "isPublic": true,
    "projectName": "My AR Experience",
    "libraryConfig": {
        "arjs": { "version": "3.4.7", "source": "kiberplano" },
        "aframe": { "version": "1.7.1", "source": "official" }
    }
}
```

### `POST /api/v1/publish/arjs` (Legacy)

Устаревший alias для обратной совместимости. Принимает тот же payload, что и новый endpoint, но проксирует `canvasId` при наличии. `chatflowId` поддерживается только для устаревших клиентов и должен быть удалён из новых интеграций.

**Пример запроса (устаревший клиент):**

```json
{
    "canvasId": "778d565f-e9cc-4dd8-b8ef-7a097ecb18f3",
    "chatflowId": "778d565f-e9cc-4dd8-b8ef-7a097ecb18f3", // Опциональное устаревшее поле
    "isPublic": true,
    "projectName": "My AR Experience"
}
```

### `GET /api/v1/publish/canvas/public/:canvasId` (Новый)

Получает сырые `flowData` (в виде JSON строки) и конфигурацию для заданного `canvasId`. Фронтенд отвечает за парсинг и обработку этих данных с помощью `UPDLProcessor`.

**Пример ответа:**

```json
{
    "success": true,
    "publicationId": "778d565f-e9cc-4dd8-b8ef-7a097ecb18f3",
    "canvasId": "778d565f-e9cc-4dd8-b8ef-7a097ecb18f3",
    "flowData": "{\"nodes\":[...],\"edges\":[...]}",
    "libraryConfig": {
        "arjs": { "version": "3.4.7", "source": "kiberplano" },
        "aframe": { "version": "1.7.1", "source": "official" }
    },
    "renderConfig": {
        "arDisplayType": "wallpaper",
        "wallpaperType": "standard"
    },
    "playcanvasConfig": {
        "gameMode": "singleplayer"
    }
}
```

### `GET /api/v1/publish/arjs/public/:publicationId` (Legacy)

Получает сырые `flowData` для заданного `publicationId` (который может быть либо `canvasId`, либо устаревшим `chatflowId`). Поддерживает обратную совместимость.

### Конфигурация чатбота

Конфигурация чатбота извлекается из поля Canvas `chatbotConfig`:

```json
{
    "botType": "chat",
    "title": "My Chat Bot",
    "backgroundColor": "#ffffff",
    "textColor": "#303235",
    "allowedOrigins": ["https://example.com"]
}
```

## Конфигурация рендера AR.js в публичном API

Публичный endpoint AR.js теперь возвращает опциональный `renderConfig`, полученный из `chatbotConfig.arjs`, для управления рендером без маркера или с маркером на фронтенде.

### Расширение ответа

```json
{
  "success": true,
  "publicationId": "<id>",
  "flowData": "{...}",
  "libraryConfig": { /* существующие */ },
  "renderConfig": {
    "arDisplayType": "wallpaper" | "marker",
    "wallpaperType": "standard",
    "markerType": "preset" | "pattern",
    "markerValue": "hiro" | "<pattern-url>"
  }
}
```

### Источник значений

-   Извлекается `FlowDataService` из `canvas.chatbotConfig.arjs`, если присутствует.
-   Отсутствует для устаревших записей; фронтенд переключается в режим маркера.

## Сводка архитектурных изменений

-   **Развязанность**: Логика `utilBuildUPDLflow` была полностью **удалена** из бэкенда и перенесена в класс `UPDLProcessor` в пакете `publish-frt`.
-   **Единственная ответственность**: Этот сервис теперь отвечает только за взаимодействие с базой данных (CRUD для публикаций, получение `flowData`) и больше не участвует в логике UPDL.
-   **Разработка на основе типов**: Этот пакет является источником истины для всех типов, связанных с публикацией, обеспечивая согласованность.

## Настройка и разработка

```bash
# Установка зависимостей из корня проекта
pnpm install

# Сборка workspace package
pnpm --filter @universo/publish-srv build

# Запуск в режиме разработки/watch
pnpm --filter @universo/publish-srv dev
```

---

_Universo Platformo | Publication Service_

## Улучшения безопасности (MVP)

Небольшие безопасные изменения были добавлены для повышения надёжности API без нарушения работы клиентов:

- Rate limiting с `express-rate-limit`:
    - 60 req/min для write маршрутов (POST/PATCH/DELETE /links)
    - 200 req/min для read маршрутов (GET /links, GET /public/:slug)
    - Использует `standardHeaders: true`, `legacyHeaders: false`.
- Минимальная валидация входных данных во время выполнения:
    - `src/utils/validators.ts` проверяет обязательные поля (например, `unikId`) и базовые типы.
    - Применяется в `PublishController.createPublishLink` и `updatePublishLink`.
- Санитизация ошибок:
    - `src/utils/errorSanitizer.ts` скрывает внутренние детали ошибок в production;
        логи по-прежнему содержат полный контекст для отладки.

Публичные формы API не были изменены; существующие клиенты продолжают работать.

## Тестирование

Запуск Jest тестов для сервисов и маршрутов:

```bash
pnpm --filter @universo/publish-srv test
```

Сценарии данных потока используют общие TypeORM фабрики и хелперы `createFlowDataServiceMock`/`createSupabaseClientMock` из `@testing/backend/mocks`.

## Примечание по развёртыванию: trust proxy

Если основной сервер работает за reverse proxy (Nginx, Traefik, Kubernetes ingress), убедитесь, что Express настроен с `app.set('trust proxy', 1)` (или более строгим значением, подходящим для вашей топологии). Это позволяет rate limiting и функциям, зависящим от IP, читать реальный IP клиента из `X-Forwarded-For`.

Основной сервер отвечает за эту настройку; этот пакет только предоставляет middleware на уровне маршрутов.

## Известные проблемы и обходные пути

### Разрешение модулей TypeScript (Временный обходной путь)

**Текущий статус**: Этот пакет использует `moduleResolution: "node"` и `module: "CommonJS"` в `tsconfig.json` в качестве **временного обходного пути** для проблем совместимости с ESM.

**Проблема**: 
- Зависимость `bs58@6.0.0` является ESM-only пакетом (`"type": "module"` в его package.json)
- Хотя он предоставляет CommonJS экспорт (`src/cjs/index.cjs`), строгий режим TypeScript `moduleResolution: "node16"` отказывается компилировать `import bs58 from 'bs58'`, потому что видит пакет как ESM-first
- Это вызывает ошибку TS1479: "Текущий файл является модулем CommonJS, импорты которого будут производить вызовы 'require'; однако, ссылаемый файл является модулем ECMAScript"

**Текущий обходной путь**:
- Откат с современного `moduleResolution: "node16"` на устаревший режим `"node"`
- Откат с `module: "Node16"` на `"CommonJS"`
- Это позволяет TypeScript успешно компилироваться, а среда выполнения Node.js корректно загружает `bs58` через его CommonJS экспорт

**Влияние**:
- ⚠️ Устаревшее разрешение модулей не поддерживает должным образом subpath exports из package.json
- ⚠️ Может вызвать проблемы, если будущие зависимости используют продвинутые возможности ESM

**План будущей миграции**:
Это **временное исправление** и должно быть решено после MVP следующим образом:

1. **Вариант A (Рекомендуется)**: Мигрировать весь бэкенд на ESM
   - Добавить `"type": "module"` в package.json
   - Обновить все импорты для включения расширений `.js`
   - Обновить `module: "ES2020"` и сохранить `moduleResolution: "node16"`
   - Протестировать совместимость TypeORM в режиме ESM

2. **Вариант B (Альтернатива)**: Использовать динамические импорты для ESM-only пакетов
   ```typescript
   // Вместо: import bs58 from 'bs58'
   const bs58Module = await import('bs58')
   const bs58 = bs58Module.default
   ```

3. **Вариант C (Быстрое исправление)**: Понизить версию `bs58` до v5.0.0 (последняя CommonJS версия)
   - Теряются новые возможности и обновления безопасности
   - Не рекомендуется для долгосрочной перспективы

**Связанные пакеты**: Тот же обходной путь был применён к `flowise-server` из-за аналогичных проблем с пакетом `lunary`.

**Отслеживание**: См. memory-bank/tasks.md для задачи миграции ESM в Backlog.

````
