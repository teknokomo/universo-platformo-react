# @universo/database

Общий runtime-пакет базы данных для владения Knex, фабрик executor-ов, безопасности identifier-ов и нормализации PostgreSQL transport.

## Overview

Этот пакет владеет единственным shared Knex runtime, используемым во всём репозитории.
Он является точкой входа для Tier 1 request-scoped executor-ов, Tier 2 pool executor-ов, Tier 3 DDL transport access и quoting динамических identifier-ов.

## Main Responsibilities

- Инициализировать, возвращать и завершать общий экземпляр Knex.
- Создавать RLS-aware и pool-level executor-ы, не раскрывая transport details в domain packages.
- Квотировать валидированные schema, table и column identifiers.
- Нормализовать PostgreSQL-style bindings для SQL-first helper-ов.
- Экспортировать health checks и graceful-shutdown utilities для backend shells.

## Public API

- `initKnex`, `getKnex` и `destroyKnex`.
- `checkDatabaseHealth` и `registerGracefulShutdown`.
- `createKnexExecutor`, `createRlsExecutor` и `getPoolExecutor`.
- `qSchema`, `qTable`, `qSchemaTable` и `qColumn`.
- `convertPgBindings`.

## Access Standard Role

- Tier 1 использует `createRlsExecutor(...)` на одном pinned connection после применения request claims.
- Tier 2 использует `getPoolExecutor()` для admin, bootstrap и public non-RLS flows.
- Tier 3 использует `getKnex()` только для infrastructure, migrations и schema-ddl boundaries.
- Domain packages должны зависеть от executor-ов и identifier helper-ов, а не от Knex transport API.
- Потребители helper-ов обязаны держать SQL parameterized и schema-qualified.

## Operational Notes

- Владение пулом сосредоточено здесь, чтобы backend packages не создавали независимые Knex singleton-ы.
- Identifier helper-ы являются утверждённым путём для каждого динамического schema, table и column name.
- Фабрики executor-ов сохраняют unified PostgreSQL access model, описанную в architecture docs.
- Package boundaries вроде applications-backend `src/ddl/index.ts` или metahubs-backend DDL seams строятся поверх этого runtime package.

## Development

```bash
pnpm --filter @universo/database lint
pnpm --filter @universo/database test
pnpm --filter @universo/database build
```

## Related References

- [Стандарт доступа к базе данных](../../../docs/ru/architecture/database-access-standard.md)
- [Чеклист ревью кода базы данных](../../../docs/ru/contributing/database-code-review-checklist.md)
- [Индекс пакетов](../../README-RU.md)
- [@universo/utils](../../universo-utils/base/README-RU.md)

## Related Packages

- `@universo/core-backend` использует этот пакет как runtime-точку входа в базу данных на backend.
- Migration и DDL packages используют его Knex runtime и identifier helper-ы.
- Domain backend packages используют его фабрики executor-ов косвенно через route boundaries.
- `@universo/utils` дополняет этот пакет нейтральными query и transaction helper контрактами.

## License

Omsk Open License