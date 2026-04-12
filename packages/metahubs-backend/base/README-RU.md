# Metahubs Backend (@universo/metahubs-backend)

Backend-пакет для design-time ресурсов metahub, metadata publication, seed встроенных шаблонов и контролируемой orchestration runtime schema.

## Overview

Этот пакет владеет design-time стороной платформы: metahubs, branches, hubs, catalogs, sets, enumerations, attributes, constants, elements, layouts, settings, templates, publications и маршрутами управления миграциями.
Он объединяет SQL-first domain services с изолированными DDL boundaries, template seeding, publication export flows и metahub-специфичной coordination runtime schema.

## Architecture

- Доменные routes и services используют `DbExecutor` или `SqlQueryable` вместо raw Knex builder-ов.
- Чтения и записи в branch schema соблюдают metahub active-row predicate `_upl_deleted = false AND _mhb_deleted = false`.
- Tier 3 raw Knex остаётся изолированным в package DDL seams и путях интеграции schema-ddl.
- Publication-driven application sync компонуется через package boundaries вместо дублирования runtime ownership внутри этого пакета.
- Service-level mutations fail closed и используют `RETURNING`, когда нужно подтверждение затронутой строки.

## Legacy-Compatible Entity V2 Contract

- `config.compatibility.legacyObjectKind` является источником истины для совместимости catalog, hub, set и enumeration.
- Custom V2 rows сохраняют свой custom `kindKey` в `_mhb_objects.kind`; controllers расширяют legacy наборы kind через compatibility helpers вместо переписывания сохранённых kind.
- Controllers hubs, catalogs, sets и enumerations принимают `kindKey`-aware compatibility filters, чтобы legacy семейство routes обслуживало и built-in, и compatible custom rows.
- Publication, runtime и schema seams классифицируют V2 kinds через compatibility metadata, поэтому в runtime navigation материализуются только catalog-compatible sections.

## Main Responsibilities

- Экспортировать authenticated CRUD routes для design-time metahub resources.
- Держать design-time surfaces исходников и bundle-артефактов scripts за permission `manageMetahub`, а не за широкими member-level reads.
- Экспортировать public read-only routes для опубликованных данных metahub.
- Инициализировать rate limiters и собирать полное дерево маршрутов metahubs.
- Выполнять seed встроенных templates через unified platform migration flow.
- Предоставлять metahub migration history, dry-run, apply, rollback и publication-linked sync seams.
- Держать DDL orchestration за выделенными package-local boundaries.

## Database Access Rules

- Видимая пользователю доменная работа использует request или pool executor-ы, а не прямые импорты Knex.
- Динамические identifiers схем, таблиц и колонок проходят через shared quoting helpers.
- Доменный SQL остаётся schema-qualified и parameterized с PostgreSQL-style bindings.
- Потоки copy, delete, restore и reorder обязаны сохранять active-row и fail-closed contracts.
- Активные design-time script codenames уникальны только внутри scope tuple `(attached_to_kind, attached_to_id, module_role)`.
- Package-local DDL helpers являются единственным допустимым местом для raw Knex и transport wiring schema-ddl.

## DDL And Publication Boundaries

- Native SQL platform migration definitions находятся в `src/platform/migrations/`.
- Primitive runtime schema generation, diff и rollback приходят из `@universo/schema-ddl`.
- Пакет использует shared runtime из `@universo/database`; private Knex singleton здесь не допускается.
- Publication routes могут запускать downstream application sync seams, но ownership runtime routes приложений остаётся в `@universo/applications-backend`.

## Router Composition

- `createMetahubsServiceRoutes()` монтирует metahubs, branches, hubs, catalogs, sets, enumerations, attributes, constants, elements, layouts, settings, publications и migration endpoints.
- `createPublicMetahubsServiceRoutes()` предоставляет публичное чтение опубликованных metahub без аутентификации.
- Package services и persistence helpers остаются переиспользуемыми вне top-level router composition.
- Tests напрямую доказывают service-level contracts там, где route tests используют mocks.

## Паттерн Controller–Service–Store

Каждый домен следует трёхслойному разделению:

1. **Routes** (`domains/<domain>/routes/<domain>Routes.ts`) — тонкие Express route definitions (извлечение параметров, коды ответов, делегирование controller-у).
2. **Controller** (`domains/<domain>/controllers/<domain>Controller.ts`) — функции-обработчики, валидирующие input, вызывающие services/stores и формирующие ответы.
3. **Store** (`persistence/<domain>Store.ts`) — raw SQL queries через `DbExecutor.query()` с параметризованными bindings.

### `createMetahubHandler()`

Фабрично-сгенерированный handler, оборачивающий каждое metahub-scoped действие controller-а:
- Получает `userId` из request-а.
- Получает request-scoped `DbExecutor` (с RLS context).
- Выполняет `ensureMetahubAccess()` permission check.
- Предоставляет `MetahubHandlerContext` (`req`, `res`, `userId`, `metahubId`, `exec`, `schemaService`) обработчику.

```ts
const handle = createMetahubHandler(getDbExecutor)
router.get('/:metahubId/hubs', handle(hubsController.list, { permission: 'viewer' }))
```

### Иерархия доменных ошибок

`MetahubDomainError` — базовый класс с `statusCode`, `code` и опциональным `details`:

| Подкласс | Статус | Код |
|---|---|---|
| `MetahubMigrationRequiredError` | 428 | `MIGRATION_REQUIRED` |
| `MetahubPoolExhaustedError` | 503 | `CONNECTION_POOL_EXHAUSTED` |
| `MetahubSchemaLockTimeoutError` | 503 | `SCHEMA_LOCK_TIMEOUT` |
| `MetahubMigrationApplyLockTimeoutError` | 409 | `MIGRATION_APPLY_LOCK_TIMEOUT` |

### Пагинация запросов

`paginateItems(items, { limit, offset })` обеспечивает in-memory пагинацию с `{ items, pagination: { limit, offset, total, hasMore } }`. Валидация входных данных использует `validateListQuery()` с Zod schema.

### Экспорт/импорт снимков

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/v1/metahub/:id/export` | Экспорт полного метахаба как JSON-конверта снимка |
| `POST` | `/api/v1/metahubs/import` | Импорт конверта снимка как нового метахаба |
| `GET` | `/api/v1/metahub/:id/publication/:pubId/versions/:verId/export` | Экспорт снимка версии публикации |
| `POST` | `/api/v1/metahub/:id/publication/:pubId/versions/import` | Импорт снимка как новой версии публикации |

Конечные точки импорта проверяют целостность конверта (хеш SHA-256), глубину вложенности, защиту от загрязнения прототипа и лимиты количества сущностей. Подробнее в [руководстве по экспорту и импорту снимков](../../../docs/ru/guides/snapshot-export-import.md).

## Development

```bash
pnpm --filter @universo/metahubs-backend lint
pnpm --filter @universo/metahubs-backend test
pnpm --filter @universo/metahubs-backend build
```

## Related References

- [Стандарт доступа к базе данных](../../../docs/ru/architecture/database-access-standard.md)
- [Чеклист ревью кода базы данных](../../../docs/ru/contributing/database-code-review-checklist.md)
- [Создание пакетов](../../../docs/ru/contributing/creating-packages.md)
- [MIGRATIONS-RU.md](MIGRATIONS-RU.md)

## Related Packages

- `@universo/database` для владения Knex runtime и фабрик executor-ов.
- `@universo/migrations-core` и `@universo/migrations-catalog` для planning миграций и lifecycle tracking.
- `@universo/schema-ddl` для runtime-генерации схем и DDL execution.
- `@universo/applications-backend` для downstream ownership runtime sync приложений.

## License

Omsk Open License
