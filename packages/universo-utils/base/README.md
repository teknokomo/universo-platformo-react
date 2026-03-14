# @universo/utils

Shared utility package for validation, serialization, browser/runtime helpers, and the neutral database-access contracts used across the repository.

## Overview

This package provides cross-environment helpers that backend and frontend packages can consume without taking direct dependencies on framework-specific runtime code.
It also owns the executor and query helper contracts that define the SQL-first repository standard.

## Database Standard Surface

- `@universo/utils/database` exports `DbSession`, `DbExecutor`, and `SqlQueryable`.
- Typed query helpers include `queryMany`, `queryOne`, `queryOneOrThrow`, and `executeCount`.
- Transaction and lock helpers include `withTransaction`, `withAdvisoryLock`, and timeout-safe SQL builders.
- Request-context helpers expose `getRequestDbExecutor`, `getRequestDbSession`, and neutral DB context creation.
- Callers use these contracts instead of importing Knex or route-local query abstractions.

## Main Responsibilities

- Provide validation, parsing, serialization, and browser/runtime support helpers.
- Provide the neutral database-access contract consumed by domain packages.
- Keep typed query result normalization consistent across backend packages.
- Centralize lock-timeout and statement-timeout helper logic.
- Preserve small, reusable APIs that remain safe for both browser and server consumers.

## Compatibility Rules

- Keep public APIs backward compatible and additive.
- Add new fields as optional or defaulted when contracts evolve.
- Prefer package-root or documented subpath imports instead of ad hoc deep imports.
- Keep database helpers transport-neutral so domain packages stay independent from Knex.
- Pair new helpers with direct unit tests before other packages depend on them.

## Operational Notes

- Browser-facing env helpers preserve the documented precedence order for host overrides and Vite runtime config.
- Database timeout helpers are the approved way to build `SET LOCAL` statements for locks and long transactions.
- Result helpers intentionally normalize on `T[]`, `T | null`, and explicit not-found errors.
- Advisory-lock helpers validate timeout bounds before SQL is emitted.

## Development

```bash
pnpm --filter @universo/utils lint
pnpm --filter @universo/utils test
pnpm --filter @universo/utils build
```

## Related References

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [Database access standard](../../../docs/en/architecture/database-access-standard.md)
- [Database review checklist](../../../docs/en/contributing/database-code-review-checklist.md)
- [Main package index](../../README.md)

## Related Packages

- `@universo/database` owns Knex runtime lifecycle and executor factories.
- `@universo/types` provides shared domain and enum contracts.
- Backend packages consume `@universo/utils/database` as the neutral SQL-first seam.
- Frontend packages consume browser-safe env, validation, and utility helpers.

## License

Omsk Open License
