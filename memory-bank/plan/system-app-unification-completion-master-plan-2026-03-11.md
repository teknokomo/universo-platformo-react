# Plan: System-App Unification Completion Master Plan

> Date: 2026-03-11  
> Mode: PLAN  
> Status: DRAFT FOR REVIEW  
> Supersedes for implementation planning: [system-app-definition-unification-plan-2026-03-11.md](system-app-definition-unification-plan-2026-03-11.md)

---

## Overview

This master plan defines the remaining work required to fully satisfy the original technical brief:

- treat Admin, Metahubs, Applications, and Profiles as system applications described by file-backed definitions,
- complete the migration architecture so platform bootstrap, runtime schema lifecycle, DB/file definition lifecycle, and future editor readiness all share one consistent contract,
- preserve current frontend shells during the transition,
- remove remaining architectural drift that still prevents the system from being considered complete,
- add a deep, production-grade test and verification program before declaring the refactor finished.

This plan is intentionally stricter than the previous one because the current repository already contains substantial partial implementation. The remaining program is no longer about proving the direction; it is about closing contract gaps, ownership gaps, live-environment drift, and full acceptance coverage.

---

## Planning Baseline And Hard Constraints

The completion program must keep the following constraints explicit throughout all implementation waves.

1. Fresh test database reset is allowed.
   - No new compatibility shims should be introduced only to preserve disposable pre-refactor test data.

2. UUID v7 remains mandatory.
   - Platform/bootstrap/runtime flows must continue using the existing UUID v7 strategy and preserve current `app_<uuid32>` / `mhb_<uuid32>_b1` naming compatibility.

3. Centralized dependency policy remains mandatory.
   - Workspace dependencies must continue following the centralized `pnpm-workspace.yaml` catalog policy wherever the repository already standardizes them.

4. The current Metahub parity milestone must not introduce artificial version churn.
   - Do not bump current Metahub structure/template versions just because the migration/bootstrap architecture is being refactored.
   - The parity milestone should preserve the current effective `0.1.0` semantics.

5. File-based structural migrations remain the default authoring model.
   - New structural revisions should be added as explicit migration files rather than hidden as ad-hoc mutable blocks.
   - Repeatable seeds remain a separate concept from immutable structural migration history.

6. Definition data stored in the database must stay declarative, never executable.
   - Canonical authoring may use TypeScript manifests.
   - Database persistence must store validated JSON/JSONB payloads, checksums, provenance, and review metadata only.

7. Current UI shells remain in service during this program.
   - Admin, Metahubs, Profile, and Applications management stay on their current packages plus `@universo/template-mui`.
   - Published application runtime stays on `@universo/apps-template-mui`.

8. New packages, interfaces, and UI components are allowed only when they solve a real ownership or safety problem.
   - The plan must prefer extending existing `universo-*` packages and existing UI primitives before inventing new abstraction layers.

---

## Executive Summary

### What is already implemented

- Unified platform migrations run through `@universo/migrations-platform` and are no longer assembled only as one manual hardcoded list.
- Package-owned `SystemAppDefinition` manifests already exist for `admin`, `metahubs`, `applications`, and `profiles`.
- Built-in metahub template bootstrap has already moved into the migration lifecycle.
- Registry storage for `upl_migrations.definition_registry`, `definition_revisions`, `definition_exports`, `definition_drafts`, and `approval_events` already exists.
- A CLI foundation already exists for `status`, `plan`, `diff`, `validate`, `lint`, `doctor`, `import`, and `sync`.
- Profile fixed-schema migration work has already started in code and package tests.

### What remains incomplete

- The core system-app contract is still too thin for the target architecture.
- Schema naming and target resolution are still split between system-app fixed schemas and runtime dynamic schemas.
- Runtime application sync ownership still lives inside `metahubs-backend`.
- DB/file lifecycle is not complete enough for a future editor workflow.
- UP-test currently shows live drift that proves the architecture is not yet fully reconciled in a real environment.
- The deep test system required by the original brief does not yet exist.

---

## Verified Findings From This Session

### Codebase findings

1. `SystemAppDefinition` currently carries only `key`, `displayName`, `ownerPackage`, `schemaTarget`, `summary`, and `migrations`.
   - It does not yet model `engineVersion`, `structureVersion`, `configurationVersion`, runtime capabilities, repeatable seed packs, or explicit export contracts.

2. `SchemaTarget` currently supports only the fixed-schema variant in `@universo/migrations-core`.
   - Dynamic and managed custom targets are still handled outside the shared contract.

3. `@universo/schema-ddl` still validates only managed dynamic schemas through `isManagedDynamicSchemaName(...)`.
   - Fixed system schemas are therefore not yet governed by the same compiler-facing contract.

4. Runtime application sync is still hosted in `packages/metahubs-backend/base/src/domains/applications/routes/applicationSyncRoutes.ts`.
   - This keeps the transitional ownership model in place and blocks full architecture convergence.

5. The codebase has strong package-level tests, but it does not yet prove the full user path on a fresh database:
   - create Metahub,
   - create branch schema,
   - create publication/version,
   - create application/connector,
   - create application schema,
   - sync publication data,
   - use the current UI successfully.

### Context7 findings

1. PostgreSQL 17 guidance for `SECURITY DEFINER` functions is explicit:
   - use trusted schemas only,
   - put `pg_temp` last in `search_path`,
   - revoke default `PUBLIC` execute privileges,
   - grant execute selectively.

2. TanStack Query testing guidance is explicit:
   - create a fresh `QueryClient` per test,
   - disable retries in tests,
   - provide a dedicated wrapper with `QueryClientProvider`,
   - use explicit query-key invalidation patterns instead of broad implicit cache mutation.

### Live UP-test findings from Supabase

Project ref: `osnvhnawsmyfduygsajj`

1. Fixed schemas present:
   - `admin`
   - `applications`
   - `metahubs`
   - `profiles`
   - `upl_migrations`
   - `public`

2. Current drift in UP-test is real and important:
   - `profiles` schema exists but has **zero tables**,
   - `public.profiles` still exists,
   - `upl_migrations.definition_registry` / `definition_revisions` / `definition_exports` / `definition_drafts` all exist but have **zero rows**.

3. Current PostgreSQL connection/session defaults in UP-test:
   - `search_path = "$user", public`
   - `statement_timeout = 2min`
   - `lock_timeout = 0`

4. The Supabase project uses transaction pooler mode on port `6543`.
   - This reinforces the need for strict connection budgeting, explicit DDL budgets, and no correctness dependency on ambient session state.

These verified findings must be treated as plan inputs, not optional notes.

---

## Non-Negotiable Acceptance Gates

The program is not complete until all of the following are true.

1. Fresh bootstrap acceptance
   - A newly reset UP-test database boots successfully.
   - Fixed schemas are created from file-defined system-app definitions.
   - `upl_migrations.definition_*` is populated as part of the normal lifecycle.

2. Exact current metahubs compatibility
   - The `metahubs` fixed schema remains exactly compatible with the current Metahubs frontend/backend contract.
   - Exact parity means preserving:
     - same table names,
     - same columns,
     - same enums,
     - same indexes,
     - same constraints,
     - same RLS and policies,
     - same naming.
   - The current UI packages continue to function without a legacy compatibility branch.

3. End-to-end user workflow acceptance
   - Open `/metahubs`.
   - Create a Metahub.
   - Create the first branch schema `mhb_<uuid32>_b1`.
   - Create publication/version.
   - Create application/connector.
   - Create application schema `app_<uuid32>`.
   - Sync publication data into the application runtime.
   - Continue using the current UI packages successfully.

4. No hardcoded bootstrap-only source of truth
   - System sections must be created from application-like definitions.
   - Startup must not rely on special-case hardcoded schema creation logic outside the definition lifecycle.

5. No hidden live drift
   - `definition_registry` cannot remain empty after successful bootstrap.

6. No accidental scope inflation in the parity milestone
   - The parity milestone must not be blocked by speculative future-state abstractions that are not required for current exact behavior.
   - Profile fixed-schema cutover is decision-gated: if approved for this program, it must be completed cleanly; if deferred, the plan must still achieve full migration/bootstrap parity without inventing compatibility debt.

7. Deep test closure
   - Unit, integration, contract, fresh-DB acceptance, concurrency, and UI guard tests must all exist for the changed layers.

---

## QA Corrections Applied To This Plan

The QA review for this session identified several constraints that must stay explicit in the master plan so the program does not drift into speculative architecture work or lose the original brief's guarantees.

1. Exact current behavior is a blocking acceptance gate.
   - The refactor is not complete unless the full existing path works on a fresh DB: `/metahubs` -> Metahub -> branch schema -> publication/version -> application/connector -> `app_*` schema -> publication sync -> current UI usage.

2. Exact `metahubs` platform schema parity is mandatory.
   - Compatibility language alone is too weak for this milestone.

3. The `profiles.profiles` cutover must not be forced into the critical path unless explicitly approved.
   - It is architecturally desirable, but not a valid reason to delay parity closure if the user chooses to stage it later.

4. A new package is justified only by a real ownership or cycle win.
   - Do not create neutral packages that only rewrap interfaces already owned cleanly by `@universo/migrations-*` plus shared types/utilities.

5. Existing UI and CRUD patterns must be reused first.
   - `MigrationGuardShell`, `ApplicationMigrationGuard`, `MetahubMigrationGuard`, `ConnectorDiffDialog`, `EntityFormDialog`, `DynamicEntityFormDialog`, `CrudDialogs`, `RowActionsMenu`, `useCrudDashboard`, `createEntityActions`, `createMemberActions`, and existing optimistic CRUD/query invalidation helpers are the default building blocks.

6. Forward-only governance must remain explicit.
   - Structural migrations are immutable after publication.
   - Repeatable seeds are checksum-tracked and re-executable.
   - Destructive changes remain classified and approval-gated.

7. Operational observability and safe SQL remain first-class requirements.
   - Run identifiers, scope metadata, timings, explicit timeout budgets, and schema-qualified SQL are part of the architecture, not polish.

---

## Architecture Principles For The Completion Program

1. One migration architecture
   - No separate conceptual migration systems for Metahubs and Applications.
   - One shared neutral migration architecture in `universo-*` packages.

2. Author in TypeScript, persist in JSONB
   - Canonical authored manifests stay in TypeScript.
   - Export/import bundles use deterministic JSON.
   - Database persistence stores validated declarative JSONB plus checksum/provenance metadata.

3. Platform/configuration version split
   - Distinguish platform engine version, system-app structure version, and configuration/template version.

4. No correctness dependency on global `search_path`
   - Compiler output must use schema-qualified SQL.
   - `SECURITY DEFINER` functions must set a safe `search_path` explicitly.

5. Forward-only operations by default
   - Prefer expand -> migrate -> contract over destructive rewrites.
   - Treat rollback as roll-forward with checkpoints, not as a universal `down` promise.

6. Current UI stays operational
   - Admin / Metahubs / Profile / Applications management continue using their current packages and `@universo/template-mui` during this program.
   - `@universo/apps-template-mui` remains the runtime shell for published applications.

7. Shared types/utilities live in the right packages
   - Shared contracts -> `@universo/types` or `@universo/migrations-core` when migration-specific.
   - Shared helpers -> `@universo/utils`.
   - Shared i18n namespaces -> `@universo/i18n`.

8. Everything new is i18n-first
   - New status codes and diagnostics must be key/params-based.
   - No new raw user-facing strings in shared infrastructure.

9. Reuse existing UI and CRUD infrastructure first
    - Prefer the already available route guards, dialog components, CRUD factories, query helpers, and optimistic update helpers before introducing new frontend surface area.

10. No unnecessary abstraction in the parity milestone
    - Future-state constructs such as managed custom schemas or richer artifact catalogs may be designed early, but they must not delay exact parity closure unless they solve a current correctness problem.

---

## Requirement Coverage Matrix

### Original Technical Brief

- Requirement 1: deeper analysis and unification of Metahub/Application migrations
   - Covered by: Overview, Planning Baseline, Architecture Principles, Waves 1-7, Wave 9.

- Requirement 2: robust migration system for real working data
   - Covered by: Non-Negotiable Acceptance Gates, QA Corrections, Waves 4-10, Deep Test Program.

- Requirement 3: replace TypeORM static migrations with file-based native system
   - Covered by: Planning Baseline item 5, Waves 1-4, Wave 6.

- Requirement 4: support DB/file-backed structure and future editor workflow
   - Covered by: Planning Baseline item 6, Waves 6-7, Deep Test Program.

- Requirement 5: maximize unification because Metahubs are temporary special-case applications
   - Covered by: Overview, Architecture Principles, Waves 1-7.

- Requirement 6: support fixed schema names such as `metahubs`
   - Covered by: Non-Negotiable Acceptance Gates, Waves 1-2.

- Requirement 7: treat Metahub structure/template as application structure/template concepts
   - Covered by: Platform/configuration version split, Wave 7.

- Requirement 8: preserve exact current Metahub schema
   - Covered by: Non-Negotiable Acceptance Gate 2, QA Corrections item 2, Wave 4, Deep Test Program.

- Requirement 9: preserve full current end-to-end workflow on a fresh DB
   - Covered by: Non-Negotiable Acceptance Gate 3, Wave 4, Wave 9, Wave 10.

### Additional Follow-Up Brief

- System sections must be represented as application-like definitions, not bootstrap hardcode
   - Covered by: Overview, Non-Negotiable Acceptance Gate 4, Waves 1-4.

- File format must be defined using good patterns
   - Covered by: Planning Baseline items 5-6, Wave 6, Wave 7.

- Schema names must be architecture-aware now, even if custom names are future work
   - Covered by: Planning Baseline item 2, Wave 2, Wave 7.

- Need MD-level architectural descriptions for future app convergence
   - Covered by: Wave 7.

- Current frontends must continue to work through existing packages
   - Covered by: Planning Baseline item 7, Architecture Principles items 6 and 9, Wave 8.

- No unnecessary new UI/components/interfaces
   - Covered by: Planning Baseline item 8, QA Corrections items 4-5, Wave 8.

- Do not increase the effective current schema/template version only because of this refactor
   - Covered by: Planning Baseline item 4, Wave 4 acceptance, Wave 10 acceptance.

---

## Target Architecture To Finish

### Canonical contract family

The repository should converge to a shared contract family similar to:

```ts
export type SchemaTarget =
  | { kind: 'fixed'; schemaName: 'admin' | 'applications' | 'metahubs' | 'profiles' | 'public' }
  | { kind: 'managed_dynamic'; prefix: 'app' | 'mhb'; ownerId: string; branchNumber?: number }
  | { kind: 'managed_custom'; schemaName: string; ownerKind: 'system_app' | 'application' | 'metahub_branch' }

export interface RepeatableSeedPack {
  id: string
  checksum: string
  scope: 'platform' | 'system_app'
  apply(executor: DbExecutor): Promise<void>
}

export interface SystemAppDefinition {
  key: 'admin' | 'applications' | 'metahubs' | 'profiles'
  displayName: string
  ownerPackage: string
  engineVersion: string
  structureVersion: string
  configurationVersion: string
  schemaTarget: SchemaTarget
  runtimeCapabilities: {
    supportsPublicationSync: boolean
    supportsTemplateVersions: boolean
    usesCurrentUiShell: 'universo-template-mui' | 'apps-template-mui'
  }
  migrations: readonly SystemAppMigrationEntry[]
  repeatableSeeds: readonly RepeatableSeedPack[]
  desiredArtifacts: readonly DefinitionArtifact[]
}
```

This does not mean every field must be introduced in one patch, but the completion plan must converge to this class of contract, not remain on the current minimal manifest shape.

Critical-path rule:

- `fixed` and `managed_dynamic` support are parity-critical.
- `managed_custom`, `desiredArtifacts`, and the richest future editor/export fields are convergence-tier work unless a concrete current requirement proves they are needed earlier.
- The parity milestone must not be delayed only to complete the most future-facing contract fields.

### Safe SQL hardening pattern

```sql
BEGIN;
CREATE OR REPLACE FUNCTION admin.secure_fn(...)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = admin, pg_temp
AS $$
BEGIN
  -- schema-qualified SQL only
  PERFORM admin.some_table.id FROM admin.some_table LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION admin.secure_fn(...) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin.secure_fn(...) TO authenticated_user_role;
COMMIT;
```

### Safe QueryClient test wrapper pattern

```tsx
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  })
}

export function createQueryWrapper(client = createTestQueryClient()) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}
```

### Safe diagnostic payload pattern

```ts
return res.status(409).json({
  code: 'systemApps.registryDrift',
  params: {
    logicalKey,
    scopeKey,
    expectedChecksum,
    actualChecksum,
  },
})
```

---

## Delivery Strategy

The program should be executed in ten implementation waves.

### Wave 0: Freeze The Completion Baseline

Goal:
- Convert the verified findings above into explicit acceptance gates and decision records.

Tasks:
- Replace the current fragmented planning baseline with this master plan.
- Record that UP-test currently shows `public.profiles` and empty `definition_*` rows.
- Decide that the authoritative completion proof must be a fresh DB reset, not incremental drift repair on a dirty test environment.
- Freeze the acceptance scenario from the original brief as a formal integration gate.
- Record the hard constraints that must survive all later implementation waves:
   - UUID v7 remains mandatory,
   - no artificial Metahub version bump,
   - no disposable-data compatibility shim work,
   - no unnecessary package/UI/interface churn.
- Keep the requirement coverage matrix in this plan so later edits cannot silently drop original brief obligations.

Acceptance:
- The repository has one canonical master plan for completion work.
- The completion program is anchored to fresh-DB acceptance, not to local partial success.

Tests:
- None new in this wave; this is the planning and acceptance-baseline wave.

### Wave 1: Complete The Core Contract Layer

Goal:
- Expand the shared migration/system-app contract so it can describe the target architecture instead of only the already-implemented subset.

Tasks:
- Extend `SchemaTarget` to include fixed and managed dynamic targets as parity-critical support.
- Define the managed custom target shape now, but keep implementation decision-gated unless it solves a real current requirement.
- Extend `SystemAppDefinition` with:
  - engine version,
  - structure version,
  - configuration version,
  - runtime capabilities,
   - repeatable seeds.
- Add richer fields such as `desiredArtifacts` only where they unlock real registry/export/editor behavior already planned in this program.
- Introduce shared neutral helpers for:
  - schema target resolution,
  - safe managed custom name validation,
  - deterministic definition bundle compilation.
- Keep the implementation in existing `universo-*` packages unless a new package is strictly necessary to prevent cycles.
- Keep one new migration file per structural revision boundary instead of hiding multiple revision semantics inside mutable blocks.

Acceptance:
- The core contract can model both current fixed system apps and future runtime-generated definitions.

Tests:
- Contract-type tests.
- Validator tests.
- Schema target resolution tests.
- Bundle checksum/deterministic serialization tests.

### Wave 2: Unify Naming, Qualification, And Compiler Boundaries

Goal:
- Remove the split between fixed-schema contracts and runtime-schema compiler behavior.

Tasks:
- Refactor `@universo/schema-ddl` to consume the shared naming/qualification layer.
- Keep helper-level safety boundaries inside helpers, not only at route level.
- Add safe qualification helpers for tables, functions, indexes, triggers, policies, and history tables.
- Support future managed custom names without enabling unsafe arbitrary identifiers.
- Ensure generated SQL does not depend on ambient `search_path`.

Acceptance:
- Fixed schemas and runtime schemas are resolved through one canonical contract family.

Tests:
- Identifier safety tests.
- Qualification tests.
- Managed custom name rejection tests.
- Schema generator/cloner/migrator contract tests.

### Wave 3: Move System-App Definitions To Manifest V2

Goal:
- Upgrade package-owned definitions from “migration list manifests” to real application-like manifests.

Tasks:
- Convert `admin`, `applications`, `metahubs`, and `profiles` manifests to the richer contract in two tiers:
   - parity tier required for exact bootstrap/runtime behavior,
   - convergence tier for future editor/export features.
- Attach repeatable seed packs explicitly instead of encoding them only as special migrations.
- Define desired artifacts for each system app only where they already support a concrete catalog/export need in this program.
- Add capability metadata documenting how each system app behaves today.
- Keep concrete manifests co-located with their owning packages.
- Preserve the effective current Metahub structure/template version semantics instead of introducing a refactor-only version increment.

Acceptance:
- System-app definitions describe more than migration order; they describe target ownership, versions, and seed/data lifecycle.

Tests:
- Manifest parsing and ordering tests.
- Capability metadata tests.
- Repeatable seed checksum tests.

### Wave 4: Close Live Bootstrap And Registry Drift

Goal:
- Make startup lifecycle and actual UP-test state match the intended architecture.

Tasks:
- Reset UP-test or provision a clean equivalent environment.
- Run bootstrap end-to-end.
- Verify that `definition_registry`, `definition_revisions`, and `definition_exports` are populated after sync.
- Add explicit bootstrap doctor checks that fail when fixed-schema or registry drift exists.
- Make drift visible in operator diagnostics rather than silently tolerated.
- Verify exact `metahubs` parity against the current fixed-schema contract:
   - table names,
   - columns,
   - enums,
   - indexes,
   - constraints,
   - RLS/policies,
   - naming.
- If profile fixed-schema cutover is approved in scope for this program:
   - verify that `profiles.profiles` is created on fresh bootstrap,
   - verify that `public.profiles` does not remain the effective live target after cutover.

Acceptance:
- The live test environment reflects the intended architecture, not an older partially migrated state.
- Exact Metahub parity is proven on a clean database.
- Profile fixed-schema cutover is proven only if it is part of the approved scope.

Tests:
- Fresh DB bootstrap integration test.
- Definition registry population test.
- Exact Metahub parity verification test.
- Profile fixed-schema existence test only if cutover is in approved scope.
- Doctor drift-detection tests.

### Wave 5: Normalize Runtime Ownership Boundaries

Goal:
- Remove the remaining transitional ownership that keeps application runtime sync under Metahubs.

Tasks:
- Extract application runtime sync orchestration from `metahubs-backend` into:
  - `applications-backend`, or
  - a new neutral infrastructure layer only if shared ownership is truly required.
- Keep publication compilation Metahub-owned.
- Keep current HTTP/API surface stable during the move.
- Standardize runtime sync metadata with platform migration metadata:
  - runId,
  - scope kind/key,
  - schema target,
  - structure/configuration version,
  - DDL budget.
- Reuse the same destructive-change policy evaluation contract across platform and runtime flows.

Acceptance:
- Application schema sync no longer depends on metahubs-domain route ownership.

Tests:
- Application sync service tests.
- Publications-to-application orchestration tests.
- Destructive policy evaluation tests.
- Lock/timeout budget tests.

### Wave 6: Finish The DB/File Definition Lifecycle

Goal:
- Make the registry lifecycle editor-ready without building the editor UI yet.

Tasks:
- Add real lifecycle operations for drafts, review, publish, export, and import metadata.
- Extend provenance payloads to include:
  - source kind,
  - actor,
  - review state,
  - imported/exported from,
  - compiler version,
  - checksum family.
- Define a canonical JSON bundle contract for system-app and future metahub-authored definitions.
- Add DB/file round-trip parity tests.
- Add approval-event linkage where destructive apply approval is required.

Acceptance:
- `definition_drafts` is not only a placeholder table; it is part of a real future-safe lifecycle.

Tests:
- Draft lifecycle tests.
- Publish/revision activation tests.
- Export/import parity tests.
- Approval metadata persistence tests.

### Wave 7: Define The Future Convergence Model Explicitly

Goal:
- Turn the target-state architecture into explicit manifests and docs instead of keeping it implicit.

Tasks:
- Define how Metahub structure maps to application structure.
- Define how Metahub template maps to configuration/template seed packs.
- Define the future target state for:
  - metahub-as-application,
  - admin-as-application,
  - profile-as-application,
  - applications-catalog/panel-as-application.
- Define the export contract that lets future editor-authored definitions round-trip back to files.
- Record the permission model for future editor workflows.
- Add MD architecture notes for the target-state schemas and internal system tables.
- Define the future policy for fixed system applications moving closer to `_app_*`-style internal conventions without making this a blocker for parity closure.

Acceptance:
- The future self-hosting direction is explicit and implementable, not only aspirational.

Tests:
- Contract validation tests for future export bundle shape.
- Documentation review gate only; no UI implementation yet.

### Wave 8: Adapt Current Frontends/Backends To The New Canonical Shape

Goal:
- Keep existing UI packages operational against the canonical new structure without inventing parallel legacy code.

Tasks:
- Audit all current Admin / Metahubs / Profile / Applications management routes and queries against the final schema contract.
- Replace remaining assumptions that still expect older field/table placement.
- Reuse existing UI building blocks:
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
  - existing optimistic CRUD helpers
- Reuse existing query helpers and invalidation patterns:
   - `safeInvalidateQueries`
   - `safeInvalidateQueriesInactive`
   - `appQueryKeys`
- New UI components or frontend interfaces are allowed only when the existing shared components/factories cannot model the behavior safely without distortion.
- Ensure all new diagnostics and blocker payloads are i18n-ready.

Acceptance:
- Current UI packages continue to work on top of the new system-app data model.

Tests:
- Route contract tests.
- Query-key invalidation tests.
- Migration-guard tests.
- Frontend component smoke/integration tests.

### Wave 9: Build The Deep Test System

Goal:
- Add the missing proof layer that the original brief explicitly requires.

Tasks:
- Create a dedicated test matrix covering:
  - contract validation,
  - bootstrap validation,
  - seed replay,
  - registry lifecycle,
  - DB/file import/export,
  - fresh DB bootstrap,
  - runtime schema creation,
  - publication-driven application sync,
  - lock contention,
  - failure recovery,
  - UI migration guards,
  - query cache invalidation,
  - i18n namespace loading,
  - approval/destructive policy gating,
  - doctor/live-drift checks.
- Keep root Vitest projects for unit/integration coverage.
- Add explicit higher-level acceptance tests for the user journey.
- Add optional live-db smoke tests for UP-test behind an explicit flag.

Acceptance:
- The architecture is proven by tests, not only by local code inspection.

Tests:
- This wave is the test-system wave; all of the above are required outputs.

### Wave 10: Final Acceptance And Release Readiness

Goal:
- Prove that the original technical brief is now fully implemented.

Tasks:
- Recreate or reset the test database.
- Run the full bootstrap and definition sync.
- Execute the full user acceptance scenario.
- Run root validation:
  - focused packages,
  - root test projects,
  - root build,
  - migration doctor,
  - live drift checks.
- Update memory-bank progress/status only after verified completion.

Acceptance:
- The project satisfies the original brief end-to-end on a fresh database.

Tests:
- All required validation gates above must pass.

---

## Deep Test Program

### Unit layer

- schema target validators
- managed custom schema naming guards
- canonical JSON bundle builder
- checksum and provenance helpers
- DDL budget validation
- destructive-change policy evaluation
- query key factories
- i18n diagnostic payload helpers

### Package integration layer

- `@universo/migrations-core`
- `@universo/migrations-catalog`
- `@universo/migrations-platform`
- `@universo/schema-ddl`
- `@universo/metahubs-backend`
- `@universo/applications-backend`
- `@universo/profile-backend`
- `@universo/auth-backend`

### Cross-package integration layer

- `App.initDatabase()` against a clean DB
- fixed schema bootstrap verification
- registry lifecycle verification
- metahubs parity verification
- publication -> application sync verification
- current frontend/backend route compatibility

### Failure/concurrency layer

- advisory lock contention
- lock timeout enforcement
- statement timeout enforcement
- partial failure and resumable rerun
- invalid import bundle rejection before any apply
- unsafe identifier rejection before any DDL

### UI/test harness layer

- one fresh `QueryClient` per test
- retries disabled in tests
- fake i18n namespace registration helpers
- shared wrappers for guards, dialogs, and optimistic CRUD tests
- explicit reuse tests for `safeInvalidateQueries`, `createEntityActions`, `createMemberActions`, `CrudDialogs`, `RowActionsMenu`, and `useCrudDashboard` where those abstractions are part of touched flows

### Live environment layer

- optional UP-test smoke suite:
  - schema existence,
  - definition registry populated,
  - profile storage target verified,
  - doctor reports no drift.

---

## Additional Newly Identified Tasks Beyond The Earlier Plan

1. Fix the current live-environment profile drift explicitly.
   - The previous plan assumed this was effectively closed, but UP-test shows it is not yet true in practice.

2. Add a registry population acceptance check.
   - Empty `definition_*` tables in UP-test prove that code-level lifecycle tests are not enough.

3. Add explicit bootstrap doctor checks for ambient PostgreSQL settings.
   - `search_path`, `statement_timeout`, `lock_timeout`, and pooler mode materially affect runtime correctness and should be visible in diagnostics.

4. Normalize migration metadata naming in SQL inspection/testing.
   - The catalog uses `_upl_created_at`, not `created_at`; operational tooling/tests must query the real schema.

5. Define a policy for fixed schema `_app_*`-style convergence.
   - This is not required for the immediate parity release, but the shape must be documented now to avoid future incompatible shortcuts.

6. Keep a living requirement traceability check inside the plan.
   - Future edits to the program should not be able to silently drop original technical-brief obligations such as exact parity, UUID v7, no artificial version bump, or current UI reuse.

---

## Deliverables

This program should produce the following artifacts.

1. Updated shared contracts and validators in `universo-*` packages.
2. Manifest V2 definitions for all current system apps.
3. Refactored runtime sync ownership.
4. Completed DB/file registry lifecycle.
5. Architecture docs for future system-app convergence.
6. Deep automated test suite.
7. Fresh-DB acceptance proof in UP-test.

---

## Approval Questions

These items should be confirmed before implementation starts.

1. Should the completion program treat `profiles.profiles` as mandatory final storage on fresh bootstrap, with `public.profiles` allowed only as migration input for already-dirty environments?
2. Is a full UP-test reset approved as the primary acceptance path for this program?
3. Should runtime application sync ownership move directly into `applications-backend`, or do you want a neutral shared infrastructure package if that produces a cleaner boundary?
4. Do you want the future convergence documentation to define a concrete `_app_*`-style internal model for fixed system apps now, or only the manifest/export contract in this wave?

---

## Recommended Next Step

Approve this master plan first.

After approval, the next agent step should be an IMPLEMENT wave starting with:

1. Wave 1: complete the core contract layer.
2. Wave 2: unify naming/qualification/compiler boundaries.
3. Wave 4: fix live bootstrap and registry drift on a clean UP-test environment.

That sequence closes the highest-risk architectural gaps before larger ownership and editor-lifecycle work begins.