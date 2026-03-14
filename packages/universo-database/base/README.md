# @universo/database

Shared database runtime package for Knex ownership, executor factories, identifier safety, and PostgreSQL transport normalization.

## Overview

This package owns the only shared Knex runtime used by the repository.
It is the entry point for Tier 1 request-scoped executors, Tier 2 pool executors, Tier 3 DDL transport access, and dynamic identifier quoting.

## Main Responsibilities

- Initialize, return, and destroy the shared Knex instance.
- Create RLS-aware and pool-level executors without leaking transport details into domain packages.
- Quote validated schema, table, and column identifiers.
- Normalize PostgreSQL-style bindings for SQL-first helpers.
- Expose health checks and graceful-shutdown utilities for backend shells.

## Public API

- `initKnex`, `getKnex`, and `destroyKnex`.
- `checkDatabaseHealth` and `registerGracefulShutdown`.
- `createKnexExecutor`, `createRlsExecutor`, and `getPoolExecutor`.
- `qSchema`, `qTable`, `qSchemaTable`, and `qColumn`.
- `convertPgBindings`.

## Access Standard Role

- Tier 1 uses `createRlsExecutor(...)` on one pinned connection after request claims are applied.
- Tier 2 uses `getPoolExecutor()` for admin, bootstrap, and public non-RLS flows.
- Tier 3 uses `getKnex()` only for infrastructure, migrations, and schema-ddl boundaries.
- Domain packages should depend on executors and identifier helpers, not on Knex transport APIs.
- Helper consumers must keep SQL parameterized and schema-qualified.

## Operational Notes

- Pool ownership lives here so backend packages do not configure independent Knex singletons.
- Identifier helpers are the approved path for every dynamic schema, table, and column name.
- Executor factories preserve the unified PostgreSQL access model documented in the architecture docs.
- Package boundaries such as applications-backend `src/ddl/index.ts` or metahubs-backend DDL seams build on this runtime package.

## Development

```bash
pnpm --filter @universo/database lint
pnpm --filter @universo/database test
pnpm --filter @universo/database build
```

## Related References

- [Database access standard](../../../docs/en/architecture/database-access-standard.md)
- [Database review checklist](../../../docs/en/contributing/database-code-review-checklist.md)
- [Main package index](../../README.md)
- [@universo/utils](../../universo-utils/base/README.md)

## Related Packages

- `@universo/core-backend` uses this package as the backend runtime database entry point.
- Migration and DDL packages consume its Knex runtime and identifier helpers.
- Domain backend packages consume its executor factories indirectly through route boundaries.
- `@universo/utils` complements this package with neutral query and transaction helper contracts.

## License

Omsk Open License