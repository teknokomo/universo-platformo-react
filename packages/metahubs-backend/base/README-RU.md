# Metahubs Backend (@universo/metahubs-backend)

Backend-пакет для design-time операций metahub, metadata publication, seed шаблонов и orchestration runtime schema в Universo Platformo.

## Overview

Этот пакет отвечает за metadata authoring-сторону платформы: metahubs, branches, hubs, catalogs, sets, enumerations, attributes, constants, elements, layouts, templates, settings, publications и migration control endpoints.
Он интегрируется с shared Knex runtime, unified platform migration catalog и schema DDL toolkit.

## Package Structure

```text
packages/metahubs-backend/base/
├── src/
│   ├── domains/             # Domain modules, routes, services, guards, DDL facade
│   ├── persistence/         # Shared SQL-first persistence helpers
│   ├── platform/migrations/ # Native SQL platform migration definitions
│   ├── services/            # Cross-domain services
│   ├── tests/               # Package regression tests
│   ├── types/               # Shared metahub contracts
│   ├── utils/               # Package utilities
│   └── index.ts             # Public package surface
├── jest.config.js
├── package.json
└── tsconfig.json
```

## Responsibilities

- Экспортировать authenticated CRUD routes для design-time ресурсов metahub.
- Экспортировать public read-only endpoints для опубликованных metahub.
- Инициализировать package rate limiters и собирать полный metahubs service router.
- Выполнять seed встроенных metahub templates при старте backend.
- Предоставлять metahub migration history, dry-run, apply, rollback и application sync endpoints.
- Переэкспортировать DDL services из `@universo/schema-ddl`, заранее настроенные на shared Knex runtime.

## Migration And DDL Model

- Native SQL platform migration definitions находятся в `src/platform/migrations/`.
- Controlled migration execution отслеживается через `@universo/migrations-core` и `@universo/migrations-catalog`.
- Primitive для runtime schema generation, diff и rollback приходят из `@universo/schema-ddl`.
- Пакет больше не владеет private Knex singleton; DDL helpers используют shared runtime из `@universo/database`.

## Router Composition

`createMetahubsServiceRoutes()` монтирует:

- metahubs и branches
- publications
- endpoints истории и управления migration metahub
- endpoints migration и sync приложений
- hubs, catalogs, sets, enumerations, attributes, constants, elements и layouts
- routes для settings и template catalog

`createPublicMetahubsServiceRoutes()` предоставляет публичное чтение опубликованных metahub без аутентификации.

## Build And Test

```bash
pnpm --filter @universo/metahubs-backend build
pnpm --filter @universo/metahubs-backend test
```

## Related Packages

- `@universo/database` поставляет shared Knex runtime.
- `@universo/migrations-core` и `@universo/migrations-catalog` поставляют migration tracking и dry-run planning.
- `@universo/schema-ddl` поставляет primitive генерации схем и миграций.
- `@universo/applications-backend` downstream-потребляет publication и runtime schema outputs.
