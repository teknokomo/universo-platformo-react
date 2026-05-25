# Пакеты Universo Platformo

В этом каталоге находятся runtime-приложения, общие библиотеки, шаблоны и сервисы документации, из которых состоит текущий монорепозиторий Universo Platformo.

## Правила структуры

-   Каждый workspace-пакет использует плоскую структуру `packages/universo-react-<name>/package.json`.
-   `pnpm-workspace.yaml` находит корни пакетов через единственный глоб `packages/*`.
-   Межпакетные импорты должны использовать workspace-имена пакетов вроде `@universo-react/types`, а не относительные пути.
-   README файлов пакетов должны существовать в синхронизированных английской и русской версиях.

## Карта пакетов

| Directory                               | Package                                  | Role                                                                            |
| --------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| `universo-react-admin-backend`          | `@universo-react/admin-backend`          | Бекенд-маршруты и сервисы для платформенного администрирования.                 |
| `universo-react-admin-frontend`         | `@universo-react/admin-frontend`         | Фронтенд-модуль для административных страниц и UI-потоков.                      |
| `universo-react-applications-backend`   | `@universo-react/applications-backend`   | Бекенд для сущностей applications, memberships, connectors и publication links. |
| `universo-react-applications-frontend`  | `@universo-react/applications-frontend`  | Фронтенд-модуль для представлений и действий управления applications.           |
| `universo-react-apps-template-mui`      | `@universo-react/apps-template-mui`      | Общая MUI-обвязка приложений для более новых frontend-пакетов.                  |
| `universo-react-auth-backend`           | `@universo-react/auth-backend`           | Инструментарий аутентификации для бекенда на Passport и Supabase.               |
| `universo-react-auth-frontend`          | `@universo-react/auth-frontend`          | Общие UI-примитивы аутентификации и frontend-хелперы работы с сессией.          |
| `universo-react-block-editor`           | `@universo-react/block-editor`           | Общие Editor.js-примитивы для авторинга блокового контента.                     |
| `universo-react-metahubs-backend`       | `@universo-react/metahubs-backend`       | Бекенд для metahubs, branches, publications и связанных доменных потоков.       |
| `universo-react-metahubs-frontend`      | `@universo-react/metahubs-frontend`      | Фронтенд-модуль для интерфейсов управления metahubs.                            |
| `universo-react-migration-guard-shared` | `@universo-react/migration-guard-shared` | Общие хелперы статуса миграций и guard-shell компоненты.                        |
| `universo-react-profile-backend`        | `@universo-react/profile-backend`        | Бекенд для данных профиля пользователя и пользовательских настроек.             |
| `universo-react-profile-frontend`       | `@universo-react/profile-frontend`       | Фронтенд-модуль для страниц профиля пользователя и profile UX.                  |
| `universo-react-schema-ddl`             | `@universo-react/schema-ddl`             | Утилиты runtime-генерации схем, миграции и diff для PostgreSQL.                 |
| `universo-react-start-backend`          | `@universo-react/start-backend`          | Бекенд-маршруты и сервисы для онбординга и стартовых потоков.                   |
| `universo-react-start-frontend`         | `@universo-react/start-frontend`         | Фронтенд-мастер онбординга, cookie UX и хелперы стартовой страницы.             |
| `universo-react-api-client`             | `@universo-react/api-client`             | Общие TypeScript API client утилиты для frontend-пакетов.                       |
| `universo-react-core-backend`           | `@universo-react/core-backend`           | Главный бекенд-сервер и интеграционная runtime-оболочка.                        |
| `universo-react-core-frontend`          | `@universo-react/core-frontend`          | Главная React-оболочка, собирающая общие и feature-пакеты.                      |
| `universo-react-database`               | `@universo-react/database`               | Knex singleton, health checks и фабрики executor-ов.                            |
| `universo-react-extension-sdk`          | `@universo-react/extension-sdk`          | SDK-примитивы модулей для расширений metahub.                                   |
| `universo-react-i18n`                   | `@universo-react/i18n`                   | Централизованный i18n runtime и утилиты регистрации namespace.                  |
| `universo-react-migrations-catalog`     | `@universo-react/migrations-catalog`     | Хранилище каталога миграций и артефактов definition registry.                   |
| `universo-react-migrations-core`        | `@universo-react/migrations-core`        | Базовый runtime миграций, identifiers, validation и execution helpers.          |
| `universo-react-migrations-platform`    | `@universo-react/migrations-platform`    | Платформенный реестр миграций, planning, diff, export и CLI entry points.       |
| `universo-react-metapanel-frontend`     | `@universo-react/metapanel-frontend`     | Фронтенд-модуль авторизованного metapanel dashboard.                            |
| `universo-react-modules-engine`         | `@universo-react/modules-engine`         | Компилятор и runtime host для metahub modules.                                  |
| `universo-react-rest-docs`              | `@universo-react/rest-docs`              | Модульный сервер OpenAPI и Swagger-документации.                                |
| `universo-react-store`                  | `@universo-react/store`                  | Общий пакет Redux и ability-helper, используемый текущей frontend-оболочкой.    |
| `universo-react-template-mui`           | `@universo-react/template-mui`           | Общие MUI template-компоненты для React-оболочки и feature-модулей.             |
| `universo-react-types`                  | `@universo-react/types`                  | Общие TypeScript domain types и межпакетные интерфейсы.                         |
| `universo-react-utils`                  | `@universo-react/utils`                  | Общие validators, serialization helpers и backend/frontend утилиты.             |

## Как читать этот каталог

-   **Core shell** пакеты дают основную рамку backend и frontend приложения.
-   **Feature modules** добавляют бизнес-возможности вроде admin, auth, onboarding, profile, metahubs и applications.
-   **Infrastructure packages** отвечают за доступ к базе данных, миграции, schema DDL, i18n, API clients, общие типы и утилиты.
-   **UI support packages** предоставляют общее состояние, шаблоны и application scaffolding для React-based frontend-частей.
-   **Documentation packages** публикуют OpenAPI и связанные assets REST-документации.

## Заметки по разработке

-   Выполняйте пакетный менеджмент и полные сборки из корня репозитория через `pnpm build`.
-   Для точечной валидации используйте команды вида `pnpm --filter <package> lint` или `pnpm --filter <package> test`.
-   При документировании или импорте пакетов предпочитайте фактическое workspace-имя пакета, а не исторические алиасы или удалённые имена директорий.

Для деталей по конкретному пакету открывайте README внутри соответствующей директории пакета.
