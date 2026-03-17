# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: Transactional Consistency Closure

- Date: 2026-03-17.
- The QA transactional-consistency reopen is closed: metahub attribute mutation routes now keep business writes and `syncMetahubSchema(...)` inside one transaction runner, and plain catalog create routes now keep `createCatalog(...)` plus managed system-attribute seeding in the same transaction.

## Current State

- `packages/metahubs-backend/base/src/domains/attributes/routes/attributesRoutes.ts` now executes create/copy/update/delete/display-toggle/required-toggle and child-attribute create inside route-level transactions that also call schema sync before commit.
- `MetahubAttributesService` mutation helpers and the shared optimistic-lock helper now accept an existing `DbExecutor | SqlQueryable` runner so route-level transactions do not fork nested write paths.
- `packages/metahubs-backend/base/src/domains/catalogs/routes/catalogsRoutes.ts` now wraps metahub-level and hub-scoped catalog creation with `ensureCatalogSystemAttributes(...)` in the same transaction runner.
- Direct route regressions now assert transaction-runner propagation into schema sync and managed seeding; targeted Jest route tests passed 43/43, package lint returned to warning-only pre-existing noise with 0 errors, and the final root `pnpm build` completed successfully.

## Immediate Next Steps

- No active reopen remains for the transactional consistency seam in metahubs-backend.
- Future work should preserve the single-runner contract whenever attribute mutations or catalog-create side effects gain new post-write steps.

## Plan Decision: Keep Knex as Transport, Ban from Domain

- Knex stays as pool manager, connection handler, DDL engine.
- Only infrastructure packages may import from 'knex': schema-ddl, migrations-core, migrations-catalog, migrations-platform, universo-database. Plus DDL subsystem files in metahubs-backend (excluded via lint paths).
- Domain packages must use DbExecutor/SqlQueryable exclusively.
- Enforced by `tools/lint-db-access.mjs` in CI pipeline.

## Operational Posture

- Previous completed waves stay documented in `progress.md`; the Unified Database Access Standard initiative remains in a closed, documented state across code, docs, and AI guidance.
- Standing guards and future implementation entry points remain in `tasks.md`.
- The latest validation baseline is: `@universo/metahubs-backend` targeted route tests passed 43/43, touched package lint is warning-only with 0 errors, and the final root `pnpm build` completed successfully.

## References

- Active tasks: `memory-bank/tasks.md`.
- Current planning artifact: `memory-bank/plan/metahub-system-attributes-migration-hardening-plan-2026-03-16.md`.
- Package docs entrypoint: `packages/universo-rest-docs/README.md`.
- Generated OpenAPI source: `packages/universo-rest-docs/src/openapi/index.yml`.
- GitBook guide: `docs/en/api-reference/interactive-openapi-docs.md`.
- Architecture patterns: `memory-bank/systemPatterns.md`.
