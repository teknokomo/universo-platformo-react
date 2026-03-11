# @universo/database

Shared database runtime package for Knex lifecycle management and executor creation.

## Responsibilities

-   Initialize, access, and destroy the shared Knex instance.
-   Expose database health checks and graceful-shutdown helpers.
-   Create plain and RLS-aware executors for request-scoped SQL work.
-   Normalize PostgreSQL-style bindings through `convertPgBindings`.

## Public API

-   `initKnex`, `getKnex`, and `destroyKnex`.
-   `checkDatabaseHealth` and `registerGracefulShutdown`.
-   `createKnexExecutor` and `createRlsExecutor`.
-   `convertPgBindings`.

## Development

```bash
pnpm --filter @universo/database build
pnpm --filter @universo/database test
```

## Related Packages

-   `@universo/core-backend` uses this package as the main runtime database entry point.
-   Migration and domain backend packages depend on its executor and Knex helpers.