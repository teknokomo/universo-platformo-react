# Universo Core Backend (@universo/core-backend)

Основной backend server package для Universo Platformo.

## Overview

Этот пакет поднимает Express-приложение, инициализирует shared Knex runtime, выполняет зарегистрированные platform migrations, монтирует service routers и отдаёт frontend bundle. Он является composition root для сервисов authentication, metahubs, applications, onboarding, admin и profile.

## Package Structure

```text
packages/universo-core-backend/base/
├── src/
│   ├── commands/        # Oclif CLI commands
│   ├── database/        # Legacy entity exports, сохранённые для совместимости
│   ├── errors/          # Shared backend error types
│   ├── middlewares/     # Error и request middleware
│   ├── routes/          # API composition и global API error handling
│   ├── utils/           # Logging, telemetry, XSS, helpers
│   ├── Interface.ts     # Public app interface types
│   └── index.ts         # App bootstrap и server lifecycle
├── bin/                 # Oclif runtime entrypoint
├── package.json
└── tsconfig.json
```

## Startup Flow

1. Проверить auth-конфигурацию либо для legacy `SUPABASE_JWT_SECRET`, либо для современного Supabase JWKS verification.
2. Инициализировать shared Knex singleton из `@universo/database`.
3. Провалидировать и выполнить registered platform migrations через `@universo/migrations-platform`.
4. Если `BOOTSTRAP_SUPERUSER_ENABLED=true`, создать или подтвердить стартового суперпользователя через Supabase Admin API, при необходимости восстановить profile row и обеспечить эксклюзивную глобальную роль `superuser`.
5. Настроить sessions, CSRF, CORS, JWT auth, sanitization и request logging.
6. Инициализировать rate limiters для downstream service packages.
7. Смонтировать роутеры `/api/v1` и отдать frontend bundle из `@universo/core-frontend`.

## Key Integrations

-   `@universo/database` предоставляет `getKnex()`, `destroyKnex()` и executor factories.
-   `@universo/migrations-platform` отвечает за startup validation и unified platform migration execution.
-   `@universo/auth-backend` предоставляет Passport setup, auth routes и RLS-aware auth middleware.
-   `@universo/metahubs-backend`, `@universo/applications-backend`, `@universo/start-backend`, `@universo/admin-backend` и `@universo/profile-backend` предоставляют domain routers, которые монтирует core server.

## Routing Model

Сервер монтирует общий роутер `/api/v1`, который объединяет:

-   public health и public metahub endpoints
-   authenticated routes для metahubs, applications, onboarding, admin и profile
-   optimistic-lock conflict mapping и обработку database timeout

Request-scoped database access строится от shared Knex runtime и request-aware executor helpers, а не через TypeORM `DataSource` или `EntityManager`.

## Build And Test

```bash
pnpm --filter @universo/core-backend build
pnpm --filter @universo/core-backend test
```

## Локальный Supabase

Перед использованием локального Supabase установите и запустите Docker. Локальная разработка Supabase управляется через Supabase CLI, но сами сервисы работают как Docker-контейнеры. Установите Docker Desktop или Docker Engine для вашей операционной системы, убедитесь, что Docker daemon запущен, и проверьте доступ из корня репозитория:

```bash
docker --version
docker ps
pnpm exec supabase --version
```

На Linux настройте пользователя так, чтобы команды Docker выполнялись без `sudo`, затем перезапустите терминал перед запуском команд проекта.

Бэкенд может работать с локальным стеком Supabase в Docker через явные профили окружения, сгенерированные из `supabase status -o env`:

```bash
pnpm supabase:local:start
pnpm doctor:local-supabase
pnpm start:local-supabase
```

`start:local-supabase` тоже сначала запускает `supabase:local:start`, поэтому его можно использовать напрямую после запуска Docker. Явная команда `doctor:local-supabase` полезна, когда нужна быстрая проверка готовности без старта приложения.

Локальный Supabase можно использовать и без этого механизма профилей: перенести локальные URL Supabase, ключи и настройки PostgreSQL прямо в `packages/universo-core-backend/base/.env`, а затем запускать обычные `pnpm start` / `pnpm start:allclean`. Но механизм профилей рекомендуется, потому что он разделяет удалённые и локальные настройки, умеет перегенерировать локальные ключи после `supabase:local:nuke`, запускает проверку перед разрушительными сценариями и защищает от случайного сброса удалённого Supabase.

Сгенерированный профиль бэкенда: `packages/universo-core-backend/base/.env.local-supabase`; для E2E используется `.env.e2e.local-supabase`. Оба файла игнорируются git и должны оставаться только локальными.

Генерация сохраняет обычный контракт окружения бэкенда:

1. Для разработки генератор берёт за основу `packages/universo-core-backend/base/.env`, если файл существует.
2. Если `.env` отсутствует, используется `packages/universo-core-backend/base/.env.example`.
3. Если нет ни одного файла, создаётся минимальный локальный профиль.

Заменяются только локальные Supabase/PostgreSQL значения, `NODE_ENV`, `UNIVERSO_ENV_TARGET` и безопасные отсутствующие значения по умолчанию. Остальные настройки приложения, включая `BOOTSTRAP_SUPERUSER_ENABLED`, ограничения частоты запросов, флаги сброса, административные переключатели, настройки хранилища и функциональные флаги, сохраняются из базового env-файла. Переопределения Postgres/Auth только для удалённого Supabase, например `DATABASE_SSL_KEY_BASE64`, `SUPABASE_JWKS_URL` и `SUPABASE_JWT_ISSUER` очищаются для локального Supabase.

Для полной пересборки и сброса базы на локальном Supabase используйте `pnpm start:allclean:local-supabase`. Скрипт поднимает локальный стек Supabase, запускает `doctor:local-supabase` и явно передаёт `UNIVERSO_ENV_FILE`, поэтому `.env` файлы удалённого Supabase не меняются.

Когда приложению нужны только локальная база данных, Auth, REST API, service-role Admin API и Studio, используйте минимальные команды запуска. Они пропускают контейнеры realtime, storage, imgproxy, edge runtime, logflare и vector, но сохраняют тот же сгенерированный профиль окружения и те же doctor-проверки:

```bash
pnpm start:local-supabase:minimal
pnpm start:allclean:local-supabase:minimal
```

Полный стек нужен, когда вы проверяете Supabase Storage, realtime-каналы, Edge Functions или сервисы логирования.

Веб-консоль локального Supabase называется Supabase Studio. По умолчанию CLI открывает её на `http://127.0.0.1:54323`. По этой ссылке можно посмотреть локальные таблицы базы данных, пользователей Auth, SQL-редактор, инструменты хранилища, если хранилище запущено, настройки API и другие инструменты администрирования локального Supabase. Само приложение использует локальный API URL `http://127.0.0.1:54321`; Studio -- это браузерная панель администрирования.

Команды локального Supabase:

```bash
pnpm supabase:local:start          # Запустить локальный стек Supabase в Docker и перегенерировать локальные env-файлы разработки.
pnpm supabase:local:start:minimal  # Запустить облегчённый стек без realtime/storage/imgproxy/edge/logflare/vector.
pnpm supabase:local:status         # Показать статус Supabase CLI.
pnpm doctor:local-supabase         # Проверить Auth, REST, service role, JWT secret и прямой Postgres.
pnpm start:local-supabase          # Запустить Supabase, выполнить doctor и стартовать приложение на локальном профиле.
pnpm start:local-supabase:minimal  # Запустить приложение на облегчённом локальном стеке Supabase.
pnpm start:allclean:local-supabase # Запустить Supabase, выполнить doctor, пересобрать проект, сбросить локальную базу и стартовать приложение.
pnpm start:allclean:local-supabase:minimal # Пересобрать и сбросить базу на облегчённом локальном стеке Supabase.
pnpm supabase:local:stop           # Остановить контейнеры локального Supabase и сохранить тома/данные Docker.
pnpm supabase:local:nuke           # Остановить локальный Supabase и удалить его локальные тома/данные Docker.
```

Для E2E-запусков на локальном Supabase:

```bash
pnpm supabase:e2e:start:minimal
pnpm doctor:e2e:local-supabase
pnpm run build:e2e:local-supabase
pnpm run test:e2e:smoke:local-supabase
```

Локальный Supabase для E2E использует отдельный проект CLI, тома Docker и порты, не совпадающие с ручной локальной разработкой. Выделенный E2E API: `http://127.0.0.1:55321`, база данных: `127.0.0.1:55322`, Studio: `http://127.0.0.1:55323`. По умолчанию локальный E2E запускается в минимальном режиме. Используйте `pnpm supabase:e2e:start` или E2E варианты с `:full` только когда тесту нужны Storage, Realtime, Edge Functions или сервисы логирования.

Дополнительные команды E2E Supabase:

```bash
pnpm supabase:e2e:start:minimal          # Запустить выделенный минимальный стек локального Supabase для E2E.
pnpm supabase:e2e:start                  # Запустить выделенный полный стек локального Supabase для E2E.
pnpm supabase:e2e:status                 # Показать статус выделенного локального профиля Supabase для E2E.
pnpm supabase:e2e:stop                   # Остановить выделенный локальный профиль Supabase для E2E и сохранить данные.
pnpm supabase:e2e:nuke                   # Остановить выделенный E2E-профиль и удалить его тома/данные Docker.
pnpm run build:e2e:local-supabase:full   # Собрать E2E с полным стеком локального Supabase.
pnpm run test:e2e:smoke:local-supabase:full # Запустить smoke E2E с полным стеком локального Supabase.
```

Выбор источника Supabase для E2E управляется `E2E_SUPABASE_PROVIDER` и `E2E_SUPABASE_ISOLATION`. Безопасное значение по умолчанию: удалённый выделенный Supabase с использованием `.env.e2e.local` / `.env.e2e`. Повторное использование основной `.env` или профиля локального Supabase для разработки намеренно не рекомендуется и требует `E2E_ALLOW_MAIN_SUPABASE=true` плюс `E2E_FULL_RESET_MODE=off`.

## Bootstrap Superuser

Core backend умеет автоматически поднимать первого суперпользователя платформы во время старта. Этот поток рассчитан на первичный bootstrap платформы и использует реальный Supabase auth account, а не прямые SQL-вставки в `auth.users`.

Обязательный backend env-контракт, если bootstrap включён:

```env
SUPABASE_URL=https://your-project.supabase.co
SERVICE_ROLE_KEY=your_server_only_service_role_key
BOOTSTRAP_SUPERUSER_ENABLED=true
BOOTSTRAP_SUPERUSER_EMAIL=stalin@kremlin.ru
BOOTSTRAP_SUPERUSER_PASSWORD=ChangeMe_123456!
```

Примечания:

-   `BOOTSTRAP_SUPERUSER_ENABLED` по умолчанию равен `true`.
-   `BOOTSTRAP_SUPERUSER_EMAIL` и `BOOTSTRAP_SUPERUSER_PASSWORD` поставляются как demo credentials только для local/dev bootstrap.
-   Перед любым реальным развёртыванием обязательно замените demo email и пароль.
-   Если bootstrap email уже принадлежит существующему non-superuser аккаунту, старт сервера завершится явной ошибкой вместо молчаливого повышения привилегий.
-   Если аккаунт уже существует и уже является superuser, старт становится безопасным no-op и при необходимости только восстанавливает отсутствующий profile row.

## Migration Commands

Запускайте workspace-level migration helpers из корня репозитория:

```bash
pnpm migration:status
pnpm migration:plan
pnpm migration:diff
pnpm migration:export
```

## Notes

-   Пакет всё ещё содержит compatibility exports в `src/database/entities/` для кода, который ещё не был полностью очищен.
-   Канонический database runtime основан на Knex и шарится через `@universo/database`.
-   Новые backend-сервисы должны регистрировать native SQL platform migration definitions вместо TypeORM entities и migrations.
-   Для подключения к Supabase Postgres в этом проекте используйте direct connection, если хост стабильно видит его, иначе переходите на session pooler на `:5432`. Transaction pooler на `:6543` использовать нельзя, потому что request-scoped RLS зависит от pinned session state.
