# @universo/database

Общий runtime-пакет базы данных для управления жизненным циклом Knex и создания executor-ов.

## Обязанности

-   Инициализировать, получать и завершать общий экземпляр Knex.
-   Предоставлять health checks базы данных и graceful-shutdown хелперы.
-   Создавать обычные и RLS-aware executor-ы для request-scoped SQL-работы.
-   Нормализовать PostgreSQL-style bindings через `convertPgBindings`.

## Публичный API

-   `initKnex`, `getKnex` и `destroyKnex`.
-   `checkDatabaseHealth` и `registerGracefulShutdown`.
-   `createKnexExecutor` и `createRlsExecutor`.
-   `convertPgBindings`.

## Разработка

```bash
pnpm --filter @universo/database build
pnpm --filter @universo/database test
```

## Связанные пакеты

-   `@universo/core-backend` использует этот пакет как основную runtime-точку входа в базу данных.
-   Пакеты миграций и доменные backend-пакеты зависят от его executor и Knex-хелперов.