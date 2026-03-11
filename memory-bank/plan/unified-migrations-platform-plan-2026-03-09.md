# Plan: Unified Universo Platformo Migration System

> Date: 2026-03-09  
> Mode: PLAN  
> Complexity: Level 4 (major cross-platform backend/runtime architecture refactor)  
> Status: DRAFT v3 (QA-reviewed, debt-reduction update)  
> Scope: Replace TypeORM-driven platform migrations with a unified Universo migration system while preserving current Metahubs and Applications behavior on a fresh database.

---

## Overview

Build a single migration platform for Universo that:

- replaces TypeORM migrations for platform schemas,
- unifies platform schema migrations and runtime schema migrations,
- preserves the current `metahubs` and `applications` schemas exactly for a fresh database,
- keeps current Metahubs UI and published Applications behavior working,
- prepares the platform for the future self-hosted model where Metahubs become one of the applications.

The migration system must support both:

- **versioned file migrations** for platform/kernel schemas and explicit high-risk changes,
- **declarative state-based migrations** for runtime schemas derived from metadata, publications, templates, and future database-stored manifests.

This plan assumes:

- the current test database can be deleted,
- no backward compatibility layer for old test data is required,
- schema/template semver remains `0.1.0` for now,
- UUID v7 remains mandatory everywhere.

---

## QA Addendum (2026-03-09)

Additional QA review confirmed that the general architecture direction is correct, but the plan must stay strict about three constraints to avoid avoidable divergence:

1. **No unnecessary new frontend shells or migration-specific UI systems**
   - Reuse the existing shared migration guard stack:
     - `@universo/migration-guard-shared`
     - `MigrationGuardShell`
     - shared status/query options
   - Reuse existing MUI shell/layout patterns from:
     - `packages/universo-template-mui/base`
     - `packages/apps-template-mui`
   - Reuse existing diff/review interaction patterns already present in:
     - `ApplicationMigrationGuard`
     - `MetahubMigrationGuard`
     - `ConnectorDiffDialog`
   - Only introduce a new component when the existing shared packages cannot represent the required behavior without breaking existing flows.

2. **Future desired-state editing must reuse the current permission architecture**
   - Do not invent a separate migration-editor ACL model.
   - Future editor permissions must layer on top of existing:
     - global admin RBAC in `@universo/admin-backend`,
     - auth permission service in `@universo/auth-backend`,
     - current metahub/application role models (`owner`, `admin`, `editor`, etc.).
   - The migration system may add new permission subjects/actions, but should not introduce a parallel authorization subsystem.

3. **Requirement traceability must remain explicit**
   - The implementation phase must preserve a one-to-one mapping between the original technical brief and the execution backlog.
   - This is especially important for:
     - exact `metahubs` schema parity,
     - fresh-database bootstrap behavior,
     - future DB/file dual-source workflow,
     - temporary coexistence of current Metahubs UI with future app-based convergence.

4. **New support storage must not be introduced through TypeORM**
   - If new database tables are required for migration catalog, desired-state definitions, revisions, exports, approvals, or audit metadata, they must be created by the new Universo migration system itself.
   - This avoids a half-migrated architecture where TypeORM remains required just to support the replacement of TypeORM.

5. **Operational observability must be part of the architecture, not a later enhancement**
   - Long-running migration flows need structured logs, machine-readable diagnostics, and stable run identifiers from day one.
   - Admin/operator inspection can remain minimal in UI for now, but backend contracts for diagnostics should not be deferred.

6. **Migration governance must be built in**
   - The new system should not rely only on “apply-time” safety.
   - It also needs validation/lint stages for versioned migration files and generated plans before they are merged or executed.
   - Destructive or backward-incompatible changes should default to a blocked/abort path until they are explicitly reviewed.

7. **Schema targeting must be explicit and sanitized**
   - The unified migration system must not rely on ambient `search_path` behavior for dynamic schemas.
   - Schema names, table names, and raw-SQL identifier usage must be validated and quoted consistently.
   - Support for fixed names like `metahubs` and generated names like `mhb_*` / `app_*` must share one canonical validation and naming policy.

---

## Requirement Coverage Matrix

The original technical brief is covered as follows:

- **Requirement 1: analyze and unify metahub/application migration architecture**
  - Covered by: Overview, Recommended Architecture Decisions, Phases 0-8, 11-12.
- **Requirement 2: support reliable migration of real data, not only reset test DB**
  - Covered by: migration catalog, checksums, drift detection, lock policy, transaction policy, failure recovery tests.
- **Requirement 3: replace TypeORM static migrations with file-based Universo migrations**
  - Covered by: hybrid model decision, Phase 7, startup runner replacement in Phase 8.
- **Requirement 4: prepare DB/file-backed structure/template workflow and future editor**
  - Covered by: Phases 9-10, QA addendum permission constraint, drift rules, import/export contracts.
- **Requirement 5: maximize unification because Metahubs are a temporary special case**
  - Covered by: package map, single migration catalog, shared contracts, future-application model for Metahubs.
- **Requirement 6: support custom schema names such as `metahubs` and future metahub-as-app bootstrap**
  - Covered by: platform migration kits, file-based platform migrations, bootstrap runner, acceptance criteria.
- **Requirement 7: redefine metahub structure/template as application schema/template concepts**
  - Covered by: architecture decision “Treat Metahubs as a future application, but not yet at the UI level”.
- **Requirement 8: preserve current `metahubs` schema exactly**
  - Covered by: explicit parity requirements, SQL parity tests, RLS/policy/index/enum parity constraints.
- **Requirement 9: preserve current end-to-end behavior on a fresh database**
  - Covered by: Phase 0 acceptance criteria, Phase 16 end-to-end scenarios, startup bootstrap replacement, metahub/application runtime preservation.

What was under-specified in v1 and is now explicit in v2:

- reuse of existing migration guard and diff-review UI,
- reuse of existing permission architecture for the future editor,
- requirement traceability back to every numbered point in the technical brief.

What is additionally explicit in v3:

- no new support tables via TypeORM,
- migration observability and diagnostics as first-class requirements,
- stronger modeling of desired-state registry/revisions/exports,
- stricter acceptance for connector-driven application creation and data transfer.

What is additionally explicit after the second QA pass:

- migration lint/validate governance is now part of the target architecture,
- high-risk schema evolution should prefer forward-only or expand-contract patterns over relying on `down()` rollback,
- the temporary development bootstrap switch must not survive as a permanent dual-path architecture.

What is additionally explicit after the third QA pass:

- schema-qualified SQL and identifier validation are now first-class migration safety requirements,
- support for custom schema names and generated schema names must be governed by one canonical naming policy,
- the future tooling surface should stay centralized rather than spreading migration operations across ad hoc scripts.

---

## Inputs Validated During Analysis

### Memory Bank and local rules

- Reviewed `memory-bank/projectbrief.md`, `activeContext.md`, `tasks.md`, `productContext.md`, `systemPatterns.md`, `techContext.md`.
- Reviewed custom mode instructions in `.gemini/rules/custom_modes/plan_mode.md`.
- Confirmed that `memory-bank/plan/` already stores planning documents and that creating a new plan file is explicitly requested.

### Current codebase findings

1. **Three migration histories exist today**
   - Platform/static migrations: `public.migrations` via TypeORM.
   - Metahub runtime migrations: `<mhb_schema>._mhb_migrations`.
   - Application runtime migrations: `<app_schema>._app_migrations`.

2. **TypeORM still boots platform schema creation at server startup**
   - `packages/universo-core-backend/base/src/index.ts` calls `runMigrations({ transaction: 'each' })`.

3. **Metahubs runtime schema lifecycle is already a custom migration system**
   - `MetahubSchemaService.ensureSchema()` supports `read_only`, `initialize`, and `apply_migrations`.
   - It handles initialization, structure upgrades, template seed sync, branch version state, and advisory locking.

4. **Applications runtime schema lifecycle is also already custom**
   - `applicationSyncRoutes.ts` generates a publication snapshot, calculates diff, applies DDL, syncs metadata/layouts/widgets/enumerations, and records `_app_migrations`.

5. **Platform schemas remain TypeORM-defined but are already highly specific**
   - `CreateMetahubsSchema1766351182000` and `CreateApplicationsSchema1800000000000` create enums, partial indexes, GIN indexes, RLS, and policies.
   - This means the replacement system must support exact SQL-level reproduction, not only table builders.

6. **RLS request context currently depends on TypeORM QueryRunner**
   - `createEnsureAuthWithRls()` creates a request-scoped TypeORM QueryRunner and sets PostgreSQL session context.
   - Any broader TypeORM removal must preserve the RLS contract for request-scoped data access.

7. **Current runtime migration metadata is valuable but inconsistent**
   - `_mhb_migrations` stores `from_version`, `to_version`, `meta`.
   - `_app_migrations` stores `meta.snapshotBefore`, `meta.snapshotAfter`, publication snapshot hash, seed warnings, and audit fields.
   - The two catalogs are conceptually similar but structurally different.

8. **Templates and publication versions already behave like versioned manifests**
   - `templates_versions.manifest_json` + `manifest_hash`.
   - `publications_versions.snapshot_json` + `snapshot_hash`.
   - This is a strong basis for future DB-stored migration inputs.

9. **Current migration guard UI already assumes a plan/apply workflow**
   - Shared status query options and severity logic already exist.
   - Metahubs already expose `status`, `plan`, `apply`.
   - Applications expose `status`, diff, sync, pending destructive confirmation.

10. **Testing coverage exists but is still uneven**
    - `@universo/schema-ddl` has focused unit tests.
    - Metahub migration routes and schema service have some tests.
    - There is not yet a deep end-to-end migration test matrix across:
      - platform schema bootstrap,
      - metahub branch lifecycle,
      - publication version creation,
      - application sync lifecycle,
      - RLS behavior after schema creation,
      - concurrency and failure recovery.

### Supabase UP-test findings

Project checked: `UP-test` (`osnvhnawsmyfduygsajj`)

- Static schemas present: `admin`, `metahubs`, `applications`.
- Dynamic schemas present: `mhb_019ccefc2f7b7b3682f485cdb1312268_b1`, `app_019ccfadde2d7108b32e1de9e32359a4`.
- `public.migrations` contains TypeORM-applied entries for infrastructure, admin, profile, metahubs, and applications.
- The metahub branch schema already contains `_mhb_objects`, `_mhb_attributes`, `_mhb_constants`, `_mhb_values`, `_mhb_elements`, `_mhb_settings`, `_mhb_layouts`, `_mhb_widgets`, `_mhb_migrations`.
- The application schema already contains `_app_objects`, `_app_attributes`, `_app_values`, `_app_settings`, `_app_layouts`, `_app_widgets`, `_app_migrations`, plus runtime entity tables.
- `_mhb_migrations` currently records a `baseline_structure_v1`.
- `_app_migrations` currently records the publication-backed `initial_schema`.

### Context7 and external documentation checked

- Knex migrations: custom migration source, transaction options, migration lock patterns.
- TypeORM migrations: migration file model, migration table naming, transaction modes.
- TanStack Query v5: optimistic mutation rollback and cache invalidation patterns.
- PostgreSQL current docs: advisory lock semantics, transaction-vs-session lock behavior, row-level security behavior.
- Additional official references reviewed for migration system design direction:
  - PostgreSQL docs,
  - Knex docs,
  - TypeORM docs,
  - Atlas docs,
  - Flyway docs,
  - Liquibase docs.

---

## Additional Audit Findings and Hidden Risks

### A. The migration problem is larger than replacing TypeORM files

The platform currently mixes four concerns:

- platform schema creation,
- runtime schema evolution,
- publication/template versioning,
- request-scoped RLS-backed data access.

Replacing TypeORM migrations alone will not solve the architectural split unless the new migration system also becomes:

- the source of truth for platform schema evolution,
- the orchestration layer for runtime state-based schema sync,
- the contract for future DB/file desired-state editing,
- the integration seam for safe RLS-compatible data access.

### B. RLS is a hidden dependency of the current persistence model

The current auth pipeline is deeply coupled to TypeORM `QueryRunner`. If the platform removes TypeORM too aggressively before introducing a replacement request-scoped DB context abstraction, route behavior can regress even if schema migrations are correct.

### C. Session-level advisory locks are currently necessary but expensive

The shared DDL lock helper uses session-level advisory locks and pins pooled Knex connections until explicit unlock. This is correct for long-running schema workflows, but expensive under load and fragile when mixed with pool pressure or nested lock use.

### D. Runtime migration catalogs are not yet checksum catalogs

Current runtime migration history stores snapshots and hashes related to publication/template payloads, but does not yet provide a general-purpose checksum + drift contract for:

- versioned file migrations,
- DB-stored manifests,
- exported files,
- replay safety,
- tamper detection.

### E. Platform schemas include policy logic, not only structure

The new system must explicitly represent:

- enums,
- indexes,
- unique partial indexes,
- GIN indexes,
- foreign keys,
- RLS enable/disable,
- policy creation/drop order,
- dependency ordering across schemas.

If the new system only models tables and columns, it will be incomplete.

### F. There is a likely future duplication trap

Without a canonical package structure, the team could accidentally end up with:

- `schema-ddl`,
- another migration core package,
- duplicated runtime migration DTOs in `metahubs-backend`,
- duplicated UI status contracts in frontends,
- duplicated DB/file manifest schemas.

The plan must prevent this from the start.

### G. Current tests are not strong enough for a migration-core refactor

The current test surface is good for local features, but not yet sufficient for a platform-level migration engine replacement. The new system needs a dedicated multilayer test program, not only a few route tests.

---

## Recommended Architecture Decisions

### 1. Build a unified migration platform under `universo-*`

Recommended new package set:

- `@universo/migrations-core`
- `@universo/migrations-knex`
- `@universo/migrations-catalog`
- `@universo/migrations-declarative`
- `@universo/migrations-platform`

Optional later split if needed:

- `@universo/db-context` for request-scoped database access abstraction,
- `@universo/migrations-testing` for shared test harnesses.

### 2. Keep a hybrid migration model

Use two migration modes under one runtime:

- **Versioned file migrations**
  - for `public`, `admin`, `profile`, `metahubs`, `applications`,
  - for enums, policies, SQL functions, RLS, and other explicit kernel behavior.

- **Declarative migrations**
  - for `mhb_*` and `app_*`,
  - for metadata-driven schema generation and state-based upgrades,
  - for future DB-edited manifests and snapshots.

### 3. Introduce a single migration catalog contract

Use one normalized migration catalog model for every migration execution, regardless of source:

- file migration,
- generated declarative plan,
- template sync,
- publication sync,
- system metadata sync,
- future DB-stored desired-state apply.

Recommended catalog responsibilities:

- unique migration id,
- scope,
- source kind,
- checksum,
- applied timestamps,
- transaction mode,
- lock mode,
- snapshot before/after links,
- drift markers,
- metadata,
- actor/audit fields,
- status,
- failure diagnostics.

### 4. Separate desired state from migration execution

Introduce a strong conceptual split:

- **Desired state**
  - file manifest,
  - DB manifest,
  - publication snapshot,
  - template manifest,
  - platform schema definition.

- **Migration plan**
  - computed diff,
  - ordered operations,
  - blockers,
  - destructive actions,
  - checksums,
  - transaction policy,
  - lock policy.

- **Migration execution**
  - lock acquisition,
  - dry-run,
  - apply,
  - audit recording,
  - error handling,
  - recovery hooks.

### 5. Introduce formal transaction and lock policies

The new system should not expose only one lock style or one transaction style.

Required policy types:

- `transactionMode`
  - `single`
  - `per_migration`
  - `none`

- `lockMode`
  - `session_advisory`
  - `transaction_advisory`
  - `none`

- `destructivePolicy`
  - `block`
  - `plan_only`
  - `confirm_required`
  - `allow`

### 6. Preserve exact schema output for `metahubs` and `applications`

For this task, the new migration system must create the same:

- schemas,
- tables,
- columns,
- defaults,
- indexes,
- enum types,
- foreign keys,
- RLS flags,
- policy SQL,
- names,
- constraints.

No frontend-facing schema changes are allowed for the current Metahubs and Applications UI.

### 7. Treat Metahubs as a future application, but not yet at the UI level

Architecturally:

- “Metahub structure” becomes the schema definition for the Metahubs application.
- “Metahub template” becomes a standard application template/input artifact.

Operationally for this task:

- keep current `packages/metahubs-frontend` and `packages/universo-template-mui` behavior,
- do not force immediate runtime UI convergence with `packages/apps-template-mui`,
- but design backend and migration contracts so that future convergence is straightforward.

---

## Proposed Package and Responsibility Map

### `@universo/migrations-core`

Responsibilities:

- migration runner,
- migration source interface,
- operation pipeline,
- checksum service,
- drift detector,
- transaction policy execution,
- lock policy orchestration,
- failure classification,
- migration event hooks.

### `@universo/migrations-catalog`

Responsibilities:

- migration catalog schema definitions,
- repository/DAO for platform-wide migration history,
- typed read models for UI/API,
- status summaries for guards and admin pages.

### `@universo/migrations-knex`

Responsibilities:

- Knex-backed operation executor,
- safe SQL builders for tables/indexes/fks/enums/policies,
- raw SQL step support,
- PostgreSQL-specific helpers.

### `@universo/migrations-declarative`

Responsibilities:

- wrap and evolve current `@universo/schema-ddl`,
- desired-state snapshots,
- diff generation,
- declarative plan output,
- runtime schema sync orchestration.

### `@universo/migrations-platform`

Responsibilities:

- platform migration kits,
- file migration registry for `public`, `admin`, `profile`, `metahubs`, `applications`,
- dependency ordering,
- exact SQL parity with current TypeORM migrations.

### `@universo/db-context` (recommended follow-up package)

Responsibilities:

- request-scoped DB session abstraction,
- RLS session setup/cleanup,
- repository/query execution adapters,
- gradual decoupling from TypeORM QueryRunner.

This package is recommended even if implementation starts inside `auth-backend` or `core-backend`.

---

## Migration Catalog Design (Recommended)

### Platform catalog schema

Recommended new schema:

- `upl_migrations`

Recommended table:

- `upl_migrations.migration_runs`
- `upl_migrations.definition_registry`
- `upl_migrations.definition_revisions`
- `upl_migrations.definition_exports`
- `upl_migrations.approval_events` (optional if approval is modeled separately from runs)

Recommended columns:

- `id uuid`
- `scope_kind text`
- `scope_key text`
- `source_kind text`
- `migration_name text`
- `migration_version text`
- `checksum text`
- `transaction_mode text`
- `lock_mode text`
- `status text`
- `summary text`
- `meta jsonb`
- `snapshot_before jsonb`
- `snapshot_after jsonb`
- `plan jsonb`
- `error jsonb`
- `_upl_created_at timestamptz`
- `_upl_created_by uuid`
- `_upl_updated_at timestamptz`
- `_upl_updated_by uuid`

Recommended supporting storage purpose:

- `definition_registry`
  - canonical record for a logical desired-state source such as the Metahubs application definition, a platform template definition, or a future DB-managed app definition.
- `definition_revisions`
  - immutable revisions with normalized payload, checksum, source kind, and provenance metadata.
- `definition_exports`
  - file export/import tracking, file checksum, export target, and drift relationship to the active DB revision.
- `approval_events`
  - review/approval audit trail for destructive or high-risk applies when needed.

Recommended scope kinds:

- `platform_schema`
- `runtime_schema`
- `template`
- `publication`
- `application_sync`
- `metahub_sync`

Recommended source kinds:

- `file`
- `declarative`
- `system_sync`
- `template_seed`
- `publication_snapshot`

### Runtime-local history

Keep local history tables for operational locality, but make them secondary:

- keep `_mhb_migrations`,
- keep `_app_migrations`,
- add links or shared identifiers that point to the global catalog entry.

This preserves current runtime observability while introducing a platform-wide source of truth.

---

## Phase Plan

## Phase 0: Contract freeze and architecture guardrails

- [ ] Define the canonical architecture decision record for hybrid migrations.
- [ ] Freeze exact compatibility target for current `metahubs` and `applications` schemas.
- [ ] Freeze non-goals for this task:
  - no migration of old test data,
  - no immediate UI rewrite to `apps-template-mui`,
  - no schema/template semver bump,
  - no partial “temporary” migration DSL that will be thrown away.
- [ ] Freeze UI reuse guardrails:
  - no new migration guard shell,
  - no parallel migration review dialog system,
  - no standalone migration page chrome if existing host shells already cover the flow.
- [ ] Freeze migration safety governance defaults:
  - destructive changes default to blocked/abort,
  - lint/validate must run before apply for versioned migrations,
  - high-risk breaking changes use forward-only or expand-contract workflows by default.
- [ ] Define acceptance criteria for:
  - fresh DB bootstrap,
  - metahub creation,
  - branch schema creation,
  - publication version creation,
  - application creation,
  - application runtime schema sync,
  - migration guard flows.

## Phase 1: Additional design extraction from current code

- [ ] Inventory all TypeORM platform migrations and dependencies.
- [ ] Inventory all platform entities still required after migration runner replacement.
- [ ] Inventory all RLS and policy dependencies that today rely on TypeORM startup order.
- [ ] Inventory all reusable frontend contracts and components that migration UX must continue to use:
  - `MigrationGuardShell`,
  - `MIGRATION_STATUS_QUERY_OPTIONS`,
  - existing MUI host layouts,
  - existing diff/review dialogs and status chips.
- [ ] Inventory all runtime sync steps that already exist outside DDL:
  - layouts,
  - widgets,
  - enumeration values,
  - predefined elements,
  - seed warnings,
  - maintenance status.
- [ ] Document every current migration entry point:
  - server startup,
  - metahub ensureSchema,
  - metahub plan/apply routes,
  - publication version create/activate,
  - application diff/sync/status.

## Phase 2: Define the core migration interfaces

- [ ] Create a typed `MigrationSource` contract.
- [ ] Create a typed `MigrationPlan` contract.
- [ ] Create a typed `MigrationOperation` contract.
- [ ] Create a typed `MigrationExecutionResult` contract.
- [ ] Create a typed `MigrationChecksum` contract.
- [ ] Create a typed `MigrationScope` contract.
- [ ] Create a typed `MigrationLockPolicy` contract.
- [ ] Create a typed `MigrationTransactionPolicy` contract.
- [ ] Create deterministic naming and ordering rules for:
  - migration ids,
  - scope keys,
  - file migration versions,
  - dependency sequencing between platform schemas.
- [ ] Define canonical identifier policy for:
  - schema names,
  - table names,
  - quoted identifiers in raw SQL,
  - UUIDv7-based generated schema naming for `mhb_*` and `app_*`,
  - fixed schema names such as `metahubs`, `applications`, `admin`, `profile`.
- [ ] Place shared types in `@universo/types` where they are cross-package API surface.
- [ ] Place helper types and non-API internals inside the new migration packages.

## Phase 3: Build the migration catalog layer

- [ ] Create the new platform migration catalog schema and tables.
- [ ] Add write/read services for migration runs.
- [ ] Add desired-state registry services for:
  - logical definition identity,
  - immutable revisions,
  - DB/file provenance,
  - export/import audit.
- [ ] Support checksums for:
  - file migrations,
  - generated declarative plans,
  - DB-stored manifests,
  - exported manifest files.
- [ ] Add drift detection contract:
  - changed file after apply,
  - DB manifest changed outside export flow,
  - runtime schema snapshot mismatch,
  - publication/template hash mismatch.
- [ ] Add statuses:
  - `planned`,
  - `applied`,
  - `skipped`,
  - `blocked`,
  - `drifted`,
  - `failed`,
  - `rolled_forward`.
- [ ] Make all new support tables part of the new migration bootstrap, not TypeORM entity migrations.

## Phase 4: Extract and stabilize lock management

- [ ] Move advisory lock helpers into the new migration core.
- [ ] Support both session-level and transaction-level advisory locks as first-class strategies.
- [ ] Add typed lock scopes:
  - platform schema,
  - runtime schema,
  - migration apply,
  - publication sync,
  - template seed sync.
- [ ] Add explicit lock timeout and diagnostics contract.
- [ ] Add pool-safety and nested-lock tests.
- [ ] Prevent silent lock leaks by design.

## Phase 5: Extract and stabilize transaction policy handling

- [ ] Support `single`, `per_migration`, and `none` transaction policies.
- [ ] Allow operation-level overrides for commands that cannot run in a transaction.
- [ ] Preserve the current behavior where safe default is transactional.
- [ ] Add test coverage for rollback/failure semantics across transaction modes.
- [ ] Add preflight validation contract that runs before apply:
  - lock availability,
  - checksum/drift state,
  - dependency readiness,
  - required approvals,
  - target schema existence rules.
- [ ] Define rollback strategy policy:
  - `down()` only where semantics are truly safe and reviewable,
  - destructive data-bearing changes prefer forward-only remediation,
  - platform and runtime workflows support compensating migrations instead of promising universal rollback.
- [ ] Define expand-contract guidance for high-risk schema evolution involving live data:
  - additive introduce phase,
  - compatibility window,
  - cleanup/drop phase after validation.

## Phase 6: Migrate `@universo/schema-ddl` into the unified declarative layer

- [ ] Keep `@universo/schema-ddl` as the implementation core for runtime declarative migration logic.
- [ ] Either:
  - keep it as a lower-level package consumed by `@universo/migrations-declarative`,
  - or fold it into `@universo/migrations-declarative` with stable export shims.
- [ ] Normalize `_app_migrations` metadata contract to align with the new catalog model.
- [ ] Introduce a parallel normalization layer for `_mhb_migrations`.
- [ ] Preserve current runtime behavior while refactoring APIs behind the scenes.

## Phase 7: Rebuild platform/static migrations outside TypeORM

- [ ] Implement versioned file migration support in the new migration system.
- [ ] Implement migration validate/lint stage for file migrations and generated plans:
  - destructive change detection,
  - backward-incompatible change detection,
  - naming/order validation,
  - dependency validation,
  - optional table-lock/data-dependent checks where feasible.
- [ ] Enforce schema-qualified SQL and sanitized identifier helpers for all platform migrations.
- [ ] Port infrastructure migration:
  - UUID v7 function initialization.
- [ ] Port admin migrations.
- [ ] Port profile migrations.
- [ ] Port metahubs platform schema migration.
- [ ] Port applications platform schema migration.
- [ ] Preserve exact SQL output for:
  - enum creation,
  - index creation,
  - partial indexes,
  - GIN indexes,
  - RLS enablement,
  - policy creation order,
  - FK ordering,
  - idempotency behavior where needed.
- [ ] Replace server startup `TypeORM.runMigrations()` with the new migration runner.

## Phase 8: Introduce a platform migration bootstrap runner

- [ ] Add a new startup bootstrap step in `core-backend`.
- [ ] Sequence:
  - initialize DB connection,
  - run platform migrations,
  - seed platform-level data such as templates if required,
  - continue server startup.
- [ ] Keep startup diagnostics and migration logging.
- [ ] Add guardrails so startup fails loudly on drift or partial platform bootstrap.
- [ ] Add structured bootstrap diagnostics with stable run ids and machine-readable error payloads.
- [ ] Ensure startup never silently falls back to an old migration path once the new runner is enabled.
- [ ] Expose one official operational entrypoint set for migration actions:
  - bootstrap,
  - validate/lint,
  - plan,
  - apply,
  - inspect/status,
  - export/import where applicable.

## Phase 9: Normalize template and publication version artifacts

- [ ] Define a canonical manifest envelope contract.
- [ ] Define a canonical snapshot envelope contract.
- [ ] Add explicit schema versioning inside the payload contract even if functional semver remains `0.1.0`.
- [ ] Normalize hashing rules:
  - deterministic stringify,
  - stable field ordering,
  - invariant handling for audit timestamps and nonsemantic metadata.
- [ ] Add import/export contracts for future file synchronization.
- [ ] Define a canonical “application definition” artifact model so that:
  - “metahub structure” maps to an application schema definition,
  - “metahub template” maps to a standard application template/input artifact,
  - the future Metahubs application can bootstrap from either file or DB revision without inventing a second format.

## Phase 10: Prepare DB/file dual-source-of-truth workflow

- [ ] Define canonical desired-state storage rules:
  - file-managed,
  - DB-managed,
  - exported,
  - imported,
  - generated.
- [ ] Add a drift status model for:
  - “DB newer than file”,
  - “file newer than DB”,
  - “same logical content, different formatting”,
  - “checksum mismatch”.
- [ ] Define future editor workflow:
  - edit desired state in UI,
  - validate,
  - generate plan,
  - review blockers,
  - apply,
  - export file update.
- [ ] Define authorization rules for the future editor and migration approval flow using existing permission systems:
  - global RBAC subjects/actions in `admin`,
  - auth permission service integration,
  - metahub/application local role checks,
  - no separate bespoke ACL subsystem.
- [ ] Define canonical revision lifecycle for future editable definitions:
  - draft,
  - validated,
  - approved,
  - exported,
  - active.
- [ ] Define how the future Metahubs application definition is identified in storage:
  - stable logical key,
  - current active revision,
  - file-origin bootstrap metadata,
  - export target metadata.
- [ ] Keep the current implementation scope minimal:
  - introduce only the storage and contracts needed for future editor readiness,
  - do not build a full generic definition-management UI in this task.

## Phase 11: Preserve and refactor Metahub runtime migration workflow

- [ ] Rebase metahub plan/apply routes on the new migration planning/execution core.
- [ ] Keep existing route semantics for frontend compatibility.
- [ ] Preserve branch-level schema creation and template sync behavior.
- [ ] Unify structure/template migration plan DTOs with the shared migration catalog.
- [ ] Preserve `_mhb_migrations` for local history, but record global migration run ids.

## Phase 12: Preserve and refactor Application runtime migration workflow

- [ ] Rebase application diff/sync/status flows on the new migration planning/execution core.
- [ ] Preserve:
  - maintenance mode behavior,
  - publication snapshot hash comparisons,
  - UI/meta-only sync path,
  - predefined elements seeding,
  - published layouts/widgets sync.
- [ ] Normalize application migration history onto the shared catalog.
- [ ] Preserve `_app_migrations` for local runtime observability.
- [ ] Preserve connector-driven application creation semantics end-to-end:
  - create application,
  - create `app_UUIDv7` schema,
  - derive structure from active publication snapshot,
  - transfer published data safely and deterministically.

## Phase 13: Introduce a DB session abstraction for post-TypeORM evolution

- [ ] Define a request-scoped DB context abstraction independent from TypeORM internals.
- [ ] Preserve current `request.jwt.claims` RLS setup contract.
- [ ] Add an adapter that can still use TypeORM while the migration away is incremental.
- [ ] Ensure the new migration system itself does not depend on TypeORM QueryRunner semantics.
- [ ] Make this a hard prerequisite before any broad entity/repository replacement program.

## Phase 14: Shared package integration cleanup

- [ ] Add shared migration DTOs/status enums to `@universo/types`.
- [ ] Add shared utility helpers to `@universo/utils`:
  - checksum helpers,
  - stable stringify wrappers,
  - migration status formatting helpers,
  - drift classification helpers.
- [ ] Keep cross-app i18n keys in `@universo/i18n`.
- [ ] Keep frontend migration guard shells in shared UI packages.
- [ ] Keep migration review UI aligned with existing shared components rather than introducing parallel widgets.
- [ ] Respect centralized dependency versions in `pnpm-workspace.yaml`.

## Phase 15: Frontend contract consolidation

- [ ] Unify migration status response rendering between Metahubs and Applications.
- [ ] Keep all new text i18n-ready from the start.
- [ ] Reuse existing route shells and page composition:
  - Metahubs flows stay under `packages/universo-template-mui/base`,
  - application runtime/admin flows stay compatible with `packages/apps-template-mui`,
  - no duplicate migration-specific host layout layer.
- [ ] Add shared i18n keys for:
  - checksum drift,
  - migration catalog states,
  - lock timeout diagnostics,
  - destructive migration review,
  - export/import desired-state drift.
- [ ] Ensure current `universo-template-mui` and `apps-template-mui` can both consume the new status contracts.
- [ ] Ensure any future editor UI can be introduced incrementally on top of existing dialogs/forms/query hooks.
- [ ] Keep backend-driven diagnostics structured enough so current UI can surface them without bespoke view-model adapters per screen.
- [ ] Reuse existing diff-dialog patterns explicitly:
  - `PublicationDiffDialog` for metahub-side review patterns,
  - `ConnectorDiffDialog` for application-side review patterns,
  - no third migration-diff component family unless a concrete gap is proven.

## Phase 16: Testing program (mandatory, full depth)

- [ ] Build a dedicated migration test strategy covering all layers.

### 16.1 Unit tests

- [ ] Migration plan builder
- [ ] checksum generation
- [ ] drift detection
- [ ] operation ordering
- [ ] transaction policy resolution
- [ ] lock strategy selection
- [ ] manifest validation
- [ ] snapshot normalization
- [ ] export/import diff classification
- [ ] identifier validation and quoting helpers

### 16.2 Integration tests

- [ ] fresh platform bootstrap
- [ ] exact creation of `metahubs` schema
- [ ] exact creation of `applications` schema
- [ ] RLS enablement and policy creation order
- [ ] runtime metahub schema bootstrap
- [ ] metahub structure migration apply
- [ ] application initial schema generation
- [ ] application diff migration apply
- [ ] template seed sync and cleanup
- [ ] publication snapshot activation flow
- [ ] logical definition revision activation and export drift tracking
- [ ] migration validate/lint failure on destructive or invalid versioned migration samples
- [ ] schema-qualified SQL behavior for dynamic and fixed schema targets

### 16.3 Concurrency tests

- [ ] concurrent platform migration attempts
- [ ] concurrent metahub schema apply
- [ ] concurrent application sync
- [ ] nested lock interactions
- [ ] lock release on thrown errors
- [ ] pool-pressure scenarios

### 16.4 Failure recovery tests

- [ ] partial failure inside transaction
- [ ] failure after plan generation before apply
- [ ] failure during metadata-only sync
- [ ] failure during template cleanup
- [ ] checksum drift on startup
- [ ] corrupted manifest payload
- [ ] blocked destructive migration without approval

### 16.5 Route/API tests

- [ ] migration status endpoints
- [ ] migration plan endpoints
- [ ] migration apply endpoints
- [ ] platform admin migration inspection endpoints if introduced
- [ ] publication/application update propagation flows
- [ ] structured diagnostics payloads for failed/preflight-blocked migration runs

### 16.6 Frontend tests

- [ ] migration guard behavior for Metahubs
- [ ] migration guard behavior for Applications
- [ ] maintenance mode rendering
- [ ] destructive confirmation flow
- [ ] drift warning rendering
- [ ] i18n rendering for migration states and blockers
- [ ] TanStack Query cache behavior for status/apply flows

### 16.7 Snapshot and SQL parity tests

- [ ] schema parity test comparing old TypeORM migration output vs new platform migration output on a clean database
- [ ] index/policy/enum parity assertions
- [ ] generated SQL snapshot tests for critical platform migrations

### 16.8 End-to-end scenario tests

- [ ] start server on fresh database
- [ ] open `/metahubs`
- [ ] create metahub
- [ ] verify branch schema creation
- [ ] create “shopping list” style metahub content
- [ ] create publication/version
- [ ] create application from publication through connector flow
- [ ] verify `app_UUIDv7` schema creation and data transfer
- [ ] open application runtime and verify it works
- [ ] verify the current Metahubs UI still works without migration-specific UI regressions

## Phase 17: Observability and operator support

- [ ] Emit structured logs for:
  - plan generation,
  - apply start/finish,
  - drift detection,
  - lock acquisition/release,
  - bootstrap failures.
- [ ] Add stable run ids and correlation ids to migration responses and logs.
- [ ] Define machine-readable error codes for:
  - checksum drift,
  - lock timeout,
  - missing dependency,
  - destructive confirmation required,
  - invalid desired-state revision.
- [ ] Ensure current and future admin/operator UIs can inspect migration state without backend contract rewrites.
- [ ] Emit diagnostics for lint/validate failures separately from apply-time failures.

## Phase 18: Rollout strategy

- [ ] Introduce the new migration runner behind a feature flag or controlled bootstrap switch during development.
- [ ] Validate parity on a clean local database.
- [ ] Validate parity on a clean `UP-test` clone/branch or recreated project state.
- [ ] Remove TypeORM migration startup path only after parity is proven.
- [ ] Keep TypeORM entities temporarily if needed for route-level persistence, but remove TypeORM migration registration and startup execution once replaced.
- [ ] Remove the temporary development bootstrap switch before considering the refactor complete.

## Phase 19: Post-refactor cleanup

- [ ] Remove obsolete TypeORM migration scripts and registry wiring.
- [ ] Remove `typeorm:migration-run` operational dependency from `core-backend` once no longer needed.
- [ ] Remove any temporary compatibility shims that would otherwise keep parallel migration concepts alive.
- [ ] Update architecture docs and package READMEs.
- [ ] Add a migration architecture document explaining:
  - file migrations,
  - declarative migrations,
  - validate/lint governance,
  - checksums,
  - drift,
  - lock policies,
  - transaction policies,
  - DB/file desired-state flows.

---

## Safe Code Examples

The examples below are illustrative contracts for the target architecture. They are intentionally conservative and focus on safety, determinism, and reviewability.

### Example 1: Versioned file migration contract

```ts
export type MigrationTransactionMode = 'single' | 'per_migration' | 'none'
export type MigrationLockMode = 'session_advisory' | 'transaction_advisory' | 'none'

export interface PlatformMigrationFile {
  id: string
  version: string
  scope: {
    kind: 'platform_schema'
    key: 'public' | 'admin' | 'profile' | 'metahubs' | 'applications'
  }
  checksumSource: string
  transactionMode?: MigrationTransactionMode
  lockMode?: MigrationLockMode
  up(ctx: MigrationExecutionContext): Promise<void>
  down?: (ctx: MigrationExecutionContext) => Promise<void>
}
```

Why this is safe:

- forces explicit scope,
- keeps checksum input stable,
- makes transaction and lock behavior reviewable,
- allows `down` only where truly meaningful.

### Example 2: Global migration catalog record

```ts
export interface MigrationRunRecord {
  id: string
  scopeKind: 'platform_schema' | 'runtime_schema' | 'template' | 'publication' | 'application_sync' | 'metahub_sync'
  scopeKey: string
  sourceKind: 'file' | 'declarative' | 'system_sync' | 'template_seed' | 'publication_snapshot'
  migrationName: string
  migrationVersion: string
  checksum: string
  status: 'planned' | 'applied' | 'skipped' | 'blocked' | 'drifted' | 'failed'
  transactionMode: MigrationTransactionMode
  lockMode: MigrationLockMode
  summary: string
  meta: Record<string, unknown>
  snapshotBefore: Record<string, unknown> | null
  snapshotAfter: Record<string, unknown> | null
  error: Record<string, unknown> | null
}
```

Why this is safe:

- normalizes all migration sources,
- supports auditability and drift analysis,
- gives UI one stable contract.

### Example 3: Lock manager split by policy

```ts
export interface LockManager {
  withSessionLock<T>(key: string, fn: () => Promise<T>): Promise<T>
  withTransactionLock<T>(trx: DbTransaction, key: string, fn: () => Promise<T>): Promise<T>
}
```

Why this is safe:

- avoids ad-hoc lock acquisition spread across features,
- forces call sites to choose the correct lifetime,
- makes pool-sensitive review easier.

### Example 4: Declarative desired-state validation

```ts
import { z } from 'zod'

const desiredStateEnvelopeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('metahub-template'),
    schemaVersion: z.literal('1'),
    codename: z.string().min(1),
    version: z.string().min(1),
    payload: z.record(z.string(), z.unknown())
  }),
  z.object({
    kind: z.literal('application-definition'),
    schemaVersion: z.literal('1'),
    codename: z.string().min(1),
    version: z.string().min(1),
    payload: z.record(z.string(), z.unknown())
  })
])

export function parseDesiredStateEnvelope(input: unknown) {
  const result = desiredStateEnvelopeSchema.safeParse(input)
  if (!result.success) {
    return { ok: false as const, error: result.error.flatten() }
  }
  return { ok: true as const, value: result.data }
}
```

Why this is safe:

- non-throwing validation,
- discriminated version-aware envelope,
- future-proof import/export contract.

### Example 5: Safe TanStack Query mutation flow for long-running apply

```ts
const applyMutation = useMutation({
  mutationFn: applyMigrationPlan,
  onMutate: async (input) => {
    await queryClient.cancelQueries({ queryKey: ['migration-status', input.scopeKey] })
    const previous = queryClient.getQueryData(['migration-status', input.scopeKey])
    queryClient.setQueryData(['migration-status', input.scopeKey], (old) =>
      old ? { ...old, isApplying: true } : old
    )
    return { previous }
  },
  onError: (_error, input, context) => {
    queryClient.setQueryData(['migration-status', input.scopeKey], context?.previous)
  },
  onSettled: async (_data, _error, input) => {
    await queryClient.invalidateQueries({ queryKey: ['migration-status', input.scopeKey] })
    await queryClient.invalidateQueries({ queryKey: ['migration-history', input.scopeKey] })
  }
})
```

Why this is safe:

- cancels stale refetches before optimistic UI,
- preserves rollback path,
- forces post-apply revalidation.

### Example 6: Exact-SQL platform migration step for RLS

```ts
export const enableMetahubsRls: PlatformMigrationFile = {
  id: '20260309_120000_enable_metahubs_rls',
  version: '2026.03.09.120000',
  scope: { kind: 'platform_schema', key: 'metahubs' },
  checksumSource: 'metahubs.enable_rls.v1',
  transactionMode: 'single',
  lockMode: 'session_advisory',
  async up(ctx) {
    await ctx.sql.raw('ALTER TABLE metahubs.metahubs ENABLE ROW LEVEL SECURITY')
    await ctx.sql.raw('ALTER TABLE metahubs.metahubs_branches ENABLE ROW LEVEL SECURITY')
    await ctx.sql.raw('ALTER TABLE metahubs.metahubs_users ENABLE ROW LEVEL SECURITY')
    await ctx.sql.raw('ALTER TABLE metahubs.publications ENABLE ROW LEVEL SECURITY')
    await ctx.sql.raw('ALTER TABLE metahubs.publications_versions ENABLE ROW LEVEL SECURITY')
  }
}
```

Why this is safe:

- uses explicit SQL for a behavior that must match current output exactly,
- keeps RLS changes reviewable and parity-testable,
- avoids abstraction leakage for critical policy behavior.

---

## Affected Areas

### New packages

- `packages/universo-migrations-core`
- `packages/universo-migrations-catalog`
- `packages/universo-migrations-knex`
- `packages/universo-migrations-declarative`
- `packages/universo-migrations-platform`

### Existing backend packages

- `packages/universo-core-backend/base`
- `packages/metahubs-backend/base`
- `packages/applications-backend/base`
- `packages/auth-backend/base`
- `packages/admin-backend/base`
- `packages/profile-backend/base`
- `packages/schema-ddl/base`

### Shared packages

- `packages/universo-types/base`
- `packages/universo-utils/base`
- `packages/universo-i18n/base`
- `packages/migration-guard-shared/base`

### Frontend packages

- `packages/metahubs-frontend/base`
- `packages/applications-frontend/base`
- `packages/universo-template-mui/base`
- `packages/apps-template-mui`

### Database surface

- `public`
- `admin`
- `profile`
- `metahubs`
- `applications`
- `mhb_*`
- `app_*`
- new migration catalog schema such as `upl_migrations`

---

## Potential Challenges

- Exact parity for RLS and policy SQL is easy to underestimate.
- Removing TypeORM migration execution without breaking startup ordering requires disciplined rollout.
- RLS request context currently depends on TypeORM internals and needs a safe migration path.
- Runtime migration metadata is already in production-like use and cannot be casually redesigned without compatibility mapping.
- Session-level advisory locks can create pool pressure if additional lock scopes are added without guardrails.
- Future DB/file desired-state editing introduces drift problems immediately unless checksum rules are formalized from day one.
- Introducing a parallel migration UI or parallel permission model would create long-term convergence debt and should be treated as a design failure, not a neutral implementation detail.
- A weak definition registry model would push hidden complexity into ad hoc tables and make the future Metahubs-as-application bootstrap harder instead of easier.
- If observability is deferred, long-running migration failures will become difficult to diagnose once platform and runtime flows share the same engine.

---

## Design Notes

- A separate CREATIVE/DESIGN phase is still recommended for:
  - canonical desired-state envelope design,
  - DB/file source-of-truth policy,
  - migration catalog naming and schema layout,
  - admin/operator UX for drift and destructive review,
  - long-term `db-context` abstraction after TypeORM migration removal.

- The current task should optimize backend and migration architecture first.

- UI convergence of Metahubs runtime to `apps-template-mui` should remain a later phase, but all new migration contracts should already be compatible with that future.

---

## Dependencies and Coordination

- `core-backend` startup/bootstrap logic
- `auth-backend` request-scoped RLS context
- `metahubs-backend` runtime schema services and publication pipeline
- `applications-backend` runtime sync pipeline
- shared migration guard types and UI
- shared `types`, `utils`, and `i18n` packages
- centralized dependency versions in `pnpm-workspace.yaml`

No cross-team dependency is visible from the repository itself, but this refactor needs strict internal sequencing because many packages assume the current migration boot path.

---

## Recommended Execution Order

1. Finalize architecture and type contracts.
2. Build migration catalog + core runner.
3. Extract lock and transaction policies.
4. Rebase `schema-ddl` onto the unified core.
5. Port static/platform migrations from TypeORM into the new file-migration system.
6. Replace startup migration execution in `core-backend`.
7. Rebase metahub/application runtime flows onto the unified engine.
8. Add full parity and end-to-end tests.
9. Remove obsolete TypeORM migration wiring.

---

## Approval Questions for the Next Stage

The following design choices should be explicitly confirmed before implementation starts:

- Should the new global migration catalog live in `public` or in a dedicated schema such as `upl_migrations`?
- Should local runtime history tables (`_mhb_migrations`, `_app_migrations`) remain first-class UI data sources, or become only local caches with the global catalog as the API source of truth?
- Should `@universo/schema-ddl` remain as a low-level package, or be folded into a broader migration-declarative package with compatibility exports?
- Should the first implementation of the post-TypeORM DB context abstraction be introduced in this same initiative, or tracked as a tightly-coupled follow-up phase after migration parity is achieved?
