# Plan: Final TypeORM Removal From Metahubs and Applications

> Date: 2026-03-09  
> Mode: PLAN  
> Complexity: Level 4 (major backend refactor)  
> Status: DRAFT v3 (rebased to current code state)  
> Supersedes: `remove-typeorm-from-metahubs-applications-plan-2026-03-09.md` for execution sequencing  
> Scope: fully remove TypeORM migrations, TypeORM persistence, and TypeORM-looking package structure from `@universo/metahubs-backend` and `@universo/applications-backend`, while preserving the original technical brief behavior on a fresh database.

---

## Executive Summary

The migration platform slice is already materially improved:

- backend startup no longer uses `TypeORM.runMigrations()`,
- `metahubs` and `applications` platform schemas already run from native SQL definitions,
- runtime migration events already mirror into `upl_migrations`,
- part of `applications-backend` route logic is already SQL-first.

However, the roadmap is still not complete.

The remaining TypeORM dependency is no longer “mostly migrations”. It now lives in:

- request-scoped RLS transport,
- route/service persistence paths,
- entity exports and package public surfaces,
- `src/database` folder structure,
- tests and documentation that still describe TypeORM as the backend access model.

This plan defines the final removal path.

At true closure:

1. `@universo/applications-backend` has no `typeorm` dependency, no `src/database`, and no TypeORM imports.
2. `@universo/metahubs-backend` has no `typeorm` dependency, no `src/database`, and no TypeORM imports.
3. request-scoped DB work for these packages runs through a neutral Knex-based session/executor contract.
4. the full fresh-database acceptance flow from the original technical brief is validated.
5. no legacy compatibility wrappers remain in those two packages.

---

## Requirement Coverage Matrix

- **Requirement 1: analyze and improve migration architecture, fully unify Metahubs and Applications**
  - Covered by: Executive Summary, Current Verified State, Batches 8-13.
- **Requirement 2: move from reset-only workflow to a reliable production-grade migration/data change system**
  - Covered by: Batches 10-13 and the full test matrix.
- **Requirement 3: fully replace TypeORM migrations and TypeORM persistence with the new system**
  - Covered by: Batches 1-9 plus Definition Of Done.
- **Requirement 4: prepare DB/file structure-template workflow for future editor flows**
  - Covered by: Batches 10-12.
- **Requirement 5: maximize unification because Metahubs are a temporary special case**
  - Covered by: Executive Summary, Structural conclusion, Batches 10-12.
- **Requirement 6: support fixed schema names like `metahubs` and remove the old TypeORM kernel path**
  - Covered by: already completed migration-platform slice plus Batches 9-13 for cleanup/closure.
- **Requirement 7: redefine Metahub structure/template as application-definition concepts**
  - Covered by: Batch 12.
- **Requirement 8: preserve exact `metahubs` schema parity**
  - Covered by: schema parity tests in Batch 13.
- **Requirement 9: preserve the full fresh-db product flow**
  - Covered by: Batch 13 full acceptance tests and Definition Of Done.

At the planning level, the original technical brief is fully covered by this roadmap.

---

## Inputs Used For This Plan

### Local code audit

Reviewed:

- `packages/applications-backend/base/README.md`
- `packages/metahubs-backend/base/README.md`
- existing `memory-bank` migration plans
- `.backup/deep-research-report-migrations.md`
- current TypeORM usage map across:
  - `applications-backend`
  - `metahubs-backend`
  - `auth-backend`

### Context7 references

- Knex official docs for:
  - transactions,
  - transaction reuse,
  - raw queries,
  - migration transaction behavior.
- TypeORM official docs for:
  - `QueryRunner`,
  - `EntityManager`,
  - transaction-scoped repository usage.

### External reference

- lsFusion official site:
  - “No ORM, Yes SQL”
  - “single query for many objects”
  - “open database structure”

Interpretation used in this plan:

- removing ORM is useful only if multi-object work is pushed to SQL in set-based form,
- the replacement architecture must not recreate ORM behavior under another name,
- the final shape must be clearly SQL-first both in code and in package structure.

### Supabase note

- Direct Supabase inspection was intentionally skipped for this planning pass.
- Reason: the current test database still contains pre-refactor data and is not a reliable acceptance source for the final roadmap.
- This roadmap therefore treats a fresh database as the only valid verification baseline.

---

## Current Verified State

### Already done

- Unified migration platform packages exist and are live.
- Platform bootstrap is Knex-based and fail-fast.
- `metahubs` and `applications` static platform schemas are native SQL migration definitions.
- Runtime migration runs mirror into `upl_migrations`.
- `applications-backend` connectors route is SQL-first.
- `applications-backend` top-level CRUD, members, runtime schema lookup, and copy-flow are largely SQL-first.
- Public request-scoped DB surface already exposes `DbSession` and `DbExecutor`.

### Still blocking final closure

#### Applications backend

TypeORM still remains in or around:

- `packages/applications-backend/base/src/routes/index.ts`
- `packages/applications-backend/base/src/routes/guards.ts`
- `packages/applications-backend/base/src/routes/applicationsRoutes.ts` (remaining mixed flow)
- `packages/applications-backend/base/src/persistence/applicationsStore.ts` (`DataSource`-typed seams still present)
- `packages/applications-backend/base/src/database/**`
- `packages/applications-backend/base/src/utils/queryHelpers.ts`

#### Metahubs backend

TypeORM is still widespread across:

- `packages/metahubs-backend/base/src/domains/router.ts`
- `packages/metahubs-backend/base/src/domains/**/routes/*`
- `packages/metahubs-backend/base/src/domains/**/services/*`
- `packages/metahubs-backend/base/src/domains/publications/helpers/createLinkedApplication.ts`
- `packages/metahubs-backend/base/src/utils/queryHelpers.ts`
- `packages/metahubs-backend/base/src/database/**`

#### Shared backend transport

TypeORM still remains in:

- `packages/auth-backend/base/src/middlewares/ensureAuthWithRls.ts`
- `packages/auth-backend/base/src/guards/*`
- `packages/auth-backend/base/src/services/permissionService.ts`
- README/docs that still instruct developers to use `DataSource`, `EntityManager`, or `QueryRunner`.

### Structural conclusion

The roadmap now needs to be executed in this exact order:

1. finish neutral DB transport,
2. finish `applications-backend`,
3. delete `applications-backend/src/database`,
4. finish `metahubs-backend`,
5. delete `metahubs-backend/src/database`,
6. finish runtime-history / DB-file registry phases,
7. run full fresh-database acceptance.

This order is mandatory because `applications-backend` is smaller and already partially ported.

---

## Non-Negotiable Architecture Rules

1. Do not introduce another ORM.
2. Do not build a pseudo-ORM under a different name.
3. Keep SQL explicit for non-trivial reads and writes.
4. Prefer set-based SQL to object-by-object loops.
5. Keep `DbSession` / `DbExecutor` intentionally thin.
6. Do not add new UI families for this task.
7. Do not keep legacy compatibility code after final cutover.
8. Do not preserve `src/database` as a misleading folder name once TypeORM is gone.

Allowed:

- thin repository/query modules,
- row decoders,
- SQL fragments,
- explicit transaction helpers,
- schema-qualified parameterized SQL.

Forbidden:

- generic `BaseRepository<T>`,
- lazy loading,
- identity map,
- hidden unit of work,
- opaque query DSL,
- automatic relation materialization,
- runtime object graphs built by default.

---

## Target End State

### Applications backend target shape

```text
src/platform/migrations/*
src/persistence/sql/*
src/persistence/repositories/*
src/persistence/row-schemas/*
src/routes/*
src/services/*
```

Deleted:

```text
src/database/*
```

### Metahubs backend target shape

```text
src/platform/migrations/*
src/persistence/sql/*
src/persistence/repositories/*
src/persistence/row-schemas/*
src/domains/**/routes/*
src/domains/**/services/*
```

Deleted:

```text
src/database/*
```

### Shared transport target shape

- `@universo/utils/database` owns:
  - `DbSession`
  - `DbExecutor`
  - request attachment/access helpers
  - nested transaction reuse helpers
- `auth-backend` owns:
  - request-claims extraction
  - RLS session setup/reset
- neither `applications-backend` nor `metahubs-backend` import `typeorm`

---

## Safe Code Standards

### 1. Shared session contract

```ts
export interface DbExecutor {
  query<T = unknown>(sql: string, bindings?: readonly unknown[]): Promise<T[]>
  transaction<T>(task: (trx: DbExecutor) => Promise<T>): Promise<T>
}

export interface DbSession extends DbExecutor {
  readonly knex: Knex | Knex.Transaction
  isTransaction(): boolean
}
```

Rules:

- `transaction()` must reuse the existing transaction when already inside one.
- SQL must always stay parameterized.
- No helper may inject dynamic schema names without identifier validation.

### 2. SQL-first repository module

```ts
const applicationMemberRow = z.object({
  id: z.string().uuid(),
  application_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'editor', 'member']),
})

export async function listApplicationMembers(
  db: DbExecutor,
  applicationId: string,
): Promise<ApplicationMember[]> {
  const rows = await db.query(
    `
      select id, application_id, user_id, role
      from applications.application_users
      where application_id = ?
        and _upl_deleted = false
      order by created_at asc
    `,
    [applicationId],
  )

  return applicationMemberRow.array().parse(rows).map(mapApplicationMemberRow)
}
```

### 3. Request-scoped RLS transport

```ts
await knex.transaction(async (trx) => {
  await trx.raw('select set_config(?, ?, true)', [
    'request.jwt.claims',
    JSON.stringify(claims),
  ])

  attachRequestDbSession(req, createDbSession(trx))
  await runHandler()
})
```

Rules:

- rely on transaction-local settings only,
- never rely on ambient `search_path`,
- cleanup must happen by transaction end, not by best-effort after response.

### 4. Set-based copy pattern

```ts
await db.transaction(async (trx) => {
  const [application] = await trx.query<ApplicationRow>(
    `
      insert into applications.applications (...)
      values (...)
      returning id, schema_name
    `,
    [...],
  )

  await trx.query(
    `
      insert into applications.application_users (id, application_id, user_id, role, ...)
      select gen_random_uuid(), ?, user_id, role, ...
      from applications.application_users
      where application_id = ?
        and _upl_deleted = false
    `,
    [application.id, sourceApplicationId],
  )
})
```

Rule:

- copy many rows with `insert ... select`, not with app-side loops unless the row count is tiny and explicitly justified.

---

## Implementation Batches

### Batch 0. Freeze completion criteria and reset policy

Deliverables:

- add explicit closure checklist to task tracking,
- require final validation only on a fresh database,
- state that old test data from the current DB is not a valid acceptance source.

Exit gate:

- acceptance is defined against a fresh DB only.

### Batch 1. Finish shared neutral DB transport

Scope:

- stabilize `DbSession` and `DbExecutor`,
- remove remaining public `getRequestManager(...)` usage from touched surfaces,
- add helper utilities for validated schema-qualified SQL,
- update route factory contracts so packages stop advertising `DataSource` as their public access model.

Deliverables:

- route factories accept a neutral DB/session provider,
- README/docs stop recommending `EntityManager` and `QueryRunner` to consumers.

Exit gate:

- `applications-backend` and `metahubs-backend` can consume only neutral DB contracts at their public boundaries.

### Batch 2. Finish `applications-backend` route and persistence cutover

Scope:

- port all remaining `applicationsRoutes.ts` TypeORM-heavy paths,
- finish `guards.ts` migration away from entity-shaped membership contracts,
- remove `DataSource`-typed seams from `applicationsStore`,
- replace `utils/queryHelpers.ts` with neutral SQL helpers,
- ensure `routes/index.ts` no longer imports TypeORM types.

Deliverables:

- no `typeorm` import anywhere under `packages/applications-backend/base/src/routes`,
- no `typeorm` import anywhere under `packages/applications-backend/base/src/persistence`,
- no entity-typed guard surface in `applications-backend`.

Exit gate:

- `rg "typeorm|getRepository\\(|createQueryBuilder\\(|EntityManager|QueryRunner" packages/applications-backend/base/src/routes packages/applications-backend/base/src/persistence packages/applications-backend/base/src/utils` returns nothing relevant.

### Batch 3. Remove `applications-backend/src/database`

Scope:

- delete entities,
- delete remaining legacy DB helpers,
- remove TypeORM exports from package index,
- remove `typeorm` dependency from `applications-backend/package.json`,
- update package README and MIGRATIONS docs.

Exit gate:

- `packages/applications-backend/base/src/database` does not exist,
- `packages/applications-backend/base/package.json` has no `typeorm`,
- package build, tests, and root build are green.

### Batch 4. Replace internal RLS QueryRunner transport

Scope:

- refactor `ensureAuthWithRls`,
- replace TypeORM `QueryRunner` lifecycle with Knex-backed request transaction/session,
- update `auth-backend` helper signatures to work on `DbSession` / `DbExecutor`,
- remove request-time dependency on `DataSource.manager` for touched package flows.

Deliverables:

- one request-scoped transaction/session path,
- no internal `QueryRunner` for requests that serve `applications` / `metahubs`.

Exit gate:

- `ensureAuthWithRls.ts` no longer imports `QueryRunner`,
- request DB context for these packages is fully Knex-backed.

### Batch 5. Build shared SQL-first foundations for `metahubs-backend`

Scope:

- replace `metahubs` query helpers with neutral SQL modules,
- build row schemas and repositories for:
  - Metahub
  - MetahubUser
  - MetahubBranch
  - Publication
  - PublicationVersion
  - Template
  - TemplateVersion
  - Hub
  - Catalog
  - Set
  - Enumeration
  - Attribute

Exit gate:

- foundation modules exist for all high-value aggregates used by routes/services.

### Batch 6. Port `metahubs-backend` top-level CRUD and membership flows

Scope:

- `metahubsRoutes.ts`
- `branchesRoutes.ts`
- `hubsRoutes.ts`
- `catalogsRoutes.ts`
- `setsRoutes.ts`
- `enumerationsRoutes.ts`
- `attributesRoutes.ts`
- `constantsRoutes.ts`
- `settingsRoutes.ts`

Rules:

- sequence the work from simpler CRUD to more stateful routes,
- use SQL-first stores and neutral guards only.

Exit gate:

- those route files have no `typeorm` imports and no repository/query-builder calls.

### Batch 7. Port `metahubs-backend` runtime/content/publication flows

Scope:

- `elementsRoutes.ts`
- `layoutsRoutes.ts`
- `metahubMigrationsRoutes.ts`
- `publicationsRoutes.ts`
- `applicationMigrationsRoutes.ts`
- `applicationSyncRoutes.ts`
- `createLinkedApplication.ts`
- `MetahubBranchesService.ts`

Important:

- this batch must preserve all current runtime DDL behavior,
- all multi-row operations must be transactionally SQL-first,
- publication/application creation must remain acceptance-safe on a fresh DB.

Exit gate:

- those flows are off TypeORM repositories/query builders.

### Batch 8. Remove `metahubs-backend/src/database`

Scope:

- delete entities,
- delete legacy DB helpers,
- remove TypeORM exports from package index,
- remove `typeorm` from `package.json`,
- update package README and MIGRATIONS docs.

Exit gate:

- `packages/metahubs-backend/base/src/database` does not exist,
- `packages/metahubs-backend/base/package.json` has no `typeorm`.

### Batch 9. Remove core registry / package-surface residue

Scope:

- remove metahubs/applications entities from any central entity registry,
- update backend composition roots,
- clean stale docs and comments referencing TypeORM in these packages.

Exit gate:

- there is no runtime path in core/auth/admin that expects applications/metahubs TypeORM entities.

### Batch 10. Unify runtime history contracts

Scope:

- normalize `_mhb_migrations` and `_app_migrations` around one shared runtime-history contract,
- keep compatibility tables only if still needed for product behavior,
- otherwise remove duplicated semantics.

Exit gate:

- one shared mental model for runtime history and mirrored global catalog writes.

### Batch 11. Build DB/file desired-state registry

Scope:

- add canonical definition registry structures,
- support DB-stored desired state plus file export/import,
- prepare future editor flow without adding editor UI in this task.

Exit gate:

- desired state can be stored, read, exported, and compared without TypeORM.

### Batch 12. Reframe Metahubs structure/template as application-definition concepts

Scope:

- map “metahub structure” to “Metahubs application schema definition”,
- map “metahub template” to “Metahubs application template definition”,
- align runtime and design-time storage semantics.

Exit gate:

- terminology and storage model match the long-term Metahubs-as-application architecture.

### Batch 13. Full test, parity, and acceptance closure

Scope:

- deep schema parity tests,
- integration tests,
- concurrency tests,
- full fresh-database acceptance tests,
- performance regression tests.

Exit gate:

- the original technical brief is validated end-to-end.

---

## Recommended PR Slices

1. Shared DB transport hardening (`DbSession` / `DbExecutor` / route-factory boundary)
2. Finish `applications-backend` route cutover
3. Delete `applications-backend/src/database`
4. Replace internal RLS QueryRunner transport
5. Metahubs persistence foundations
6. Metahubs CRUD/membership cutover
7. Metahubs publication/runtime/application-sync cutover
8. Delete `metahubs-backend/src/database`
9. Runtime history normalization + desired-state registry
10. Full acceptance/performance closure

This order is deliberate:

- `applications-backend` is smaller and partially ported,
- RLS transport replacement should happen before the deepest Metahubs runtime cutover,
- `metahubs-backend` should only lose `src/database` after publication/application-sync paths are fully off TypeORM.

---

## Deep Test Plan

### A. Unit tests

- row-schema decoders,
- SQL helper builders,
- schema-name validation helpers,
- UUID v7 generation helpers,
- optimistic locking helpers,
- runtime-history metadata mappers.

### B. Route/service integration tests

- applications CRUD,
- applications members,
- connectors,
- metahubs CRUD,
- hubs/catalogs/sets/enumerations/attributes/constants,
- branches/publications/application-sync,
- access guards under request-scoped DB session.

### C. Database-backed integration tests

Run against PostgreSQL, not pure mocks.

Cover:

- RLS session setup/reset,
- transaction reuse,
- bulk copy flows,
- soft-delete/archive transitions,
- publication/application sync writes,
- mirrored `upl_migrations` behavior,
- exact schema creation for `metahubs`, `applications`, `mhb_*`, `app_*`.

### D. Schema parity tests

- compare generated `metahubs` schema against expected native SQL source of truth,
- verify indexes, enums, RLS, policies, and foreign keys,
- ensure no drift versus current intended platform schema.

### E. Concurrency tests

- parallel startup migration runner,
- parallel metahub/application sync,
- competing membership updates,
- lock contention on runtime migration paths.

### F. Query-shape / performance tests

- query-count assertions for hot endpoints,
- explain-plan snapshots for:
  - application list/detail,
  - connector list/detail,
  - metahub list/detail,
  - publication/application sync,
  - branch/publication copy flows.

### G. Full acceptance tests

Fresh DB only:

1. start backend,
2. verify `metahubs` and `applications` platform schemas exist,
3. open `/metahubs`,
4. create a metahub,
5. verify first branch schema `mhb_*_b1`,
6. create basic entities such as “shopping list”,
7. create publication/version,
8. create application via connector,
9. verify `app_UUIDv7` schema,
10. verify runtime data transfer and application usability,
11. verify current `metahubs-frontend` and `universo-template-mui` still work unchanged.

### H. Negative/recovery tests

- bootstrap migration failure must fail fast,
- runtime sync failure must not leave split state,
- audit/write failure must not downgrade successful sync incorrectly,
- lock timeout and retry behavior must be deterministic.

---

## Documentation and Package Cleanup Requirements

- Update package READMEs once each package exits TypeORM.
- Remove documentation that tells developers to use `EntityManager`, `QueryRunner`, or package-local `DataSource` patterns in those packages.
- Keep all new user-facing or operator-facing texts i18n-ready.
- Put shared types/utilities only in:
  - `@universo/types`
  - `@universo/utils`
- Do not create backend-only ad hoc helper packages unless they are clearly reusable.

---

## Definition Of Done

The roadmap is closed only when all of the following are true:

1. `packages/applications-backend/base/src/database` does not exist.
2. `packages/metahubs-backend/base/src/database` does not exist.
3. `packages/applications-backend/base/package.json` has no `typeorm`.
4. `packages/metahubs-backend/base/package.json` has no `typeorm`.
5. `applications-backend` has no `typeorm` imports.
6. `metahubs-backend` has no `typeorm` imports.
7. request-scoped DB execution for these packages does not use `QueryRunner`.
8. `metahubs` schema still matches the intended exact platform structure.
9. runtime `mhb_*` and `app_*` schema flows still work.
10. the original fresh-database acceptance flow is green.
11. deep unit/integration/concurrency/performance coverage is green.
12. no temporary compatibility layer remains in those packages.

---

## Recommended Immediate Next Step

Do not jump directly into `metahubs-backend`.

The next implementation batch should be:

1. finish the remaining TypeORM-heavy paths in `applicationsRoutes.ts`,
2. remove `applications-backend/src/database`,
3. only then move to the deeper `metahubs-backend` cutover.

That is the safest order and the one most aligned with the current code state.
