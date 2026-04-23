# @universo/applications-backend

Бэкенд-пакет для applications, connectors, memberships, runtime sync и orchestration release bundle в Universo Platformo.

## Overview

Этот пакет владеет слоем metadata и runtime coordination на стороне приложений.
Он экспортирует authenticated CRUD routes, application membership guards, connector flows, runtime schema sync routes и endpoints экспорта/применения release bundle.

## Architecture

- Доменные routes и persistence helpers используют SQL-first доступ через `DbExecutor` или `SqlQueryable`.
- Аутентифицированные request flows используют Tier 1 request-scoped executors с RLS-контекстом.
- Admin, bootstrap и background flows используют Tier 2 pool executor-ы из `@universo/database`.
- Raw Knex разрешён только внутри package-local Tier 3 DDL boundary в `src/ddl/index.ts`.
- Mutation helpers используют `RETURNING id` и fail closed, если затронуто ноль строк.

## Main Responsibilities

- Управлять applications, connectors, memberships и publication links.
- Управлять макетами на стороне приложения, включая lineage metahub, application-owned copies, defaults, activation и activity виджетов.
- Выполнять опубликованные runtime scripts через fail-closed server bridge, который переиспользует runtime row helpers, workspace context и permission maps.
- Экспортировать runtime sync, diff и release-bundle routes для managed application schemas.
- Сохранять schema sync state в `applications.cat_applications` через SQL-first stores.
- Хранить runtime release metadata в той же центральной sync-state surface.
- Переиспользовать shared guards, identifier helpers и query helpers из стандартных database packages.

## Database Access Rules

- Чтения в application-домене используют `_upl_deleted = false AND _app_deleted = false`.
- Динамические identifiers проходят через `qSchema`, `qTable`, `qSchemaTable` или `qColumn`.
- Доменный SQL остаётся schema-qualified и parameterized через `$1`, `$2` и последующие bind-параметры.
- Route handlers выбирают executor tier на boundary-уровне вместо прямого импорта Knex.
- DDL helpers остаются изолированными от route и store кода даже когда runtime sync требует schema generation.

## Runtime Sync Model

- Publication-driven sync и file-bundle install разделяют один и тот же schema sync engine.
- Успешный sync записывает `schema_status`, `schema_snapshot` и `installed_release_metadata` в `applications.cat_applications`.
- Sync макетов сохраняет application-owned layouts, помечает локально изменённые metahub layouts как conflicts вместо перезаписи и сохраняет excluded metahub layouts исключёнными при следующих sync.
- Активные runtime script codenames уникальны в scope `(attached_to_kind, attached_to_id, module_role, codename)`, а sync чинит scoped index для существующих схем.
- Advisory locking сериализует sync work для каждого application до начала schema changes.
- Состояния maintenance и error сохраняются через тот же центральный store contract.

## Package Surface

- `createApplicationsRoutes(...)` монтирует CRUD, connector, membership и runtime-sync routes.
- Route surface теперь включает public join/leave flows и settings endpoints для per-workspace catalog limits.
- Application layout endpoints монтируются под `/applications/:applicationId/layouts` и `/applications/:applicationId/layout-scopes`.
- `initializeRateLimiters()` подготавливает package-level rate limiting до создания routes.
- Persistence helpers в `src/services/` и `src/persistence/` образуют SQL-first write/read seams.
- Platform migration definitions остаются в package migration surface, а не в route handlers.

## Архитектура контроллеров

Route files делегируют domain controllers, которые инкапсулируют логику обработчиков:

- **`applicationsController.ts`** — CRUD приложений, управление членством, операции с runtime rows.
- **`connectorsController.ts`** — CRUD коннекторов и управление publication links.
- **`syncController.ts`** — runtime schema sync, diff и release-bundle операции.
- **`applicationLayoutsController.ts`** — scopes макетов приложения, layout CRUD/copy и mutations виджетов макета.

### `asyncHandler()`

Express middleware wrapper, перехватывающий rejected promises и передающий ошибки в `next()`:

```ts
import { asyncHandler } from '../shared/asyncHandler'
router.get('/apps', asyncHandler(async (req, res) => { /* ... */ }))
```

### `runtimeHelpers.ts`

Общие helpers для runtime row controllers: валидация запросов, разрешение executor-ов, проверки схем и форматирование ответов — извлечены из inline route logic (~920 строк, 60+ экспортов).

## Development

```bash
pnpm --filter @universo/applications-backend lint
pnpm --filter @universo/applications-backend test
pnpm --filter @universo/applications-backend build
```

## Related References

- [MIGRATIONS.md](MIGRATIONS.md)
- [MIGRATIONS-RU.md](MIGRATIONS-RU.md)
- [Стандарт доступа к базе данных](../../../docs/ru/architecture/database-access-standard.md)
- [Чеклист ревью кода базы данных](../../../docs/ru/contributing/database-code-review-checklist.md)

## Related Packages

- `@universo/applications-frontend` для UI управления приложениями.
- `@universo/database` для владения Knex runtime и фабрик executor-ов.
- `@universo/utils` для нейтральных executor/query helper контрактов.
- `@universo/schema-ddl` для runtime-генерации схем и выполнения diff.

## License

Omsk Open License
