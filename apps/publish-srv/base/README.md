# Publish Server

Backend for publication system in Universo Platformo.

## Project Structure

The project follows a unified structure for applications in the monorepo:

```
apps/publish-srv/base/
├─ package.json
├─ tsconfig.json
├─ gulpfile.ts
└─ src/
   ├─ controllers/        # Express controllers for request handling
   ├─ routes/             # Route configuration (REST API)
   ├─ services/           # Business logic
   ├─ models/             # Data models
   ├─ interfaces/         # TypeScript types and interfaces
   ├─ utils/              # Helper functions
   ├─ configs/            # Configurations
   ├─ middlewares/        # Middleware handlers
   ├─ validators/         # Input data validation
   └─ index.ts            # Entry point
```

### REST API

The server provides REST API for AR.js publication:

#### Endpoints:

-   `GET /api/publish/exporters` - List available exporters
-   `POST /api/publish/arjs` - Create a new AR.js publication (streaming mode)
-   `GET /api/publish/arjs/chatflow/:chatflowId` - List AR.js publications for a chatflow
-   `GET /api/publish/arjs/public/:publicationId` - Retrieve public AR.js publication data
-   `DELETE /api/publish/arjs/:publicationId` - Delete an AR.js publication
-   `PATCH /api/publish/arjs/:publicationId` - Update an AR.js publication

### Setup and Development

For development mode:

```bash
pnpm run dev
```

To build:

```bash
pnpm run build
```

## Build Process

The build process involves two steps:

1. **TypeScript Compilation**: Compiles TypeScript files to JavaScript
2. **Gulp Tasks**: Copies static assets (JSON, HTML, templates) to the dist folder

### Available Scripts

-   `pnpm clean` - Clean the dist directory
-   `pnpm build` - Build the package (TypeScript + Gulp)
-   `pnpm dev` - Watch mode for development
-   `pnpm lint` - Lint the source code

### Gulp Tasks

The Gulp process copies all static files (JSON, HTML, etc.) from the source directories to the dist folder, preserving the directory structure. This ensures that configuration files and templates are available at runtime.

## Dependencies

Make sure to install dependencies from the root of the project using:

```bash
pnpm install
```

## Development

When adding new API endpoints, follow these steps:

1. Create a controller in the `controllers` directory
2. Define the route in the appropriate router
3. Implement the service logic in the `services` directory
4. Add any necessary utility functions in the `utils` directory

## Module Usage

From the project root:

```bash
# Install dependencies
pnpm install

# Build the module
pnpm build --filter publish-srv

# Run in development mode (watches for changes)
pnpm --filter publish-srv dev
```

## Integration

The Publish Backend module integrates with:

-   Publish Frontend (publish-frt) for user interface
-   UPDL Backend (updl-srv) for scene data processing
-   Main Flowise server through mounted routes

## Актуальная реализация потоковой генерации

В текущей версии бэкенда публикации используется потоковая генерация AR.js через UPDL-узлы без сохранения промежуточных HTML-файлов. Порядок работы:

1. Фронтенд посылает POST-запрос на `/api/publish/arjs` с параметром `chatflowId` и настройками (режим `streaming`).
2. В `PublishController.publishARJS` создаётся `publicationId` и `publicUrl`, отправляется ответ клиенту.
3. При GET-запросе на `/api/publish/arjs/public/:publicationId` вызывается метод `getPublicARJSPublication`, он перенаправляет на `streamUPDL`.
4. Метод `streamUPDL` вызывает `utilBuildUPDLflow(chatflowId)`, извлекает чат-флоу из базы Flowise, строит и выполняет UPDL-узлы через `executeUPDLFlow`.
5. Полученная сцена (`updlScene` или `scene`) возвращается клиенту в виде JSON. Если сцена пуста или происходит ошибка, используется демонстрационная сцена `createDemoUPDLScene`.

## Интеграция с базовым Flowise

-   `PublishController` импортирует `utilBuildUPDLflow` из `packages/server/dist/utils/buildUPDLflow` (или из исходников).
-   `utilBuildUPDLflow` получает данные из базы Flowise, строит и выполняет UPDL-узлы, возвращает `UPDLFlowResult`.
-   RTT клиента и сериализация JSON позволяют фронтенду строить AR-сцену без файловой системы.

## Основные используемые файлы

-   `src/server.ts`, `src/routes/publishRoutes.ts`, `src/routes/updlRoutes.ts` — настройка серверных маршрутов.
-   `src/controllers/publishController.ts` — основные методы публикации AR.js и streamUPDL.
-   `src/controllers/UPDLController.ts` — устаревшие методы для mock-публикации UPDL.
-   `src/utils/logger.ts` — логирование запросов и ошибок.
-   `src/middlewares/authMiddleware.ts` — защита приватных маршрутов.
-   `src/interfaces` — типы данных `PublishResult`, `UPDLFlowResult`, `UPDLSceneGraph`.
-   `packages/server/dist/utils/buildUPDLflow.js` — функция построения потоковой UPDL-генерации.

## Устаревшие и неиспользуемые файлы

-   `src/controllers/UPDLController.ts` — контроллер mock-публикации UPDL не используется в реальном режиме `publish/srv`.
-   Маршруты в `updlRoutes.ts` — большинство маршрутов (например, `/updl/scene`, `/updl/publish/arjs`) не подключены во время инициализации сервера.
-   `services/`, `models/`, `validators/` — вещи, связанные с mock-базой в `UPDLController`, не используются.
-   `src/routes/updlRoutes.ts` — файлы для старой модели mock-публикации, приоритет имеет `publishRoutes`.

## Известные проблемы

-   Метод `UPDLController.publishUPDLToARJS` остаётся в кодовой базе, но не используется в потоке `publish-srv`.
-   Неочевидное разделение между `publishRoutes` и `updlRoutes`, дублирование логики публикации.
-   Нет автоматической очистки директории `public/p` от старых публикаций в режиме single-session.
-   Отсутствует единый конфиг для управления режимом хранения (файловая система vs потоковая генерация).
-   Нет тестов для проверки работы потоковой генерации и обработки ошибок.

---

_Universo Platformo | Publication Backend Module_
