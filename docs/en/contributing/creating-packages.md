---
description: Package creation rules for new frontend or backend modules.
---

# Creating Packages

## Shared Rules

- Put new work under `packages/` and follow existing naming conventions.
- Use workspace package names for imports across package boundaries.
- Add synchronized English and Russian README files.
- Keep package `AGENTS.md` guidance aligned with the same architecture rules whenever the package owns non-trivial backend or infrastructure behavior.

## Frontend Packages

New frontend packages should use TypeScript or TSX and fit the current build
pattern for dual-format outputs when they are intended for reuse.

## Backend Packages

New backend packages should use SQL-first stores, `DbExecutor`-style access,
platform migration definitions, and root-level registration where required.

### Backend Database Rules

- Choose the access tier at the route or orchestration boundary.
- Use Tier 1 request executors for authenticated RLS-bound work.
- Use Tier 2 `getPoolExecutor()` for admin, bootstrap, and public non-RLS flows.
- Keep Tier 3 raw Knex only inside infrastructure, migration, or package-local DDL boundaries.
- Require schema-qualified SQL, bind parameters, and identifier helpers for every dynamic name.
- Use `RETURNING` on mutating DML when row confirmation or fail-closed behavior matters.
- Add direct store or service tests for SQL contracts instead of relying only on route mocks.

Package creation is an architectural task with runtime and integration consequences.
