# Plan: System App Definition Unification And Unified Bootstrap

> Date: 2026-03-11  
> Mode: PLAN  
> Complexity: Level 4 (major cross-cutting architecture)  
> Status: IN PROGRESS (multi-wave implementation active)  
> Scope: Replace remaining bootstrap hardcode with file-defined system-app definitions, activate the definition lifecycle in `upl_migrations`, and prepare the platform for Metahubs/Admin/Applications/Profile to be treated as applications while preserving current UI packages during the transition.

---

## Overview

Build the next architecture layer on top of the already unified Knex-based migration runtime:

- stop treating platform schemas as special hardcoded bootstrap steps,
- represent Metahubs, Admin, Applications, and Profile as file-defined system applications,
- unify platform bootstrap, runtime schema lifecycle, template/seed lifecycle, and future DB/file round-trip under one definition model,
- preserve the current React shell and current feature frontends until the later UI convergence phase,
- add a full deep test system across migrations, runtime DDL, system-app bootstrap, sync flows, and guard/UI behavior.

This plan assumes:

- a fresh test database is acceptable,
- UUID v7 remains mandatory,
- new functionality must be i18n-first,
- shared types/utilities belong in `@universo/types` and `@universo/utils`,
- dependency versions must keep following the centralized `pnpm-workspace.yaml` catalog policy.

---

## Implementation Status Snapshot (2026-03-11)

Implemented and verified in completed waves:

- unified migration-platform foundation (`validate/lint/doctor/import`, dependency-graph validation, execution-budget enforcement),
- system-app definition loader replacing manual platform-migration assembly,
- migration catalog synchronization lifecycle (`upl_migrations.definition_*`) wired into bootstrap and CLI sync,
- metahub built-in template bootstrap moved into migration lifecycle (removed ad-hoc startup seeding),
- profile reconciliation safety hardening plus ordering/scope contract tests,
- targeted search-path/security and schema naming consistency hardening,
- focused package validation and repeated successful root `pnpm build` (`27/27`).

Still open in this long-range plan:

- phase-level checkbox matrix in this document is intentionally conservative and remains open until each acceptance gate is explicitly reconfirmed end-to-end for the final convergence milestone.
- deeper target-state convergence phases (full ownership normalization, full DB/file editor round-trip, complete architecture-note closure) remain tracked as ongoing program work.

---

## QA Addendum (2026-03-11)

Additional QA review identified several places where the original draft needed to be stricter to match the technical brief and avoid unnecessary architecture churn.

The corrected constraints for implementation are:

1. **Exact current behavior is a non-negotiable acceptance gate**
   - The refactor is not complete unless the full existing path still works on a fresh DB:
     - open `/metahubs`,
     - create a Metahub,
     - create its first branch schema `mhb_*_b1`,
     - create publication/version,
     - create application/connector,
     - create application schema `app_*`,
     - sync publication data into the application runtime,
     - use the current UI packages successfully.

2. **Exact `metahubs` platform schema parity must be explicit**
   - “Keep exact structure parity where required” was too soft.
   - The implementation must preserve the exact schema produced today by the current native SQL migration:
     - same table names,
     - same columns,
     - same enums,
     - same indexes,
     - same constraints,
     - same RLS and policies,
     - same naming.

3. **Do not force the `profiles.profiles` move into the critical path**
   - The user explicitly framed this as an architectural option, not the primary acceptance criterion.
   - Therefore the `profiles` schema migration is a decision-gated phase after the core migration/bootstrap unification is proven.

4. **Do not introduce a new package unless it has a clear ownership win**
   - A new `@universo/app-definitions` package is reasonable only if it prevents circular dependencies and gives a clean infrastructure boundary.
   - If the same result can be achieved more simply by extending `@universo/migrations-platform`, `@universo/migrations-core`, `@universo/migrations-catalog`, and `@universo/types`, that path is preferred.

5. **Reuse existing UI patterns by default**
   - The plan must explicitly reuse:
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
   - New UI components are allowed only when these cannot model the required behavior safely.

6. **Dual versioning must be explicit**
   - The architecture must distinguish:
     - platform/runtime engine version,
     - system-app structure version,
     - template/seed/configuration version.
   - This aligns the plan with the user’s “1C-style” platform/configuration thinking.

7. **File format strategy must be explicit**
   - Canonical authoring format: TypeScript manifests.
   - Exchange/export format: JSON bundles.
   - Database storage format: normalized JSONB plus registry metadata/checksums.

8. **No legacy compatibility layer is required for old test DB data**
   - Fresh DB reset is allowed.
   - The plan must avoid inventing compatibility shims that only preserve already-disposable pre-refactor data.

9. **Definition data in the database must stay declarative, never executable**
   - Canonical authoring may use TypeScript files.
   - Database persistence must store only validated JSON/JSONB payloads, checksums, and provenance metadata.
   - The future editor/import flow must never persist arbitrary executable code or raw SQL authored by operators.

10. **Migration governance rules must be explicit**
   - Versioned structural migrations are immutable once published.
   - Repeatable seed packs are re-executable and checksum-tracked.
   - Destructive runtime changes must stay explicitly classified and confirmation-gated.
   - Validate/lint/drift checks must run before apply in automation-facing flows.

11. **Operational observability is part of the architecture, not an afterthought**
   - Migration and sync flows need structured run identifiers, error codes, timings, and scope metadata.
   - This is required for safe operations once the system is used with non-test data.

12. **Compiler-generated SQL must not rely on ambient `search_path`**
   - Compiler-generated SQL should use schema-qualified names by default.
   - `SECURITY DEFINER` functions must set a safe `search_path` explicitly and avoid writable/untrusted schemas.
   - Connection-level `search_path` may remain as a transitional compatibility layer, but not as the long-term correctness boundary.

13. **DDL execution must have explicit lock and timeout budgets**
   - Runtime DDL and platform DDL must define `statement_timeout` / `lock_timeout` policy deliberately.
   - Long-running or high-lock-impact operations must be classified, surfaced in planning, and guarded in interactive flows.

14. **Definition artifacts require dependency-graph validation**
   - Desired artifacts already carry `dependencies`; the plan must require DAG validation, deterministic topological ordering, and cycle rejection.
   - This must apply to tables, constraints, functions, triggers, policies, and repeatable seed dependencies.

15. **Production-grade changes should follow forward-only and expand/migrate/contract discipline**
   - Versioned migrations should be treated as forward-only for operational workflows.
   - Data-bearing/destructive changes should prefer expand -> backfill/migrate -> cutover -> contract instead of direct destructive rewrites.
   - Rollback strategy should rely on roll-forward fixes, checkpoints/snapshots, and validated restore procedures rather than assuming universal `down` safety.

---

## Additional Analysis Performed For This Plan

### Revalidated Current Architecture

- Unified platform migrations already run from `@universo/migrations-platform` during `App.initDatabase()` in `@universo/core-backend`.
- Runtime schema history already exists for both Metahub branches and published Applications.
- `upl_migrations.migration_runs` is active in `UP-test`, but `upl_migrations.definition_registry` and related revision/export tables are still empty.
- Metahub template persistence already stores `manifest_json`, `manifest_hash`, and `definition_type`, which is a strong base for a broader application-definition model.

### Hidden Couplings And Problems Found

1. **Platform bootstrap is still manually assembled**
   - `packages/universo-migrations-platform/base/src/platformMigrations.ts` imports package migrations explicitly and builds one hardcoded array.
   - Result: the runtime is unified, but the bootstrap source-of-truth is not.

2. **Template seeding still lives outside the migration lifecycle**
   - `seedMetahubTemplates()` is called after platform migrations from `@universo/core-backend`.
   - Result: schema bootstrap and repeatable seed bootstrap are still separate orchestration paths.

3. **Definition registry exists but is not used as a real definition lifecycle**
   - `upl_migrations.definition_registry`, `definition_revisions`, `definition_exports`, and `definition_drafts` exist in `UP-test`.
   - Row counts are currently zero.
   - Result: the project has catalog storage, but not yet a living DB/file definition workflow.

4. **Schema naming policy is fragmented**
   - `@universo/schema-ddl` validates only managed dynamic names (`app_*`, `mhb_*`).
   - `MetahubBranchesService` has its own `buildSchemaName()` and `assertSafeSchemaName()`.
   - Fixed schema names (`admin`, `metahubs`, `applications`) are not represented through one canonical `SchemaTarget` contract.

5. **Profile storage is still hardcoded to `public.profiles` across multiple packages**
   - `auth-backend`, `start-backend`, `admin-backend`, `applications-backend`, `metahubs-backend`, and `profile-backend` all reference `public.profiles`.
   - Result: moving Profile to `profiles.profiles` is now feasible on a fresh DB, but must be treated as a coordinated cross-package refactor.

6. **Application runtime sync logic is still hosted in `metahubs-backend`**
   - `packages/metahubs-backend/base/src/domains/applications/routes/applicationSyncRoutes.ts` performs application schema generation and sync.
   - Result: domain ownership is still transitional and should be decoupled before full system-app convergence.

7. **Version catalog usage is not fully normalized**
   - At least `packages/universo-rest-docs/package.json` still pins a literal `typescript` version instead of using `catalog:`.
   - Result: the monorepo policy is defined centrally, but not enforced uniformly.

8. **Shared i18n registry currently logs namespace registration to console**
   - `packages/universo-i18n/base/src/registry.ts` prints registration diagnostics.
   - Result: helpful during migration, but noisy and not appropriate as a long-term production default.

9. **Current test coverage is good at package-unit level but not deep enough end-to-end**
   - Strong unit coverage exists in `schema-ddl`, `migrations-core`, `migrations-catalog`, `migrations-platform`, auth RLS middleware, and migration guards.
   - Missing or still shallow:
     - full fresh-DB bootstrap verification,
     - system-app bootstrap end-to-end,
     - definition registry round-trip usage,
     - profiles-schema relocation scenario,
     - concurrent runtime sync / retry / resume,
     - cross-package UI compatibility with restructured storage.

---

## Affected Areas

- `packages/universo-migrations-platform`
- `packages/universo-migrations-core`
- `packages/universo-migrations-catalog`
- `packages/schema-ddl`
- `packages/universo-core-backend`
- `packages/universo-database`
- `packages/metahubs-backend`
- `packages/applications-backend`
- `packages/profile-backend`
- `packages/admin-backend`
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
- `memory-bank/plan`
- selected package README / architecture docs only when the implementation is approved

---

## Requirement Coverage Matrix

### Original Technical Brief

- **Requirement 1: deeper analysis and unification of Metahub/Application migrations**
  - Covered by: Overview, Target Architecture Decisions, Phases 0-7, 9.

- **Requirement 2: robust migration system for real working data**
  - Covered by: Target Architecture Decisions 2, 4, 7; Phases 4-6; Detailed Testing Strategy; concurrency/failure tests.

- **Requirement 3: replace TypeORM static migrations with file-based native system**
  - Covered by: Phases 3-5.

- **Requirement 4: support DB/file-backed structure and future editor workflow**
  - Covered by: Target Architecture Decisions 4, 7, 8; Phases 6 and 9.

- **Requirement 5: maximize unification because Metahubs are temporary special-case applications**
  - Covered by: Overview, Decisions 1-5, Phases 3, 7, 9.

- **Requirement 6: support fixed schema names such as `metahubs`**
  - Covered by: Decisions 3 and 7; Phase 2.

- **Requirement 7: treat Metahub structure/template as application structure/template concepts**
  - Covered by: Decisions 2, 6, 7; Phase 9.

- **Requirement 8: preserve exact current Metahub schema**
  - Covered by: QA Addendum points 1-2; Non-Negotiable Acceptance Gates; Phase 3.

- **Requirement 9: preserve full current end-to-end workflow on a fresh DB**
  - Covered by: QA Addendum point 1; Non-Negotiable Acceptance Gates; Detailed Testing Strategy.

### Additional Follow-Up Brief

- **System sections must be represented as application-like definitions, not bootstrap hardcode**
  - Covered by: Overview, Decisions 1-3, 7; Phases 3-6.

- **File format must be defined using good patterns**
  - Covered by: QA Addendum point 7; Phase 0.

- **Schema names must be architecture-aware now, even if custom names are future work**
  - Covered by: Decisions 3 and 7; Phase 2.

- **Need MD-level architectural descriptions for future app convergence**
  - Covered by: Phase 9 and final documentation/archive pass.

- **Current frontends must continue to work through existing packages**
  - Covered by: Decisions 5 and 8; QA Addendum point 1; frontend reuse rule.

- **No unnecessary new UI/components/interfaces**
  - Covered by: QA Addendum points 4-5; Decision 8; Phase 10.

---

## Target Architecture Decisions

### 1. Introduce A Canonical System-App Definition Layer

Preferred shape:

- `@universo/app-definitions`

Responsibilities:

- define strongly typed file manifests for system applications,
- validate and normalize those manifests,
- model structure definitions, fixed/dynamic schema targets, repeatable seed packs, and export metadata,
- provide file loaders and artifact builders,
- stay infrastructure-level and UI-neutral.

Decision gate:

- Create this package only if it provides a clean ownership boundary and avoids cycles better than extending existing migration packages plus `@universo/types`.
- Do not create it if it only repackages interfaces that can live cleanly in the current `universo-migrations-*` stack.

If created, it must not depend on business backends. Business packages may consume definitions or contribute builders, but the definition contract itself must live in a neutral `universo-*` layer.

Concrete system-app manifests should stay co-located with their owning domain packages unless centralization demonstrably reduces duplication without obscuring ownership.

### 2. Distinguish Four Different Things Explicitly

Do not keep mixing them under one vague "migration" term:

1. **Versioned platform migrations**
   - file-based, ordered, checksum-validated, forward-only by default.

2. **System-app structure definitions**
   - desired-state manifests for fixed schemas like `admin`, `metahubs`, `applications`, and later `profiles`.

3. **Runtime schema snapshots**
   - publication-driven or branch-driven desired state for `app_*` and `mhb_*`.

4. **Repeatable seed packs**
   - roles, locales, template manifests, default settings, default layouts/widgets, other replaceable reference/system data.

### 3. Use A Single SchemaTarget Contract Everywhere

Support all schema kinds through one contract:

- fixed platform schema: `admin`, `metahubs`, `applications`, `profiles`
- managed generated schema: `app_*`, `mhb_*`
- future managed custom name: user-assigned but policy-validated

### 4. Activate The Definition Lifecycle That Already Exists

The existing `upl_migrations.definition_*` tables must become real:

- register file definitions,
- store revisions,
- export active revisions,
- later support draft/review/editor flows,
- mirror runtime-generated artifacts where appropriate.

### 5. Keep The Current UI Packages During This Refactor

Do not block on full UI convergence.

During this plan:

- Metahubs/Admin/Profile/Applications management UIs continue to use `@universo/template-mui` and current feature packages.
- Published application runtime continues to use `@universo/apps-template-mui`.
- Backend/data contracts evolve first.
- UI convergence is prepared, not completed.

### 6. Use A Dual Version Model

The architecture must distinguish:

- platform/runtime engine version,
- system-app structure version,
- template/seed/configuration version.

This applies to Metahubs and to future system applications.

### 7. Standardize File And DB Representation

- canonical authored manifests live in TypeScript files,
- export/import uses stable JSON bundles,
- database-backed definitions store normalized JSONB payloads plus registry/checksum metadata.

### 8. Reuse Existing UI And Frontend Infrastructure

For any operator-facing or user-facing work produced by this migration program:

- reuse `MigrationGuardShell`,
- reuse existing Metahub/Application migration guard patterns,
- reuse `ConnectorDiffDialog` for diff/review UX where applicable,
- reuse `EntityFormDialog` / `DynamicEntityFormDialog`,
- reuse `CrudDialogs`, `RowActionsMenu`, `useCrudDashboard`,
- reuse existing optimistic CRUD helpers and current QueryClient pattern,
- add new UI components only if reuse would materially distort or break behavior.

### 9. Separate Transitional Implementation From Target-State Convergence

Two tracks must stay explicit:

- **Transitional implementation track**
  - preserve current fixed schemas and current frontends,
  - prove parity and current end-to-end behavior first.

- **Target-state convergence track**
  - define how system applications will later move closer to application-style `_app_*` internals and shared UI/runtime patterns,
  - document this target state without making it a blocker for the parity release.

### 10. Keep DB Definitions Declarative And Compiler-Driven

Definition authoring and definition persistence must not collapse into one thing:

- TypeScript manifests are authoring-time assets,
- stable JSON bundles are the interchange/export format,
- DB storage contains validated declarative payloads plus checksums and provenance,
- DDL SQL is compiler output, not operator-authored input.

This keeps the future editor safe and prevents a second “mini-TypeORM” from emerging inside the registry.

### 11. Treat Governance As A First-Class Runtime Contract

The migration platform must encode these invariants:

- published versioned migrations are immutable,
- repeatable seeds are idempotent and replayable,
- non-transactional migrations must be explicitly declared and justified,
- destructive changes require explicit confirmation or policy approval,
- drift/validate/lint/doctor checks are standard lifecycle steps, not optional scripts.

### 12. Build Security, Provenance, And Auditability Into The Definition Lifecycle

The future DB-backed editor path requires:

- actor/source provenance on revisions and exports,
- draft/review/published lifecycle enforcement,
- RBAC/permission checks owned by platform/admin policies,
- import validation that rejects unsafe identifiers, unsupported artifacts, and malformed payloads before any DDL is compiled.

### 13. Add Operational Observability To Migration And Sync Flows

Every platform migration and runtime sync flow should emit structured, testable telemetry fields:

- `runId`,
- `scopeKind`,
- `scopeKey`,
- `schemaTarget`,
- `definitionId` / `revisionId` where applicable,
- duration/error classification metadata.

This is required for reliable diagnosis once schema changes operate on real production-like data.

### 14. Make Schema Qualification And Function Hardening Explicit

The platform must converge toward:

- schema-qualified compiler output for tables, indexes, functions, triggers, and policies,
- no correctness dependency on global connection `search_path`,
- safe `SECURITY DEFINER` functions with explicit trusted `search_path` and controlled EXECUTE privileges.

This matters because parts of the current code still rely on ambient `search_path` and unqualified table names.

### 15. Treat Lock And Timeout Budgets As Part Of DDL Policy

The platform should classify DDL operations by operational risk:

- low-lock additive operations,
- potentially blocking operations,
- destructive or review-required operations.

For each class, define:

- advisory lock strategy,
- `lock_timeout`,
- `statement_timeout`,
- retry/abort policy,
- whether interactive confirmation is required.

### 16. Validate Artifact Dependency Graphs Before Compilation

The compiler/registry path must not assume artifact order is “already correct”.

It should enforce:

- deterministic topological ordering,
- cycle detection,
- unknown-dependency rejection,
- phase-aware grouping for tables, constraints, indexes, functions, triggers, policies, and seeds.

### 17. Prefer Forward-Only Delivery With Expand/Contract For Risky Changes

For operationally meaningful changes, especially data-bearing ones, the plan should prefer:

- additive expansion,
- data backfill / snapshot migration,
- contract cleanup only after successful cutover.

This reduces the temptation to encode unsafe direct destructive rewrites into the core migration system.

---

## Proposed Package And Module Layout

### Optional New Package

- `packages/app-definitions/base`
  - `src/contracts/`
  - `src/loaders/`
  - `src/validators/`
  - `src/artifacts/`

Recommended ownership split:

- shared contracts/loaders/validators/artifact builders may live in this package,
- concrete `admin` / `metahubs` / `applications` / `profiles` definitions should remain co-located in their owning backend packages unless a clear ownership-neutral central registry layout proves simpler.

### Existing Packages To Extend

- `@universo/migrations-platform`
  - load registered platform migrations from definition loaders, not only hardcoded arrays.

- `@universo/migrations-catalog`
  - become the canonical registry/export/revision layer for system-app definitions.

- `@universo/schema-ddl`
  - adopt the shared `SchemaTarget` rules but remain DI-only.

- `@universo/types`
  - shared contracts for definitions, schema targets, seed packs, registry DTOs, status payloads.

- `@universo/utils`
  - shared validators, naming helpers, safe identifier helpers, reusable test fixtures/wrappers where appropriate.

---

## Safe Code Patterns To Adopt

### Safe Pattern 1: Canonical SchemaTarget

```ts
export type SchemaTarget =
    | { kind: 'fixed'; schemaName: 'admin' | 'metahubs' | 'applications' | 'profiles' }
    | { kind: 'managed_dynamic'; prefix: 'app' | 'mhb'; ownerId: string; branchNumber?: number }
    | { kind: 'managed_custom'; schemaName: string; ownerKind: 'system_app' | 'application' | 'metahub_branch' }

export function resolveSchemaName(target: SchemaTarget): string {
    if (target.kind === 'fixed') {
        return target.schemaName
    }

    if (target.kind === 'managed_dynamic') {
        const cleanId = target.ownerId.replace(/-/g, '')
        if (target.prefix === 'mhb' && typeof target.branchNumber === 'number') {
            return `mhb_${cleanId}_b${target.branchNumber}`
        }
        return `${target.prefix}_${cleanId}`
    }

    assertManagedCustomSchemaName(target.schemaName)
    return target.schemaName
}
```

Why this is safe:

- all schema creation paths use one contract,
- fixed and generated names stop using different validator families,
- custom names can be introduced later without rewriting every caller again.

### Safe Pattern 2: Validated Identifier Quoting

```ts
const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/

export function assertSqlIdentifier(value: string): void {
    if (!IDENTIFIER_RE.test(value)) {
        throw new Error(`Unsafe SQL identifier: ${value}`)
    }
}

export function quoteIdentifier(value: string): string {
    assertSqlIdentifier(value)
    return `"${value}"`
}
```

Why this is safe:

- the validation happens inside the helper,
- route-level validation is not treated as a sufficient safety boundary,
- the same helper can be used by DDL, runtime sync, schema clone, and schema drop flows.

### Safe Pattern 3: System-App Definition Manifest

```ts
export interface SystemAppDefinition {
    id: 'admin' | 'metahubs' | 'applications' | 'profiles'
    engineVersion: string
    structureVersion: string
    configurationVersion: string
    schemaTarget: SchemaTarget
    structure: {
        migrations: readonly PlatformMigrationFile[]
        desiredArtifacts: readonly DefinitionArtifact[]
    }
    repeatableSeeds: readonly RepeatableSeedPack[]
    runtimeCapabilities: {
        supportsPublicationSync: boolean
        supportsTemplateVersions: boolean
        supportsDirectCrudUi: boolean
    }
}
```

Why this is safe:

- structure and repeatable data become separate first-class concepts,
- platform/version/configuration semantics are explicit,
- system applications stop being hidden one-off startup logic,
- the same model can later represent app-authored manifests from DB or files.

### Safe Pattern 4: Repeatable Seed Packs

```ts
export interface RepeatableSeedPack {
    id: string
    scope: 'platform' | 'system_app'
    checksum: string
    apply(executor: DbExecutor): Promise<void>
}
```

Why this is safe:

- idempotent reference/system data is not forced into versioned one-shot migrations,
- template manifest refreshes and role/default-setting refreshes get proper lifecycle handling,
- checksums make drift and replay visible.

### Safe Pattern 5: React Query Query Key Factory

```ts
export const systemAppQueryKeys = {
    root: ['system-apps'] as const,
    detail: (appId: string) => [...systemAppQueryKeys.root, 'detail', appId] as const,
    definitions: (appId: string) => [...systemAppQueryKeys.root, 'definitions', appId] as const,
    migrationPlan: (appId: string) => [...systemAppQueryKeys.root, 'migration-plan', appId] as const
}
```

Why this is safe:

- it follows TanStack Query v5 guidance for one client per app plus organized key factories,
- invalidation stays precise and testable,
- it avoids ad hoc string keys scattered across feature packages.

### Safe Pattern 6: Compiler Boundary For Definitions

```ts
export interface DefinitionBundle {
    manifest: SystemAppDefinition
    exportedAt: string
    canonicalJson: string
    checksum: string
}

export function compileDefinitionBundle(manifest: SystemAppDefinition): DefinitionBundle {
    const canonicalJson = stableStringify(manifest)
    return {
        manifest,
        exportedAt: new Date().toISOString(),
        canonicalJson,
        checksum: sha256(canonicalJson)
    }
}
```

Why this is safe:

- authored TypeScript never becomes the persisted runtime representation,
- export/import use one deterministic canonical form,
- registry checksums are stable across environments.

### Safe Pattern 7: Destructive-Change Policy Gate

```ts
export interface ChangePolicyDecision {
    allowApply: boolean
    requiresConfirmation: boolean
    reasonCode: string | null
}

export function evaluateChangePolicy(input: {
    hasDestructiveChanges: boolean
    isOperatorConfirmed: boolean
    executionMode: 'interactive' | 'automation'
}): ChangePolicyDecision {
    if (!input.hasDestructiveChanges) {
        return { allowApply: true, requiresConfirmation: false, reasonCode: null }
    }

    if (input.executionMode === 'automation' && !input.isOperatorConfirmed) {
        return { allowApply: false, requiresConfirmation: true, reasonCode: 'destructive_confirmation_required' }
    }

    return { allowApply: input.isOperatorConfirmed, requiresConfirmation: true, reasonCode: null }
}
```

Why this is safe:

- destructive changes stop being hidden UI-only decisions,
- automation and operator-driven flows follow the same policy contract,
- error/status payloads can be i18n-coded and testable.

### Safe Pattern 8: Schema-Qualified SQL Compiler Output

```ts
export function qualifyTable(schemaName: string, tableName: string): string {
    assertSqlIdentifier(schemaName)
    assertSqlIdentifier(tableName)
    return `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`
}
```

Why this is safe:

- generated SQL stops depending on ambient `search_path`,
- fixed schemas and managed schemas follow the same qualification rules,
- future custom schema names stay inside one validation boundary.

### Safe Pattern 9: DDL Execution Budget

```ts
export interface DdlExecutionBudget {
    lockTimeoutMs: number
    statementTimeoutMs: number
    requiresReview: boolean
}
```

Why this is safe:

- long or blocking DDL stops being “just another migration”,
- planning output can expose operational risk before apply,
- runtime and platform execution paths can share one budget contract.

### Safe Pattern 10: Artifact Dependency Graph Validation

```ts
export interface ArtifactGraphValidationResult {
    ok: boolean
    orderedKeys: string[]
    issues: string[]
}
```

Why this is safe:

- artifact application order becomes deterministic,
- cycles and missing dependencies fail before execution,
- catalog export/import and compiler output share one ordering contract.

### Safe Pattern 11: Expand/Contract Migration Classification

```ts
export type MigrationDeliveryStage = 'expand' | 'migrate' | 'contract' | 'one_shot'
```

Why this is safe:

- risky changes become visible in planning and review,
- backfills and cutovers stop being hidden inside generic migration files,
- the system can evolve toward production-safe data migrations without redesign.

---

## Plan Steps

### Phase 0: Freeze The Contracts Before Moving More Code

- [ ] Define the approved terminology in `@universo/types`:
  - `SystemAppDefinition`
  - `SchemaTarget`
  - `RepeatableSeedPack`
  - `DefinitionSource`
  - `DefinitionExportBundle`
- [ ] Add neutral validators and naming helpers to `@universo/utils` / `@universo/migrations-core`.
- [ ] Freeze the file format strategy:
  - canonical authored manifests = TypeScript,
  - export/import bundles = JSON,
  - DB-backed storage = JSONB + registry metadata.
- [ ] Freeze the governance rules:
  - published versioned migrations are immutable,
  - repeatable seed packs are replayable and checksum-tracked,
  - non-transactional migrations require explicit justification,
  - destructive changes require a policy gate.
- [ ] Decide and document whether the target profile schema for the next iteration is:
  - `profiles.profiles` (recommended for long-term convergence), or
  - `public.profiles` (temporary compatibility hold).
- [ ] Document that the recommended target is `profiles.profiles`, and treat this as an explicit cross-package migration, not an incidental rename.
- [ ] Document explicitly that no legacy compatibility layer is required for old disposable test-database data.
- [ ] Freeze the provenance contract for future DB-backed editing:
  - source kind,
  - actor metadata,
  - approval/review metadata,
  - export/import metadata.
- [ ] Freeze the SQL hardening rules:
  - compiler output uses schema-qualified names by default,
  - `SECURITY DEFINER` functions require explicit safe `search_path`,
  - long-term correctness must not depend on connection-global `search_path`.
- [ ] Freeze the DDL budget policy:
  - `lock_timeout`,
  - `statement_timeout`,
  - risk classes,
  - confirmation/review thresholds.
- [ ] Freeze the artifact graph rules:
  - dependency key format,
  - cycle handling,
  - deterministic topological ordering,
  - phase grouping rules.
- [ ] Freeze the delivery policy for risky changes:
  - default to forward-only,
  - use expand/migrate/contract for data-bearing changes,
  - define when `down` functions are informational/dev-only vs operationally supported.

Acceptance:

- one canonical type family exists for schema targeting and definition loading,
- the decision about `profiles` schema is explicit before implementation begins,
- governance and provenance rules are explicit before implementation begins.

### Phase 1: Establish The Definition Contract Boundary

- [ ] Run a dependency-boundary check:
  - if a new package is justified, create it with catalog-based versions and dual build outputs consistent with the repo pattern,
  - otherwise keep the contracts in existing `universo-migrations-*` packages and `@universo/types`.
- [ ] Move shared definition contracts and manifest validators there.
- [ ] Add file loaders for:
  - versioned migration files,
  - repeatable seed packs,
  - desired artifact bundles.
- [ ] Add a deterministic compiler boundary:
  - manifest -> canonical JSON bundle,
  - canonical JSON bundle -> catalog payload,
  - canonical JSON bundle -> DDL artifacts.
- [ ] Add tests for manifest parsing, validation failures, checksum stability, and serialization.
- [ ] Add tests for dependency graph validation and deterministic artifact ordering.

Acceptance:

- new package is infrastructure-only,
- no circular dependency on feature backends,
- manifest loading is deterministic and test-covered.

### Phase 2: Unify Schema Naming And Target Resolution

- [ ] Replace scattered schema-name builders/validators with the shared `SchemaTarget` API.
- [ ] Update `schema-ddl`, `applications-backend`, `metahubs-backend`, and runtime sync helpers to use the same helpers.
- [ ] Introduce shared schema-qualification helpers so compiler-generated SQL can stop relying on ambient `search_path`.
- [ ] Preserve current generated names:
  - `mhb_<uuid32>_b<branch>`
  - `app_<uuid32>`
- [ ] Add support for fixed names:
  - `admin`
  - `metahubs`
  - `applications`
  - `profiles`
- [ ] Add future-safe support for managed custom names without enabling unsafe free-form identifiers.

Acceptance:

- all schema create/drop/clone/sync paths share one naming policy,
- route-level regex checks become thin wrappers over shared validators instead of separate logic islands.

### Phase 3: Convert System Apps Into File-Defined Definitions

- [ ] Define initial system-app manifests for:
  - Admin
  - Metahubs
  - Applications
  - Profiles
- [ ] Keep concrete manifests close to the owning domain package by default:
  - shared infrastructure contracts in `universo-*`,
  - domain-specific definitions in the owning package unless a central home is clearly better.
- [ ] Represent platform bootstrap as file definitions, not as ad hoc startup code.
- [ ] Keep exact structure parity for the current fixed schemas where this is part of the acceptance contract.
- [ ] For `metahubs`, make parity explicit against the current native SQL migration:
  - tables,
  - columns,
  - enums,
  - constraints,
  - indexes,
  - RLS,
  - policy names,
  - default values.
- [ ] Materialize that parity as a golden contract test fixture derived from the current accepted SQL bootstrap, so future refactors compare against an explicit snapshot instead of implicit expectations.
- [ ] Split each definition into:
  - versioned structural migrations,
  - repeatable seed packs,
  - exportable desired artifacts.
- [ ] Validate artifact dependency graphs before any compile/export/apply step.
- [ ] For function/trigger artifacts, define safe generation rules:
  - explicit schema qualification,
  - explicit `SECURITY DEFINER` hardening where needed,
  - explicit privilege model for EXECUTE access.

Acceptance:

- system apps are loaded from files,
- bootstrap no longer depends on hand-maintained per-package arrays as the only source-of-truth.

### Phase 4: Refactor `@universo/migrations-platform` To Load Definitions

- [ ] Replace the manually assembled `platformMigrations` array with a loader/registry that consumes system-app definitions.
- [ ] Keep the existing CLI surface (`status`, `plan`, `diff`, `export`) stable.
- [ ] Add `validate` and `lint` phases as first-class commands if not already exposed.
- [ ] Add a `doctor`/`check` style command that evaluates:
  - registry drift,
  - migration checksum drift,
  - live-schema parity checks where available,
  - invalid pending definition states.
- [ ] Surface artifact graph issues in validate/doctor output:
  - dependency cycles,
  - missing dependencies,
  - non-deterministic ordering violations.
- [ ] Include DDL risk surfacing in plan/doctor output:
  - high-lock-impact operations,
  - non-transactional operations,
  - review-required operations,
  - unsafe/unqualified artifact findings.
- [ ] Add an explicit `import` path for validated JSON bundles so the future editor round-trip is not bolted on later.
- [ ] Preserve dry-run planning and diff export behavior.

Acceptance:

- the CLI still works,
- the registry source becomes file definitions,
- validation catches duplicate IDs, invalid ordering, and checksum mismatches before runtime,
- the operational lifecycle includes import/export/doctor rather than export-only tooling.

### Phase 5: Move Repeatable Bootstrap Data Into The Definition Lifecycle

- [ ] Remove standalone startup seeding from `@universo/core-backend` for Metahub templates.
- [ ] Re-express template bootstrap as repeatable seed packs.
- [ ] Re-express Admin default roles/permissions/locales/settings using the same repeatable seed lifecycle where appropriate.
- [ ] Track seed execution checksums and reapply rules through the shared catalog.
- [ ] Reuse current frontend migration status/guard UX instead of introducing a second migration UI path.

Acceptance:

- schema bootstrap and seed bootstrap use one orchestrator,
- template/version updates no longer depend on a special-case startup call.

### Phase 6: Activate `upl_migrations.definition_*` As A Real Registry

- [ ] Register system-app desired artifacts on bootstrap/export.
- [ ] Record active revisions in `definition_registry` and `definition_revisions`.
- [ ] Record exports in `definition_exports`.
- [ ] Keep `definition_drafts` reserved for the future editor workflow, but wire the lifecycle now.
- [ ] Extend provenance/audit metadata where needed so revisions and exports can record:
  - actor/source,
  - review/approval state,
  - import/export origin,
  - compiler/checksum metadata.
- [ ] Add import/export round-trip tests for file bundle ↔ DB registry parity.

Acceptance:

- `UP-test` no longer shows an empty definition registry after bootstrap,
- the DB/file lifecycle becomes observable and testable,
- future editor/audit requirements do not require redesigning the catalog tables again.

### Phase 7: Normalize Runtime Ownership Boundaries

- [ ] Extract application runtime sync orchestration from `metahubs-backend` into a neutral/shared ownership model.
- [ ] The target is:
  - publication compilation stays Metahub-owned,
  - application schema sync becomes Application-owned or shared-infrastructure owned.
- [ ] Keep current API routes stable during the transition.
- [ ] Ensure the sync pipeline still uses shared DDL services and `migration_runs`.
- [ ] Standardize destructive-change policy evaluation so runtime sync and platform migrations use the same confirmation semantics.
- [ ] Standardize lock/transaction policy metadata across runtime flows:
- [ ] Standardize lock/transaction policy metadata across runtime flows:
  - transaction advisory vs session advisory,
  - justified `transactionMode: none`,
  - retry/timeout behavior.
- [ ] Standardize DDL execution budgets across runtime flows:
  - `lock_timeout`,
  - `statement_timeout`,
  - abort/retry rules for interactive vs automation contexts.
- [ ] Standardize delivery-stage semantics across runtime flows:
  - `expand`,
  - `migrate`,
  - `contract`,
  - explicit one-shot exceptions.

Acceptance:

- domain ownership matches the long-term architecture better,
- future removal of legacy Metahub-specific packaging becomes simpler,
- runtime sync behavior is operationally consistent with the platform migration runner.

### Phase 8: Move Profile To A Dedicated System Schema

- [ ] Decision gate: only execute this phase if the user confirms that `profiles.profiles` should be part of the same implementation program.
- [ ] If approved:
  - create the `profiles` fixed schema definition,
  - move table target from `public.profiles` to `profiles.profiles`,
  - update all SQL references across backend packages and RLS optimization definitions,
  - revalidate policies and bootstrap trigger functions.

Acceptance:

- if this phase is approved, fresh DB boot creates `profiles.profiles`,
- if this phase is deferred, the rest of the program remains valid and no other phase depends on it,
- all affected packages have passing targeted tests.

### Phase 9: Prepare System Apps For Future App-Based Convergence

- [ ] Define explicit runtime capability metadata in system-app manifests.
- [ ] Define how Metahub "structure" maps to application structure metadata.
- [ ] Define how Metahub "template" maps to reusable template/seed packs.
- [ ] Define export contracts so future editor-created app definitions can round-trip back to files.
- [ ] Define the approval and permission model for the future editor workflow:
  - who may create drafts,
  - who may publish,
  - who may export/import,
  - who may trigger destructive applies.
- [ ] Produce architecture notes in `memory-bank/plan` or follow-up docs for the target-state schema model of:
  - metahub-as-application,
  - admin-as-application,
  - profile-as-application,
  - applications-catalog/panel-as-application.
- [ ] Explicitly document that these target-state notes do not override the transitional parity release requirements.
- [ ] Keep current feature frontends operational without forcing immediate migration to `apps-template-mui`.

Acceptance:

- the architecture is ready for future self-hosting Metahubs-as-an-app,
- today’s UI remains functional.

### Phase 10: Enforce I18n-First And Shared Frontend Contracts

- [ ] Every new backend status code / blocker / diagnostics payload must use i18n-ready codes plus params.
- [ ] Every new UI string must be registered through package namespaces and merged via `@universo/i18n`.
- [ ] Stop adding raw user-facing strings inside shared infrastructure components.
- [ ] Remove or gate debug namespace logging in `@universo/i18n/registry`.
- [ ] Standardize Query Key Factories for new system-app/admin/runtime flows.
- [ ] Explicitly reuse existing UI building blocks before introducing new ones:
  - `MigrationGuardShell`
  - `ConnectorDiffDialog`
  - `EntityFormDialog`
  - `DynamicEntityFormDialog`
  - `CrudDialogs`
  - `RowActionsMenu`
  - `useCrudDashboard`
  - `createEntityActions`
  - `createMemberActions`
  - existing optimistic CRUD helpers

Acceptance:

- new functionality is EN/RU ready from day one,
- no new ad hoc untranslated strings are introduced.

### Phase 11: Normalize Catalog Version Usage

- [ ] Replace literal dependency versions with `catalog:` where the repo policy requires it.
- [ ] Prioritize:
  - `@tanstack/react-query`
  - `typescript`
  - other centrally managed infra libraries
- [ ] Add a lightweight validation script or CI check to prevent future drift.

Acceptance:

- dependency policy is enforceable rather than aspirational,
- packages stop silently diverging on core infra versions.

### Phase 12: Build The Deep Test System Before Declaring The Refactor Complete

- [ ] Create a test matrix that explicitly covers:
  - definition validation,
  - migration planning,
  - migration execution,
  - seed replay,
  - registry/export lifecycle,
  - registry import lifecycle,
  - fresh DB bootstrap,
  - runtime schema creation,
  - publication-driven application sync,
  - concurrent lock scenarios,
  - failure recovery / retry / resume,
  - UI migration guards,
  - query-cache invalidation,
  - i18n namespace loading,
  - destructive-change policy gating,
  - provenance/audit persistence,
  - live-schema doctor checks.
- [ ] Use Vitest projects to separate:
  - fast unit tests,
  - integration tests,
  - browser/component tests where justified.
- [ ] Add shared helpers for:
  - QueryClient test wrappers with retries disabled,
  - fake i18n namespace registration,
  - mock DB executors,
  - migration fixture loading,
  - Supabase-backed smoke tests for critical bootstrap paths when explicitly enabled.

Acceptance:

- the test system proves architecture behavior, not only isolated helpers,
- all critical layers have both happy-path and failure-path coverage.

---

## Detailed Testing Strategy

### A. Unit Tests

- manifest validators
- naming helpers
- identifier safety helpers
- definition checksum builders
- repeatable seed checksum logic
- compiler boundary and canonical JSON serialization
- destructive-change policy evaluation
- schema qualification helpers
- DDL execution budget policy
- artifact dependency graph validation
- forward-only / expand-contract classification rules
- query key factories
- i18n namespace helpers

### B. Package Integration Tests

- `@universo/migrations-platform` loader + plan/diff/export
- `@universo/migrations-platform` validate/lint/doctor/import
- `@universo/migrations-catalog` registry/revisions/exports/drafts
- `@universo/schema-ddl` with shared `SchemaTarget`
- `@universo/schema-ddl` timeout / schema-qualification helpers
- artifact graph ordering and cycle rejection across compiler/export/apply paths
- `profile-backend` after `profiles` schema move
- `auth-backend` bootstrap trigger and session behavior after profile move

### C. Cross-Package Integration Tests

- fresh DB startup from `@universo/core-backend`
- system-app bootstrap creates all fixed schemas
- repeatable seeds populate expected rows
- definition registry is populated
- definition registry provenance metadata is populated correctly
- exact `metahubs` fixed-schema parity validation against the current native SQL contract
- golden snapshot verification for `metahubs` schema metadata from `information_schema` / `pg_catalog`
- generated SQL and stored function definitions pass schema-qualification / safe-search-path checks
- artifact dependency ordering is stable across export/import/bootstrap
- metahub creation creates `mhb_*_b1`
- publication creation creates publication schema/runtime artifacts
- application creation and sync creates `app_*`
- application data sync imports publication data correctly
- the current user-visible Metahub → Publication → Application workflow still works end-to-end through existing frontend/backend packages

### D. Concurrency And Failure Tests

- advisory lock contention on Metahub branch initialization
- advisory lock contention on Application sync
- explicit non-transactional migration handling where applicable
- lock-timeout / statement-timeout policy enforcement for DDL execution
- expand/migrate/contract staging behaves correctly for risky changes
- mid-sync failure leaves deterministic status/error
- rerun after failure is resumable and idempotent
- invalid custom schema name fails before any SQL executes
- invalid import bundle fails before any DDL is compiled or executed

### E. Frontend And Guard Tests

- migration guard shell rendering for mandatory/recommended/optional
- blocker i18n rendering
- QueryClient invalidation paths after migration apply/sync
- current feature frontends still load against the restructured backend contracts

### F. Browser-Level Confidence Tests

- limited browser/component suite for:
  - migration dialog flows,
  - core CRUD shells,
  - i18n namespace registration,
  - React Query optimistic update rollback paths where critical

### G. Supabase Smoke Tests

- gated smoke test job against `UP-test` or a temporary branch project
- verify:
  - fixed schemas present,
  - registry populated,
  - doctor/check command reports clean state,
  - dynamic schemas created,
  - core CRUD routes operational,
  - publication → application sync still works

---

## Potential Challenges And Mitigations

### Challenge 1: Profiles schema relocation touches many packages

Mitigation:

- treat it as one dedicated phase,
- use shared constants/helpers instead of mass string replacement,
- add focused package tests before and after the move.

### Challenge 2: Bootstrap refactor may accidentally create a second orchestration path

Mitigation:

- remove special-case startup seeds once repeatable seed packs exist,
- reject any implementation that leaves both old and new bootstrap paths permanently active.

### Challenge 3: Definition registry may become yet another passive storage table family

Mitigation:

- require bootstrap/export code to populate it,
- add tests and acceptance criteria based on non-empty registry/revisions/exports.

### Challenge 4: Runtime sync ownership refactor can destabilize the current feature flow

Mitigation:

- preserve route contracts during the ownership move,
- extract orchestration into shared services first, then move route ownership.

### Challenge 5: Introducing a new package may over-fragment the migration stack

Mitigation:

- create `@universo/app-definitions` only if it solves a real ownership/cycle problem,
- otherwise keep the definition contracts in the current migration stack and shared type package.

### Challenge 6: I18n and UI drift during infrastructure work

Mitigation:

- require all new status/blocker payloads to use codes + params,
- keep strings out of shared infrastructure layers,
- test namespace registration and fallback behavior.

### Challenge 7: Optional profile-schema relocation may distract from the core objective

Mitigation:

- treat `profiles.profiles` as a gated scope item,
- do not let it block the parity release for the core migration/bootstrap program.

### Challenge 8: DB-backed definitions can become an unsafe code-execution channel

Mitigation:

- persist only validated declarative payloads,
- compile DDL from trusted compilers,
- reject raw operator-authored SQL in the editor/import path.

### Challenge 9: Tooling may remain export-oriented and leave import/doctor as late debt

Mitigation:

- make import and doctor/check first-class CLI capabilities in the same phase as the loader refactor,
- cover them with package and smoke tests before calling the platform lifecycle complete.

### Challenge 10: Governance rules may stay implicit and drift across runtime and platform flows

Mitigation:

- encode immutability, destructive-change policy, and non-transactional migration rules in shared contracts,
- test the same rules in both platform and runtime execution paths.

### Challenge 11: Ambient `search_path` can hide correctness and security problems

Mitigation:

- move compiler-generated SQL toward schema-qualified output,
- treat connection-global `search_path` as transitional compatibility only,
- harden `SECURITY DEFINER` functions explicitly.

### Challenge 12: Runtime DDL can block live traffic if timeout policy stays implicit

Mitigation:

- introduce shared DDL execution budgets,
- surface lock-impact in plan/doctor output,
- test timeout and retry behavior explicitly.

### Challenge 13: Artifact order can drift between compile/export/import/apply paths

Mitigation:

- validate dependency graphs centrally,
- use one deterministic topological sort for every path,
- fail fast on cycles and missing dependencies.

### Challenge 14: Direct destructive rewrites create avoidable production risk

Mitigation:

- classify risky changes as expand/migrate/contract,
- keep versioned delivery forward-only by default,
- rely on roll-forward fixes and validated restore/checkpoint procedures instead of optimistic rollback assumptions.

---

## Non-Negotiable Acceptance Gates

1. Exact `metahubs` fixed-schema parity against the current native SQL migration.
2. Fresh DB bootstrap creates all required fixed schemas and shared migration catalog schemas.
3. `/metahubs` current UI flow still works.
4. Creating a Metahub creates `mhb_*_b1`.
5. Creating a publication/version still works.
6. Creating an application/connector still works.
7. Application runtime schema `app_*` is created and synced from the publication snapshot.
8. Current management UIs continue to function through existing feature packages and `@universo/template-mui`.
9. Published application runtime continues to function through `@universo/apps-template-mui`.
10. No new compatibility shims are introduced solely to preserve disposable legacy test-DB state.
11. Import/export/doctor lifecycle exists for definitions and is covered by automated tests.
12. Definition registry stores usable provenance/audit metadata for future editor-driven flows.
13. No DB-backed definition path accepts raw operator-authored executable code or unsafe SQL.
14. Compiler-generated SQL and stored functions do not rely on ambient `search_path` for correctness.
15. DDL execution policy exposes and enforces lock/timeout budgets for platform and runtime flows.
16. Definition artifact dependency graphs are validated and deterministically ordered before export/import/apply.
17. Risky data-bearing changes follow forward-only expand/migrate/contract policy unless an explicit exception is approved.

---

## Design Notes

- A later CREATIVE/DESIGN phase is still required for the future editor UX that will create and edit system-app / metahub-app definitions directly.
- This plan intentionally focuses on infrastructure, lifecycle, and compatibility layers first.
- The current `@universo/template-mui` and `@universo/apps-template-mui` split remains acceptable during this refactor, but the new definition model must not hardcode that split into the long-term architecture.

---

## Dependencies And Coordination

- `@universo/types` and `@universo/utils` must be extended before feature package rewiring.
- `@universo/core-backend` bootstrap changes depend on the chosen definition-contract home (`@universo/app-definitions` if created, otherwise the extended `universo-migrations-*` stack plus `@universo/types`).
- Profile schema relocation depends on cross-package SQL updates.
- Frontend compatibility depends on stable backend contracts and i18n payload design.
- Test infrastructure changes depend on Vitest project layout decisions and shared test helpers.

---

## Recommended Execution Order

1. Phase 0 through Phase 2
2. Phase 3 through Phase 6
3. Phase 12 test harness foundation in parallel before large rewires continue
4. Phase 7 and Phase 8
5. Phase 9 through Phase 11
6. Final full validation and documentation/archive pass

---

## External References Used For This Plan

- Knex migration source and transaction patterns
- Supabase/Postgres RLS guidance
- PostgreSQL advisory lock and row-security documentation
- TypeORM migration organization as reference only
- Flyway versioned/repeatable/validate concepts
- Atlas versioned + declarative + lint + checkpoint model
- TanStack Query v5 QueryClient/query-key/invalidation/testing guidance
- Vitest project/workspace/mocking/browser guidance
- i18next namespace and fallback guidance

These references support the architecture direction:

- hybrid versioned + desired-state model,
- first-class validate/lint/drift controls,
- explicit separation of repeatable seeds from one-shot migrations,
- one QueryClient per frontend app,
- namespace-based i18n with explicit fallback rules,
- broad automated testing from package-unit to environment-level smoke verification.
