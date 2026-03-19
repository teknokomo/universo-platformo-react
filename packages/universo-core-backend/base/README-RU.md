# Universo Core Backend (@universo/core-backend)

Основной backend server package для Universo Platformo.

## Overview

Этот пакет поднимает Express-приложение, инициализирует shared Knex runtime, выполняет зарегистрированные platform migrations, монтирует service routers и отдаёт frontend bundle.
Он является composition root для сервисов authentication, metahubs, applications, onboarding, admin и profile.

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

1. Проверить обязательную auth-конфигурацию, например `SUPABASE_JWT_SECRET`.
2. Инициализировать shared Knex singleton из `@universo/database`.
3. Провалидировать и выполнить registered platform migrations через `@universo/migrations-platform`.
4. Если `BOOTSTRAP_SUPERUSER_ENABLED=true`, создать или подтвердить стартового суперпользователя через Supabase Admin API, при необходимости восстановить profile row и обеспечить эксклюзивную глобальную роль `superuser`.
5. Настроить sessions, CSRF, CORS, JWT auth, sanitization и request logging.
6. Инициализировать rate limiters для downstream service packages.
7. Смонтировать роутеры `/api/v1` и отдать frontend bundle из `@universo/core-frontend`.

## Key Integrations

- `@universo/database` предоставляет `getKnex()`, `destroyKnex()` и executor factories.
- `@universo/migrations-platform` отвечает за startup validation и unified platform migration execution.
- `@universo/auth-backend` предоставляет Passport setup, auth routes и RLS-aware auth middleware.
- `@universo/metahubs-backend`, `@universo/applications-backend`, `@universo/start-backend`, `@universo/admin-backend` и `@universo/profile-backend` предоставляют domain routers, которые монтирует core server.

## Routing Model

Сервер монтирует общий роутер `/api/v1`, который объединяет:

- public health и public metahub endpoints
- authenticated routes для metahubs, applications, onboarding, admin и profile
- optimistic-lock conflict mapping и обработку database timeout

Request-scoped database access строится от shared Knex runtime и request-aware executor helpers, а не через TypeORM `DataSource` или `EntityManager`.

## Build And Test

```bash
pnpm --filter @universo/core-backend build
pnpm --filter @universo/core-backend test
```

## Bootstrap Superuser

Core backend умеет автоматически поднимать первого суперпользователя платформы во время старта.
Этот поток рассчитан на первичный bootstrap платформы и использует реальный Supabase auth account, а не прямые SQL-вставки в `auth.users`.

Обязательный backend env-контракт, если bootstrap включён:

```env
SUPABASE_URL=https://your-project.supabase.co
SERVICE_ROLE_KEY=your_server_only_service_role_key
BOOTSTRAP_SUPERUSER_ENABLED=true
BOOTSTRAP_SUPERUSER_EMAIL=demo-admin@example.com
BOOTSTRAP_SUPERUSER_PASSWORD=ChangeMe_123456!
```

Примечания:

- `BOOTSTRAP_SUPERUSER_ENABLED` по умолчанию равен `true`.
- `BOOTSTRAP_SUPERUSER_EMAIL` и `BOOTSTRAP_SUPERUSER_PASSWORD` поставляются как demo credentials только для local/dev bootstrap.
- Перед любым реальным развёртыванием обязательно замените demo email и пароль.
- Если bootstrap email уже принадлежит существующему non-superuser аккаунту, старт сервера завершится явной ошибкой вместо молчаливого повышения привилегий.
- Если аккаунт уже существует и уже является superuser, старт становится безопасным no-op и при необходимости только восстанавливает отсутствующий profile row.

## Migration Commands

Запускайте workspace-level migration helpers из корня репозитория:

```bash
pnpm migration:status
pnpm migration:plan
pnpm migration:diff
pnpm migration:export
```

## Notes

- Пакет всё ещё содержит compatibility exports в `src/database/entities/` для кода, который ещё не был полностью очищен.
- Канонический database runtime основан на Knex и шарится через `@universo/database`.
- Новые backend-сервисы должны регистрировать native SQL platform migration definitions вместо TypeORM entities и migrations.
