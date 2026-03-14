# Database Runtime Package — AI Agent Guide

## Scope

This package owns the shared Knex runtime, executor factories, identifier helpers, and transport normalization for PostgreSQL access.
It is the infrastructure boundary beneath the SQL-first domain packages.

## Ownership Rules

- Keep the shared Knex lifecycle here.
- Expose Tier 1, Tier 2, and Tier 3 primitives without pushing Knex transport APIs into domain code.
- Maintain `qSchema`, `qTable`, `qSchemaTable`, and `qColumn` as the approved dynamic identifier helpers.
- Preserve `getPoolExecutor()` as the standard Tier 2 entry point.
- Keep `getKnex()` for infrastructure, migrations, and DDL boundaries only.

## Change Rules

- Runtime changes must preserve pool ownership and graceful shutdown behavior.
- Executor factories should stay aligned with the repository database-access architecture docs.
- Identifier helper changes need direct regression coverage because many backend packages depend on them.
- Avoid adding package-local policy exceptions that belong in docs or lint rules instead.

## References

- `README.md`
- `src/`
- `jest.config.js`