# Пакеты Universo Platformo

В этом каталоге находятся runtime-приложения, общие библиотеки, шаблоны и сервисы документации, из которых состоит текущий монорепозиторий Universo Platformo.

## Правила структуры

-   Большинство workspace использует структуру `packages/<name>/base`.
-   `packages/apps-template-mui` и `packages/universo-rest-docs` являются корнями пакетов без слоя `base`.
-   Межпакетные импорты должны использовать workspace-имена пакетов вроде `@universo/types`, а не относительные пути.
-   README файлов пакетов должны существовать в синхронизированных английской и русской версиях.

## Карта пакетов

| Directory | Package | Role |
| --- | --- | --- |
| `admin-backend` | `@universo/admin-backend` | Бекенд-маршруты и сервисы для платформенного администрирования. |
| `admin-frontend` | `@universo/admin-frontend` | Фронтенд-модуль для административных страниц и UI-потоков. |
| `applications-backend` | `@universo/applications-backend` | Бекенд для сущностей applications, memberships, connectors и publication links. |
| `applications-frontend` | `@universo/applications-frontend` | Фронтенд-модуль для представлений и действий управления applications. |
| `apps-template-mui` | `@universo/apps-template-mui` | Общая MUI-обвязка приложений для более новых frontend-пакетов. |
| `auth-backend` | `@universo/auth-backend` | Инструментарий аутентификации для бекенда на Passport и Supabase. |
| `auth-frontend` | `@universo/auth-frontend` | Общие UI-примитивы аутентификации и frontend-хелперы работы с сессией. |
| `metahubs-backend` | `@universo/metahubs-backend` | Бекенд для metahubs, branches, publications и связанных доменных потоков. |
| `metahubs-frontend` | `@universo/metahubs-frontend` | Фронтенд-модуль для интерфейсов управления metahubs. |
| `migration-guard-shared` | `@universo/migration-guard-shared` | Общие хелперы статуса миграций и guard-shell компоненты. |
| `profile-backend` | `@universo/profile-backend` | Бекенд для данных профиля пользователя и пользовательских настроек. |
| `profile-frontend` | `@universo/profile-frontend` | Фронтенд-модуль для страниц профиля пользователя и profile UX. |
| `schema-ddl` | `@universo/schema-ddl` | Утилиты runtime-генерации схем, миграции и diff для PostgreSQL. |
| `start-backend` | `@universo/start-backend` | Бекенд-маршруты и сервисы для онбординга и стартовых потоков. |
| `start-frontend` | `@universo/start-frontend` | Фронтенд-мастер онбординга, cookie UX и хелперы стартовой страницы. |
| `universo-api-client` | `@universo/api-client` | Общие TypeScript API client утилиты для frontend-пакетов. |
| `universo-core-backend` | `@universo/core-backend` | Главный бекенд-сервер и интеграционная runtime-оболочка. |
| `universo-core-frontend` | `@universo/core-frontend` | Главная React-оболочка, собирающая общие и feature-пакеты. |
| `universo-database` | `@universo/database` | Knex singleton, health checks и фабрики executor-ов. |
| `universo-i18n` | `@universo/i18n` | Централизованный i18n runtime и утилиты регистрации namespace. |
| `universo-migrations-catalog` | `@universo/migrations-catalog` | Хранилище каталога миграций и артефактов definition registry. |
| `universo-migrations-core` | `@universo/migrations-core` | Базовый runtime миграций, identifiers, validation и execution helpers. |
| `universo-migrations-platform` | `@universo/migrations-platform` | Платформенный реестр миграций, planning, diff, export и CLI entry points. |
| `universo-rest-docs` | `@universo/rest-docs` | Модульный сервер OpenAPI и Swagger-документации. |
| `universo-store` | `@universo/store` | Общий пакет Redux и ability-helper, используемый текущей frontend-оболочкой. |
| `universo-template-mui` | `@universo/template-mui` | Общие MUI template-компоненты для React-оболочки и feature-модулей. |
| `universo-types` | `@universo/types` | Общие TypeScript domain types и межпакетные интерфейсы. |
| `universo-utils` | `@universo/utils` | Общие validators, serialization helpers и backend/frontend утилиты. |

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