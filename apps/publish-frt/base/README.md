# Publication Frontend (publish-frt)

Frontend for publication system in Universo Platformo.

## Project Structure

The project follows a unified structure for applications in the monorepo:

```
apps/publish-frt/base/
├─ package.json
├─ tsconfig.json
├─ gulpfile.ts
└─ src/
   ├─ assets/              # Static files (images, fonts, icons)
   │  ├─ icons/            # SVG icons for components and UI
   │  └─ images/           # Images for UI elements
   ├─ api/                 # HTTP clients for backend interaction
   ├─ components/          # Presentation React components
   ├─ features/            # Functional modules for different technologies
   │  ├─ arjs/             # AR.js components and logic
   │  ├─ aframe/           # A-Frame components and logic
   │  └─ exporters/        # Exporters for different platforms
   ├─ hooks/               # Custom React hooks
   ├─ store/               # State management
   ├─ i18n/                # Localization
   ├─ services/            # Service layer for backend communication
   ├─ utils/               # Utility functions
   ├─ interfaces/          # TypeScript types and interfaces
   ├─ configs/             # Configurations
   └─ index.ts             # Entry point

```

### Backend Interaction

The application interacts with the backend exclusively through REST API using API clients from the `api/` directory.
Direct imports from other applications are not used to ensure modularity and independence.

### Main Components

-   `Publisher` - Main component for project publication
-   `ExporterSelector` - Exporter selection component
-   `ARJSPublisher` - Specialized component for AR.js project publication

### Setup and Development

To run the project:

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
2. **Gulp Tasks**: Copies static assets (SVG, PNG, JSON, CSS) to the dist folder

### Available Scripts

-   `pnpm clean` - Clean the dist directory
-   `pnpm build` - Build the package (TypeScript + Gulp)
-   `pnpm dev` - Watch mode for development
-   `pnpm lint` - Lint the source code

### Gulp Tasks

The Gulp process copies all static files (SVG, PNG, JPG, JSON, CSS) from the source directories to the dist folder, preserving the directory structure. This ensures that assets are available at runtime.

## Dependencies

Make sure to install dependencies from the root of the project using:

```bash
pnpm install
```

## Development

When adding new components or pages, follow these practices:

1. Create components in the appropriate directory
2. Use TypeScript interfaces for props and state
3. Add appropriate static assets to the same folder (they will be copied during build)
4. Implement internationalization support using the i18n system

## Overview

The Publish Frontend module provides UI components and functionality for exporting and publishing UPDL scenes to various platforms, including:

-   AR.js for augmented reality
-   A-Frame for virtual reality (future)
-   PlayCanvas for 3D web (future)
-   Three.js for 3D web (future)

## Key Components

### ARJSPublisher

The ARJSPublisher component provides a comprehensive interface for publishing AR.js scenes, including:

-   Project title and description
-   Visibility controls
-   Marker selection
-   Generation type selection (streaming/pre-generated)
-   QR code for easy mobile access

### ARJSExporter

The ARJSExporter component allows users to export AR.js scenes for offline use, including:

-   HTML code generation
-   File downloads
-   Preview options

## Integration

The Publish Frontend module integrates with:

-   UPDL Frontend (updl-frt) for scene data
-   Publish Backend (publish-srv) for storing and serving published content
-   Main Flowise UI through custom tabs and components

## Актуальная реализация потоковой генерации

В текущей версии фронтенда публикации используется исключительно потоковая генерация AR.js из UPDL-узлов без предварительной генерации проекта. Порядок работы:

1. Компонент `ARJSPublisher` отправляет POST-запрос на эндпоинт `/api/publish/arjs` с параметром `chatflowId` и выбранными настройками (генерация в режиме `streaming`).
2. Данные поступают в контроллер бэкенда `PublishController.publishARJS`, где формируется ответ с `publicationId` и `publicUrl`.
3. React Router перехватывает маршрут `/ar/{publicationId}` и отображает компонент `ARViewPage`.
4. В компоненте `ARViewPage` выполняется GET-запрос к `/api/publish/arjs/public/:publicationId`, который возвращает JSON со сценой UPDL (`updlScene` или `scene`).
5. Полученная сцена конвертируется утилитой `UPDLToARJSConverter` в A-Frame элементы и отрисовывается в браузере.

## Интеграция с базовым Flowise

-   Фронтенд обращается к бэкенду публикации, который импортирует функцию `utilBuildUPDLflow` из пакета `packages/server`.
-   `utilBuildUPDLflow` извлекает из базы данных Flowise чат-флоу по `chatflowId`, собирает UPDL-узлы и выполняет их через внутренний механизм `executeUPDLFlow`.
-   Результирующий объект сцены возвращается фронтенду в виде JSON, что позволяет избежать хранения промежуточных HTML-файлов.

## Основные используемые файлы

-   `src/main.tsx`, `src/App.tsx` — инициализация приложения и роутинг.
-   `src/routes/index.tsx` — настройка React Router для публичного просмотра.
-   `src/features/arjs/ARJSPublisher.jsx` — UI для выбора параметров и запуска потоковой генерации.
-   `src/pages/public/ARViewPage.tsx`, `src/pages/public/ARView.tsx` — отображение AR-сцены.
-   `src/services/arjsService.ts`, `src/services/publishService.ts` — сервисный слой для запросов к API публикации.
-   `src/api/ARJSPublishApi.ts`, `src/api/httpClient.ts` — HTTP-клиенты.
-   `src/utils/UPDLToARJSConverter.ts` — конвертация UPDL-схемы в элементы AR.js.
-   `src/interfaces/UPDLTypes.ts`, `src/interfaces/publishTypes.ts` — общие интерфейсы данных сцены.

## Устаревшие и неиспользуемые файлы

-   Папка `src/features/aframe` и файлы `AFrameExporter.ts` — логика для A-Frame офлайн-экспорта не задействована.
-   Папка `src/features/exporters` и файлы `BaseExporter.ts`, `ExporterFactory.ts`, `BaseAFrameExporter.ts` — генерация статического HTML/ZIP-файлов пока не используется.
-   Генераторы и конвертеры в `src/features/arjs/generators` — реализуют альтернативные подходы предварительной генерации.
-   Служебные файлы и README внутри `features/aframe` и `features/exporters` устарели и не поддерживаются.

## Известные проблемы

-   Документация в README и комментариях часто не соответствует текущей архитектуре.
-   Нет автоматического удаления неиспользуемых модулей и зависимостей, что приводит к избыточному размеру бандла.
-   Отсутствует централизованный конфиг управления режимами генерации (pre-generated vs streaming).
-   Не реализована поддержка офлайн-режима и кэширования сцен для повторного использования.
-   Не унифицированы стили кода и стандарты именования в разных модулях.

---

_Universo Platformo | Publication Frontend Module_
