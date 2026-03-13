# Plan: System-App Unification Final Completion Plan

> Date: 2026-03-11  
> Mode: PLAN  
> Status: DRAFT FOR REVIEW  
> Supersedes for final completion planning:
> - [system-app-definition-unification-plan-2026-03-11.md](system-app-definition-unification-plan-2026-03-11.md)
> - [system-app-unification-completion-master-plan-2026-03-11.md](system-app-unification-completion-master-plan-2026-03-11.md)

---

## Overview

This final plan exists because the previous plans solved only part of the original technical brief.

The platform already achieved important migration unification milestones:

- TypeORM is no longer the active migration engine.
- platform bootstrap runs through the shared `@universo/migrations-platform` runtime,
- system app manifests exist for `public`, `admin`, `profiles`, `metahubs`, and `applications`,
- `upl_migrations.definition_*` storage is now alive,
- fresh bootstrap creates fixed schemas and dynamic runtime schemas successfully.

However, the implementation still does **not** satisfy the deeper architectural goal of the original brief:

- fixed system schemas are still mostly wrappers around legacy-style SQL migrations,
- the definition registry stores platform migration definitions, not true system-application definitions,
- fixed schemas such as `metahubs`, `applications`, `admin`, and `profiles` are not structurally modeled like application schemas,
- current frontend/backend packages were not yet migrated to consume system applications as application-like data models.

The goal of this final plan is to close that gap without introducing compatibility shims that only preserve disposable test data.

This plan also intentionally replaces the old “exact fixed-schema table-name parity” milestone from the previous master plan.
That older milestone was valid for the previous phase, but it no longer matches the clarified expectation from the user after the fresh-DB verification.
The new acceptance target is:

- exact behavioral closure of the existing end-to-end user flow,
- exact preservation of UUID v7 / schema naming policy,
- exact preservation of the current shell UX during transition,
- **but intentional structural convergence** of fixed system schemas toward the application model.

---

## Verified Findings

### Codebase findings

1. `SystemAppDefinition` exists, but current fixed system apps still point to legacy-style SQL schema creation files.
   - Example: `metahubsSystemAppDefinition` still uses `CreateMetahubsSchema1766351182000`.
   - Example: `applicationsSystemAppDefinition` still uses `CreateApplicationsSchema1800000000000`.

2. `@universo/migrations-platform` currently synchronizes **platform migration definitions** to `upl_migrations.definition_*`.
   - Logical keys in `definition_registry` are currently shaped like:
     - `platform_migration.platform_schema.metahubs.CreateMetahubsSchema1766351182000::custom`
   - This means the registry is still about migration-definition metadata, not about system-app manifest bundles and compiled desired artifacts.

3. Dynamic published application schemas already have the application-like internal structure expected by the original brief.
   - Verified example schema: `app_019cdd54a4e17122878322c174ef217f`
   - Tables:
     - `_app_attributes`
     - `_app_layouts`
     - `_app_migrations`
     - `_app_objects`
     - `_app_settings`
     - `_app_values`
     - `_app_widgets`
     - `cat_019cdd5288b475f8bafd78881e1fce9d`

4. Fixed system schemas are still structurally different from runtime application schemas.
   - `metahubs` currently contains:
     - `metahubs`
     - `metahubs_branches`
     - `metahubs_users`
     - `publications`
     - `publications_versions`
     - `templates`
     - `templates_versions`
   - `applications` currently contains:
     - `applications`
     - `applications_users`
     - `connectors`
     - `connectors_publications`
   - `admin` currently contains:
     - `instances`
     - `locales`
     - `role_permissions`
     - `roles`
     - `settings`
     - `user_roles`
   - `profiles` currently contains only:
     - `profiles`

5. `profiles.profiles` is now active and `public.profiles` is gone in the current `UP-test` database.
   - This means the profile schema split is already effectively cut over in the current environment.

6. The runtime application schema compiler already exists in `@universo/schema-ddl`.
   - It creates `_app_*` system tables and business tables.
   - It is therefore the correct foundation for final convergence.

### Verified UP-test findings

Project ref: `osnvhnawsmyfduygsajj`

1. Fixed schemas present:
   - `admin`
   - `applications`
   - `metahubs`
   - `profiles`
   - `upl_migrations`
   - `public`

2. Current row counts show the system is live, but not yet architecturally converged:
   - `upl_migrations.definition_registry`: `15`
   - `upl_migrations.definition_revisions`: `15`
   - `upl_migrations.definition_exports`: `15`
   - `upl_migrations.definition_drafts`: `0`
   - `upl_migrations.approval_events`: `0`

3. The registry is populated, but populated with migration-definition records, not with top-level system-app manifest lifecycle records.

---

## Final Architectural Decision

The completion program should stop treating fixed system schemas as merely “system-app metadata plus old SQL files”.

The final target is:

1. Every system section (`admin`, `metahubs`, `applications`, `profiles`) is authored as a **system application definition**.
2. The authored source of truth is a **TypeScript manifest**.
3. The exported/persisted interchange format is a **canonical JSON bundle**.
4. The database registry stores:
   - manifest revisions,
   - compiled artifact revisions,
   - export records,
   - draft/review/publish provenance.
5. Fixed schemas are compiled by the same application-definition compiler family that already creates dynamic application schemas.
6. Current UI shells stay in place during the transition, but backend/frontend data access is migrated to the new fixed-schema structure.

This means the plan is no longer “make registry aware of platform migration files”.
It is now “make platform bootstrap, fixed system apps, dynamic apps, and future editor workflows share one application-definition lifecycle”.

---

## Non-Negotiable Constraints

1. Fresh database reset is allowed.
2. UUID v7 remains mandatory everywhere.
3. No TypeORM fallback or compatibility layer should be reintroduced.
4. No artificial version bump for Metahub structure/template just because bootstrap architecture changes.
5. Current UI packages remain active during this program:
   - `@universo/template-mui` for current system shells,
   - `@universo/apps-template-mui` for published runtime apps.
6. All new user-visible text must be i18n-first through `@universo/i18n`.
7. Shared types/utilities must go to `@universo/types` and `@universo/utils` instead of duplicating contracts locally.
8. New packages are allowed only if they remove a real ownership or dependency problem.
9. Database-stored definitions must stay declarative, never executable.
10. Compiler-generated SQL and security-definer functions must not rely on ambient `search_path`.
11. Public HTTP route contracts should remain stable unless a route-level change is required by the new data model and explicitly planned.
12. Do not keep a long-lived parallel domain model where both old fixed-schema tables and new application-like tables are treated as first-class sources of truth.
13. Reuse existing UI primitives and existing CRUD/query patterns before introducing any new frontend abstraction.
14. Extend existing `universo-*` packages before creating a new package boundary.
15. Versioning must stay explicit and layered:
    - platform engine version,
    - system-app structure version,
    - configuration/template version,
    - repeatable seed pack version/checksum.
16. The current effective `0.1.0` semantics for Metahubs must not be artificially bumped only because the implementation model changes.
17. Dependency versions must continue following the centralized workspace catalog policy.
    - Prefer `catalog:` / workspace-managed versions where the repository already standardizes them.
    - New implementation waves must not reintroduce literal package-version drift in touched packages.

---

## Target Structural Model

### Common rules for every system application schema

Every fixed system schema must converge toward the same internal structural conventions as runtime application schemas.

However, to avoid unnecessary schema surface and fake uniformity, the `_app_*` contract must be **capability-based**, not blindly maximal.

#### Core `_app_*` layer required for every fixed system app

- `_app_migrations`
- `_app_settings`
- `_app_objects`

#### Metadata `_app_*` layer required when the app exposes typed object metadata

- `_app_attributes`
- `_app_values`

#### Layout `_app_*` layer required when the current shell or future editor needs persisted layout metadata

- `_app_layouts`
- `_app_widgets`

This keeps the architecture application-like without forcing `profiles` or other minimal system apps to carry tables that have no real runtime purpose yet.

The compiler must still support the **full** `_app_*` family for any system app that declares those capabilities.

### Default convergence rule

The target is “same compiler family, same naming conventions, same metadata principles, same lifecycle semantics”.
It is **not** “copy every runtime app table into every fixed system schema regardless of need”.

Business tables must then use explicit prefixes:

- `cat_` for catalog-like entities
- `doc_` for versioned/event/document-like entities
- `rel_` for relation/join entities
- `cfg_` for configuration/reference tables that should stay explicit

### Proposed fixed-schema business-table mapping

| Schema | Current shape | Target business tables |
| --- | --- | --- |
| `metahubs` | `metahubs`, `metahubs_branches`, `templates`, `publications`, ... | `cat_metahubs`, `cat_metahub_branches`, `rel_metahub_users`, `cat_templates`, `doc_template_versions`, `doc_publications`, `doc_publication_versions` |
| `applications` | `applications`, `connectors`, `applications_users`, `connectors_publications` | `cat_applications`, `cat_connectors`, `rel_application_users`, `rel_connector_publications` |
| `admin` | `instances`, `roles`, `role_permissions`, ... | `cfg_instances`, `cat_roles`, `rel_role_permissions`, `rel_user_roles`, `cfg_locales`, `cfg_settings` |
| `profiles` | `profiles` | `cat_profiles` |

This is the structural convergence the original technical brief expected and the current implementation still lacks.

---

## Final Definition Lifecycle Model

### Authored source of truth

- Author in TypeScript manifests.
- Keep versioned structural revisions as immutable files.
- Keep repeatable seeds as explicit checksum-tracked packs.

### Persisted lifecycle

`upl_migrations.definition_*` must store **two levels** of definitions:

1. top-level system-app manifest revisions,
2. compiled desired artifacts derived from those manifests.

The registry should no longer be limited to `platform_migration.*` logical keys.

Example logical key families:

- `system_app.metahubs.manifest`
- `system_app.metahubs.compiled.table.cat_metahubs`
- `system_app.metahubs.compiled.table._app_objects`
- `system_app.metahubs.compiled.index.idx_cat_metahubs_slug_active`
- `system_app.metahubs.seed.default_templates`

### Execution pipeline

1. Load manifest from TypeScript.
2. Validate manifest contract.
3. Compile manifest to desired artifacts.
4. Register manifest + compiled artifacts in `upl_migrations.definition_*`.
5. Diff desired artifacts against current schema.
6. Plan/apply versioned changes.
7. Run repeatable seed packs.
8. Export canonical JSON bundle.

---

## Affected Areas

- `packages/universo-migrations-core`
- `packages/universo-migrations-platform`
- `packages/universo-migrations-catalog`
- `packages/schema-ddl`
- `packages/universo-core-backend`
- `packages/metahubs-backend`
- `packages/applications-backend`
- `packages/admin-backend`
- `packages/profile-backend`
- `packages/auth-backend`
- `packages/start-backend`
- `packages/universo-types`
- `packages/universo-utils`
- `packages/universo-i18n`
- `packages/universo-template-mui`
- `packages/apps-template-mui`
- `packages/metahubs-frontend`
- `packages/applications-frontend`
- `packages/admin-frontend`
- `packages/profile-frontend`

---

## Execution Governance

Before implementation begins, the program must maintain one explicit execution matrix covering every touched package.

Each row in the matrix must include:

- package name,
- owned schema(s),
- current stores,
- current routes/controllers,
- frontend consumers,
- current tests,
- planned cutover wave,
- blocking dependencies.

This matrix is required to prevent hidden cross-package drift and to avoid over-implementing speculative abstractions.

### Mandatory execution rules

1. No phase may start with only “architecture intent”.
   - Every phase must define:
     - concrete touched packages,
     - concrete touched schemas/tables,
     - expected route/API effect,
     - expected tests.

2. No frontend work should begin before the backend/storage contract for that slice is frozen.

3. No package should introduce a private ad-hoc manifest/DDL helper if the same need belongs in:
   - `@universo/migrations-core`
   - `@universo/migrations-platform`
   - `@universo/migrations-catalog`
   - `@universo/schema-ddl`
   - `@universo/types`
   - `@universo/utils`

4. Every implementation wave must end with:
   - focused package lint/test/build,
   - dependency policy verification for touched packages,
   - updated impact matrix,
   - updated verified progress note,
   - no over-claim of overall completion.

---

## Implementation Phases

### Phase 0 — Freeze The Baseline And Acceptance Contract

- Record the exact current `UP-test` findings in tests and docs.
- Freeze the acceptance scenario:
  - reset DB,
  - bootstrap platform,
  - login,
  - create Metahub,
  - create branch schema,
  - create publication/version,
  - create application/connector,
  - create published app schema,
  - sync publication into application,
  - use current UI packages successfully.
- Freeze the current dynamic runtime application structure as the convergence reference.
- Explicitly declare that final completion means **fixed system schemas also become application-like**.
- Produce the execution impact matrix for all touched packages before any code cutover.
- Freeze the initial route/API compatibility list:
  - routes that must remain unchanged,
  - DTOs that may be adapted internally,
  - DTOs that require explicit change management.

### Phase 1 — Finalize Manifest V3

- Expand the existing `SystemAppDefinition` into the real authored manifest contract.
- Do **not** introduce a parallel top-level interface such as `SystemAppManifest` unless a strict ownership or compatibility reason appears later.
- The default path is to evolve the existing contract instead of multiplying terms.
- Add:
  - `engineVersion`
  - `structureVersion`
  - `configurationVersion`
  - `schemaTarget`
  - `capabilities`
  - `businessObjects`
  - `compiledArtifactsPolicy`
  - `seedPacks`
  - `uiShell`
  - `exportPolicy`
- Move shared manifest types into `@universo/types` only if ownership becomes cross-package enough to justify it.
- Keep validation in `@universo/migrations-core`.
- Add explicit capability flags for:
  - core `_app_*` layer,
  - metadata `_app_*` layer,
  - layout `_app_*` layer,
  - repeatable seed lifecycle,
  - publication/runtime sync participation.
- Add explicit layered version semantics in the manifest contract:
  - `engineVersion`
  - `structureVersion`
  - `configurationVersion`
  - per-seed-pack checksum/version metadata
- Require deterministic serialization rules so manifest and export diffs remain stable in code review.

### Phase 2 — Upgrade Registry From Migration Metadata To Definition Lifecycle

- Extend `upl_migrations.definition_*` usage so it stores:
  - top-level manifest revisions,
  - compiled artifact revisions,
  - exports,
  - review/publish transitions,
  - approval events.
- Preserve the existing tables if possible instead of inventing parallel storage.
- Add typed logical-key families and registry query helpers.
- Keep migration-definition export support, but downgrade it from the primary architectural role.
- Add registry-level invariants so one manifest revision can be traced to:
  - compiled artifact set,
  - export bundle(s),
  - approval/review history,
  - bootstrap/apply run identifiers.

### Phase 3 — Introduce Fixed-Schema Compiler Input

- Teach the compiler/runtime to compile a system app into a **fixed** schema using the same artifact model as runtime apps.
- Unify `SchemaTarget` resolution for:
  - fixed schemas,
  - managed dynamic application schemas,
  - managed dynamic Metahub branch schemas,
  - future managed custom schema names.
- Remove the architecture split where fixed schemas are created by legacy SQL and dynamic schemas are created by the application compiler.
- Keep compiler output schema-qualified and deterministic so golden artifact snapshots remain stable.
- Extract the compiler boundary away from Metahub-specific snapshot assumptions.
  - Current runtime compilation is still strongly shaped around `EntityDefinition`, publication snapshots, template validators, and Metahub-oriented serializers.
  - The fixed-system-app compiler path must be neutral infrastructure, not a hidden Metahub adapter.
- Define a neutral intermediate compiled-definition model only if extending `EntityDefinition` directly would keep Metahub-only assumptions inside the core compiler.

### Phase 4 — Define Canonical System-App Business Models

- Create the authored business object model for:
  - `metahubs`
  - `applications`
  - `admin`
  - `profiles`
- Decide the exact object/table naming map before implementation.
- Reuse application-style object/table conventions instead of keeping old table names.
- Store these definitions as file-backed system-app manifests.
- For each system app, explicitly document:
  - required `_app_*` capability subset,
  - business table prefixes,
  - required RLS behavior,
  - required seed packs,
  - current UI shell dependencies.

### Phase 5 — Compile And Bootstrap Fixed System Schemas From Manifests

- Replace legacy fixed-schema SQL creation files as the primary source of truth.
- The bootstrap should compile fixed system apps into:
  - `_app_*` system tables,
  - business tables (`cat_*`, `doc_*`, `rel_*`, `cfg_*`),
  - indexes,
  - RLS policies,
  - functions,
  - triggers,
  - repeatable seeds.
- Keep only bootstrap primitives that are truly cross-cutting:
  - `public.uuid_generate_v7()`
  - `upl_migrations` storage
  - cross-schema safety helpers if still needed.
- Require bootstrap acceptance proof after each system app is cut over:
  - schema exists,
  - required `_app_*` subset exists,
  - business tables exist,
  - registry contains manifest + compiled artifact records,
  - repeatable seeds completed.
- For sensitive `SECURITY DEFINER` functions created during bootstrap:
  - set explicit safe `search_path`,
  - revoke default `PUBLIC` execute when the function is not meant to be globally callable,
  - grant execute only to intended roles,
  - keep schema qualification explicit in function bodies where practical.

### Phase 6 — Refactor Backends To The New Fixed-System-App Structures

- Migrate all SQL-first stores to the new fixed-schema table names and shapes.
- This affects:
  - `metahubs-backend`
  - `applications-backend`
  - `admin-backend`
  - `profile-backend`
  - `auth-backend`
  - `start-backend`
- Do not add compatibility views unless a very narrow transitional reason is proven.
- Because the database can be reset, the preferred strategy is direct cutover.
- Route handlers and services must continue using SQL-first stores rather than ad-hoc query logic in controllers.
- Every backend slice must define explicit copy/create/delete invariants and duplicate-protection checks before cutover.

### Phase 7 — Refactor Frontends To The New Contract

- Update API responses and consuming frontend code to the new system-app-backed storage contract.
- Reuse current UI building blocks first:
  - `MigrationGuardShell`
  - `ApplicationMigrationGuard`
  - `MetahubMigrationGuard`
  - `ConnectorDiffDialog`
  - `EntityFormDialog`
  - `DynamicEntityFormDialog`
  - `CrudDialogs`
  - `RowActionsMenu`
  - `useCrudDashboard`
  - `createEntityActions`
  - `createMemberActions`
  - existing optimistic mutation/query invalidation patterns
- Prefer TanStack Query patterns consistently for touched screens.
- Do not invent new UI components unless existing primitives cannot model the behavior safely.
- Reuse current i18n namespaces and shared label strategy before adding new translation domains.
- Keep current shell routing structure stable where possible so the transition remains invisible to end users.

### Phase 8 — Align Runtime Publication And Application Sync

- Ensure the publication -> application runtime sync path uses the same compiled application-definition family as fixed system apps.
- Unify:
  - artifact planning,
  - diffing,
  - apply semantics,
  - migration history,
  - seed execution,
  - observability metadata.
- Keep Metahub-owned publication compilation separate from Application-owned runtime sync execution.
- Require explicit invariants for:
  - idempotent repeated sync,
  - duplicate identifier prevention,
  - safe delete/archive propagation,
  - partial-failure recovery,
  - non-destructive retry behavior.

### Phase 9 — Make DB/File Round-Trip Editor-Ready

- Add manifest export/import round-trip for system apps, not only migration definitions.
- Store canonical JSON bundles in the registry/export lifecycle.
- Support:
  - draft
  - review
  - publish
  - export
  - import
  - recompile
- Keep database-stored definitions declarative only.
- Require deterministic JSON export ordering so file diffs remain reviewable and safe.

### Phase 10 — Deep Test System

- Add a full layered test program:
  - unit tests for manifest validation and compiler helpers,
  - contract tests for naming, artifacts, registry lifecycle, and seed packs,
  - integration tests for fixed-schema bootstrap,
  - integration tests for dynamic app bootstrap,
  - fresh-DB acceptance tests for the full user flow,
  - concurrency tests for repeated exports, sync retries, and registry dedupe,
  - frontend integration tests for current UI shells against the new backend contract.
- Add golden snapshot tests for compiled fixed system apps and dynamic apps.
- Add explicit drift detection tests against the real logical-key families.
- Add package-level impact-matrix coverage checks so touched packages cannot silently skip required validation in later waves.

### Phase 11 — Final Cutover And Cleanup

- Remove remaining fixed-schema legacy SQL definitions that are no longer the source of truth.
- Remove dead compatibility helpers and drift-only adapters.
- Update READMEs and architecture docs only after the cutover is verified.
- Keep memory-bank status honest:
  - no “complete” status before all acceptance gates pass.
- Complete a final codebase grep/audit for:
  - obsolete table names,
  - obsolete logical-key families,
  - dead manifest fields,
  - direct SQL bypasses around stores,
  - leftover debug logging or temporary migration helpers.

---

## Deep Test Program

### Required automated coverage

1. Manifest validation
   - invalid schema target
   - invalid business object map
   - invalid seed pack metadata
   - invalid capability combinations

2. Compiler tests
   - fixed schema compilation
   - managed dynamic compilation
   - deterministic artifact ordering
   - cycle rejection
   - schema-qualified SQL generation

3. Registry lifecycle tests
   - draft -> review -> publish
   - export idempotency
   - import idempotency
   - compiled artifact regeneration
   - approval event persistence
   - manifest/version lineage integrity

4. Bootstrap acceptance
   - empty database -> full platform bootstrap
   - fixed schemas created from manifests
   - registry populated with manifest and compiled artifact records
   - route/API smoke verification for unchanged public contracts
   - security-definer privilege/search-path contract checks for touched schemas

5. Functional acceptance
   - create Metahub
   - create branch schema `mhb_*_b1`
   - create publication/version
   - create application/connector
   - create application schema `app_*`
   - sync publication into runtime schema
   - use current UI successfully

6. Frontend test policy
   - create a fresh `QueryClient` per test
   - disable retries in tests
   - avoid broad cache reuse between tests
   - prefer accessible queries over DOM implementation selectors

7. Data-safety regression coverage
   - duplicate identifier protection
   - repeated create/copy idempotency where required
   - delete/archive propagation correctness
   - re-sync after partial failure
   - no accidental cross-schema writes

8. Workspace governance coverage
   - touched-package dependency policy remains aligned with centralized `catalog:` rules
   - no newly introduced package-level version drift

### Required manual verification on `UP-test`

- inspect fixed schemas after clean bootstrap,
- inspect one live `mhb_*_bN` schema,
- inspect one live `app_*` schema,
- inspect `upl_migrations.definition_*`,
- confirm the registry contains manifest families, not only `platform_migration.*`.

---

## Risks And Mitigations

1. Risk: trying to preserve old fixed-schema tables and also introduce the new application-like model.
   - Mitigation: direct cutover on a fresh database; no compatibility preservation for disposable data.

2. Risk: registry remains artifact-centric and never becomes useful for editor workflows.
   - Mitigation: manifest revisions become first-class registry entries before more compiler work is added.

3. Risk: fixed-schema convergence drifts from runtime application conventions.
   - Mitigation: define one canonical table-prefix and system-table policy before cutover.

4. Risk: current frontend/backend packages keep hidden assumptions about old table names.
   - Mitigation: explicit package-by-package store and route refactor; no silent compatibility layer.

5. Risk: security-definer SQL or compiled SQL depends on global `search_path`.
   - Mitigation: schema-qualified SQL everywhere and explicit safe `search_path` only where PostgreSQL requires it.

6. Risk: long-running DDL becomes unreliable on Supabase pooled connections.
   - Mitigation: explicit statement/lock timeout budgets and forward-only expand/migrate/contract sequencing.

7. Risk: the program invents too many new contracts and slows delivery with abstraction churn.
   - Mitigation: evolve `SystemAppDefinition`, existing migration packages, and current UI primitives first; new abstractions require a demonstrated ownership win.

8. Risk: the compiler remains implicitly coupled to Metahub snapshots and cannot cleanly own fixed system apps.
   - Mitigation: make the compiler boundary neutral before or during fixed-schema cutover, and protect it with contract tests that do not require Metahub publication snapshots.

---

## Safe Code Examples

### Example: system-app definition authored in TypeScript

```ts
export const metahubsSystemAppDefinition: SystemAppDefinition = {
  key: 'metahubs',
  displayName: 'Metahubs',
  ownerPackage: '@universo/metahubs-backend',
  engineVersion: '0.1.0',
  structureVersion: '0.1.0',
  configurationVersion: '0.1.0',
  schemaTarget: { kind: 'fixed', schemaName: 'metahubs' },
  uiShell: 'universo-template-mui',
  capabilities: {
    supportsPublicationSync: true,
    supportsTemplateVersions: true,
  },
  businessObjects: [
    { kind: 'catalog', codename: 'metahubs', tableName: 'cat_metahubs' },
    { kind: 'catalog', codename: 'metahub_branches', tableName: 'cat_metahub_branches' },
    { kind: 'relation', codename: 'metahub_users', tableName: 'rel_metahub_users' },
    { kind: 'catalog', codename: 'templates', tableName: 'cat_templates' },
    { kind: 'document', codename: 'template_versions', tableName: 'doc_template_versions' },
    { kind: 'document', codename: 'publications', tableName: 'doc_publications' },
    { kind: 'document', codename: 'publication_versions', tableName: 'doc_publication_versions' },
  ],
  seedPacks: ['default-templates'],
}
```

### Example: safe schema-qualified SQL store

```ts
const sql = `
  SELECT id, name, schema_name
  FROM metahubs.cat_metahubs
  WHERE _upl_deleted = false
  ORDER BY _upl_created_at DESC
`

const rows = await executor.query(sql, [])
```

### Example: safe security-definer function

```sql
CREATE OR REPLACE FUNCTION admin.is_superuser(p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = admin, public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM admin.rel_user_roles ur
    JOIN admin.cat_roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_user_id
      AND r.codename = 'superuser'
      AND COALESCE(r._upl_deleted, false) = false
  );
END;
$$;
```

### Example: TanStack Query test harness

```tsx
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

export const createQueryWrapper = () => {
  const queryClient = createTestQueryClient()
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
```

---

## Final Acceptance Gates

The program is complete only when all of the following are true:

1. Fresh database bootstrap creates fixed system schemas from manifests, not from legacy hardcoded SQL as the primary source of truth.
2. `metahubs`, `applications`, `admin`, and `profiles` all contain `_app_*` system tables plus application-like business tables.
3. Current backend/frontend packages work against the new fixed-schema structures without a legacy compatibility branch.
4. Dynamic `mhb_*` and `app_*` schemas still bootstrap and sync correctly.
5. `upl_migrations.definition_*` stores manifest lifecycle and compiled artifacts, not only `platform_migration.*` records.
6. Full fresh-DB end-to-end acceptance passes.
7. The deep automated test matrix passes.

---

## Recommendation

Do **not** continue implementing from the previous plans directly.

Use this plan as the final execution baseline because it reflects the current verified state:

- migration unification is partially complete,
- registry activation is partially complete,
- profile schema split is already active,
- but fixed system schemas still have not crossed the final architectural boundary into true application-like structures.

That structural convergence is now the real remaining work.
