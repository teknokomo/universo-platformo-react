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
4. Настроить sessions, CSRF, CORS, JWT auth, sanitization и request logging.
5. Инициализировать rate limiters для downstream service packages.
6. Выполнить seed metahub templates через `@universo/metahubs-backend`.
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
