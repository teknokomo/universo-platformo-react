# @universo-react/database

Общий runtime-пакет базы данных для владения Knex, фабрик executor-ов, безопасности identifier-ов и нормализации PostgreSQL transport.

## Overview

Этот пакет владеет единственным shared Knex runtime, используемым во всём репозитории.
Он является точкой входа для Tier 1 request-scoped executor-ов, Tier 2 pool executor-ов, Tier 3 DDL transport access и quoting динамических identifier-ов.

## Main Responsibilities

-   Инициализировать, возвращать и завершать общий экземпляр Knex.
-   Создавать RLS-aware и pool-level executor-ы, не раскрывая transport details в domain packages.
-   Квотировать валидированные schema, table и column identifiers.
-   Нормализовать PostgreSQL-style bindings для SQL-first helper-ов.
-   Экспортировать health checks и graceful-shutdown utilities для backend shells.

## Public API

-   `initKnex`, `getKnex` и `destroyKnex`.
-   `checkDatabaseHealth` и `registerGracefulShutdown`.
-   `createKnexExecutor`, `createRlsExecutor` и `getPoolExecutor`.
-   `runWithRlsOperationScope`, `runInRlsOperationScope` и тип `RlsOperationScope` для координации жизненного цикла аутентифицированного запроса.
-   `releaseKnexConnection` для освобождения вручную полученных соединений и исключения из пула соединений с неизвестным состоянием транзакции.
-   `qSchema`, `qTable`, `qSchemaTable` и `qColumn`.
-   `convertPgBindings`.

## Access Standard Role

-   Tier 1 использует `createRlsExecutor(...)` на одном pinned connection после применения request claims.
-   Tier 2 использует `getPoolExecutor()` для admin, bootstrap и public non-RLS flows.
-   Tier 3 использует `getKnex()` только для infrastructure, migrations и schema-ddl boundaries.
-   Domain packages должны зависеть от executor-ов и identifier helper-ов, а не от Knex transport API.
-   Потребители helper-ов обязаны держать SQL parameterized и schema-qualified.
-   Middleware аутентифицированных запросов использует экспортированный API operation scope, чтобы закрыть admission, дождаться принятых операций и завершить внешнюю транзакцию; потребителям не следует создавать собственный async context для этого жизненного цикла.
-   Если не удалось подтвердить сброс или rollback транзакции вручную полученного соединения, его нужно освободить через `releaseKnexConnection` с `{ discard: true }`.

## Operational Notes

-   Владение пулом сосредоточено здесь, чтобы backend packages не создавали независимые Knex singleton-ы.
-   Identifier helper-ы являются утверждённым путём для каждого динамического schema, table и column name.
-   Фабрики executor-ов сохраняют unified PostgreSQL access model, описанную в architecture docs.
-   Request-scoped RLS executor-ы закрывают admission до connection lease, дожидаются всех принятых запросов и транзакций, завершают outer transaction и только затем освобождают pinned connection.
-   Запросы через request session выполняются в активном transaction scope: запросы родителя ждут окончания savepoint, а запрос внутри savepoint откатывается вместе с ним.
-   RLS executor-ы возвращают обычные native Promise. Ошибка вложенной транзакции откатывает savepoint и всю родительскую транзакцию; перехваченный rejection не разрешает commit частичных изменений.
-   Если connection не удалось сбросить или подтвердить rollback, он помечается непригодным и пул Knex удаляет его перед повторным использованием.
-   Package boundaries вроде applications-backend `src/ddl/index.ts` или metahubs-backend DDL seams строятся поверх этого runtime package.

## Development

```bash
pnpm --filter @universo-react/database lint
pnpm --filter @universo-react/database test
pnpm --filter @universo-react/database build
```

## Related References

-   [Стандарт доступа к базе данных](../../../docs/ru/architecture/database-access-standard.md)
-   [Чеклист ревью кода базы данных](../../../docs/ru/contributing/database-code-review-checklist.md)
-   [Индекс пакетов](../../README-RU.md)
-   [@universo-react/utils](../universo-react-utils/README-RU.md)

## Related Packages

-   `@universo-react/core-backend` использует этот пакет как runtime-точку входа в базу данных на backend.
-   Migration и DDL packages используют его Knex runtime и identifier helper-ы.
-   Domain backend packages используют его фабрики executor-ов косвенно через route boundaries.
-   `@universo-react/utils` дополняет этот пакет нейтральными query и transaction helper контрактами.

## License

Omsk Open License
