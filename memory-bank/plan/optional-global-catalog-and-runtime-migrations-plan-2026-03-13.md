# Plan: Optional Global Catalog And Runtime Migration Architecture

> **Date**: 2026-03-13
> **Mode**: PLAN
> **Status**: QA-REFINED READY FOR REVIEW

---

## Overview

This plan introduces a safer architecture split between:

1. **Canonical local runtime migration history** inside each runtime schema (`_app_migrations`, `_mhb_migrations`).
2. **Optional global migration catalog** in `upl_migrations` used only for cross-schema observability, definition lifecycle, bundle export/import, and audit workflows.
3. **Fast bootstrap / baseline path** for fixed system apps and file-backed application installs that does not require the global definition registry lifecycle to run on first startup.

The main product goal is to keep dynamic runtime schema evolution fully supported while removing the current requirement that every installation must create and synchronize the `upl_migrations` schema. The default mode becomes **global catalog disabled**, with explicit opt-in through configuration.

---

## Alignment With The Original Brief And Existing Master Plan

This plan keeps the original technical brief intact, but it refines one earlier acceptance assumption that is now known to be too strict for the intended architecture.

- The plan **preserves** the original non-negotiable goals:
    - file-backed structural authoring remains the default model
    - fixed system apps must still bootstrap from application-like definitions rather than hardcoded one-off SQL bootstrap logic
    - exact current frontend shells and runtime contracts stay in place
    - fresh database reset is allowed
    - UUID v7 remains mandatory
    - no artificial Metahub structure/template version bump is introduced
- The plan **supersedes only one acceptance detail** from the earlier master-plan wording: fresh bootstrap correctness must no longer require `upl_migrations.definition_*` population in every installation mode.
- The refined acceptance contract becomes two explicit modes:
    - **Default mode, catalog disabled**: fresh bootstrap is correct when fixed schemas, runtime schemas, and local migration history work without creating `upl_migrations`.
    - **Opt-in mode, catalog enabled**: fresh bootstrap must also create and maintain `upl_migrations`, definition lifecycle state, and cross-schema audit records.
- This keeps the architecture aligned with the original brief while removing the cold-start coupling that caused the current performance problem.

---

## Verified Current State

### Repository Findings

- `@universo/core-backend` startup always calls `syncRegisteredPlatformDefinitionsToCatalog(...)` after fixed-schema bootstrap, which keeps `upl_migrations` in the critical startup path.
- `@universo/schema-ddl` already uses local per-schema history (`_app_migrations`) as the canonical runtime migration log for dynamic application schemas.
- `@universo/metahubs-backend` already uses local per-schema history (`_mhb_migrations`) as the canonical runtime migration log for branch schemas.
- `MigrationManager.recordMigration(...)`, `SystemTableMigrator`, and `MetahubSchemaService` all also call `mirrorToGlobalCatalog(...)`, so runtime flows still have a hard dependency on the global catalog.
- Fixed system-app schema generation currently creates `_app_migrations` tables through schema-ddl, but `applySystemAppSchemaGenerationPlan(...)` does not record baseline rows, so those local history tables remain empty.
- `PlatformMigrationCatalog.ensureStorage()` auto-creates `upl_migrations` storage; multiple CLI/doctor/sync helpers assume that storage can be checked or created on demand.

### Live UP-test Findings

- `upl_migrations.migration_runs`: 20 rows.
- `upl_migrations.definition_registry`: 215 rows.
- `upl_migrations.definition_revisions`: 215 rows.
- `upl_migrations.definition_exports`: 215 rows.
- `upl_migrations.definition_drafts`: 215 rows.
- `upl_migrations.approval_events`: 430 rows.
- Fixed `applications._app_migrations`: 0 rows.
- Fixed `metahubs._app_migrations`: 0 rows.

### External Guidance Used

- **Context7 / Knex**: migrations are canonical schema history; seeds are repeatable data loaders and should not replace migration history.
- **Context7 / Prisma**: baseline an existing schema with a full initial migration, then deploy only pending incremental migrations.
- **Supabase guidance**: direct connections are preferred for migrations and management tasks; pooled transaction-mode traffic should not become a hidden correctness dependency for bootstrap or migration state.
- **Earlier web research**: Strapi/Directus-like file definitions and Django fixture patterns support file export/import, but bootstrap should still use a fast baseline/materialized path rather than per-artifact lifecycle replay.

---

## Target Architecture

### A. Canonical Runtime History

- Dynamic application schemas keep `_app_migrations` as their canonical history.
- Dynamic metahub branch schemas keep `_mhb_migrations` as their canonical history.
- Fixed application-like system schemas (`admin`, `profiles`, `metahubs`, `applications`) gain **local baseline history recording** in their own `_app_migrations` tables for schema-ddl-managed business-structure changes.
- Local history must remain fully functional when the global catalog is disabled.

### B. Optional Global Catalog

- `upl_migrations` becomes an **optional** global infrastructure layer.
- Default: disabled.
- When enabled, it provides:
  - cross-schema runtime audit (`migration_runs`)
  - definition lifecycle registry (`definition_*` tables)
  - bundle export/import lifecycle tracking
  - operator-grade doctor and observability commands
- When disabled, the platform must still be able to:
  - start
  - create fixed system schemas
  - create/update metahub branch schemas
  - create/update dynamic application schemas
  - export/import application bundles via local/file artifacts without DB-backed definition lifecycle

### C. File Bundle Release Model

- **Authoring source of truth**: publication/metahub snapshot.
- **Release baseline**: full materialized schema baseline for empty install.
- **Incremental migration**: executable diff from previous released version.
- **Release manifest**: version, compatibility, checksums, metadata.

This allows:

- empty install -> baseline/bootstrap path
- existing install -> incremental migration path
- file-backed system app -> same contract as DB-backed app

---

## Proposed Config Contract

### Shared Feature Flag

Proposed environment variable:

```env
UPL_GLOBAL_MIGRATION_CATALOG_ENABLED=false
```

Required integration points:

- `packages/universo-core-backend/base/.env`
- `packages/universo-core-backend/base/.env.example`
- `packages/universo-core-backend/base/src/commands/base.ts`
- small shared config helper in `@universo/utils`, following the existing env-helper pattern already used for admin feature flags

### Expected Semantics

- `false` or unset: do not create `upl_migrations`; skip all global catalog sync and mirror behavior safely.
- `true`: preserve existing behavior and create/maintain `upl_migrations`.
- When explicitly enabled, registry/audit operations should **fail closed** if the catalog is unhealthy; the platform must not silently degrade into local-only writes while claiming global audit is active.

### Quality Example

```ts
export interface GlobalMigrationCatalogConfig {
    enabled: boolean
}

export const resolveGlobalMigrationCatalogConfig = (
    env: NodeJS.ProcessEnv = process.env,
): GlobalMigrationCatalogConfig => ({
    enabled: parseBooleanEnv(env.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED, false),
})
```

Design rule: parse once, pass through dependency injection, do not scatter raw `process.env.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED` checks across packages.

---

## Affected Areas

### Core Startup

- `packages/universo-core-backend/base/src/index.ts`
- startup logging and telemetry around skipped/active catalog sync

### Shared Migration Contracts

- `packages/universo-migrations-core/base/src/types.ts`
- `packages/universo-migrations-core/base/src/runner.ts`
- `packages/universo-migrations-catalog/base/src/PlatformMigrationCatalog.ts`
- `packages/universo-migrations-catalog/base/src/mirrorToGlobalCatalog.ts`
- `packages/universo-migrations-catalog/base/src/DefinitionRegistryStore.ts`

### Runtime Migration Writers

- `packages/schema-ddl/base/src/MigrationManager.ts`
- `packages/metahubs-backend/base/src/domains/metahubs/services/SystemTableMigrator.ts`
- `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubSchemaService.ts`

### Fixed System-App Bootstrap

- `packages/universo-migrations-platform/base/src/systemAppSchemaCompiler.ts`
- `packages/universo-migrations-platform/base/src/platformMigrations.ts`
- related startup/compiler tests

### CLI / Doctor / Export / Bundle Surfaces

- `packages/universo-migrations-platform/base/src/cli.ts`
- doctor/status/export helpers in `platformMigrations.ts`

### Documentation And i18n

- operator docs / architecture docs
- new flag documentation
- any UI or CLI user-facing text through `@universo/i18n` when applicable

---

## Plan Steps

### Phase 0: Freeze The Contracts

- [ ] Confirm the env variable name and default value.
- [ ] Replace the earlier single fresh-bootstrap acceptance gate with the new **two-mode acceptance contract** (catalog disabled by default, catalog enabled explicitly).
- [ ] Confirm whether fixed system-app `_app_migrations` should become canonical for schema-ddl-created business-table history.
- [ ] Confirm that `upl_migrations.definition_*` is optional and must not participate in cold-start correctness when disabled.
- [ ] Confirm that runtime migration correctness must never depend on the global catalog.
- [ ] Confirm that when the catalog is explicitly enabled, runtime audit/registry writes remain strict and do not silently downgrade.
- [ ] Confirm that file-release/install metadata must extend existing application sync state first, before introducing any new persistent metadata store.

Deliverable:

- Approved configuration and ownership contract before code changes begin.

### Phase 1: Introduce Shared Catalog Config Helper

- [ ] Add a small env helper in `@universo/utils` that mirrors the existing `adminConfig` style: parse once, expose a focused config getter, avoid raw env checks in callers.
- [ ] Extend core-backend command flags to accept the new env toggle.
- [ ] Add `.env.example` documentation with secure default `false`.
- [ ] Add `.env` local-development placeholder/comment entry without exposing secrets in documentation.
- [ ] Keep any richer capability object internal to the migration packages unless a real cross-package contract emerges.

Quality example:

```ts
export interface GlobalMigrationCatalogConfig {
    enabled: boolean
}

export const resolveGlobalMigrationCatalogConfig = (
    env: NodeJS.ProcessEnv = process.env,
): GlobalMigrationCatalogConfig => ({
    enabled: parseBooleanEnv(env.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED, false),
})
```

Reasoning: match the current repository pattern first; introduce richer derived capabilities only where they are genuinely needed internally.

### Phase 2: Make Global Runtime Mirroring Optional

- [ ] Refactor `mirrorToGlobalCatalog(...)` so disabled mode is a safe no-op instead of calling `ensureStorage()`.
- [ ] Widen return contract from `string` to `string | null` where required.
- [ ] Update `MigrationManager.recordMigration(...)` to write local `_app_migrations` regardless of global catalog mode.
- [ ] Update metahub runtime writers to record local `_mhb_migrations` regardless of global catalog mode.
- [ ] Keep `globalRunId` in metadata optional/null-safe.
- [ ] Preserve current strict all-or-nothing semantics when the catalog is explicitly enabled.

Safety example:

```ts
export async function mirrorToGlobalCatalog(input: MirrorToGlobalCatalogInput): Promise<string | null> {
    if (!input.capabilities.runtimeAuditEnabled) {
        return null
    }

    const catalog = new PlatformMigrationCatalog(input.knex)
    await catalog.ensureStorage()
    return recordAppliedMigrationRun(...)
}
```

Rules:

- Disabled mode: short-circuit before any catalog storage creation and let local history remain canonical.
- Enabled mode: keep the current same-transaction truthfulness contract for DDL + local history + schema state + global mirror, so the platform does not create local-only success while claiming global audit is active.
- Do not regress the already-established `afterMigrationRecorded(...)` transaction hook pattern used by schema-ddl runtime sync.

### Phase 3: Remove Mandatory Global Catalog From Startup

- [ ] Update core-backend startup so `syncRegisteredPlatformDefinitionsToCatalog(...)` runs only when the feature flag is enabled.
- [ ] Emit explicit structured logs when skipped.
- [ ] Ensure the rest of startup (prelude, schema generation, post-schema, metadata bootstrap, inspections) remains valid with catalog disabled.
- [ ] Add a startup health distinction between “catalog disabled by config” and “catalog requested but unhealthy”.
- [ ] Keep the existing no-hardcoded-bootstrap rule: fixed system apps must still come from registered definitions and schema-ddl plans, not from a new fallback bootstrap-only source.

Safe startup example:

```ts
if (catalogCapabilities.definitionRegistryEnabled) {
    const definitionSyncResult = await syncRegisteredPlatformDefinitionsToCatalog(getKnex(), {
        source: 'core-backend-initDatabase',
    })
    logger.info('[server]: Registered platform definitions synchronized to catalog', definitionSyncResult)
} else {
    logger.info('[server]: Global migration catalog disabled; skipping registered definition sync', {
        featureFlag: 'UPL_GLOBAL_MIGRATION_CATALOG_ENABLED',
    })
}
```

### Phase 4: Record Fixed System-App Local Baselines

- [ ] Decide on the canonical baseline event name for fixed system-app schemas, for example `baseline_structure_v1`.
- [ ] Extend fixed system-app schema application so it can record a local `_app_migrations` baseline row after first successful schema-ddl materialization.
- [ ] Reuse the existing schema-ddl runtime contract where possible: `recordMigration: true`, `MigrationManager.recordMigration(...)`, and the in-transaction `afterMigrationRecorded(...)` hook.
- [ ] Preserve the existing fingerprint-based repeated-start optimization.
- [ ] Ensure repeated startup does not insert duplicate baseline rows.
- [ ] Define how future fixed-system-app structural updates create incremental local history entries.

Key constraint:

- do not reintroduce monolithic SQL migrations as the business-table source of truth.
- keep schema-ddl plans as the structure source.
- write local baseline/incremental history around that source.

### Phase 5: Split Bootstrap Baseline From Definition Lifecycle Registry

- [ ] Keep `DefinitionBundle` and definition lifecycle for the optional global registry mode.
- [ ] Introduce a fast bootstrap artifact for empty-install system apps and file-backed applications.
- [ ] Define baseline generation from the same source snapshot used for diff generation.
- [ ] Ensure the baseline artifact is a materialized release view of the same file-backed source of truth, not a second authoring model and not a new special-case bootstrap manifest family.
- [ ] Ensure empty installs use baseline/bootstrap instead of per-artifact lifecycle replay.

Recommended release contract:

```json
{
  "kind": "application_release_bundle",
  "bundleVersion": 1,
  "applicationKey": "profiles",
  "releaseVersion": "2026.03.13",
  "manifest": { "engineVersion": "...", "structureVersion": "..." },
  "snapshot": { "entities": {}, "layouts": [], "widgets": [] },
  "bootstrap": { "kind": "baseline_sql", "checksum": "..." },
  "incrementalMigration": { "fromVersion": "2026.03.01", "kind": "ddl_plan", "checksum": "..." }
}
```

### Phase 6: Make CLI / Doctor / Export Explicitly Capability-Aware

- [ ] Review all CLI commands in `@universo/migrations-platform`.
- [ ] Commands that require the definition registry must fail fast with a clear message when disabled.
- [ ] Commands that can operate without the global catalog should continue to work.
- [ ] Doctor output must distinguish:
  - feature disabled by config
  - feature enabled and healthy
  - feature enabled and unhealthy

Design rule: do not silently succeed for registry-only operations when the registry is disabled.

### Phase 7: File Export / Import Path For Applications

- [ ] Formalize export from publication/metahub into a file bundle.
- [ ] Support export from an existing application using the same release bundle contract.
- [ ] On empty target: install from baseline/bootstrap artifact.
- [ ] On existing target: calculate and apply incremental migration from prior installed version.
- [ ] Reuse the existing application sync-state surface in `applications.cat_applications` first for installed release/version and sync metadata; add columns there if required before introducing any new store in per-app schemas.
- [ ] Keep per-app runtime schemas focused on runtime data plus local migration history, not on duplicating central application release state.

Modern-pattern rule:

- full snapshot for truth and recovery
- incremental migration for upgrades
- baseline for fast fresh installs
- repeatable seeds only for deterministic non-structural defaults

### Phase 8: Deep Test System

- [ ] Unit tests for feature-flag parsing and capability resolution.
- [ ] Unit tests for no-op mirror path and nullable `globalRunId` handling.
- [ ] Unit tests for `PlatformMigrationCatalog` disabled-mode behavior.
- [ ] Unit tests for fixed-system-app baseline write-once semantics.
- [ ] Integration tests for startup with catalog disabled.
- [ ] Integration tests for startup with catalog enabled.
- [ ] Integration tests proving runtime application migration still records `_app_migrations` with catalog disabled.
- [ ] Integration tests proving metahub branch migration still records `_mhb_migrations` with catalog disabled.
- [ ] Integration tests proving enabled-mode mirror failure aborts the operation instead of leaving local-only success with claimed global audit.
- [ ] Integration tests proving schema state persistence and migration history stay in the same transaction in both modes.
- [ ] Regression tests for CLI/doctor capability-aware responses.
- [ ] Bundle export/import tests for empty install and upgrade install.
- [ ] Regression tests proving file-bundle install/update reuses the central application sync-state contract instead of creating a duplicate metadata store.
- [ ] Performance regression test comparing empty-install baseline path vs legacy definition lifecycle path.
- [ ] Live smoke validation on UP-test after implementation.

Minimum acceptance matrix:

| Scenario | Expected Result |
| --- | --- |
| Startup, catalog disabled | Platform starts without creating `upl_migrations` |
| Startup, catalog enabled | Existing catalog behavior preserved and definition lifecycle state populated |
| Runtime app schema migration, catalog disabled | `_app_migrations` updated, no global write attempt |
| Runtime app schema migration, catalog enabled but mirror fails | Whole operation fails; no false local-only success with claimed audit |
| Runtime branch migration, catalog disabled | `_mhb_migrations` updated, no global write attempt |
| Fixed system-app first bootstrap | local baseline recorded once, repeated start stays no-op |
| File bundle fresh install | baseline/bootstrap path succeeds |
| File bundle upgrade | incremental migration path succeeds |
| Doctor command, catalog disabled | explicit “disabled by config” result |

### Phase 9: Documentation, Safety, And Rollout

- [ ] Update architecture docs in English and Russian.
- [ ] Document the env flag and operational meaning.
- [ ] Document when to enable the global catalog.
- [ ] Document migration recovery procedure for both modes.
- [ ] Add rollout guidance: start disabled by default, enable only for installations that need global audit/definition lifecycle/export registry.

---

## Potential Challenges

### 1. Hard Type Dependency On `globalRunId`

Current runtime code expects a returned global run id. Converting this to nullable must be done carefully to avoid hidden assumptions in tests, logs, and rollback analysis.

### 2. Duplicate Histories For Fixed System Apps

Fixed system apps may end up with both:

- local `_app_migrations` baseline/incremental rows
- optional platform-level support migrations

The plan must keep those roles separate:

- local history = business-schema structure history
- platform support migrations = auxiliary platform setup

### 3. CLI/Doctor Surface Area

`@universo/migrations-platform` currently has many helpers that assume `PlatformMigrationCatalog.isStorageReady()` can be called safely. Disabled mode must not produce confusing false-negative health output.

### 4. Enabled-Mode Audit Strictness

Once operators explicitly enable the global catalog, silent downgrade is more dangerous than loud failure. The plan must preserve truthful operational semantics instead of letting local history succeed while global audit quietly disappears.

### 5. Baseline vs Seed Confusion

Seeds must stay repeatable and non-canonical. Baseline/install artifacts must be deterministic and versioned like migrations, not like data resets.

### 6. Duplicate Release Metadata Stores

The repository already persists runtime sync state centrally in `applications.cat_applications`. File-bundle work must extend that contract first instead of adding a second source of truth inside every app schema.

### 7. Cold-Start Regression Risk

The global catalog feature flag solves only one part of the startup cost. The implementation must preserve the current repeated-start fast path and must not introduce a new slow fixed-system-app baseline recording path on every boot.

### 8. Master-Plan Drift

If the older acceptance wording is left unchanged, future implementation or QA cycles may treat the absence of `upl_migrations.definition_*` in default mode as a regression even though the new architecture intends it. The refined acceptance split must be recorded explicitly in planning artifacts.

---

## Design Notes

### Why the global catalog should be optional

- It provides real value for observability and registry workflows.
- It is not required for core runtime schema correctness.
- Today it introduces unnecessary startup and runtime coupling.

### Why local per-schema history should remain canonical

- It matches modern migration-tool patterns.
- It works offline from a central registry.
- It is the right place to answer “what happened to this concrete schema?”

### Why snapshots are still needed

- They are the best source of truth for diff generation.
- They support bundle export/import.
- They enable baseline generation and deterministic recovery.

### Why incremental migrations are still needed

- They are the safe, performant upgrade path.
- They avoid replaying full structure creation on every update.
- They match expected operational semantics from mature migration systems.

---

## Dependencies And Coordination

- Shared helpers/types should go to `@universo/utils` and `@universo/types` only when there is a real reused contract; avoid exporting a new shared type layer just to wrap one feature flag.
- Any operator-facing UI/CLI text must be internationalized through `@universo/i18n`.
- The plan must preserve UUID v7 usage everywhere.
- The plan must preserve current `apps-template-mui` / `universo-template-mui` separation; this work is backend/runtime architecture first, not a UI rewrite.
- Existing frontend shells remain the default reuse path; do not invent a new admin settings page, migration guard variant, or bundle-management UI in this wave unless the backend cutover proves a concrete missing operator need.
- Root package/version management remains centralized through `pnpm-workspace.yaml`.

---

## Approval Questions

1. Do we approve `UPL_GLOBAL_MIGRATION_CATALOG_ENABLED=false` as the initial env contract?
2. Do we approve local `_app_migrations` baseline recording for fixed system apps as part of this cycle?
3. Do we keep `upl_migrations.definition_*` strictly optional and outside the cold-start critical path?
4. Do we approve the refined two-mode acceptance contract so this plan explicitly supersedes the earlier “definition registry populated on every fresh bootstrap” wording?
5. Do we agree that file-release metadata should extend existing application sync-state storage first, rather than introducing a new per-app metadata store?
