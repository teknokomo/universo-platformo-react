# Plan: Remove TypeORM From Metahubs and Applications

> Date: 2026-03-09  
> Mode: PLAN  
> Complexity: Level 4 (major backend architecture refactor)  
> Status: DRAFT v2 (QA-reviewed, SQL-first refinement)  
> Scope: Fully remove TypeORM-based migrations and TypeORM-based runtime/repository usage from `@universo/metahubs-backend` and `@universo/applications-backend`, while keeping the current Metahubs and Applications behavior on a fresh database.

---

## Overview

The platform already completed the first migration-platform slice:

- unified platform bootstrap is now driven by `@universo/migrations-*`,
- Metahubs and Applications platform schemas already run from native SQL definitions,
- runtime schema history is partially mirrored into `upl_migrations`.

However, `@universo/metahubs-backend` and `@universo/applications-backend` still depend on TypeORM for:

- entity definitions,
- repositories and query builders,
- request-scoped RLS execution via `QueryRunner`,
- public package exports under `src/database`,
- compatibility migration wrappers and legacy-looking folder structure.

This plan defines the full removal path so that, after completion:

1. `metahubs-backend` and `applications-backend` no longer depend on TypeORM,
2. their `src/database` folders can be deleted,
3. their platform schema definitions are kept as native Universo migration definitions,
4. all request-scoped database access in those packages uses one shared non-TypeORM DB session abstraction,
5. the full Metahub → Publication → Connector → Application flow still works on a fresh database.

This plan assumes:

- the development/test database can be reset,
- old test data does not need backward compatibility,
- schema/template version remains `0.1.0`,
- UUID v7 remains mandatory,
- no legacy dual-path is kept after cutover.

---

## QA Addendum (2026-03-09)

Additional QA review confirms that the overall direction is correct, but the plan must stay strict about five architectural constraints:

1. **Do not build a homemade ORM after removing TypeORM**
   - The replacement layer must stay SQL-first and thin.
   - `DbSession` is allowed as an execution/session abstraction.
   - Domain repositories/query services are allowed as composition boundaries.
   - A generic repository framework, entity identity map, lazy loading, hidden unit-of-work, automatic relation resolution, and opaque query DSL must not be introduced.

2. **Prefer set-based DB execution over object-by-object loops**
   - The lsFusion “No ORM, Yes SQL” lesson is relevant here: operations over many objects should be pushed to the database and executed in one query whenever possible, not materialized into application-side loops by default.
   - This applies especially to:
     - membership lookups,
     - bulk copy flows,
     - publication/application sync projections,
     - runtime metadata updates,
     - cascade soft-delete/archive operations.

3. **Do not invent new UI families for this task**
   - This refactor is backend/persistence/migration work.
   - If minimal operator/admin UI is needed later, it must reuse existing shells and patterns from:
     - `@universo/migration-guard-shared`
     - `@universo/universo-template-mui`
     - `@universo/apps-template-mui`
   - No parallel migration editor shell or custom “technical backend UI” should appear in this task.

4. **Performance and observability must be explicit**
   - SQL-first architecture is only useful if the team can see what it generates and whether it regresses.
   - The plan therefore needs:
     - structured query diagnostics for critical flows,
     - explain/profile snapshots for hot read/write paths,
     - regression checks around N+1 and accidental row-by-row execution.

5. **The final state must remove TypeORM-looking structure, not just TypeORM dependency**
   - It is not enough to stop importing `typeorm`.
   - The packages should also stop exposing a misleading `src/database` shape that implies TypeORM-owned persistence.
   - Final persistence and migration locations must communicate the new architecture clearly.

---

## Requirement Coverage Matrix

- **Requirement 1: analyze and improve the migration architecture, unify Metahubs + Applications**
  - Covered by: Overview, Target Architecture, Phases 1-12.
- **Requirement 2: move from reset-only test DB workflow to a reliable production-grade migration system**
  - Covered by: unified migration platform assumptions, shared runtime history, parity tests, concurrency/recovery tests, acceptance flow.
- **Requirement 3: fully replace TypeORM migrations with the new migration system**
  - Covered by: Phases 5, 11, 12, 17.
- **Requirement 4: prepare DB/file structure-template workflow and future in-app editor**
  - Covered by: Phases 8, 9, 10, plus final round-trip and registry design.
- **Requirement 5: maximize unification because Metahubs are a temporary special case**
  - Covered by: Target Architecture, Phases 8-10, final Metahubs-as-application preparation.
- **Requirement 6: support explicit schema names like `metahubs` and remove the old TypeORM kernel path**
  - Covered by: native migration definitions, Phase 5/17 cleanup, shared migration platform.
- **Requirement 7: redefine Metahub structure/template as application schema/template concepts**
  - Covered by: Phase 10.
- **Requirement 8: keep exact `metahubs` schema parity while migrating away from TypeORM**
  - Covered by: schema parity tests in Phase 14 and native SQL source-of-truth expectations.
- **Requirement 9: preserve the full fresh-db end-to-end product flow**
  - Covered by: Phase 16 acceptance suite and final Definition of Done.

As of this QA pass, the plan covers all numbered parts of the original technical brief at the planning level. The remaining gap is implementation, not planning coverage.

---

## Current Findings From Codebase Audit

### What is already migrated

- Backend startup no longer uses `TypeORM.runMigrations()`.
- Metahubs and Applications platform schemas are registered in `@universo/migrations-platform` through native SQL definitions.
- New migration history is recorded in `upl_migrations`.
- Runtime application/metahub migration events already mirror into the global catalog.

### What still depends on TypeORM

1. **Package public surfaces**
   - `packages/metahubs-backend/base/src/index.ts`
   - `packages/applications-backend/base/src/index.ts`
   - still export `metahubsEntities`, `applicationsEntities`, and old migration arrays.

2. **Package-local `src/database` folders**
   - `packages/metahubs-backend/base/src/database/**`
   - `packages/applications-backend/base/src/database/**`
   - still contain TypeORM entities and compatibility migration wrappers.

3. **Route and guard layers**
   - both packages still inject `getDataSource(): DataSource`,
   - still call `manager.getRepository(...)`, `ds.getRepository(...)`, and `createQueryBuilder(...)`,
   - still depend on `QueryRunner`-aware guards.

4. **Request-scoped RLS**
   - `packages/auth-backend/base/src/middlewares/ensureAuthWithRls.ts`
   - still creates a TypeORM `QueryRunner` per request.

5. **Core backend entity registration**
   - `packages/universo-core-backend/base/src/database/entities/index.ts`
   - still aggregates TypeORM entities from Metahubs and Applications.

6. **Template seeding and schema services**
   - `TemplateSeeder`, `MetahubSchemaService`, branch/publication/application sync services
   - still rely on `EntityManager`, repositories, or `DataSource.transaction(...)`.

### Structural conclusion

The remaining TypeORM dependency is no longer “just migrations”.
It now lives in the persistence model and request execution model.

Therefore, a complete removal requires:

- replacing TypeORM entities with neutral row schemas and domain repositories,
- replacing `DataSource` / `EntityManager` / `QueryRunner` with a shared DB session abstraction,
- removing TypeORM exports from package public APIs,
- relocating native migration definitions out of the legacy `src/database/migrations/postgres` path.

---

## Documentation Inputs Used

### Context7

- Knex official transaction guidance:
  - transaction callback reuse,
  - transaction provider reuse,
  - atomic multi-step writes,
  - migration transaction controls.
- TypeORM official guidance:
  - `QueryRunner` lifecycle,
  - repository usage inside transaction-specific managers,
  - migration transaction modes.

### External references

- lsFusion official site and feature docs:
  - “No ORM, Yes SQL”
  - single-query / DB-side execution for many-object processing
  - declarative logic and DB pushdown principles
- Additional SQL-first ecosystem references were reviewed only as supporting patterns, not as direct stack recommendations.

### Local code and memory-bank

- `memory-bank/tasks.md`
- `memory-bank/activeContext.md`
- `memory-bank/techContext.md`
- `memory-bank/systemPatterns.md`
- existing migration-platform plan
- local package READMEs for:
  - `metahubs-backend`
  - `applications-backend`
  - `schema-ddl`

### Interpretation

The most important official constraint is:

- if request-scoped RLS is built on one transaction/connection context, every repository/query in that request must run through that same context;
- if TypeORM is removed, the replacement must preserve this exact “single request-scoped DB session” behavior.

The most important architectural lesson from lsFusion for this plan is:

- “no ORM” is valuable only if it also avoids row-by-row object materialization and pushes multi-object work to the database in set-oriented form.

That makes Knex the correct execution substrate for these packages, because:

- runtime schema code already uses it,
- the migration platform already uses it,
- it provides explicit transaction boundaries without introducing a second ORM,
- it lets the codebase stay SQL-first instead of rebuilding an object mapper.

---

## Target Architecture

### Core decision

Do **not** replace TypeORM in Metahubs/Applications with another ORM.

Instead:

- keep **Knex + PostgreSQL** as the execution layer,
- introduce a shared **Universo DB session abstraction**,
- move domain persistence to explicit repository/query-service modules,
- keep Zod validation for DTOs and add row-level decoding where needed.

### SQL-first guardrail

The target architecture must follow this rule:

- abstractions may organize queries,
- abstractions must not hide SQL semantics.

Allowed:

- thin repositories per aggregate,
- query modules,
- row decoders,
- session/transaction helpers,
- shared SQL fragments and builders.

Forbidden:

- generic base repository inheritance trees,
- entity graphs with lazy relations,
- query composition DSLs that obscure final SQL,
- automatic write tracking / dirty checking,
- generic CRUD engines that reintroduce ORM behavior.

### New target layering

```text
HTTP Route
  -> Guard / access policy
  -> Domain service
  -> Domain repository / query service
  -> Shared DB session (request-scoped or transaction-scoped)
  -> Knex / raw SQL (parameterized, schema-qualified)
```

### Query design rule

For non-trivial reads/writes, prefer:

- one explicit set-based SQL statement,
- or one small bounded transaction containing a small number of explicit statements.

Avoid:

- per-row follow-up queries by default,
- app-side loops that emulate joins/aggregations,
- hidden N+1 repository calls.

### Shared infrastructure placement

- Shared DB session types/helpers: `@universo/utils/database`
- Shared persistence types/DTOs: `@universo/types`
- Shared migration platform: `@universo/migrations-*`
- Domain-specific persistence modules stay inside their own packages

### Folder target after cutover

#### Applications backend

Replace:

- `src/database/entities/*`
- `src/database/migrations/postgres/*`

With something like:

- `src/platform/migrations/*`
- `src/persistence/repositories/*`
- `src/persistence/sql/*`
- `src/persistence/row-schemas/*`

#### Metahubs backend

Replace:

- `src/database/entities/*`
- `src/database/migrations/postgres/*`

With something like:

- `src/platform/migrations/*`
- `src/persistence/repositories/*`
- `src/persistence/sql/*`
- `src/persistence/row-schemas/*`

### Deletion rule

At final closure:

- `packages/metahubs-backend/base/src/database` must not exist.
- `packages/applications-backend/base/src/database` must not exist.
- neither package may depend on `typeorm` in `package.json`.
- neither package may export TypeORM entities or migration arrays.

---

## Affected Areas

### Shared / platform infrastructure

- `packages/universo-utils/base/src/database/*`
- `packages/universo-types/base/*`
- `packages/universo-core-backend/base/src/DataSource.ts`
- `packages/universo-core-backend/base/src/database/entities/index.ts`
- `packages/universo-core-backend/base/src/routes/index.ts`
- `packages/auth-backend/base/src/middlewares/ensureAuthWithRls.ts`
- `packages/auth-backend/base/src/services/permissionService.ts`
- `packages/admin-backend/base/src/services/*`
- `packages/universo-migrations-platform/base/src/platformMigrations.ts`

### Applications backend

- `packages/applications-backend/base/package.json`
- `packages/applications-backend/base/src/index.ts`
- `packages/applications-backend/base/src/routes/*`
- `packages/applications-backend/base/src/utils/*`
- `packages/applications-backend/base/src/database/**` (to be removed)

### Metahubs backend

- `packages/metahubs-backend/base/package.json`
- `packages/metahubs-backend/base/src/index.ts`
- `packages/metahubs-backend/base/src/domains/router.ts`
- `packages/metahubs-backend/base/src/domains/**/routes/*`
- `packages/metahubs-backend/base/src/domains/**/services/*`
- `packages/metahubs-backend/base/src/utils/*`
- `packages/metahubs-backend/base/src/database/**` (to be removed)

### Tests / tooling

- backend Jest configs
- route/service integration suites
- migration parity tests
- browser/API end-to-end flow tests

---

## Explicit Non-Goals

- Do not redesign Metahubs UI in this task.
- Do not move current Metahubs UI into `apps-template-mui` in this task.
- Do not bump metahub structure/template version.
- Do not preserve TypeORM compatibility code after cutover.
- Do not introduce a second ORM.
- Do not build a custom ORM-like abstraction under another name.

---

## Plan Steps

### Phase 0. Freeze acceptance and deletion criteria

- Define final completion criteria before implementation starts.
- Add explicit “done means” checklist:
  - no `typeorm` dependency in Metahubs/Applications packages,
  - no `src/database` folders in those packages,
  - no TypeORM imports in those packages,
  - no TypeORM exports from those packages,
  - fresh DB bootstrap works,
  - full acceptance flow from the original brief works,
  - deep test matrix is green.

Deliverable:

- acceptance checklist embedded into active plan and task tracker.

### Phase 1. Introduce the neutral DB session contract

- Expand the shared request/session contract in `@universo/utils/database` into a full neutral API:
  - `DbSession`
  - `DbTransaction`
  - `RequestDbSession`
  - helper accessors for transaction reuse
  - helper accessors for schema-qualified parameterized queries
- Ensure services can accept either:
  - root session,
  - request-bound session,
  - nested transaction session.

Recommended interface:

```ts
export interface DbSession {
  readonly knex: Knex | Knex.Transaction
  query<T = unknown>(sql: string, bindings?: readonly unknown[]): Promise<T>
  transaction<T>(task: (trx: DbSession) => Promise<T>): Promise<T>
  isTransaction(): boolean
}
```

Safe implementation note:

- nested transaction calls must reuse the existing transaction when already inside one,
- request-scoped RLS context must be created once and passed downward,
- SQL must stay parameterized and schema-qualified.
- the session contract must stay intentionally small so it cannot grow into a pseudo-ORM surface.

### Phase 2. Replace TypeORM QueryRunner-based RLS transport

- Refactor `ensureAuthWithRls` so it no longer creates a TypeORM `QueryRunner`.
- Replace it with a Knex/pg-backed request session that:
  - acquires one connection for the request,
  - starts a request transaction if required by the RLS contract,
  - sets PostgreSQL session/local variables for claims,
  - exposes that connection/session via the shared `DbSession` contract,
  - reliably cleans up on `finish` / `close` / error.

Safe pattern:

```ts
await knex.transaction(async (trx) => {
  await trx.raw('SELECT set_config(?, ?, true)', ['request.jwt.claims', JSON.stringify(claims)])
  req.dbSession = createRequestDbSession(trx)
  await nextAsync()
})
```

Important:

- only use transaction-local or connection-local settings that are explicitly reset by transaction end,
- do not rely on ambient `search_path`,
- do not keep a connection pinned after response completion.

### Phase 3. Introduce explicit repositories/query services for Applications

- Create neutral persistence modules for:
  - `Application`
  - `ApplicationUser`
  - `Connector`
  - `ConnectorPublication`
- Replace TypeORM entities and repositories with:
  - row schemas,
  - repository modules,
  - explicit query helpers,
  - transaction-aware writes.

Suggested structure:

```text
src/persistence/repositories/applicationRepository.ts
src/persistence/repositories/connectorRepository.ts
src/persistence/row-schemas/applicationRow.ts
src/persistence/sql/applicationSql.ts
```

Rules:

- decode DB rows with Zod where row shape is non-trivial,
- return domain-safe objects, not raw `any`,
- all writes must increment audit/version fields explicitly,
- use one repository contract per aggregate root,
- forbid a generic `BaseRepository<T>` pattern,
- prefer explicit SQL for complex joins, aggregates, and bulk updates.

### Phase 4. Rewrite Applications guards and routes off TypeORM

- Refactor:
  - `routes/guards.ts`
  - `routes/applicationsRoutes.ts`
  - `routes/connectorsRoutes.ts`
  - `routes/index.ts`
- Replace:
  - `DataSource`
  - `EntityManager`
  - `Repository`
  - `createQueryBuilder`
with the new repository/query-service layer.

Important migration order:

1. guards and membership reads,
2. list/detail reads,
3. create/update/delete writes,
4. copy flows,
5. connector-publication joins,
6. transaction-heavy flows.

Acceptance for this phase:

- no TypeORM imports remain in `applications-backend`,
- `applications-backend/package.json` no longer depends on `typeorm`.

### Phase 5. Relocate Applications platform migration definitions and remove `src/database`

- Move native SQL definition files out of:
  - `src/database/migrations/postgres`
- into a neutral path like:
  - `src/platform/migrations`
- delete:
  - compatibility TypeORM migration wrapper,
  - migration array index,
  - entity exports,
  - `src/database` folder entirely.

Update exports:

- `createApplicationsSchemaMigrationDefinition` should be exported from a non-TypeORM path.

### Phase 6. Introduce explicit repositories/query services for Metahubs

- Create neutral persistence modules for:
  - `Metahub`
  - `MetahubBranch`
  - `MetahubUser`
  - `Publication`
  - `PublicationVersion`
  - `Template`
  - `TemplateVersion`
- Prioritize the aggregates that feed runtime schema orchestration first:
  - branches,
  - metahubs,
  - templates,
  - publications.

Special note:

- `MetahubSchemaService` and branch/template/publication services already combine Knex runtime DDL with TypeORM metadata access.
- This package must move to one persistence substrate end-to-end.
- For Metahubs specifically, copy/publish/sync flows should be reviewed for set-based rewriting opportunities before doing a line-by-line repository port.

### Phase 7. Rewrite Metahubs guards, services, and routes off TypeORM

- Refactor:
  - `domains/shared/guards.ts`
  - `domains/router.ts`
  - all touched routes under `domains/*/routes`
  - template seeder,
  - branch services,
  - publication services,
  - `MetahubSchemaService`
  - application sync routes that still read static metadata through TypeORM

Order:

1. shared access guards,
2. template seeding and template reads,
3. metahub and branch CRUD,
4. publication/version flows,
5. application sync / migration route helpers,
6. remaining design-time entity routes.

Important:

- for copy flows and multi-write flows, port transaction blocks first,
- for list routes, preserve current filtering, sorting, and pagination semantics exactly.

### Phase 8. Unify runtime history contracts for `_mhb_migrations` and `_app_migrations`

- Keep local tables if they are still needed for product semantics,
  but normalize contracts so they are clearly one platform pattern.
- Standardize:
  - run id,
  - scope metadata,
  - summary,
  - before/after snapshots,
  - warnings,
  - global catalog link.

Target outcome:

- one shared runtime migration record contract in shared code,
- package-local metadata builders only wrap the shared model.

### Phase 9. Build DB/file desired-state registry for future editor flows

- Add native Universo support tables for:
  - definition registry,
  - definition revisions,
  - exports,
  - approval/audit events
- Store canonical application/metahub desired-state documents there.
- Define export/import contracts for filesystem round-trip.

Important:

- these tables must be created only via the new migration system,
- not via TypeORM,
- not as ad hoc bootstrapping.

### Phase 10. Reframe Metahubs structure/template as application definition concepts

- Define canonical terminology:
  - Metahub structure → application schema definition
  - Metahub template → application template/seed definition
- Add explicit transformation contracts between:
  - DB definition,
  - file definition,
  - publication snapshot,
  - runtime schema snapshot.

This phase prepares the future self-hosted “Metahubs as application” model.

### Phase 11. Remove TypeORM from package exports and core entity registry

- Delete `metahubsEntities` and `applicationsEntities` exports.
- Remove Metahubs/Applications entities from:
  - `packages/universo-core-backend/base/src/database/entities/index.ts`
- Ensure core backend no longer expects those packages to contribute TypeORM entities.

Potential companion refactor:

- split remaining TypeORM-based packages from the non-TypeORM packages more clearly,
- or prepare a future separate persistence bootstrap path for legacy packages until they are ported too.

### Phase 12. Remove `typeorm` from package dependencies

- Remove `typeorm` from:
  - `packages/metahubs-backend/base/package.json`
  - `packages/applications-backend/base/package.json`
- Remove obsolete TypeORM-only helpers, exports, docs, and tests from those packages.
- Update READMEs and migration docs to describe the new persistence and migration model.

### Phase 13. Update public architecture docs and package boundaries

- Update READMEs:
  - `metahubs-backend`
  - `applications-backend`
  - `core-backend`
  - `auth-backend` if RLS contract changed
- Explain the new architecture clearly:
  - platform migrations,
  - runtime migrations,
  - request DB session,
  - persistence repositories,
  - no TypeORM in Metahubs/Applications.

### Phase 14. Deep parity and schema-safety tests

- Add schema parity tests that assert exact static schema shape for:
  - `metahubs`
  - `applications`
- Validate:
  - tables,
  - columns,
  - enums,
  - defaults,
  - indexes,
  - unique constraints,
  - foreign keys,
  - RLS enabled state,
  - policies,
  - triggers/functions if present.

Recommended pattern:

- create fresh DB,
- apply unified platform migrations,
- snapshot `information_schema`, `pg_indexes`, `pg_constraint`, `pg_policies`, `pg_type`,
- compare to approved golden snapshot.

Also add:

- hot query `EXPLAIN` snapshots for selected critical flows so that the no-ORM rewrite does not accidentally regress into worse plans.

### Phase 15. Backend integration and concurrency tests

- Add backend integration suites for:
  - request-scoped RLS session lifecycle,
  - nested transactions,
  - guard enforcement,
  - copy/delete flows,
  - publication creation/version promotion,
  - application sync from publication,
  - mirrored runtime history,
  - failure recovery,
- concurrent schema sync lock behavior.

Add explicit performance regression checks for:

- N+1 prevention in application list/detail flows,
- N+1 prevention in metahub branch/publication/template flows,
- bulk copy/update/delete flows remaining set-based where expected.

Testing substrate recommendation:

- use real PostgreSQL in isolation for integration tests,
- prefer Testcontainers for reproducible local/CI DB tests.

### Phase 16. Full acceptance tests for the original technical brief

- Add end-to-end acceptance coverage for the fresh-db scenario:
  1. boot system on fresh DB,
  2. open `/metahubs`,
  3. create Metahub,
  4. verify branch schema `mhb_*`,
  5. create basic design-time model,
  6. create publication/version,
  7. create application/connector,
  8. create target schema `app_*`,
  9. verify data transfer and runtime usability.

Recommended split:

- backend API acceptance via Jest + Supertest,
- browser acceptance via Playwright.

Playwright is justified here because:

- the brief explicitly expects UI-visible working behavior,
- current unit/component tests are not enough for the full flow.

### Phase 17. Final deletion pass

- Delete:
  - `src/database` in both packages,
  - remaining compatibility wrappers,
  - obsolete migration exports,
  - obsolete entity exports,
  - TypeORM-only tests/docs in those packages.
- Re-run root build, touched lints, full backend tests, full frontend tests, and acceptance suites.

---

## Implementation Batches

This section translates the phases into concrete implementation batches that can be delivered as safe, reviewable PR slices.

### Batch 0. Preparation and acceptance freeze

**Scope**

- freeze the final Definition of Done in active planning/tracking docs,
- document exact deletion criteria for:
  - `packages/applications-backend/base/src/database`
  - `packages/metahubs-backend/base/src/database`
- identify the current highest-risk TypeORM entry points and mark them as migration blockers.

**Files/packages**

- `memory-bank/tasks.md`
- `memory-bank/activeContext.md`
- `memory-bank/plan/remove-typeorm-from-metahubs-applications-plan-2026-03-09.md`

**Exit criteria**

- the team agrees on explicit closure gates,
- no ambiguity remains about what “fully removed” means.

### Batch 1. Shared DB session kernel

**Goal**

- promote the current request DB helper work into the final neutral contract that the rest of the refactor depends on.

**Scope**

- finalize `DbSession` / `RequestDbSession` / transaction reuse contract,
- expose safe helpers from `@universo/utils/database`,
- add row/query helper utilities that stay SQL-first and parameterized.

**Primary packages**

- `@universo/utils`
- `@universo/types` if shared types are needed

**No-go**

- no domain migration yet,
- no ORM-like repository framework.

**Exit criteria**

- shared DB session contract is stable and small,
- no hidden ORM semantics have entered the abstraction.

### Batch 2. RLS transport cutover

**Goal**

- remove TypeORM `QueryRunner` from request-scoped RLS for the touched domains.

**Scope**

- refactor `ensureAuthWithRls`,
- replace request-bound `QueryRunner` lifecycle with request-bound DB session lifecycle,
- update `permissionService` and other touched auth/admin helpers to accept the neutral session contract.

**Primary packages**

- `@universo/auth-backend`
- `@universo/admin-backend`
- `@universo/core-backend`
- `@universo/utils`

**Critical tests**

- request cleanup,
- RLS claim propagation,
- nested request reads/writes inside same session.

**Exit criteria**

- touched request flows no longer require TypeORM `QueryRunner`,
- RLS integration tests pass.

### Batch 3. Applications persistence foundation

**Goal**

- build the non-TypeORM persistence layer for Applications before touching routes.

**Scope**

- add row schemas,
- add SQL modules,
- add repositories/query services for:
  - applications,
  - application users,
  - connectors,
  - connector publications.

**Primary package**

- `@universo/applications-backend`

**Critical tests**

- repository integration tests,
- row decode tests,
- query-shape checks for key list/detail flows.

**Exit criteria**

- route code can be switched package-by-package without new persistence primitives.

### Batch 4. Applications guards cutover

**Goal**

- remove TypeORM from Applications access control first.

**Scope**

- rewrite `routes/guards.ts`,
- switch membership lookup and connector/application access checks to the new repositories,
- remove `DataSource` / `QueryRunner` dependencies from Applications guards.

**Why first**

- this reduces the biggest coupling multiplier before route CRUD refactors.

**Exit criteria**

- guards run only on neutral DB session + repositories.

### Batch 5. Applications route cutover

**Goal**

- fully move Applications CRUD and copy flows off TypeORM.

**Scope**

- `routes/applicationsRoutes.ts`
- `routes/connectorsRoutes.ts`
- `routes/index.ts`
- local utilities that still expose DataSource-based helpers

**Sub-order**

1. list/detail reads
2. create/update/delete
3. copy flows
4. membership flows
5. connector-publication join flows

**Performance guardrail**

- explicitly collapse multi-step list/detail enrichment into set-based SQL where possible,
- ban app-side N+1 loops during review.

**Exit criteria**

- no `typeorm` imports remain in `applications-backend/src/routes`,
- package builds/tests pass.

### Batch 6. Applications migration/export cleanup

**Goal**

- finish Applications package cleanup and make `src/database` removable.

**Scope**

- move native migration definitions to `src/platform/migrations`,
- remove compatibility exports from `src/index.ts`,
- remove `applicationsMigrations`,
- remove entity exports,
- remove `src/database`.

**Exit criteria**

- `packages/applications-backend/base/src/database` is deleted,
- `applications-backend/package.json` has no `typeorm`,
- package public API no longer exposes TypeORM-era surfaces.

### Batch 7. Metahubs persistence foundation

**Goal**

- build the non-TypeORM persistence layer for Metahubs before touching route/service orchestration.

**Scope**

- add repositories/query services for:
  - metahubs,
  - branches,
  - memberships,
  - publications,
  - publication versions,
  - templates,
  - template versions.

**Primary package**

- `@universo/metahubs-backend`

**Important**

- prioritize aggregates used by `MetahubSchemaService`, branch flows, publication flows, and application-sync bridging.

**Exit criteria**

- all core read/write operations needed by metahub services are available without TypeORM.

### Batch 8. Metahubs guards and branch/template services cutover

**Goal**

- remove shared TypeORM dependency from Metahubs authorization and branch/template service foundations.

**Scope**

- `domains/shared/guards.ts`
- branch services
- template seeder and template reads
- early parts of `MetahubSchemaService` that currently read static metadata through repositories

**Exit criteria**

- guard layer no longer depends on `DataSource` / `QueryRunner`,
- template and branch services run on neutral persistence.

### Batch 9. Metahubs route cutover: design-time CRUD

**Goal**

- port the broad CRUD surface without yet doing the heaviest publication/application-sync orchestration.

**Scope**

- metahubs
- hubs
- catalogs
- sets
- enumerations
- attributes
- constants
- elements
- layouts
- settings

**Review rule**

- any route that currently uses repeated repository calls for enrichment must be rewritten to explicit set-based SQL if it is already a hot path.

**Exit criteria**

- design-time CRUD routes no longer import TypeORM.

### Batch 10. Metahubs route cutover: publications and application sync

**Goal**

- migrate the heaviest orchestration paths last, after the shared persistence foundation is already stable.

**Scope**

- `domains/publications/routes/publicationsRoutes.ts`
- `domains/applications/routes/applicationMigrationsRoutes.ts`
- `domains/applications/routes/applicationSyncRoutes.ts`
- helpers used for publication-driven linked application creation

**Critical areas**

- publication version creation,
- linked application creation,
- connector/publication mapping,
- runtime schema sync reads of static metadata,
- notification/update-available logic.

**Exit criteria**

- publication -> application flow is TypeORM-free inside Metahubs package.

### Batch 11. Metahubs migration/export cleanup

**Goal**

- finish Metahubs package cleanup and make `src/database` removable.

**Scope**

- move native migration definitions to `src/platform/migrations`,
- remove compatibility exports from `src/index.ts`,
- remove `metahubsMigrations`,
- remove entity exports,
- remove `src/database`.

**Exit criteria**

- `packages/metahubs-backend/base/src/database` is deleted,
- `metahubs-backend/package.json` has no `typeorm`,
- package public API no longer exposes TypeORM-era surfaces.

### Batch 12. Core backend cleanup

**Goal**

- remove the remaining core expectations that Metahubs/Applications are TypeORM-contributing packages.

**Scope**

- remove Metahubs/Applications from core entity registry,
- update route factory signatures if they no longer need `getDataSource`,
- update startup/bootstrap docs and package contracts.

**Exit criteria**

- core backend no longer treats Metahubs/Applications as TypeORM providers.

### Batch 13. Runtime history unification + DB/file registry

**Goal**

- finish the deeper migration-platform work that remains after TypeORM removal.

**Scope**

- unify `_mhb_migrations` / `_app_migrations` contracts,
- add desired-state registry/revisions/exports,
- prepare DB/file round-trip.

**Exit criteria**

- runtime migration model is clearly one platform pattern,
- DB/file round-trip foundation exists.

### Batch 14. Acceptance and final deletion closure

**Goal**

- prove the entire original brief works on a fresh DB and close the refactor honestly.

**Scope**

- schema parity tests,
- backend integration suites,
- concurrency suites,
- full acceptance e2e,
- docs cleanup,
- final dead-code sweep.

**Exit criteria**

- all Definition of Done checks are green.

---

## PR Slices

The safest PR sequence is:

1. **PR-01**: Shared DB session kernel hardening
2. **PR-02**: RLS transport without QueryRunner
3. **PR-03**: Applications repositories/query services
4. **PR-04**: Applications guards + routes cutover
5. **PR-05**: Applications `src/database` deletion
6. **PR-06**: Metahubs repositories/query services
7. **PR-07**: Metahubs guards + branch/template cutover
8. **PR-08**: Metahubs design-time CRUD route cutover
9. **PR-09**: Metahubs publications + application-sync cutover
10. **PR-10**: Metahubs `src/database` deletion
11. **PR-11**: Core backend export/registry cleanup
12. **PR-12**: Runtime history unification + DB/file registry foundation
13. **PR-13**: Full parity, performance, and e2e closure

Each PR should be mergeable on its own and must not leave the workspace in a half-broken state.

---

## Package-by-Package Exit Gates

### Applications backend: when `src/database` may be deleted

Delete `packages/applications-backend/base/src/database` only after all of the following are true:

- no `typeorm` imports remain under `src/routes`, `src/utils`, or `src/index.ts`,
- no `DataSource` appears in public route factory contracts for Applications,
- no `getRepository`, `EntityManager`, or `createQueryBuilder` remains in the package,
- native migration definitions have moved to `src/platform/migrations`,
- package tests and builds are green,
- root build is green.

### Metahubs backend: when `src/database` may be deleted

Delete `packages/metahubs-backend/base/src/database` only after all of the following are true:

- no `typeorm` imports remain under `src/domains/**` or `src/utils`,
- `MetahubSchemaService`, branch services, publications, and application-sync flows no longer use `DataSource` / `EntityManager`,
- shared guards and route factories no longer depend on `DataSource`,
- native migration definitions have moved to `src/platform/migrations`,
- template seeding and publication-linked application creation are green,
- package tests and builds are green,
- root build is green.

---

## Review Checklist Per Batch

Every implementation batch should be reviewed against this checklist:

- Does this batch reduce TypeORM usage, or did it only move it?
- Did we accidentally introduce a generic ORM-like abstraction?
- Are the new queries explicit, parameterized, and schema-qualified?
- Did any hot path regress into N+1 or app-side row loops?
- Are transactions explicit and correctly reused?
- Are `_upl_*`, `_mhb_*`, `_app_*` audit/version fields still handled correctly?
- Did we avoid inventing new UI surfaces?
- Did we update tests to cover the touched behavior, not just compile-time types?

---

## Recommended Safe Code Patterns

### 1. Shared DB session contract

```ts
export interface DbSession {
  readonly knex: Knex | Knex.Transaction
  readonly kind: 'root' | 'request' | 'transaction'
  query<T = unknown>(sql: string, bindings?: readonly unknown[]): Promise<T>
  transaction<T>(task: (trx: DbSession) => Promise<T>): Promise<T>
}
```

Why:

- explicit transaction reuse,
- no hidden global manager,
- no ORM-specific surface.

### 2. Repository with explicit SQL and row decoding

```ts
const applicationRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().nullable(),
  schema_name: z.string().nullable(),
  _upl_version: z.number().int()
})

export class ApplicationRepository {
  constructor(private readonly db: DbSession) {}

  async findById(id: string) {
    const row = await this.db.knex('applications.applications')
      .select('id', 'slug', 'schema_name', '_upl_version')
      .where({ id, _upl_deleted: false })
      .first()

    return row ? applicationRowSchema.parse(row) : null
  }
}
```

Why:

- explicit selected columns,
- predictable decoding,
- no hidden lazy-loading or entity mutation semantics.

### 3. Request-scoped RLS session

```ts
await knex.transaction(async (trx) => {
  await trx.raw('SELECT set_config(?, ?, true)', [
    'request.jwt.claims',
    JSON.stringify(jwtClaims)
  ])

  req.dbSession = createRequestDbSession(trx)
  await nextAsync()
})
```

Why:

- request claims are tied to the same DB session,
- cleanup is automatic at transaction end,
- no manual `QueryRunner.release()` lifecycle.

### 4. Native migration definition in neutral path

```ts
export const createApplicationsSchemaMigrationDefinition = {
  id: 'CreateApplicationsSchema1800000000000',
  version: '1800000000000',
  summary: 'Create applications platform schema',
  up: [{ sql: 'CREATE SCHEMA IF NOT EXISTS applications' }],
  down: [{ sql: 'DROP SCHEMA IF EXISTS applications CASCADE' }]
} satisfies SqlPlatformMigrationDefinition
```

Why:

- one source of truth,
- stable checksum input,
- no TypeORM wrapper needed.

---

## Potential Challenges

### RLS correctness

Risk:

- replacing `QueryRunner` incorrectly can silently bypass or break RLS.

Mitigation:

- move RLS transport first,
- add dedicated RLS integration tests,
- forbid fallback to a root/global session inside request-handling code.

### Transaction semantics drift

Risk:

- TypeORM `manager.transaction(...)` and Knex transactions are not drop-in identical in existing flows.

Mitigation:

- port transaction-heavy flows with explicit tests first,
- use one `DbSession` contract everywhere,
- forbid mixed TypeORM + Knex transaction orchestration in the same flow after each phase cutover.

### Query semantics drift

Risk:

- `createQueryBuilder` rewrites can accidentally change joins, filters, pagination, or soft-delete behavior.

Mitigation:

- snapshot SQL/result behavior before porting,
- add route integration tests before and after each port,
- port one aggregate at a time.

### Build-order fragility

Risk:

- monorepo package build resolution can still be order-sensitive.

Mitigation:

- avoid new `src` cross-package imports,
- prefer stable package exports,
- consider TS project references if the current `dist`-based resolution remains brittle.

### Over-scoping

Risk:

- trying to remove TypeORM from every package at once will stall delivery.

Mitigation:

- this plan removes TypeORM fully from Metahubs/Applications first,
- Admin/Auth/Core can keep transitional internals temporarily as long as Metahubs/Applications stop importing TypeORM directly.

---

## Full Test Strategy

### Unit tests

- DB session helper behavior
- row decoders and repository mapping
- SQL identifier/scope validation
- migration definition checksum stability
- SQL fragment builders and query-shape helpers for set-based operations

### Repository integration tests

- Applications repositories
- Metahubs repositories
- guards and membership lookup
- transaction rollback behavior
- query-count and query-shape assertions for hot paths

### Migration parity tests

- static schema parity for `metahubs`
- static schema parity for `applications`
- runtime history mirror correctness

### RLS tests

- claims propagation into DB session
- request isolation
- guard behavior under restricted membership
- cleanup of request session after response close

### Route integration tests

- CRUD for applications/connectors/members
- CRUD for metahubs/branches/publications/templates
- publication-driven linked application creation
- application sync and resync flows

### Concurrency tests

- repeated startup migration race
- concurrent metahub schema ensure
- concurrent application sync
- lock timeout behavior

### Acceptance / browser e2e

- `/metahubs` create flow
- publication/version creation
- application + connector creation
- generated `app_*` schema validation
- published runtime smoke flow

### Validation gates

Every phase must pass:

- touched package lint,
- touched package test suites,
- touched package builds,
- root `pnpm build`.

Before final closure:

- full backend acceptance suite,
- full browser acceptance suite,
- schema parity suite,
- critical-path query profile / explain review,
- root build green.

---

## Milestones

### Milestone A

- shared DB session contract exists,
- request-scoped RLS no longer uses TypeORM QueryRunner.

### Milestone B

- `applications-backend` fully off TypeORM,
- `packages/applications-backend/base/src/database` deleted.

### Milestone C

- `metahubs-backend` fully off TypeORM,
- `packages/metahubs-backend/base/src/database` deleted.

### Milestone D

- full acceptance flow from the original brief is green on fresh DB,
- no TypeORM imports remain in Metahubs/Applications packages.

---

## Final Definition of Done

The task is complete only when all of the following are true:

- Metahubs and Applications platform migrations are native Universo migrations.
- Metahubs and Applications runtime flows use the unified migration platform and shared runtime-history model.
- `@universo/metahubs-backend` does not depend on TypeORM.
- `@universo/applications-backend` does not depend on TypeORM.
- both packages have no `src/database` directory.
- no TypeORM entities or migration arrays are exported from those packages.
- request-scoped RLS works without TypeORM QueryRunner for the touched domains.
- fresh DB bootstrap works.
- original acceptance flow works end-to-end.
- deep automated tests are in place and green.

---

## Recommended Next Implementation Order

If implementation starts immediately, the safest order is:

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6
7. Phase 7
8. Phase 11
9. Phase 12
10. Phase 14
11. Phase 15
12. Phase 16
13. Phase 17

This order removes risk from the smaller Applications surface first, then ports the larger Metahubs surface with the shared infrastructure already proven.
