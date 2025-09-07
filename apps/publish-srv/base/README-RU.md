# Сервис Публикаций (@universo/publish-srv)

Бэкенд-сервис для системы публикаций в Universo Platformo, преобразованный в workspace-пакет для модульности, чистой интеграции и совместного использования типов.

## Структура Проекта

Проект структурирован как **workspace-пакет** (`@universo/publish-srv`), обеспечивая четкое разделение и управление зависимостями в монорепозитории:

```
apps/publish-srv/base/
├── package.json              # Конфигурация пакета с именем "@universo/publish-srv"
├── tsconfig.json             # Конфигурация TypeScript
└── src/
   ├── controllers/
   │  └── publishController.ts   # REST API контроллер (экспортируемый)
   ├── services/
   │  └── FlowDataService.ts     # Бизнес-логика для получения данных потока
   ├── routes/
   │  └── createPublishRoutes.ts # Фабрика маршрутов Express (экспортируемая)
   ├── types/
   │  └── publication.types.ts  # Общие типы UPDL (экспортируемые)
   └── index.ts                 # Точка входа со всеми экспортами пакета
```

### Архитектура Workspace-пакета

Этот сервис реализован как **pnpm workspace-пакет**, который:

-   **Имя пакета**: `@universo/publish-srv` (имя в рамках организации).
-   **Интеграция**: Используется как зависимость `"@universo/publish-srv": "workspace:*"` в основном сервере.
-   **Экспорты**: Ключевые модули (маршруты, типы, сервисы, контроллеры) экспортируются через `src/index.ts` для чистых и контролируемых импортов.
-   **Общие типы**: Является источником истины для типов UPDL (`IUPDLSpace`, `IUPDLObject` и т.д.), которые используются фронтенд-пакетом `@universo/publish-frt`.

## Функциональность

-   **Управление публикациями**: Предоставляет API для создания и получения записей о публикациях.
-   **Поставщик данных потока**: Отдает сырые `flowData` из базы данных, делегируя всю обработку UPDL фронтенду.
-   **Централизованные типы**: Экспортирует общие типы TypeScript, связанные с UPDL и публикациями, для использования на всей платформе.
-   **Модульность и слабая связанность**: Полностью независим от бизнес-логики `packages/server`. Больше не содержит код для генерации UPDL.
-   **Интеграция с Canvas**: Полностью поддерживает новую структуру Canvas, сохраняя обратную совместимость с ChatFlow.
-   **Публикация чатботов**: Обрабатывает публикацию чатботов с использованием конфигурации на основе Canvas, хранящейся в поле `chatbotConfig`.

## Интеграция с основным сервером Flowise

Сервис тесно интегрирован с основным сервером Flowise, используя его базовую инфраструктуру, но оставаясь модульным.

### Асинхронная инициализация маршрутов

**Критическое исправление**: Для решения проблемы "race condition", когда маршруты регистрировались до того, как было готово соединение с базой данных, этот пакет использует **фабрику асинхронных маршрутов**, аналогично `@universo/profile-srv`.

Функция `createPublishRoutes(dataSource)` экспортируется и вызывается с основного сервера **после** инициализации `DataSource`. Это гарантирует, что `FlowDataService` и его репозиторий всегда будут доступны, когда первый запрос поступит в контроллер.

```typescript
// Основной сервер (упрощенно)
import { createPublishRoutes } from '@universo/publish-srv'

// ... после AppDataSource.initialize()
const publishRoutes = createPublishRoutes(AppDataSource)
this.app.use('/api/v1/publish', publishRoutes)
```

### Ключевые точки интеграции

1.  **Регистрация маршрутов**: Асинхронная функция `createPublishRoutes` обеспечивает безопасную регистрацию маршрутов.
2.  **Доступ к базе данных**: `FlowDataService` напрямую обращается к базе данных Flowise через `DataSource` TypeORM, переданный с основного сервера.
3.  **Аутентификация**: Наследует middleware аутентификации JWT основного сервера, который применяется перед маршрутами этого пакета.

## REST API

API теперь оптимизирован для обработки записей о публикациях и предоставления сырых данных потока.

### Эндпоинты:

#### Эндпоинты на основе Canvas (Новые)
-   `POST /api/v1/publish/canvas` - Создает или обновляет запись о публикации Canvas.
-   `GET /api/v1/publish/canvas/public/:canvasId` - Получает сырые `flowData` для указанного Canvas.
-   `GET /api/v1/publish/canvas/:canvasId` - Прямой доступ к данным потока Canvas для стриминга.

#### Устаревшие эндпоинты (Обратная совместимость)
-   `POST /api/v1/publish/arjs` - Создает или обновляет запись о публикации (поддерживает как canvasId, так и chatflowId).
-   `GET /api/v1/publish/arjs/public/:publicationId` - Получает сырые `flowData` для указанной публикации.
-   `GET /api/v1/publish/arjs/stream/:chatflowId` - Устаревший эндпоинт стриминга (устарел, используйте эндпоинты Canvas).

#### Эндпоинты чатботов
-   `GET /api/v1/bots/:canvasId/config` - Получает конфигурацию чатбота из Canvas.
-   `GET /api/v1/bots/:canvasId` - Отображает интерфейс чатбота для Canvas.
-   `GET /api/v1/bots/:canvasId/stream/:sessionId?` - Обеспечивает функциональность потокового чата.

### `POST /api/v1/publish/canvas` (Новый)

Создает запись о публикации, связанную с `canvasId`. Тело запроса должно содержать ID холста и любые метаданные, необходимые для фронтенда.

**Пример запроса:**

```json
{
    "canvasId": "778d565f-e9cc-4dd8-b8ef-7a097ecb18f3",
    "isPublic": true,
    "projectName": "Мой AR-проект",
    "libraryConfig": {
        "arjs": { "version": "3.4.7", "source": "kiberplano" },
        "aframe": { "version": "1.7.1", "source": "official" }
    }
}
```

### `POST /api/v1/publish/arjs` (Устаревший)

Создает запись о публикации, связанную с `chatflowId` или `canvasId`. Поддерживает оба для обратной совместимости.

**Пример запроса:**

```json
{
    "canvasId": "778d565f-e9cc-4dd8-b8ef-7a097ecb18f3",
    "chatflowId": "778d565f-e9cc-4dd8-b8ef-7a097ecb18f3", // Устарел, используйте canvasId
    "isPublic": true,
    "projectName": "Мой AR-проект"
}
```

### `GET /api/v1/publish/canvas/public/:canvasId` (Новый)

Получает сырые `flowData` (в виде JSON-строки) и конфигурацию для указанного `canvasId`. Фронтенд отвечает за парсинг и обработку этих данных с помощью `UPDLProcessor`.

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

### `GET /api/v1/publish/arjs/public/:publicationId` (Устаревший)

Получает сырые `flowData` для указанного `publicationId` (который может быть как `canvasId`, так и устаревшим `chatflowId`). Поддерживает обратную совместимость.

### Конфигурация чатбота

Конфигурация чатбота извлекается из поля `chatbotConfig` Canvas:

```json
{
    "botType": "chat",
    "title": "Мой чат-бот",
    "backgroundColor": "#ffffff",
    "textColor": "#303235",
    "allowedOrigins": ["https://example.com"]
}
```

## Параметры рендеринга AR.js в публичном API

Публичный эндпоинт AR.js теперь возвращает необязательный блок `renderConfig`, извлекаемый из `chatbotConfig.arjs`, чтобы фронтенд корректно выбирал безмаркерный или маркерный режим.

### Расширение ответа

```json
{
  "success": true,
  "publicationId": "<id>",
  "flowData": "{...}",
  "libraryConfig": { /* как раньше */ },
  "renderConfig": {
    "arDisplayType": "wallpaper" | "marker",
    "wallpaperType": "standard",
    "markerType": "preset" | "pattern",
    "markerValue": "hiro" | "<pattern-url>"
  }
}
```

### Источник значений

-   Извлекается `FlowDataService` из `chatflow.chatbotConfig.arjs`, если присутствует.
-   Отсутствует для наследуемых записей; фронтенд использует поведение по умолчанию с маркером.

## Краткий обзор архитектурных изменений

-   **Разделение логики**: Логика `utilBuildUPDLflow` была полностью **удалена** из бэкенда и перенесена в класс `UPDLProcessor` в пакете `publish-frt`.
-   **Принцип единой ответственности**: Этот сервис теперь отвечает только за взаимодействие с базой данных (CRUD-операции с публикациями, получение `flowData`) и больше не участвует в логике UPDL.
-   **Разработка на основе типов**: Этот пакет является источником истины для всех типов, связанных с публикациями, обеспечивая консистентность.

## Настройка и разработка

```bash
# Установите зависимости из корня проекта
pnpm install

# Соберите workspace-пакет
pnpm --filter @universo/publish-srv build

# Запустите в режиме разработки/отслеживания
pnpm --filter @universo/publish-srv dev
```

---

_Universo Platformo | Сервис Публикаций_
