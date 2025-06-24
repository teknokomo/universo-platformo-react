# Current Research Context

## 🎯 ACTIVE: Flowise 2.2.8 Upgrade & Chatbot Refactoring Research

### APPs Architecture Implementation Research ✅

**Status**: COMPLETED - All research objectives achieved

#### APPs Architecture Pattern Analysis

-   ✅ **4 Applications Successfully Implemented**: UPDL, Publish-FRT, Publish-SRV, Analytics-FRT
-   ✅ **TypeScript + JSX Integration**: Solved with `allowJs: true` pattern in tsconfig.json
-   ✅ **Modular Build System**: Consistent TypeScript + Gulp pipeline across all applications
-   ✅ **Alias Integration**: Clean integration with main UI via `@apps/*` aliases

#### Results Achieved:

-   **UPDL Application**: Pure node definitions with Data nodes for quiz functionality
-   **Publish Frontend**: Complete AR.js builder with iframe rendering and multi-object support
-   **Publish Backend**: Integrated with main Flowise server, quiz results storage
-   **Analytics Frontend**: Single component architecture with JSX integration

### 🔍 NEXT: Flowise Upgrade & Chatbot Refactoring Research

#### Research Questions for Platform Upgrade:

1. **Breaking Changes**: What API changes exist between Flowise 2.2.7-patch.1 and 2.2.8?
2. **Dependency Updates**: Which packages need version updates and compatibility checks?
3. **Custom Integration Points**: How will UPDL nodes and APPs architecture be affected?
4. **Chatbot Extraction**: What components need to be moved to separate chatbot-frt application?

#### Research Areas:

-   **Flowise 2.2.8 Changelog**: Study official release notes and breaking changes
-   **Dependency Compatibility**: Research package version compatibility matrix
-   **Migration Strategy**: Plan step-by-step upgrade process with rollback options
-   **Chatbot Architecture**: Design chatbot-frt application following proven APPs pattern

### 🏗️ Technical Research Focus

#### Platform Upgrade Considerations:

-   **Backward Compatibility**: Ensure all 4 existing applications continue working
-   **UPDL Node Compatibility**: Verify node definitions work with new Flowise version
-   **API Stability**: Check publication system API compatibility
-   **Build Process**: Ensure all TypeScript + Gulp pipelines remain functional

#### Chatbot Refactoring Strategy:

-   **Component Identification**: Map chatbot-specific components in main UI
-   **Dependency Analysis**: Identify chatbot dependencies and shared utilities
-   **Integration Points**: Design clean API between chatbot-frt and main application
-   **Migration Path**: Plan gradual migration without breaking existing functionality

### 📚 Background Context

#### Current Technology Stack:

-   **Base**: Flowise 2.2.7-patch.1 (stable) → **Target**: Flowise 2.2.8
-   **APPs Architecture**: 4 applications successfully implemented and working
-   **Custom Features**: Supabase auth, Uniks workspaces, i18n, UPDL nodes with quiz support
-   **AR Technology**: AR.js with A-Frame, iframe rendering, local library serving
-   **UI Framework**: React with Material-UI + modular APPs integration

#### Proven Patterns:

-   **APPs Architecture**: 4 applications working in production with clean separation
-   **UPDL System**: Complete AR.js export with quiz functionality and lead collection
-   **TypeScript + JSX**: `allowJs: true` pattern for mixed TypeScript/JSX applications
-   **Publication Flow**: Integrated with main Flowise server, `/p/{uuid}` URLs working
-   **Multi-language**: English/Russian support with modular namespace architecture
-   **Build System**: Consistent TypeScript + Gulp pipeline across all applications





## 🚀 **ПЛАН: Превращение `apps` во внутренние пакеты (Workspaces)**


### Шаг 1: Превращение `apps/profile-srv` в полноценный внутренний пакет

**Цель:** Сделать так, чтобы `packages/server` мог импортировать код из `apps/profile-srv` как из обычного npm-пакета, используя `pnpm workspaces`.

**1.1. Модификация `apps/profile-srv/base/package.json`:**

*   **Добавить `name`:**
    ```json
    "name": "@universo/profile-srv",
    "version": "0.1.0", // Или любая начальная версия
    ```
*   **Указать основной файл и типы (важно для TypeScript):**
    ```json
    "main": "dist/index.js", // Путь к главному экспортируемому файлу ПОСЛЕ компиляции
    "types": "dist/index.d.ts", // Путь к файлу декларации типов ПОСЛЕ компиляции
    ```
*   **Добавить скрипт сборки (если его нет):**
    ```json
    "scripts": {
      "build": "tsc", // Или ваш текущий скрипт сборки для profile-srv
      "clean": "rimraf dist"
    },
    ```
*   **Убедиться, что `typescript` и `rimraf` есть в `devDependencies`.**

**1.2. Создание `apps/profile-srv/base/tsconfig.json` (если его нет или он не настроен для сборки пакета):**

*   Ключевые опции для сборки пакета:
    ```json
    {
      "compilerOptions": {
        "target": "es2021",
        "module": "commonjs",
        "outDir": "./dist", // Компилировать в папку dist
        "rootDir": "./src",  // Исходники лежат в src
        "declaration": true, // Генерировать .d.ts файлы
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "strict": true
        // ... другие ваши опции
      },
      "include": ["src/**/*"], // Собирать всё из src
      "exclude": ["node_modules", "dist"]
    }
    ```

**1.3. Создание или обновление `apps/profile-srv/base/src/index.ts`:**

*   Этот файл должен экспортировать всё, что `profile-srv` предоставляет наружу (например, сущности, миграции, роуты).
    ```typescript
    // Пример apps/profile-srv/base/src/index.ts
    export * from './database/entities'; // Экспортируем все сущности
    export * from './database/migrations/postgres'; // Экспортируем миграции
    export * from './routes'; // Экспортируем роуты, если они есть
    // ... и так далее
    ```

**1.4. Модификация `packages/server/package.json`:**

*   **Добавить `profile-srv` в зависимости:**
    ```json
    "dependencies": {
      // ... ваши текущие зависимости
      "@universo/profile-srv": "workspace:*"
    },
    ```

**1.5. Модификация `packages/server/tsconfig.json`:**

*   **Добавить `composite: true` и `declaration: true` (если нет):** Это важно для корректной работы с зависимостями в монорепозитории.
*   **Добавить `references` на `profile-srv`:** Это скажет TypeScript, что `server` зависит от `profile-srv` и его нужно собрать первым.
    ```json
    {
      "compilerOptions": {
        "composite": true, // Для сборки зависимых проектов
        "declaration": true, // Тоже важно для composite
        "outDir": "./dist",
        // ... остальные опции
      },
      "include": ["src/**/*"],
      "references": [
        { "path": "../../apps/profile-srv/base" } // Путь к tsconfig.json пакета profile-srv
      ]
    }
    ```
    *   **Важно:** Путь в `references` должен указывать на директорию, содержащую `tsconfig.json` зависимого пакета (`apps/profile-srv/base` в нашем случае).

**1.6. Обновление импортов в `packages/server`:**

*   Везде, где `server` импортировал что-то из `profile-srv` через относительные пути, заменить их на импорты из пакета:
    ```typescript
    // Было (пример):
    // import { Profile } from '../../../../apps/profile-srv/base/src/database/entities/Profile';
    // import { profileMigrations } from '../../../../apps/profile-srv/base/src/database/migrations/postgres';

    // Стало:
    import { Profile } from '@universo/profile-srv/database/entities'; // Или как вы экспортировали в index.ts profile-srv
    import { profileMigrations } from '@universo/profile-srv/database/migrations/postgres'; // Или как вы экспортировали
    ```
    Или, если у `profile-srv` в `src/index.ts` все экспортируется напрямую:
    ```typescript
    import { Profile, profileMigrations } from '@universo/profile-srv';
    ```

**1.7. Настройка корневого `pnpm-workspace.yaml` (если его нет или он неполный):**

*   Убедитесь, что `pnpm-workspace.yaml` в корне проекта включает все ваши пакеты и приложения:
    ```yaml
    packages:
      - 'packages/*'
      - 'apps/*/*' # Это добавит apps/profile-srv/base, apps/publish-srv/base и т.д.
    ```

**1.8. Сборка и проверка:**

1.  **Установка зависимостей:** Из корня проекта выполнить `pnpm install`. `pnpm` должен обнаружить `workspace:*` зависимость и создать символическую ссылку.
2.  **Полная очистка:** (Опционально, но рекомендуется для чистоты эксперимента)
    ```bash
    pnpm -r clean # Запускает clean во всех пакетах, если он есть
    # или вручную удалить папки dist
    ```
3.  **Полная сборка проекта:** Из корня проекта `pnpm build` (или `turbo build`, если используете Turborepo). Благодаря `references` в `tsconfig.json`, `profile-srv` должен собраться *перед* `server`.
4.  **Проверка структуры `packages/server/dist`:** Убедитесь, что там больше нет вложенных папок `packages/` или `apps/`. Структура должна быть "плоской", как до добавления `profile-srv`.
5.  **Запуск сервера:** `pnpm start` из корня проекта.
    *   **Ожидаемый результат:** Сервер стартует без ошибок `MODULE_NOT_FOUND` связанных с `profile-srv` и без ошибок `command start not found` от oclif.

---

### Шаг 2: Аналогичное преобразование `apps/publish-srv`

Повторить все пункты из Шага 1 для `apps/publish-srv`, адаптируя имена и пути:

*   `apps/publish-srv/base/package.json` -> `name: "@universo/publish-srv"`
*   `apps/publish-srv/base/tsconfig.json`
*   `apps/publish-srv/base/src/index.ts`
*   Добавить `@universo/publish-srv: "workspace:*"` в зависимости `packages/server/package.json`.
*   Добавить `references` на `apps/publish-srv/base` в `packages/server/tsconfig.json`.
*   Обновить импорты из `publish-srv` в `packages/server`.
*   Сборка и проверка.

---

### Шаг 3: Аналогичное преобразование `apps/updl`

Повторить все пункты из Шага 1 для `apps/updl`, адаптируя имена и пути:

*   `apps/updl/base/package.json` -> `name: "@universo/updl"`
*   `apps/updl/base/tsconfig.json`
*   `apps/updl/base/src/index.ts` (особое внимание на экспорт `nodes`)
*   Добавить `@universo/updl: "workspace:*"` в зависимости `packages/server/package.json`.
*   Добавить `references` на `apps/updl/base` в `packages/server/tsconfig.json`.
*   Обновить код в `NodesPool.ts` (и где-либо еще, если есть) для импорта узлов из `@universo/updl`.
    *   Путь к узлам UPDL в `NodesPool.ts` нужно будет изменить. Вместо прямого пути к файловой системе, мы будем использовать `require.resolve` или аналогичный механизм для получения пути к скомпилированным узлам внутри пакета `@universo/updl` (который будет лежать в `node_modules`).
        ```typescript
        // Было в NodesPool.ts:
        // const updlNodesPath = path.join(__dirname, '../../../apps/updl/base/dist/nodes');
        
        // Станет что-то вроде (потребуется точная реализация):
        // const updlPackagePath = getNodeModulesPackagePath('@universo/updl'); // Нужна функция для получения пути к пакету
        // const updlNodesPath = path.join(updlPackagePath, 'dist', 'nodes');
        ```
*   Сборка и проверка.

---

### Аспекты реализации и потенциальные сложности

*   **Циклические зависимости:** Если `server` зависит от `profile-srv`, а `profile-srv` (вдруг) попытается импортировать что-то из `server` – это создаст цикл. Это плохая архитектура, и её нужно будет разрешать (например, вынося общий код в третий пакет). `pnpm workspaces` и `tsc --build` помогут выявить такие проблемы.
*   **Правильные экспорты из `index.ts`:** Важно тщательно продумать, что именно каждый новый пакет (`@universo/profile-srv` и т.д.) экспортирует. Это его публичный API.
*   **Скрипты сборки:** Каждый новый пакет должен иметь свой собственный рабочий скрипт `build` в `package.json`, который корректно компилирует его в папку `dist` с декларациями типов.
*   **Очистка `postbuild`:** После успешной реализации этих шагов, ужасный `postbuild` скрипт в `packages/server/package.json` станет полностью ненужным и его можно будет удалить.
*   **Oclif:** Конфигурация oclif в `packages/server/package.json` должна оставаться стандартной (`"commands": "./dist/commands"`), так как `tsc --build` с `references` и правильной структурой проекта будет компилировать всё "плоско" в `dist` папку `server`.

Этот план более трудоёмкий вначале, но он решает проблему **системно и надолго**, а также идеально готовит ваш проект к будущему разделению на микросервисы или плагины.

Готов ответить на вопросы по каждому пункту и помочь с деталями, когда вы приступите к реализации.