# Utils Package — AI Agent Guide

## Scope

This package owns reusable cross-environment helpers plus the neutral database-access contracts used across backend packages.
Treat it as transport-neutral infrastructure: contracts first, small helpers second, no domain behavior here.

## Database Contract Rules

- `@universo/utils/database` defines `DbSession`, `DbExecutor`, and `SqlQueryable`.
- Query helpers should normalize results to `T[]`, `T | null`, or explicit not-found errors.
- Timeout and advisory-lock helpers are the approved path for `SET LOCAL` helper SQL.
- Keep helpers generic and reusable across backend packages.
- Do not leak Knex-specific types into these neutral contracts unless a bridge helper explicitly requires it.

## Change Rules

- Preserve backward compatibility for exported helpers whenever possible.
- Pair new helpers with direct Vitest coverage before downstream adoption.
- Keep browser-safe and server-safe surfaces clearly separated through documented exports.
- Prefer additive APIs over breaking contract changes.

## References

- `README.md`
- `src/database/`
- `vitest.config.ts`