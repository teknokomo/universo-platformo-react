# LMS Catalog And Ledger Platform Expansion Plan

> Date: 2026-05-07
> Mode: PLAN
> Complexity: Level 4 - major cross-package platform architecture
> Status: IMPLEMENTATION QA FINALIZED on 2026-05-08; neutral public runtime contract, Ledger policy/reversal blockers, fixture regeneration, and LMS browser proof completed

## Overview

Build a platform-level foundation that can produce an LMS application comparable in scope to iSpring LMS without hardcoding LMS behavior into the platform runtime.

The target architecture is:

1. The metahub defines the base metadata model, logic, layouts, scripts, and seed data.
2. The application control panel owns application-wide runtime choices such as visibility, workspace policy, menu/layout overrides, limits, and report/dashboard configuration.
3. Each published application workspace owns local operational data and workspace-specific settings.
4. The LMS fixture `tools/fixtures/metahubs-lms-app-snapshot.json` is regenerated from a product Playwright flow and becomes a credible configuration artifact, not an E2E-only dataset.

The plan has two platform pillars:

1. Extend the existing standard `catalog` entity type so a single Catalog can behave as a reference list, document-like transactional collection, or a hybrid collection.
2. Add a new standard entity type with code key `ledger`, English UI label "Ledgers", and Russian UI label "Регистры". This should be a universal multi-dimensional ledger/register, not a separate family of information, accumulation, accounting, and calculation registers.

The Russian user-facing term should remain "Регистры". The code-facing term should be `ledger`, because "registry/register" is overloaded in software engineering and can be confused with service registries, package registries, or configuration registries.

## QA Remediation Update - 2026-05-08

Final hardening after the QA remediation pass also completed:

-   Public guest runtime settings now use neutral platform keys: access links, participants, assessments, content nodes, assessment responses, and content progress.
-   Legacy LMS-shaped guest runtime keys remain readable for older snapshots.
-   The canonical LMS template and `tools/fixtures/metahubs-lms-app-snapshot.json` were regenerated with the neutral guest runtime contract.
-   Registrar-only Ledger rejection and public runtime edge cases are now asserted in the browser import/runtime flow.
-   The Ledger workspace-column compatibility probe was removed; tests now model real information-schema `column_name` rows.
-   The shared Settings-origin tab test now mocks the shared LayoutList boundary correctly.

The latest implementation pass closed the remaining QA blockers that were still material for a working LMS-like configuration:

-   Registrar-only Ledgers now reject direct manual API writes and direct manual reversals.
-   Ledger registrar writes now honor `registrarKinds`; Catalog posting flows pass `catalog`, and script lifecycle contexts pass the attachment kind.
-   Transactional Catalog posting now persists `_app_posting_movements` and unpost/void append compensating Ledger facts before clearing that metadata.
-   Runtime script Ledger calls preserve capability checks and carry the correct manual/registrar write origin.
-   Public guest runtime object and field bindings are now driven by generic application settings under `publicRuntime.guest` or `guestRuntime`; LMS codenames remain defaults, not hardcoded-only platform behavior.
-   The LMS Playwright runtime flow was extended and passed, proving post -> unpost -> compensating Progress Ledger facts.

Focused validation completed:

-   `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/shared/publicRuntimeAccess.test.ts src/tests/routes/publicApplicationsRoutes.test.ts src/tests/routes/applicationsRoutes.test.ts src/tests/services/runtimeLedgersService.test.ts src/tests/services/runtimePostingMovements.test.ts`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/schema-ddl build`
-   `pnpm --filter @universo/schema-ddl test`
-   `node --check tools/testing/e2e/support/backend/api-session.mjs`
-   `node --check tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "lms snapshot fixture imports"`
-   `pnpm docs:i18n:check`

## Context Loaded

Local repository context:

-   `memory-bank/tasks.md`, `techContext.md`, `systemPatterns.md`, `activeContext.md`, `currentResearch.md`, and recent LMS/Page/runtime progress.
-   Existing plans around LMS, application workspaces, Entity-first refactoring, scripting, layouts, and fixtures.
-   Backup research files:
    -   `.backup/Каталоги-и-ресурсы.md`
    -   `.backup/Расширение-платформы-для-LMS.md`
-   Package READMEs:
    -   `packages/metahubs-backend/base/README.md`
    -   `packages/metahubs-frontend/base/README.md`
    -   `packages/applications-backend/base/README.md`
    -   `packages/apps-template-mui/README.md`
    -   `packages/universo-template-mui/base/README.md`
-   Current implementation files:
    -   `packages/universo-types/base/src/common/entityComponents.ts`
    -   `packages/universo-types/base/src/common/metahubs.ts`
    -   `packages/metahubs-backend/base/src/domains/templates/data/standardEntityTypeDefinitions.ts`
    -   `packages/metahubs-frontend/base/src/domains/entities/ui/BuiltinEntityCollectionPage.tsx`
    -   `packages/metahubs-frontend/base/src/domains/entities/ui/EntityInstanceListContent.tsx`
    -   `packages/metahubs-frontend/base/src/domains/entities/ui/entityInstanceListHelpers.ts`
    -   `packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts`
    -   `packages/schema-ddl/base/src/SchemaGenerator.ts`
    -   `packages/schema-ddl/base/src/builtinEntityKinds.ts`
    -   `packages/applications-backend/base/src/controllers/runtimeRowsController.ts`
    -   `packages/applications-backend/base/src/services/runtimeScriptsService.ts`
    -   `packages/apps-template-mui/src/dashboard/**`
    -   `.backup/templates/dashboard/**`
    -   `tools/testing/e2e/support/lmsFixtureContract.ts`
    -   `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`
    -   `tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`

External research:

-   iSpring LMS root docs: content types include SCORM packages, video, audio, documents, PowerPoint presentations, courses, assignments, pages, and web links.
-   iSpring course docs: courses can contain sections or a row of content items, due dates, order, completion conditions, certificates, enrollments, and reports.
-   iSpring assignment docs: free-form learner work is submitted, checked, graded, accepted, or declined.
-   iSpring learning tracks docs: tracks combine courses into ordered, free-order, or scheduled learning programs with due dates, automated assignment rules, certificates, and progress reports.
-   iSpring enrollments docs: enrollments assign courses/tracks to users, departments, or groups, with start dates, due dates, locking after due dates, training session selection, edit/cancel/reset/export flows.
-   iSpring reports docs: detailed statistics exist per content item and user; department progress and learning-track progress summarize completed, in-progress, not-started, overdue, and trained ratios.
-   iSpring roles docs: standard roles include account owner, account administrator, department administrator, course author, learner, supervisor, and custom roles.
-   iSpring API docs: REST/SOAP surfaces cover users, groups, departments, content, enrollments, points, training, 360 review, and webhooks.
-   Moodle docs/features as a comparable LMS baseline: course pages, timelines, activities, files, text editing, notifications, progress tracking, enrolment, multilingual capability, gradebook, competencies, learning plans, badges, certificates, and custom reports.
-   Context7:
    -   MUI X Data Grid guidance confirms server-side pagination should be paired with server-side filtering and sorting for large datasets.
    -   TanStack Query v5 docs confirm mutation invalidation and optimistic updates with `onMutate`, rollback via `onError`, and refetch via `onSettled`.

## Local Findings

1. Standard entity kinds are already DB-stored entity type definitions keyed by direct kind keys (`hub`, `page`, `catalog`, `set`, `enumeration`). Adding `ledger` should follow the same standard-kind path, not a separate registry.
2. `EntityKind` already allows arbitrary strings, but built-in behavior lists, settings tabs, schema DDL helpers, script attachment kinds, standard presets, i18n, and fixture contracts currently know only `hub`, `catalog`, `set`, `enumeration`, and `page`.
3. The standard `catalog` type is already the physical runtime table primitive:
    - `dataSchema`, `records`, `hierarchy`, `relations`, `layoutConfig`, `runtimeBehavior`, and `physicalTable` are enabled.
    - Runtime DDL creates physical catalog tables and child TABLE tables.
    - Runtime CRUD routes already run lifecycle hooks for `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete`, `beforeCopy`, and `afterCopy`.
4. Runtime scripts already have a restricted server bridge with `records.read` and `records.write`. This is a good starting point, but ledger posting should get a dedicated `ledger.write` capability so scripts do not have to write implementation tables directly.
5. `apps-template-mui` already owns the published runtime shell and has MUI X DataGrid, charts, workspace management, DataGrid locale helpers, and a dashboard widget renderer. The correct path is to improve generic widgets and datasource contracts, not restore LMS-specific `moduleViewerWidget`, `statsViewerWidget`, or `qrCodeWidget`.
6. The committed LMS fixture currently proves the removal of the previous LMS-specific global widgets. The next LMS fixture should preserve this direction and make reports/cards/learning views data-driven through generic dashboard widgets.
7. The original MUI dashboard template in `.backup/templates/dashboard` includes the visual language that should remain the reference for runtime dashboard density, cards, charts, grids, side menu, and spacing. Current custom runtime sections should be brought back to that composition style.
8. Metahub navigation is already data-driven through `getMetahubMenuItems(...)` and `ui.sidebarOrder`. Existing tests explicitly assert the current standard order as Hubs, Pages, Catalogs, Sets, Enumerations. Ledger must be added after Enumerations with `sidebarOrder: 60`, and the menu tests must be updated to assert this exact order.
9. The current `EntityResourceSurfaceCapability` accepts only `dataSchema`, `fixedValues`, and `optionValues`. Any Ledger-specific configuration must either reuse the existing `dataSchema` field-definition surface or deliberately extend the shared surface capability model. The preferred V1 path is reuse, not a parallel Ledger field editor.
10. Metahub authoring already has generic UI primitives: `EntityFormDialog`, `FieldDefinitionList`, `RecordList`, `OptionListList`, `SelectableOptionList`, `SharedResourcesPage`, `ViewHeaderMUI`, `ToolbarControls`, `FlowListTable`, and `ItemCard`. New Catalog behavior and Ledger authoring should compose these primitives instead of adding per-kind screens.
11. Runtime tables currently support server-side pagination, but `CrudDataAdapter.fetchList(...)`, `fetchAppData(...)`, and `CustomizedDataGrid` do not yet carry sort/filter models end to end. The table/widget plan must include adapter and backend contract changes before reports can be considered scalable.
12. PostgreSQL unique constraints treat `NULL` values as distinct. Any numbering uniqueness that includes nullable `workspace_id` must use an explicit workspace scope key, generated column, expression index, or separate global/workspace unique indexes. A plain `UNIQUE (object_id, workspace_id, period_key, prefix)` is not sufficient.
13. Script attachment kinds, lifecycle events, capability allowlists, and default capabilities currently know only the existing kinds and CRUD lifecycle. Ledger and posting must be added to the shared script contract and tests before template scripts can rely on them.
14. The LMS fixture contract currently guards old LMS widget removal and baseline LMS entities. It must be expanded to assert Ledgers, record behavior, posting scripts, generated reports, workspace-scoped facts, and the metahub menu order.
15. The application control panel already has an application-owned layout override layer in `ApplicationLayouts.tsx`, backed by `applicationLayoutsController.ts` and `_app_layouts` / `_app_widgets`. This is the correct place for application-wide menu, dashboard, and layout choices after a metahub publication is synced.
16. The application layout editor already uses shared authoring patterns: `LayoutAuthoringList`, `LayoutAuthoringDetails`, `ApplicationMenuWidgetEditorDialog`, `ApplicationColumnsContainerEditorDialog`, `ApplicationWidgetBehaviorEditorDialog`, and existing widget schemas in `@universo/types`. New LMS-like dashboard/report behavior should extend these generic contracts instead of adding LMS-specific editors.
17. `ApplicationMenuWidgetEditorDialog` already uses `EntityFormDialog` and validates menu hrefs through `isSafeMenuHref`. If report or ledger navigation needs menu entries, the shared menu item schema and runtime menu builder must be extended centrally; do not add ad hoc menu item shapes in runtime code.
18. `ApplicationSettings.tsx` currently exposes only generic settings and workspace limits, and the backend validates `settings` with a strict `applicationDialogSettingsSchema`. Any new application-wide defaults for reports, dashboard sections, or runtime datasource policies must be added as generic typed settings, not as unvalidated LMS-specific JSON.
19. Publication snapshots already carry entity type definitions, system fields, scripts, layouts, layout widgets, and runtime policy. Ledger config and Catalog record behavior must be included in the same deterministic snapshot, restore, hash, and sync paths.
20. `loadApplicationRuntimeElements(...)` and seed synchronization currently treat only physical `catalog` entities as seeded data. Ledger facts should not be silently treated as seed records; if the LMS fixture needs initial ledger facts, add an explicit seed fact contract with idempotency and workspace scope.
21. The runtime linked-collection endpoint currently exposes catalogs and pages as navigable runtime sections. Ledgers should not become normal linked collections by default; they should be accessed through generic datasource/report endpoints or explicitly configured manual ledgers.
22. Runtime script execution is already fail-closed around capabilities and lifecycle dispatch. Posting and ledger access should preserve that model by adding `posting`, `ledger.read`, and `ledger.write` centrally to shared capability lists, compiler manifests, runtime context, and tests.
23. `BuiltinEntityCollectionPage.tsx` uses an exhaustive `Record<BuiltinEntityKind, () => JSX.Element>` for standard collection views. Adding `ledger` to `BuiltinEntityKind` must update this map. The correct Ledger entry is the existing `EntityInstanceListContent`, not a new `LedgerListPage`.
24. `EntityInstanceListContent.tsx` currently enables generic authoring for hub-scoped routes, custom entity types, and Pages. If `ledger` is added to `STANDARD_ENTITY_METADATA_KIND_SET`, the generic authoring predicate must also include Ledgers; otherwise Ledger routes can render the shared page but disable pagination and data loading.
25. Built-in entity display names and dialog title maps in `entityInstanceListHelpers.ts` are also exhaustive by `BuiltinEntityKind`. Ledger needs EN/RU i18n keys and dialog labels in the same maps so the shared dialogs do not fall back to raw kind keys.
26. `ENTITY_SETTINGS_KINDS`, `ENTITY_SURFACE_KEYS`, surface maps, and settings tabs in `metahubs.ts` are currently exhaustive for five standard kinds. Ledger settings must be added there in the same change set so metahub settings, surface labels, and type-level tests remain coherent.
27. Current standard entity list implementations are already thinly aligned around shared primitives (`ViewHeaderMUI`, `ToolbarControls`, `FlowListTable`, `ItemCard`, and `EntityFormDialog`), but the code still has separate preset containers for Hubs, Catalogs, Sets, and Enumerations. Ledger must not add another specialized container. The implementation should also extract any newly needed common list/header/dialog behavior into shared components so all entity sections stay visually consistent.

## Architecture Decisions

### AD-1: Do not create a separate Document entity type in V1

The platform should not add a separate standard `document` kind in this wave. Instead, standard `catalog` remains the physical record collection primitive and receives optional document-like behavior.

Reasoning:

-   The existing `catalog` already owns physical table generation, records, field definitions, table parts, layouts, runtime CRUD, scripting, and workspace scope.
-   Many business objects naturally combine reference and transactional behavior. For example, LMS `Assignments`, `Enrollments`, and `Certificates` need document lifecycle, while `Courses`, `Modules`, and `Departments` are mostly reference-like collections.
-   Adding a separate `document` kind would duplicate a large part of the catalog route, DDL, layout, and runtime logic.

The UI can still expose a clear business mode on each Catalog:

-   Reference collection
-   Transactional collection
-   Hybrid collection

### AD-2: Add code kind `ledger`, UI name "Registers"

Add a standard entity type `ledger`.

Recommended user-facing labels:

-   English singular: `Ledger`
-   English plural: `Ledgers`
-   Russian singular: `Регистр`
-   Russian plural: `Регистры`

The plan uses "Ledger" in code and "Registers" in product docs where the 1C analogy matters. The object should be described as a universal multi-dimensional ledger/register that stores immutable facts and can derive information-register, accumulation-register, accounting-register, and calculation-register behavior through settings.

### AD-3: Ledgers are append-only by default

Ledger facts should be append-only. Corrections should be modeled as reversing or compensating facts, not in-place mutation. Direct edit should be disabled by default and allowed only for explicitly configured manual ledgers.

This gives:

-   auditability,
-   safe reposting,
-   reproducible reports,
-   compatibility with event-sourcing style projections,
-   clean LMS progress history.

### AD-4: Posting is a platform command, scripts provide business movements

The platform should own state transitions, locks, idempotency, numbering, and persistence. Scripts should validate and produce movement facts, but they should not directly mutate internal ledger tables.

### AD-5: LMS must remain a configuration, not a runtime fork

The LMS template should use:

-   standard Hubs, Pages, Catalogs, Sets, Enumerations, and Ledgers,
-   generic layouts,
-   generic table/card/chart/report widgets,
-   generic scripts and events,
-   generic runtime workspace APIs,
-   generic public access link routes.

No package should introduce `LmsDashboard`, `LmsReportWidget`, `LmsCourseWidget`, or similar feature-specific runtime shells unless a generic extension point has been exhausted and documented.

### AD-6: No schema/template version bump in this wave

The user explicitly stated that the test database will be dropped and recreated, and no metahub schema/template version increase is needed. The implementation can change current migrations, presets, and fixtures directly.

### AD-7: One shared UI contract for all entity kinds

Catalogs, Ledgers, Pages, Sets, Enumerations, Hubs, and future custom kinds must use the same entity-owned route and component contract where capabilities overlap.

Required UI reuse:

-   standard list/detail surfaces stay under `/metahub/:id/entities/:kindKey/...`,
-   create/edit/settings dialogs use `EntityFormDialog`,
-   data fields use `FieldDefinitionList`,
-   row-like data uses `RecordList` or the existing table/card primitives,
-   fixed and option values keep the existing value list components,
-   settings are added as reusable form tab sections, not as separate per-kind pages,
-   runtime dashboards use `detailsTable`, `columnsContainer`, generic cards, generic charts, and menu widgets.

Existing specialized standard-kind containers may remain only as thin adapters for truly different semantics such as trees, linked records, sets, and option lists. Any common header, toolbar, card/table layout, dialog, validation, conflict handling, search, pagination, and empty-state behavior that is touched in this work should be extracted or kept in shared components and reused by every applicable entity kind.

No implementation phase should add a standalone `LedgerListPage`, `LedgerFieldEditor`, `LmsDashboard`, `LmsReportWidget`, or similar kind/domain-specific UI unless the generic component contract is first extended and the exception is documented.

The standard collection view map should stay exhaustive and should route Ledgers to the generic entity instance page:

```tsx
const standardEntityCollectionViews = {
    catalog: LinkedCollectionListContent,
    hub: TreeEntityListContent,
    set: ValueGroupListContent,
    enumeration: OptionListContent,
    page: EntityInstanceListContent,
    ledger: EntityInstanceListContent
} satisfies Record<BuiltinEntityKind, () => JSX.Element>
```

The generic authoring predicate should be explicit rather than accidental:

```ts
const GENERIC_STANDARD_ENTITY_KINDS = new Set<BuiltinEntityKind>(['page', 'ledger'])
const usesGenericEntityAuthoring = isHubScoped || !isEntityMetadataSurface || GENERIC_STANDARD_ENTITY_KINDS.has(entityMetadataKind)
```

This preserves the existing Page pattern and prevents a hidden no-data route when Ledger becomes a standard kind.

### AD-8: Application settings remain generic application policy

The application control panel is the application-level override layer between metahub publication defaults and workspace-local settings.

It should contain generic application policy only:

-   visibility and access,
-   workspace mode and workspace limits,
-   application-owned layout/menu overrides,
-   generic dashboard/report feature toggles,
-   generic datasource defaults,
-   generic runtime UI behavior.

It must not contain an LMS settings page or LMS-specific configuration keys. If the LMS template needs a default report, start page, menu structure, or dashboard composition, model it through application layouts, menu widgets, datasource descriptors, or generic runtime settings that also make sense for non-LMS applications.

Backend settings validation should stay strict. Extending `applicationDialogSettingsSchema` should happen together with frontend types, i18n keys, tests, and migration/default handling. Avoid accepting arbitrary nested JSON for new runtime settings.

## Affected Areas

### Shared Types

-   `packages/universo-types/base/src/common/entityComponents.ts`
-   `packages/universo-types/base/src/common/metahubs.ts`
-   `packages/universo-types/base/src/common/scripts.ts`
-   `packages/universo-types/base/src/common/applicationLayouts.ts`
-   New suggested file: `packages/universo-types/base/src/common/ledgers.ts`
-   New suggested file: `packages/universo-types/base/src/common/recordBehavior.ts`

### Schema DDL

-   `packages/schema-ddl/base/src/builtinEntityKinds.ts`
-   `packages/schema-ddl/base/src/SchemaGenerator.ts`
-   `packages/schema-ddl/base/src/SchemaMigrator.ts`
-   `packages/schema-ddl/base/src/diff.ts`
-   `packages/schema-ddl/base/src/snapshot.ts`
-   `packages/schema-ddl/base/src/systemTables.ts`

### Metahubs Backend

-   `packages/metahubs-backend/base/src/domains/templates/data/standardEntityTypeDefinitions.ts`
-   New suggested preset: `packages/metahubs-backend/base/src/domains/templates/data/ledger.entity-preset.ts`
-   `packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts`
-   Entity services/controllers under `packages/metahubs-backend/base/src/domains/entities/**`
-   Metadata field validation under `packages/metahubs-backend/base/src/domains/entities/metadata/**`
-   Publication snapshot serializer/import/restore services

### Applications Backend

-   Runtime sync and DDL:
    -   `packages/applications-backend/base/src/routes/sync/**`
    -   `packages/applications-backend/base/src/services/publishedApplicationSnapshotEntities.ts`
-   Runtime CRUD and commands:
    -   `packages/applications-backend/base/src/controllers/runtimeRowsController.ts`
    -   `packages/applications-backend/base/src/shared/runtimeHelpers.ts`
    -   New suggested services: `runtimeRecordCommandService.ts`, `runtimeLedgerService.ts`, `runtimeNumberingService.ts`
-   Runtime scripts:
    -   `packages/applications-backend/base/src/services/runtimeScriptsService.ts`
-   Application control panel persistence:
    -   `packages/applications-backend/base/src/controllers/applicationsController.ts`
    -   `packages/applications-backend/base/src/controllers/applicationLayoutsController.ts`
    -   `packages/applications-backend/base/src/persistence/applicationsStore.ts`
    -   `packages/applications-backend/base/src/persistence/applicationLayoutsStore.ts`

### Frontend

-   Metahub authoring:
    -   `packages/metahubs-frontend/base/src/domains/entities/**`
    -   settings and i18n under `packages/metahubs-frontend/base/src/i18n/**`
-   Application control panel:
    -   `packages/applications-frontend/base/src/pages/ApplicationSettings.tsx`
    -   `packages/applications-frontend/base/src/pages/ApplicationLayouts.tsx`
    -   `packages/applications-frontend/base/src/components/layouts/ApplicationMenuWidgetEditorDialog.tsx`
    -   `packages/applications-frontend/base/src/components/layouts/ApplicationColumnsContainerEditorDialog.tsx`
    -   `packages/applications-frontend/base/src/components/layouts/ApplicationWidgetBehaviorEditorDialog.tsx`
    -   related `packages/applications-frontend/base/src/i18n/**` keys
-   Published app template:
    -   `packages/apps-template-mui/src/dashboard/**`
    -   `packages/apps-template-mui/src/hooks/useCrudDashboard.ts`
    -   `packages/apps-template-mui/src/workspaces/**`
    -   `packages/apps-template-mui/src/i18n/**`
-   Shared MUI:
    -   `packages/universo-template-mui/base/src/components/dashboard/**`
    -   shared cards, tables, chart wrappers, tabs, toolbar primitives

### Fixtures, Tests, Docs

-   `tools/testing/e2e/support/lmsFixtureContract.ts`
-   `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`
-   `tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   New Playwright flows for posting/ledgers/reports.
-   `tools/fixtures/metahubs-lms-app-snapshot.json`
-   `docs/en/**`
-   `docs/ru/**`
-   Relevant package READMEs in EN/RU.

## Extended Catalog Architecture

### Concept

Standard `catalog` stays the universal physical collection type. Each catalog object receives a `recordBehavior` config block that controls whether its runtime rows behave as reference rows, documents, or hybrids.

Suggested model:

```ts
export type LinkedCollectionRecordMode = 'reference' | 'transactional' | 'hybrid'
export type RuntimeRecordState = 'draft' | 'posted' | 'voided' | 'archived'

export interface NumberingConfig {
    enabled: boolean
    field: string
    scope: 'application' | 'workspace' | 'workspace-year' | 'workspace-month'
    prefixTemplate?: string
    minWidth?: number
    assignOn: 'create' | 'post'
    allowManualOverride?: boolean
}

export interface EffectiveDateConfig {
    enabled: boolean
    field: string
    defaultToNow: boolean
    requiredForPosting: boolean
}

export interface PostingConfig {
    enabled: boolean
    allowedSourceStates: RuntimeRecordState[]
    immutableWhenPosted: boolean
    repostPolicy: 'forbid' | 'reverse-and-repost'
    scriptActionCodename?: string
    targetLedgers?: string[]
}

export interface LinkedCollectionRecordBehaviorConfig {
    mode: LinkedCollectionRecordMode
    numbering?: NumberingConfig
    effectiveDate?: EffectiveDateConfig
    posting?: PostingConfig
}
```

### Component Manifest Extension

Add generic capabilities to the Entity Component System:

```ts
export interface IdentityFieldsComponentConfig extends ComponentConfig {
    supportsNumbering?: boolean
    supportsEffectiveDate?: boolean
}

export interface RecordLifecycleComponentConfig extends ComponentConfig {
    states?: readonly string[]
}

export interface PostingComponentConfig extends ComponentConfig {
    requiresRecordLifecycle?: boolean
}

export interface ComponentManifest {
    // existing keys...
    identityFields: IdentityFieldsComponentConfig | false
    recordLifecycle: RecordLifecycleComponentConfig | false
    posting: PostingComponentConfig | false
    ledgerSchema: LedgerSchemaComponentConfig | false
}
```

Dependencies:

```ts
export const COMPONENT_DEPENDENCIES = {
    // existing dependencies...
    posting: ['recordLifecycle', 'scripting'],
    ledgerSchema: ['dataSchema', 'physicalTable']
}
```

QA clarification: `ledgerSchema` is a behavioral capability flag, not a new standalone authoring surface in V1. Ledger dimensions, resources, and attributes should be ordinary field definitions edited through the existing `FieldDefinitionList`; `config.ledger.fieldRoles` classifies those fields. If a future implementation makes `ledgerSchema` a resource surface capability, it must extend `EntityResourceSurfaceCapability`, `ENTITY_RESOURCE_SURFACE_CAPABILITIES`, normalization, shared resource labels, routes, mocks, and tests in one shared place.

The standard `catalog` preset should enable support for `identityFields`, `recordLifecycle`, and `posting`, but each catalog instance should decide through `config.recordBehavior` whether these are active.

### Runtime System Columns

When a catalog instance enables `recordBehavior`, runtime DDL should add system columns to that catalog table.

Suggested columns:

```sql
_app_record_number TEXT NULL,
_app_record_date TIMESTAMPTZ NULL,
_app_record_state TEXT NOT NULL DEFAULT 'draft',
_app_posted_at TIMESTAMPTZ NULL,
_app_posted_by UUID NULL,
_app_voided_at TIMESTAMPTZ NULL,
_app_voided_by UUID NULL,
_app_posting_batch_id UUID NULL
```

Indexes:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_<table>_record_number_active
ON <schema>.<table> (workspace_id, _app_record_number)
WHERE _upl_deleted = false AND _app_deleted = false AND _app_record_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_<table>_record_date_active
ON <schema>.<table> (_app_record_date DESC)
WHERE _upl_deleted = false AND _app_deleted = false;

CREATE INDEX IF NOT EXISTS idx_<table>_record_state_active
ON <schema>.<table> (_app_record_state)
WHERE _upl_deleted = false AND _app_deleted = false;
```

If workspaces are disabled, the unique number scope should use a generated sentinel key or omit `workspace_id` according to the DDL helper.

### Numbering

Add an application runtime support table:

```sql
CREATE TABLE IF NOT EXISTS <schema>._app_number_sequences (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  object_id UUID NOT NULL REFERENCES <schema>._app_objects(id) ON DELETE CASCADE,
  workspace_id UUID NULL REFERENCES <schema>._app_workspaces(id) ON DELETE CASCADE,
  workspace_scope_key TEXT NOT NULL DEFAULT 'global',
  period_key TEXT NOT NULL DEFAULT '',
  prefix TEXT NOT NULL DEFAULT '',
  next_value BIGINT NOT NULL DEFAULT 1,
  _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  _upl_deleted BOOLEAN NOT NULL DEFAULT false,
  _app_deleted BOOLEAN NOT NULL DEFAULT false,
  CHECK (
    (workspace_id IS NULL AND workspace_scope_key = 'global')
    OR (workspace_id IS NOT NULL AND workspace_scope_key = workspace_id::text)
  ),
  UNIQUE (object_id, workspace_scope_key, period_key, prefix)
);
```

Safe allocation should be a single SQL statement inside the same transaction that creates or posts the row:

```ts
const rows = await executor.query<{ allocated: string }>(
    `
  INSERT INTO ${qSchemaTable(schemaName, '_app_number_sequences')}
    (object_id, workspace_id, workspace_scope_key, period_key, prefix, next_value)
  VALUES ($1, $2, $3, $4, $5, 2)
  ON CONFLICT (object_id, workspace_scope_key, period_key, prefix)
  DO UPDATE SET
    next_value = ${qSchemaTable(schemaName, '_app_number_sequences')}.next_value + 1,
    _upl_updated_at = NOW()
  RETURNING next_value - 1 AS allocated
  `,
    [objectId, workspaceId, workspaceId ?? 'global', periodKey, prefix]
)
```

This keeps concurrent document number generation safe without using application-level locks.

Do not use a nullable `workspace_id` as the only workspace discriminator in a unique constraint. PostgreSQL allows multiple rows with the same `NULL` value under a normal unique constraint, which would break global numbering.

### Runtime Commands

Add generic runtime record command endpoints:

-   `POST /api/v1/applications/:applicationId/runtime/rows/:rowId/post`
-   `POST /api/v1/applications/:applicationId/runtime/rows/:rowId/unpost`
-   `POST /api/v1/applications/:applicationId/runtime/rows/:rowId/void`

Each endpoint must require:

-   authenticated application access,
-   workspace access if workspaces are enabled,
-   write permission for the target collection,
-   row ownership/visibility rules already used by runtime CRUD,
-   optimistic concurrency through expected version if available.

The implementation should share one command service instead of adding large blocks to `runtimeRowsController.ts`.

### Posting Transaction

Target flow:

```ts
await executor.transaction(async (tx) => {
    const row = await lockRuntimeRowForPosting(tx, {
        schemaName,
        tableName,
        rowId,
        workspaceId
    })

    assertAllowedTransition(row._app_record_state, 'posted')

    const postingContext = await buildPostingContext(tx, {
        applicationId,
        schemaName,
        objectId,
        row,
        currentUserId,
        workspaceId
    })

    await runtimeScripts.dispatchLifecycleEvent({
        executor: tx,
        payload: { eventName: 'beforePost', row }
        // ...
    })

    const movements = await runtimeScripts.runPostingAction(postingContext)

    const batch = await ledgerService.appendPostingBatch(tx, {
        applicationId,
        schemaName,
        sourceObjectId: objectId,
        sourceRowId: rowId,
        workspaceId,
        effectiveAt: postingContext.effectiveAt,
        movements
    })

    await markRuntimeRowPosted(tx, {
        schemaName,
        tableName,
        rowId,
        batchId: batch.id,
        currentUserId
    })
})
```

The actual implementation should use repository helpers, `qSchemaTable`, `qTable`, `qColumn`, `queryOneOrThrow`, and parameterized SQL.

### Immutability Rules

If `posting.immutableWhenPosted = true`:

-   ordinary update/delete/copy must fail closed for posted rows unless the command is explicitly allowed,
-   tabular part edits must also fail closed for posted rows,
-   unpost/repost should append compensating ledger entries instead of mutating previous facts,
-   the UI should show posted rows as locked and expose command actions through the same row action menu pattern.

## Ledger/Register Architecture

### Concept

A Ledger is a metadata object that defines an append-only fact stream with typed dimensions, resources, attributes, period/effective date semantics, and optional projection definitions.

It covers:

-   1C information registers: latest or historical state by dimensions.
-   1C accumulation registers: turnover and balance by dimensions/resources.
-   1C accounting registers: account dimensions and balanced debit/credit entries.
-   1C calculation registers: facts with effective periods and recalculation projections.
-   LMS learning record store behavior: progress, score, attendance, attempt, enrollment, certificate, notification, and activity facts.

### Standard Type Definition

Add `ledger` to built-in standard kinds.

Suggested standard `LEDGER_TYPE_COMPONENTS`:

```ts
export const LEDGER_TYPE_COMPONENTS: ComponentManifest = {
    dataSchema: { enabled: true },
    records: false,
    treeAssignment: { enabled: true },
    optionValues: false,
    fixedValues: false,
    hierarchy: false,
    nestedCollections: false,
    relations: { enabled: true, allowedRelationTypes: ['manyToOne'] },
    actions: { enabled: true },
    events: { enabled: true },
    scripting: { enabled: true },
    blockContent: false,
    layoutConfig: { enabled: true },
    runtimeBehavior: { enabled: true },
    physicalTable: { enabled: true, prefix: 'led' },
    identityFields: false,
    recordLifecycle: false,
    posting: false,
    ledgerSchema: { enabled: true }
}
```

The exact extension should be kept compatible with the final `ComponentManifest` design.

### Ledger Config

Each Ledger object should store a `config.ledger` block:

```ts
export type LedgerMode = 'facts' | 'balance' | 'accounting' | 'calculation'
export type LedgerMutationPolicy = 'appendOnly' | 'manualEditable'
export type LedgerPeriodicity = 'none' | 'instant' | 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface LedgerFieldRole {
    fieldCodename: string
    role: 'dimension' | 'resource' | 'attribute'
    aggregate?: 'sum' | 'count' | 'min' | 'max' | 'latest'
    required?: boolean
}

export interface LedgerProjectionDefinition {
    codename: string
    kind: 'latest' | 'turnover' | 'balance' | 'timeline'
    dimensions: string[]
    resources: string[]
    period?: LedgerPeriodicity
}

export interface LedgerConfig {
    mode: LedgerMode
    mutationPolicy: LedgerMutationPolicy
    periodicity: LedgerPeriodicity
    effectiveDateField?: string
    sourcePolicy: 'manual' | 'registrar' | 'both'
    registrarKinds?: string[]
    fieldRoles: LedgerFieldRole[]
    projections?: LedgerProjectionDefinition[]
    idempotency: {
        keyFields: string[]
    }
}
```

The field definitions remain normal metadata fields. The ledger config classifies them as dimensions/resources/attributes. This avoids building a separate field-definition subsystem for Ledgers.

### Runtime Tables

For each Ledger object, generate a physical ledger table with typed columns from metadata fields plus required system columns:

```sql
id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
batch_id UUID NOT NULL,
source_object_id UUID NULL,
source_row_id UUID NULL,
source_line_id TEXT NULL,
workspace_id UUID NULL,
effective_at TIMESTAMPTZ NOT NULL,
period_key TEXT NOT NULL DEFAULT '',
direction SMALLINT NOT NULL DEFAULT 1 CHECK (direction IN (-1, 1)),
idempotency_key TEXT NOT NULL,
attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
_upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
_upl_created_by UUID NULL,
_upl_deleted BOOLEAN NOT NULL DEFAULT false,
_app_deleted BOOLEAN NOT NULL DEFAULT false
```

Typed dimension/resource fields are added as normal columns. This gives better query performance than storing every movement only as JSONB.

Global support table:

```sql
CREATE TABLE IF NOT EXISTS <schema>._app_ledger_batches (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  source_object_id UUID NULL,
  source_row_id UUID NULL,
  workspace_id UUID NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL DEFAULT 'active',
  reason TEXT NULL,
  _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  _upl_created_by UUID NULL,
  _upl_deleted BOOLEAN NOT NULL DEFAULT false,
  _app_deleted BOOLEAN NOT NULL DEFAULT false
);
```

Recommended indexes per ledger table:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_<ledger_table>_idempotency_active
ON <schema>.<ledger_table> (idempotency_key)
WHERE _upl_deleted = false AND _app_deleted = false;

CREATE INDEX IF NOT EXISTS idx_<ledger_table>_workspace_period
ON <schema>.<ledger_table> (workspace_id, period_key, effective_at DESC)
WHERE _upl_deleted = false AND _app_deleted = false;

CREATE INDEX IF NOT EXISTS idx_<ledger_table>_source
ON <schema>.<ledger_table> (source_object_id, source_row_id)
WHERE _upl_deleted = false AND _app_deleted = false;
```

Projection-specific indexes should be generated from `config.ledger.projections`.

### Ledger Append API

Add server-side services:

-   `RuntimeLedgerService.appendBatch(...)`
-   `RuntimeLedgerService.appendManualFact(...)`
-   `RuntimeLedgerService.reverseBatch(...)`
-   `RuntimeLedgerService.queryFacts(...)`
-   `RuntimeLedgerService.queryProjection(...)`

Safe append example:

```ts
await executor.query(
    `
  INSERT INTO ${qSchemaTable(schemaName, ledgerTable)} (
    batch_id,
    source_object_id,
    source_row_id,
    workspace_id,
    effective_at,
    period_key,
    direction,
    idempotency_key,
    ${dimensionColumns},
    ${resourceColumns},
    attributes,
    _upl_created_by
  )
  VALUES (${placeholders})
  ON CONFLICT (idempotency_key)
  WHERE _upl_deleted = false AND _app_deleted = false
  DO NOTHING
  RETURNING id
  `,
    params
)
```

If a movement is expected and `RETURNING` returns no row because of an idempotency conflict, the service should either:

-   treat it as idempotent success when the existing row matches the same payload hash, or
-   fail closed when payload differs.

### Query API

Add runtime endpoints:

-   `GET /api/v1/applications/:applicationId/runtime/ledgers`
-   `GET /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/facts`
-   `POST /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/query`
-   `GET /api/v1/applications/:applicationId/runtime/ledgers/:ledgerId/projections/:projectionCodename`

Queries must:

-   require application/workspace access,
-   validate requested dimensions/resources against ledger metadata,
-   use server-side pagination,
-   use server-side filtering/sorting,
-   block arbitrary SQL fragments,
-   return a stable table/card/chart payload that generic runtime widgets can consume.

Aggregation example:

```sql
SELECT
  student_id,
  module_id,
  SUM(direction * progress_delta) AS progress_total,
  MAX(effective_at) AS last_event_at
FROM <schema>.<ledger_table>
WHERE workspace_id = $1
  AND period_key >= $2
  AND period_key <= $3
  AND _upl_deleted = false
  AND _app_deleted = false
GROUP BY student_id, module_id
ORDER BY last_event_at DESC
LIMIT $4 OFFSET $5;
```

## Script Integration

### Script Roles And Capabilities

Extend shared script capabilities in `@universo/types`:

-   `ledger.read`
-   `ledger.write`
-   `posting`
-   `numbering.read`

Add lifecycle events:

-   `beforePost`
-   `afterPost`
-   `beforeUnpost`
-   `afterUnpost`
-   `beforeVoid`
-   `afterVoid`

Expose a restricted script SDK API:

```ts
type PostingScriptResult = {
    movements: Array<{
        ledger: string
        idempotencyKey: string
        effectiveAt?: string
        direction?: 1 | -1
        dimensions: Record<string, unknown>
        resources: Record<string, number>
        attributes?: Record<string, unknown>
    }>
}

export class EnrollmentPosting {
    async post(ctx: PostingContext): Promise<PostingScriptResult> {
        const enrollment = ctx.row
        return {
            movements: [
                {
                    ledger: 'LearningProgressLedger',
                    idempotencyKey: `enrollment:${enrollment.id}:assign`,
                    dimensions: {
                        student: enrollment.EnrollmentStudentId,
                        module: enrollment.ModuleIdRef
                    },
                    resources: {
                        assignments: 1
                    }
                }
            ]
        }
    }
}
```

The script result is a declarative movement list. The platform validates and persists the movements.

## LMS Configuration Architecture

### Layering

Metahub layer:

-   standard entity types and LMS-specific entity instances,
-   field definitions,
-   ledger definitions,
-   layouts and generic widget configuration,
-   default scripts and posting handlers,
-   default pages and seed rows,
-   publication policy.

Application layer:

-   visibility,
-   connector and schema sync choices,
-   workspace mode,
-   application-owned layout overrides,
-   menu placement and default start page,
-   global report/dashboard enabled sections,
-   limits and quotas.

Workspace layer:

-   students/learners,
-   enrollments,
-   assignments,
-   attempts,
-   progress,
-   attendance,
-   certificates,
-   report data,
-   workspace-specific settings such as local passing score overrides if enabled.

### LMS Object Model

Use the core metadata object types:

#### Hubs

-   `Learning`
-   `Administration`
-   `Reports`
-   `Knowledge`
-   Optional nested hubs for departments or programs if navigation needs grouping.

#### Pages

-   `LearnerHome`
-   `CourseOverviewPage`
-   `KnowledgeArticle`
-   `AssignmentInstructions`
-   `CertificatePolicy`
-   Optional course article pages backed by Editor.js block content.

#### Catalogs, reference mode

-   `Departments`
-   `Groups`
-   `SmartGroups`
-   `Learners`
-   `Instructors`
-   `Competencies`
-   `Skills`
-   `Courses`
-   `Modules`
-   `ContentItems`
-   `LearningTracks`
-   `TrainingSessions`
-   `ReportDefinitions`

#### Catalogs, transactional mode

-   `Enrollments`
-   `AssignmentSubmissions`
-   `QuizAttempts`
-   `TrainingAttendance`
-   `CertificateIssues`
-   `DevelopmentPlanAssignments`
-   `NotificationJobs`
-   `CoursePublicationRequests`

#### Sets

-   `LmsConfiguration`
-   `DefaultGradingPolicy`
-   `NotificationPolicy`
-   `CertificateTemplates`
-   `ReportFilters`

#### Enumerations

-   `CourseStatus`
-   `ContentType`
-   `CompletionOrder`
-   `EnrollmentStatus`
-   `AttemptStatus`
-   `AssignmentStatus`
-   `TrainingEventType`
-   `CertificateStatus`
-   `ReportType`
-   `LearningRole`

#### Ledgers / Registers

-   `LearningActivityLedger`
    -   xAPI-like facts: actor, verb, object, result, context.
-   `ProgressLedger`
    -   student/module/course/track progress deltas and status events.
-   `ScoreLedger`
    -   quiz scores, attempts, passing/failing facts.
-   `EnrollmentLedger`
    -   assign, cancel, reset, overdue, completed facts.
-   `AttendanceLedger`
    -   session registration and attendance facts.
-   `CertificateLedger`
    -   issue, expire, revoke facts.
-   `PointsLedger`
    -   gamification or iSpring-like points behavior.
-   `NotificationLedger`
    -   delivery and read/ack facts if notification reporting is required.

### iSpring Feature Mapping

| iSpring / LMS feature                   | Platform mapping                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Courses with sections and content items | `Courses` and `Modules` catalogs, TABLE fields for ordered content, Pages for rich content, files/links as field values                           |
| SCORM/video/audio/docs/PPT/web links    | `ContentItems` catalog with `ContentType` enumeration and URL/file metadata; SCORM/xAPI player integration can be a later generic content adapter |
| Pages                                   | Standard `page` entity with Editor.js block content                                                                                               |
| Assignments                             | Transactional `Assignments` and `AssignmentSubmissions` catalogs with posting into Progress/Score ledgers                                         |
| Learning tracks                         | `LearningTracks` catalog with ordered TABLE steps, completion order enum, schedule/due date fields, enrollment scripts                            |
| Enrollments                             | Transactional `Enrollments` catalog with numbering/date/state and posting into Enrollment/Progress ledgers                                        |
| Departments and groups                  | Reference `Departments` and `Groups` catalogs, linked to app memberships/profiles where possible                                                  |
| Smart groups / automated cohorts        | Generic `Groups` catalog plus rule fields/scripts that evaluate learners, departments, roles, and enrollment status                               |
| Roles                                   | Application membership roles plus LMS role catalog/enumeration for learning domain semantics                                                      |
| Supervisors                             | App roles plus department manager references and report permissions                                                                               |
| Assignment grading workflow             | Transactional `AssignmentSubmissions` catalog with state transitions, reviewer fields, score resources, and posting into `ScoreLedger`            |
| Reports                                 | Generic ledger projection queries rendered by generic table/card/chart widgets                                                                    |
| Department progress                     | `ProgressLedger` projection grouped by department/course/status                                                                                   |
| Learner progress                        | `ProgressLedger` + `ScoreLedger` projections grouped by learner and learning item                                                                 |
| Enrollment history                      | Append-only `EnrollmentLedger` facts                                                                                                              |
| Certificates                            | Transactional `CertificateIssues` catalog plus `CertificateLedger`                                                                                |
| Points                                  | `PointsLedger`                                                                                                                                    |
| Training sessions                       | `TrainingSessions` reference catalog plus `TrainingAttendance` transactional catalog and `AttendanceLedger`                                       |
| API/webhooks                            | Existing REST routes plus script/event/webhook capabilities, not LMS-specific endpoints                                                           |
| Public guest access                     | Existing public access link / guest runtime path, backed by generic records and ledgers                                                           |

## UI And Template Direction

### Metahub Authoring Navigation

Ledger must appear in the metahub left menu immediately after Enumerations:

1. Hubs
2. Pages
3. Catalogs
4. Sets
5. Enumerations
6. Ledgers / Registers

Implementation requirements:

-   add the standard `ledger` entity type with `ui.sidebarSection: 'objects'` and `ui.sidebarOrder: 60`,
-   keep it in the same dynamic object menu insertion point used by the other standard entity types,
-   update `getMetahubMenuItems(...)` tests to assert the six-item standard order,
-   update frontend mocks and template defaults so the menu is visible in tests and e2e flows,
-   use the existing menu icon registry; if a new icon is necessary, add it centrally to the registry, not inline in a Ledger screen.

### Shared Entity UI

All Ledger and extended Catalog authoring must reuse the same generic surfaces used by the existing entity kinds:

-   entity instance lists use the existing standard entity collection routes,
-   create/edit/settings use `EntityFormDialog`,
-   fields use `FieldDefinitionList`,
-   record-like data uses `RecordList`,
-   shared resources use the existing `SharedResourcesPage` capability tabs,
-   settings for Catalog behavior and Ledger field roles are reusable form tab sections.

Do not add separate entity-kind pages for Ledgers. If a missing generic capability is discovered, extend the shared component first and then consume it from every applicable entity type.

### Application Control Panel UI

The application control panel must reuse the existing settings and layout pages:

-   keep application-wide visibility and runtime behavior settings in `ApplicationSettings.tsx`,
-   keep application-owned dashboard/menu/layout overrides in `ApplicationLayouts.tsx`,
-   keep menu editing in `ApplicationMenuWidgetEditorDialog`,
-   keep multi-column layout editing in `ApplicationColumnsContainerEditorDialog`,
-   keep generic widget behavior editing in `ApplicationWidgetBehaviorEditorDialog`.

New controls for report defaults, dashboard sections, datasource policy, or workspace-related runtime behavior should be added as reusable settings sections or widget config sections. They should use existing MUI controls, `ViewHeader`, tabs, switches, selects, text fields, and shared dialog patterns.

Do not add an LMS settings route, an LMS dashboard editor, or report-specific menu editor. If a report menu item is needed, extend the shared `MenuWidgetConfigItem` schema and runtime menu builder in one place.

### Runtime Dashboard

Keep `packages/apps-template-mui` as the only published app runtime shell.

Restore visual parity with `.backup/templates/dashboard` by:

-   preserving the `SideMenu`, `AppNavbar`, `Header`, `MainGrid`, and MUI dashboard surface,
-   using white cards and compact MUI grid layout,
-   keeping chart/card/table proportions close to the original dashboard template,
-   fixing current workspace cards that diverged from original demo card geometry,
-   preventing text from overflowing cards/buttons,
-   avoiding nested cards,
-   keeping all new runtime sections inside the existing shell and `DashboardDetailsSlot.content`.

### Generic Widgets

Do not add LMS-specific widgets. Instead extend existing generic widgets:

-   `detailsTable` should support configurable datasource:
    -   record list,
    -   ledger facts,
    -   ledger projection,
    -   static seed preview.
-   card/stat widgets should support datasource metrics:
    -   count,
    -   sum,
    -   percentage,
    -   trend.
-   chart widgets should support datasource series:
    -   timeseries,
    -   grouped totals,
    -   status distribution.
-   menu widget should remain the navigation contract for Pages, Catalogs, Reports, and Workspaces.
-   application-level widget overrides should stay in the existing `_app_layouts` / `_app_widgets` model and keep source sync state semantics.
-   any new widget config schema must live in `@universo/types` with strict Zod parsing and be reused by metahub authoring, application authoring, sync, and runtime rendering.

MUI X Data Grid guidance supports server-side pagination/filtering/sorting for large datasets. The generic table widget should therefore send pagination, sort, and filter models to the backend rather than filtering only the current page.

Current QA note: `CrudDataAdapter.fetchList(...)` and `fetchAppData(...)` currently carry `limit` and `offset` only, and `CustomizedDataGrid` only switches `paginationMode` to `server`. The implementation must extend the adapter, response schema, runtime endpoint, and DataGrid props with sort/filter/search models. For MUI X v8, evaluate the Data Source layer for the generic table adapter where it fits the existing `DashboardDetailsContext`; otherwise implement equivalent `sortingMode="server"` and `filterMode="server"` wiring in the shared table component.

TanStack Query v5 should be used with typed query key factories and mutation invalidation. For record commands, optimistic UI should be limited to safe state changes where rollback is straightforward.

## QA Requirements Coverage

The plan now covers every material requirement from the original task:

-   Metahub-first architecture is preserved: base metadata and logic stay in metahubs, application-wide overrides stay in the application control panel, and workspace-local operational settings/data stay in workspaces.
-   Existing standard entity blocks remain the logical core: Hubs, Pages, Catalogs, Sets, and Enumerations stay first-class; Ledgers are the only new standard kind in this wave.
-   Catalogs are extended instead of splitting into a separate Document kind. `recordBehavior` provides numbering, effective dates, lifecycle states, posting hooks, and immutability without duplicating Catalog storage/runtime contracts.
-   Ledgers are modeled as universal append-only fact stores with configurable dimensions/resources/attributes/projections. This covers 1C-style information, accumulation, accounting, and calculation register behavior without creating four separate entity families.
-   iSpring-like LMS functionality is mapped to configuration objects: reference Catalogs, transactional Catalogs, Pages, Sets, Enumerations, Ledgers, scripts, layouts, generic widgets, and reports.
-   The metahub left menu requirement is explicit: Ledgers appear immediately after Enumerations through `ui.sidebarOrder: 60`.
-   Shared UI reuse is explicit: Ledger must use the generic entity instance route/content, and any common list/dialog/header changes must be made in shared components rather than in a new kind-specific screen.
-   Runtime application UI remains based on `packages/apps-template-mui` and the original MUI dashboard composition in `.backup/templates/dashboard`.
-   LMS-specific hardcoding remains forbidden. New reports, cards, tables, menus, and dashboards are generic widget/datasource/schema extensions.
-   Script attachments are part of the design, but posting remains platform-owned and fail-closed. Scripts return declarative movements or use a restricted SDK.
-   The Playwright-generated LMS snapshot remains the final product artifact and receives contract assertions for real working functionality, not only static fixture shape.
-   The no-legacy/no-version-bump constraint is reflected in AD-6.
-   Tests, screenshot checks, package READMEs, and GitBook docs are included as mandatory implementation phases.

## Implementation Plan

### Phase 0 - Architecture Proof And Visual Baseline

-   [x] Capture current published application screenshots for:
    -   `/a/:applicationId`
    -   `/a/:applicationId/workspaces`
    -   a catalog table section
    -   mobile runtime layout
-   [x] Compare current `apps-template-mui` surfaces with `.backup/templates/dashboard` components:
    -   card radius,
    -   card background,
    -   grid width,
    -   header spacing,
    -   charts/table proportions,
    -   workspace card overflow.
-   [x] Map all current hardcoded LMS references in runtime packages and confirm which are fixture/test-only versus product code.
-   [x] Write an implementation decision note in `memory-bank/creative/` only if UI composition choices need a creative phase before coding.

### Phase 1 - Shared Types And Entity Component Model

-   [x] Add shared `recordBehavior` types in `@universo/types`.
-   [x] Add shared `ledger` types in `@universo/types`.
-   [x] Extend `ComponentManifest` with identity/record lifecycle/posting/ledger capabilities.
-   [x] Extend component dependency validation.
-   [x] Add `ledger` to built-in entity kind values, settings kinds, surface labels, menu metadata, and script attachment kinds.
-   [x] Update every hardcoded built-in kind list in one pass:
    -   `_META_ENTITY_KIND_MAP`,
    -   `BuiltinEntityKinds`,
    -   `BUILTIN_ENTITY_KIND_VALUES`,
    -   `SchemaBuiltinEntityKind`,
    -   `ENTITY_SETTINGS_KINDS`,
    -   `ENTITY_SURFACE_KEYS` and surface maps,
    -   `BUILTIN_ENTITY_TYPE_NAME_KEYS`,
    -   `BUILTIN_ENTITY_DIALOG_TITLE_KEYS`,
    -   `STANDARD_ENTITY_METADATA_KIND_SET`,
    -   `standardEntityCollectionViews`,
    -   `SCRIPT_ATTACHMENT_KINDS`,
    -   script lifecycle events and capability allowlists,
    -   standard entity mocks,
    -   menu icon registry metadata if a new icon name is used.
-   [x] Set standard Ledger menu metadata to `sidebarSection: 'objects'` and `sidebarOrder: 60`, after Enumerations.
-   [x] Add EN/RU i18n keys in `packages/universo-i18n` where shared labels belong.
-   [x] Add direct type tests for:
    -   component dependency validation,
    -   built-in kind recognition,
    -   standard object menu order including Ledger,
    -   ledger config parsing,
    -   record behavior normalization.

### Phase 2 - Standard Presets And Metahub Authoring

-   [x] Update standard `catalog` preset to support record behavior components.
-   [x] Add `ledger.entity-preset.ts`.
-   [x] Register the ledger preset in template data exports.
-   [x] Update `basic`, `basic-demo`, and `lms` template preset lists as needed.
-   [x] Add Entity constructor UI for Catalog behavior:
    -   mode,
    -   numbering,
    -   effective date,
    -   lifecycle states,
    -   posting target ledgers,
    -   immutability.
-   [x] Add Entity constructor UI for Ledger definitions:
    -   field roles,
    -   mode,
    -   periodicity,
    -   mutation policy,
    -   projections.
-   [x] Route the standard `ledger` collection through `EntityInstanceListContent` in `BuiltinEntityCollectionPage.tsx`; do not create `LedgerListPage` or another kind-specific list.
-   [x] Update `EntityInstanceListContent` generic authoring rules so standard Ledgers load, paginate, search, create, edit, and delete through the same generic path as Pages/custom metadata objects where applicable.
-   [x] Add shared list-shell extraction tasks when touching repeated list/header/dialog patterns in Hub, Catalog, Set, Enumeration, Page, or Ledger screens.
-   [x] Reuse `FieldDefinitionList` for Ledger dimensions/resources/attributes and store the role classification in Ledger config. Do not add a separate Ledger field editor.
-   [x] Reuse `EntityFormDialog` tabs for Catalog behavior and Ledger settings. Any new fields should be reusable tab sections, not kind-specific pages.
-   [x] Keep standard entity structural editing protected unless the change is explicitly allowed by the standard preset contract.
-   [x] Add frontend tests for Catalog behavior form and Ledger definition form.
-   [x] Add frontend route tests proving `BuiltinEntityCollectionPage` maps Ledger to the generic entity list and that hub-scoped Ledger routes also use the same generic content.
-   [x] Add backend route/service tests for standard ledger type creation/seed and standard catalog config validation.

### Phase 3 - Schema DDL And Snapshot Support

-   [x] Update `@universo/schema-ddl` built-in kind helpers to include `ledger`.
-   [x] Extend schema snapshot generation to persist record behavior and ledger config deterministically.
-   [x] Extend `SnapshotSerializer`, snapshot restore/import, `resolveExecutablePayloadEntities(...)`, and publication hash normalization so `ledger` objects, `config.ledger`, and `config.recordBehavior` round-trip without lossy normalization.
-   [x] Extend physical table generation:
    -   Catalog record behavior columns,
    -   `_app_number_sequences`,
    -   `_app_ledger_batches`,
    -   per-ledger physical tables,
    -   typed dimension/resource columns,
    -   indexes.
-   [x] Extend diff/migration logic for:
    -   adding/removing record behavior columns,
    -   changing ledger field roles,
    -   adding ledger projections/indexes,
    -   destructive changes with explicit confirmation.
-   [x] Update sync seeding so seeded runtime rows preserve workspace scope and record behavior defaults.
-   [x] Keep regular seed elements scoped to Catalogs unless an explicit Ledger seed fact contract is added. Ledger seed facts, if added, must use append/idempotency semantics rather than raw table inserts.
-   [x] Update runtime data loaders so application release bundles include new metadata while avoiding accidental export of operational ledger facts.
-   [x] Add schema-ddl tests for fresh schema, diff, rollback analysis, snapshots, and workspace-enabled schemas.

### Phase 4 - Runtime Record Commands

-   [x] Create `RuntimeNumberingService`.
-   [x] Create `RuntimeRecordCommandService`.
-   [x] Add runtime endpoints for post/unpost/void.
-   [x] Make posted rows immutable for update/delete/tabular edits when configured.
-   [x] Add row action descriptors in `apps-template-mui`:
    -   post,
    -   unpost,
    -   void,
    -   state chip.
-   [x] Keep action icons from the existing MUI/Tabler icon registries; do not add text-only buttons where an icon action is standard.
-   [x] Add backend tests for:
    -   concurrent number allocation,
    -   global numbering when `workspace_id` is null,
    -   state transition failures,
    -   posted-row immutability,
    -   tabular edit blocking,
    -   workspace-scoped numbering,
    -   permission failures.
-   [x] Add frontend tests for command buttons, disabled states, errors, and query invalidation.

### Phase 5 - Ledger Runtime Services

-   [x] Create `RuntimeLedgerService`.
-   [x] Add ledger query/append/reverse APIs.
-   [x] Add ledger metadata loaders from `_app_objects` and `_app_attributes`.
-   [x] Add safe projection query builder:
    -   no arbitrary SQL fragments,
    -   only declared dimensions/resources,
    -   parameterized values,
    -   server-side pagination/sorting/filtering.
-   [x] Add append idempotency checks.
-   [x] Add reversing batch support.
-   [x] Add tests for:
    -   append-only behavior,
    -   idempotency,
    -   reversal,
    -   workspace isolation,
    -   aggregation correctness,
    -   invalid dimension/resource rejection,
    -   permission failures.

### Phase 6 - Script SDK And Posting Integration

-   [x] Extend shared script manifest capabilities with `posting`, `ledger.read`, and `ledger.write`.
-   [x] Add `ledger` to script attachment kinds and update attachment validation so Ledger-compatible custom kinds resolve through entity type definitions, not hardcoded object checks.
-   [x] Add posting lifecycle events to design-time and runtime event bindings.
-   [x] Expose a restricted `ctx.ledger` API in runtime scripts.
-   [x] Add a declarative movement return contract for posting actions.
-   [x] Ensure `beforePost` runs in the active transaction.
-   [x] Ensure `afterPost` runs only after commit.
-   [x] Fail closed when posting scripts throw, return invalid movement payloads, or reference undeclared ledgers/fields.
-   [x] Add compiler/runtime tests for new SDK capability gates.
-   [x] Add E2E proof that a metahub-authored script posts an enrollment and creates ledger facts in the published app.

### Phase 7 - Generic Runtime Dashboard/Data Widgets

-   [x] Extend dashboard widget config schemas in `@universo/types`.
-   [x] Add generic datasource descriptors:
    -   `records.list`,
    -   `ledger.facts`,
    -   `ledger.projection`,
    -   `metric`.
-   [x] Extend `CrudDataAdapter.fetchList(...)`, `fetchAppData(...)`, response schemas, and runtime list endpoints with server-side search/sort/filter models.
-   [x] Update `detailsTable` and `CustomizedDataGrid` to consume datasource responses with server-side pagination/filtering/sorting.
-   [x] Evaluate MUI X Data Source integration for the generic table adapter; use explicit `sortingMode="server"` and `filterMode="server"` wiring if the Data Source layer does not fit the existing `DashboardDetailsContext`.
-   [x] Update stat/card/chart widgets to consume generic metric/series responses.
    -   [x] Add typed `overviewCards` / stat-card config and resolve generic `records.count` metrics through the existing runtime records API.
    -   [x] Add generic series datasource consumption for chart widgets.
-   [x] Extend application layout widget catalog and widget config editors through the existing `ApplicationLayouts.tsx` flow. Reuse `ApplicationMenuWidgetEditorDialog`, `ApplicationColumnsContainerEditorDialog`, and `ApplicationWidgetBehaviorEditorDialog`; add a generic datasource editor only if it is shared by multiple widget keys.
    -   [x] Pass widget identity into `ApplicationWidgetBehaviorEditorDialog` and configure `detailsTable.datasource` through the existing `EntityFormDialog` surface.
    -   [x] Render `detailsTable` `records.list` datasources through the existing published-app `CustomizedDataGrid` path.
    -   [x] Generalize datasource authoring for chart widgets after their series runtime consumers are implemented.
    -   [x] Generalize datasource authoring for multi-card metric widgets without replacing the existing shared behavior editor pattern.
-   [x] Extend `ApplicationSettings.tsx` only with generic runtime policy sections:
    -   report/dashboard defaults,
    -   datasource execution policy,
    -   workspace-related runtime defaults,
    -   no LMS-specific settings keys.
-   [x] Update `applicationsController` strict settings schema, frontend `ApplicationDialogSettings` types, defaults, and EN/RU i18n together for every new application setting.
-   [x] Preserve layout source sync semantics when application admins override metahub-provided report/dashboard widgets.
-   [x] Move reusable dashboard card/chart primitives to `@universo/template-mui` only when they are domain-neutral.
-   [x] Fix workspace management UI to match original MUI dashboard card/grid style.
-   [x] Add Playwright screenshots for:
    -   runtime dashboard desktop,
    -   runtime dashboard mobile,
    -   workspaces section,
    -   table section,
    -   ledger report section.
-   [x] Add pixel/geometry checks for overflow, text clipping, and nested-card regressions.

### Phase 8 - LMS Template Rebuild

-   [x] Replace current LMS model with a richer iSpring-inspired configuration using standard objects only.
-   [x] Add ledger definitions:
    -   `LearningActivityLedger`,
    -   `ProgressLedger`,
    -   `ScoreLedger`,
    -   `EnrollmentLedger`,
    -   `AttendanceLedger`,
    -   `CertificateLedger`,
    -   `PointsLedger`,
    -   `NotificationLedger`.
-   [x] Mark document-like catalogs as transactional:
    -   [x] `Enrollments`,
    -   [x] current LMS `Assignments` catalog,
    -   [x] current LMS `QuizResponses` catalog,
    -   [x] current LMS `TrainingEvents` catalog,
    -   [x] current LMS `Certificates` catalog,
    -   [x] add separate `AssignmentSubmissions`, `QuizAttempts`, `TrainingAttendance`, and `CertificateIssues` catalogs as complements to the current product model.
-   [x] Keep reference-like catalogs as reference mode:
    -   `Departments`,
    -   `Groups`,
    -   `SmartGroups`,
    -   `Learners`,
    -   `Courses`,
    -   `Modules`,
    -   `LearningTracks`,
    -   `Competencies`.
-   [x] Add bilingual Pages for:
    -   learner home,
    -   course overview,
    -   knowledge article,
    -   assignment instructions,
    -   certificate policy.
-   [x] Add scripts:
    -   auto-enrollment rule,
    -   enrollment posting,
    -   quiz attempt posting,
    -   module completion posting,
    -   certificate issue posting.
-   [x] Configure generic widgets:
    -   learner dashboard cards,
    -   progress report table,
    -   department progress chart,
    -   learning track report table,
    -   enrollment history table.
-   [x] Configure application-level defaults through generic layout/widget/settings contracts only. Do not introduce an LMS-specific app settings route or settings blob.
-   [x] Keep demo content bilingual EN/RU with equal breadth.
-   [x] Remove placeholder support email/domain values where a generic setting can generate a local value.
-   [x] Ensure public guest flow still creates real rows and ledger facts.

### Phase 9 - Product Playwright Fixture Generator

-   [x] Rewrite `metahubs-lms-app-export.spec.ts` around the new product model.
-   [x] Move canonical fixture constants into `lmsFixtureContract.ts`.
-   [x] Validate:
    -   standard `ledger` entity type exists,
    -   required ledger objects exist,
    -   Ledger appears after Enumerations in metahub menu metadata,
    -   transactional catalogs have record behavior config,
    -   posting scripts are attached,
    -   generic dashboard widgets reference generic datasources,
    -   application-level runtime defaults use generic settings/layout/widget contracts,
    -   no LMS-specific runtime widget keys exist,
    -   no LMS-specific application settings keys exist,
    -   fixture hash matches.
-   [x] Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` through Playwright only.
-   [x] Add import/runtime proof:
    -   browser import,
    -   linked application creation,
    -   connector diff,
    -   workspace enablement,
    -   schema sync,
    -   dashboard screenshot,
    -   reports screenshot,
    -   post enrollment,
    -   public guest journey,
    -   ledger row counts and projection assertions.

### Phase 10 - Tests And Validation Matrix

-   [x] Backend Jest:
    -   metahubs entity type validation,
    -   template seeding,
    -   snapshot restore,
    -   snapshot hash determinism for Ledger and recordBehavior config,
    -   application settings strict schema and generic runtime policy validation,
    -   application layout widget config validation and sync-state preservation,
    -   runtime record command service,
    -   runtime ledger service,
    -   runtime scripts posting bridge,
    -   sync DDL and seeding.
-   [x] Frontend Jest/Vitest:
    -   metahub Catalog behavior UI,
    -   Ledger authoring UI,
    -   standard metahub menu order: Hubs, Pages, Catalogs, Sets, Enumerations, Ledgers,
    -   `BuiltinEntityCollectionPage` routes Ledger through `EntityInstanceListContent`,
    -   `entityInstanceListHelpers` resolves Ledger names and dialog titles through i18n keys,
    -   Ledger UI uses shared entity route/dialog/resource components,
    -   shared entity list/header/dialog components are reused by all touched standard entity kinds,
    -   runtime command actions,
    -   generic datasource widgets,
    -   application settings generic runtime policy sections,
    -   application layout/widget editors reuse existing dialog/editor components,
    -   server-side sort/filter/search adapter wiring,
    -   workspace UI parity,
    -   i18n key coverage.
-   [x] Schema-DDL tests:
    -   fresh schema generation,
    -   diff,
    -   workspace-enabled DDL,
    -   rollback analysis,
    -   snapshot determinism.
-   [x] Playwright:
    -   basic create/edit for Ledger type,
    -   transactional Catalog post/unpost,
    -   LMS generator,
    -   LMS import/runtime flow,
    -   LMS reports,
    -   LMS public guest flow,
    -   workspaces visual parity,
    -   mobile runtime.
-   [x] Static checks:

    -   `pnpm --filter @universo/types build`
    -   `pnpm --filter @universo/schema-ddl build`
    -   `pnpm --filter @universo/metahubs-backend test`
    -   `pnpm --filter @universo/applications-backend test`
    -   `pnpm --filter @universo/metahubs-frontend test`
    -   `pnpm --filter @universo/apps-template-mui test`
    -   `pnpm docs:i18n:check`
    -   `pnpm build`

    Validation note 2026-05-08: focused builds/lints and the root build passed earlier in the implementation wave. The broad package test rerun passed for schema-ddl (`158/158`), applications-backend (`283/283`), metahubs-backend (`626/630`, `4` skipped), metahubs-frontend (`274/274`), and apps-template-mui (`101/101`). The LMS generator Playwright flow, direct fixture contract, and Chromium import/runtime flow also passed.

Do not run `pnpm dev` automatically. For browser validation, use the existing Playwright runner and its e2e startup/reset tooling.

### Phase 11 - Documentation

-   [x] Update package READMEs in EN/RU:
    -   `metahubs-backend`,
    -   `metahubs-frontend`,
    -   `applications-backend`,
    -   `apps-template-mui`,
    -   `schema-ddl`,
    -   `universo-types`.
-   [x] Update GitBook docs in EN/RU:
    -   `docs/*/architecture/entity-component-system.md`
    -   `docs/*/architecture/entity-systems.md`
    -   `docs/*/architecture/lms-entities.md`
    -   new `docs/*/architecture/ledgers.md`
    -   new `docs/*/guides/transactional-catalogs.md`
    -   new `docs/*/guides/ledgers.md`
    -   `docs/*/guides/lms-overview.md`
    -   `docs/*/guides/lms-setup.md`
    -   `docs/*/guides/lms-guest-access.md`
    -   `docs/*/guides/app-template-views.md`
    -   `docs/*/SUMMARY.md`
-   [x] Keep EN/RU docs structurally aligned so `pnpm docs:i18n:check` passes.

## Key Risks And Mitigations

1. Risk: Ledger scope becomes too broad for one implementation wave.
   Mitigation: deliver append-only facts, posting integration, and projection queries first. Defer advanced materialized view refresh and complex calculation registers if needed.

2. Risk: Adding `ledger` as a standard kind breaks existing standard-kind assumptions.
   Mitigation: update all built-in kind lists, standard settings, schema-ddl helpers, script attachment kinds, fixtures, and tests in the same phase.

3. Risk: Posting scripts could become an unsafe database escape hatch.
   Mitigation: scripts return declarative movements or call restricted SDK methods; platform services validate and persist.

4. Risk: Number generation can race under concurrent posts.
   Mitigation: allocate numbers with one `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` statement inside the transaction and use a non-null workspace scope key so global numbering is unique when `workspace_id` is null.

5. Risk: Generic widgets accidentally become LMS-specific through config assumptions.
   Mitigation: test the same widgets against at least one non-LMS fixture or self-hosted/basic demo scenario.

6. Risk: Ledger reports become slow on real data.
   Mitigation: require declared dimensions/resources, generated indexes, server-side pagination/filtering/sorting, and a documented path to projection materialization.

7. Risk: UI drift from the MUI dashboard template continues.
   Mitigation: add screenshot and geometry checks against actual browser renders, especially workspace cards and dashboard sections.

8. Risk: Snapshot hash and fixture contract drift.
   Mitigation: regenerate only through Playwright generator and validate with `assertLmsFixtureEnvelopeContract`.

9. Risk: Ledger authoring introduces a parallel UI style.
   Mitigation: require shared entity routes, `EntityFormDialog`, `FieldDefinitionList`, and existing table/card primitives; add tests that fail if Ledger needs a dedicated page.

10. Risk: application-level LMS behavior leaks into a special settings page or untyped JSON.
    Mitigation: keep application settings strict and generic, use existing layout/widget override UI, and require fixture tests that reject LMS-specific settings keys.

## Acceptance Criteria

-   `catalog` supports document-like behavior without adding a separate `document` standard type.
-   `ledger` is a first-class standard entity type available through Entity constructor, templates, publication snapshots, application sync, and runtime APIs.
-   The metahub left menu shows Ledgers / Registers immediately after Enumerations and before the generic Entity Types section.
-   Ledger and extended Catalog authoring reuse shared entity UI components for equivalent interactions.
-   Posting an LMS enrollment/quiz attempt/module completion creates immutable ledger facts.
-   Reports are powered by generic ledger projection APIs and generic dashboard widgets.
-   Application-level LMS-like dashboard/report defaults are configured through generic application settings, layouts, menu widgets, and datasource descriptors, not LMS-specific settings pages or runtime widgets.
-   The LMS runtime has iSpring-like functional breadth:
    -   courses/modules,
    -   pages,
    -   assignments,
    -   learning tracks,
    -   enrollments,
    -   departments/groups/smart groups/roles,
    -   progress,
    -   reports,
    -   certificates,
    -   public guest access.
-   The UI keeps the original MUI dashboard style and does not introduce nested cards or overflowing controls.
-   `tools/fixtures/metahubs-lms-app-snapshot.json` is regenerated by Playwright and imports into a clean database.
-   Jest, Vitest, Playwright, docs i18n, and root build validations are green.

## Approval Gate

Implementation should not start until this plan is reviewed and approved. The recommended next mode after approval is `IMPLEMENT`.
