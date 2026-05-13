# Scoped Layout Widget Visibility Plan

Date: 2026-05-12  
Mode: PLAN / IMPLEMENT  
Status: Implemented  
Complexity: Level 4, cross-package platform architecture

## Overview

The current LMS application generated from `tools/fixtures/metahubs-lms-app-snapshot.json` still renders dashboard metrics and the three-column table container on every runtime section because the snapshot has one global layout. The runtime selects that global layout for all pages and linked collections unless a collection-specific layout exists.

The correct fix is not to add LMS-specific widget filters. The platform needs a generic scoped layout and widget visibility system:

- The active global layout remains the base application shell.
- Any layout-capable Entity can get a scoped layout overlay: Page, Catalog, Set, Ledger-like custom types, or any future Entity type whose constructor metadata enables layout configuration.
- Scoped layouts inherit widgets from the active global layout and store only sparse visibility or placement overrides.
- The global layout editor can show where each widget is visible or hidden.
- The scoped Entity layout editor can hide or move inherited widgets for that specific destination.
- Runtime receives a flattened, already-resolved layout for the active destination, so `packages/apps-template-mui` stays simple and configuration-driven.

For the LMS fixture this means:

- The "Home" runtime destination is a configured Page, not a hardcoded route.
- LMS overview cards and charts are visible on the "Home" Page only unless explicitly enabled elsewhere.
- The three-column table container is either removed from the default LMS fixture or moved to a meaningful scoped destination with real seed data.
- Other LMS sections use clean entity-specific content and tables without empty inherited dashboard blocks.

No Metahub schema version or LMS template version bump is planned. Legacy data compatibility is not required because the test database will be recreated.

## Research Inputs

### Local Codebase Findings

Current implementation details that explain the reported behavior:

- `tools/fixtures/metahubs-lms-app-snapshot.json` contains one global layout and no scoped layouts for the LMS pages or sections.
- The global LMS layout has `overviewCards`, `sessionsChart`, `pageViewsChart`, and `columnsContainer` enabled through `layoutConfig` and `zoneWidgets`.
- `columnsContainer` contains three nested `detailsTable` widgets for `ModuleProgress`, `LearningTracks`, and `Enrollments`.
- `packages/apps-template-mui/src/dashboard/components/MainGrid.tsx` renders global overview and chart widgets whenever the selected layout has them enabled.
- `packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx` renders `columnsContainer` recursively from configuration.
- `packages/applications-backend/base/src/controllers/runtimeRowsController.ts` currently selects a layout by `catalog_id = linkedCollectionId` or global fallback. This is semantically too narrow for Page, Hub, Set, Enumeration, and custom Entity destinations.
- `packages/applications-backend/base/src/routes/sync/syncHelpers.ts` currently materializes only catalog-scoped layout overlays into runtime layouts and widgets.
- `packages/metahubs-backend/base/src/domains/layouts/services/MetahubLayoutsService.ts` already has the right inheritance idea, but the naming and persistence are catalog-specific.
- `packages/universo-types/base/src/common/applicationLayouts.ts` already contains `scopeKind: "global" | "entity"`, but layout API fields still expose `linkedCollectionId`. The implementation should finish this generic direction instead of introducing a second scope model.
- Standard Entity type metadata currently enables `components.layoutConfig` for Catalog, Set, Page, and Ledger-style types. Future Entity types can enable the same capability in the Entity constructor, so scope eligibility must be capability-driven rather than based on a hardcoded kind allowlist.

The main reusable pattern already exists: inherited widgets plus sparse overrides. The next step is to generalize it from Catalog-only layouts to Entity-scoped layouts.

### QA Review Addendum

The first draft selected the right high-level architecture, but it needs these stricter implementation constraints:

1. Layout scopes must be driven by `components.layoutConfig.enabled === true`, not by hardcoded Entity kind names.
2. Public layout contracts, snapshot keys, table names, request payload fields, query keys, tests, docs, and UI labels must not retain catalog-specific names for generic layout behavior.
3. `linkedCollectionId` can remain in record, datasource, and table-part APIs where it still means "runtime record collection", but it must not be used as the generic layout scope field.
4. Existing partial `scopeKind` contracts should be completed and renamed consistently instead of duplicated.
5. Persisted generated ids must use the project's UUID v7 path. Deterministic synthetic ids should not be used for newly persisted inherited widget rows.
6. Runtime destination resolution must support menu targets by resolving each menu item to a layout-capable Entity. Direct menu-item-specific layout scope is deferred unless the same Entity must appear in multiple menu entries with different layouts.
7. Backend refactoring must keep Knex limited to DDL/sync boundaries that already own schema work. Domain route handlers, services, and stores should use `DbExecutor.query()` with schema-qualified, parameterized SQL.
8. Browser tests must include visual and semantic assertions that would have caught the current global dashboard leakage and the three empty table modules.

### Product Reference

iSpring Learn is a product reference, not an implementation blueprint.

Relevant patterns from iSpring documentation:

- Administrators can personalize the learner portal navigation and select a start page. This confirms that the "Home" experience should be configuration-driven, not hardcoded.
  Source: https://ispringhelpdocs.com/ispring-learn/navigation-menu-in-the-user-portal-100871437.html
- The Knowledge Base is a user portal module organized into spaces, folders, articles, recent items, bookmarks, search, and permissions. This supports using ordinary configured destinations rather than one global dashboard on every section.
  Source: https://ispringhelpdocs.com/ispring-learn/knowledge-base-128352839.html
- iSpring LMS supports several content types and pages, reinforcing that Page and resource destinations need their own clean layouts.
  Source: https://ispringhelpdocs.com/ispring-learn/ispring-lms-10683320.html

### Library Guidance

Context7 checks confirmed the implementation direction:

- MUI surfaces should use the existing Grid, Card, Data Grid, Dialog, and theme composition patterns instead of custom one-off layout components.
- TanStack Query mutations should use stable query keys, optimistic update snapshots from `onMutate`, rollback in `onError`, and invalidation in `onSettled`.
- Playwright coverage should use locators, web-first assertions, trace/screenshot evidence, and targeted flows rather than brittle DOM timing checks.

## Goals

1. Make widget visibility configurable per layout-capable Entity destination without LMS hardcoding.
2. Generalize existing catalog layout overlays into Entity-scoped layout overlays.
3. Keep global layout as the base source of inherited widgets.
4. Support forward and reverse synchronization:
   - Global widget settings show where a widget is hidden.
   - Scoped Entity layouts show inherited widgets and their local overrides.
5. Make the LMS generated application show dashboard metrics only on intended destinations.
6. Remove or properly scope the three empty table modules in the LMS fixture.
7. Preserve original MUI dashboard visual language from `packages/apps-template-mui` and `.backup/templates/dashboard`.
8. Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` only through the product Playwright generator.
9. Add backend, frontend, unit, integration, and Playwright coverage that catches visually incorrect or illogical runtime states.
10. Update GitBook docs and package README files.

## Non-Goals

1. Do not create LMS-specific runtime routes, widgets, or visibility flags.
2. Do not add a separate dashboard engine.
3. Do not hardcode "Home" in `packages/apps-template-mui`; use menu/start-page and layout metadata.
4. Do not preserve legacy catalog-only layout naming or database compatibility in public contracts, snapshot payloads, database schema definitions, or documentation.
5. Do not add new UI components when existing MUI template surfaces and shared layout editors can be extended.
6. Do not show empty dashboard/table containers in the generated LMS app as accepted behavior.

## Target Architecture

### 1. Generic Layout Scope

Finish the existing partial generic layout scope and replace the remaining catalog-only concept with a capability-driven generic layout scope.

Target shared contract:

```ts
import { z } from 'zod'

export const layoutScopeSchema = z.discriminatedUnion('scopeKind', [
  z.object({
    scopeKind: z.literal('global'),
    scopeEntityId: z.null().optional(),
    scopeEntityKind: z.null().optional()
  }),
  z.object({
    scopeKind: z.literal('entity'),
    scopeEntityId: z.string().uuid(),
    scopeEntityKind: z.string().min(1)
  })
])

export type LayoutScope = z.infer<typeof layoutScopeSchema>
```

Rules:

- `global` layout has no destination Entity.
- `entity` layout targets a concrete Entity instance.
- `entity` layout targets are allowed only when their Entity type has `components.layoutConfig.enabled === true`.
- `scopeEntityKind` is informational and validation-friendly; authorization and data lookup must use the id plus persisted Entity metadata.
- Future scopes such as `workspace`, `role`, or `route` must not be added until the Entity-scoped model proves insufficient.
- If the same Entity later needs two different layouts through two menu entries, add a separate generic `destination` scope in a follow-up plan. Do not couple the V1 persistence model to widget-local menu item ids.

### Naming Cleanup Matrix

The implementation should remove generic layout behavior from catalog-specific names.

| Current name | Target name | Notes |
| --- | --- | --- |
| `catalogLayouts` | `scopedLayouts` | Snapshot/public contract. |
| `catalogLayoutWidgetOverrides` | `layoutWidgetOverrides` | Snapshot/public contract. |
| `_mhb_catalog_widget_overrides` | `_mhb_layout_widget_overrides` | Design-time table. |
| `catalog_layout_id` | `scoped_layout_id` or `layout_id` | Override table column. |
| `catalog_id` on layout tables | `scope_entity_id` | Design-time and runtime layout tables. |
| `linkedCollectionId` in layout APIs | `scopeEntityId` | Keep `linkedCollectionId` only for record-collection APIs. |
| `isCatalogLayout` | `isScopedEntityLayout` | Service/helper naming. |
| `buildCatalogScopeWhereSql` | `buildLayoutScopeWhereSql` | SQL helper naming. |

### 2. Sparse Widget Overrides

Replace `_mhb_catalog_widget_overrides` semantics with a generic override table/contract.

Target override shape:

```ts
export const layoutWidgetOverridePatchSchema = z.object({
  layoutId: z.string().uuid(),
  baseWidgetId: z.string().uuid(),
  isActive: z.boolean().optional(),
  zone: z.string().min(1).optional(),
  sortOrder: z.number().int().min(0).optional()
})
```

Rules:

- Inherited widget config remains owned by the base layout.
- Scoped layouts store only local visibility and placement decisions.
- Config edits on inherited widgets remain blocked unless `sharedBehavior` explicitly allows local configuration.
- Delete on inherited widgets means "hide here", not physical deletion.
- Deleting an owned scoped widget physically removes only that scoped widget.

### 3. Runtime Layout Selection

Runtime should resolve the current destination before loading a layout.

Selection priority:

1. Exact `scopeEntityId` layout.
2. Global active layout.

Root app URL rule:

- If the app is opened at `/a/:appId`, resolve `menuWidget.config.startPage` to its Page or destination Entity.
- Select that Entity-scoped layout when it exists.
- This keeps Home highlighting and Home layout rendering aligned without hardcoded route branches.

Safe SQL example:

```ts
const rows = await executor.query<RuntimeLayoutRow>(
  `
    SELECT id, config
    FROM ${qSchemaTable(runtimeSchema, '_app_layouts')}
    WHERE application_id = $1
      AND (
        scope_entity_id = $2
        OR (scope_kind = 'global' AND scope_entity_id IS NULL)
      )
    ORDER BY CASE WHEN scope_entity_id = $2 THEN 0 ELSE 1 END, created_at DESC
    LIMIT 1
  `,
  [applicationId, scopeEntityId]
)
```

Security rules:

- `runtimeSchema` must come from trusted application metadata.
- Dynamic identifiers must be wrapped with `qSchemaTable`, `qTable`, `qColumn`, or equivalent project helpers.
- User payload must never supply raw table names or SQL identifiers.
- Unknown or inaccessible `scopeEntityId` must fail closed.

### 4. Entity-Scoped Layout Materialization

Publication/application sync should materialize scoped layouts generically:

- Export/import `scopedLayouts`.
- Export/import `layoutWidgetOverrides`.
- Resolve all source ids to target ids during snapshot restore.
- Preserve UUID v7 generation paths for new ids.
- Reject duplicate layout scope rows for the same base layout and Entity.

Suggested uniqueness:

```sql
CREATE UNIQUE INDEX app_layouts_unique_entity_scope
  ON app_schema._app_layouts (base_layout_id, scope_entity_id)
  WHERE scope_kind = 'entity';
```

If the physical database currently uses `catalog_id`, the implementation should rename the concept cleanly to `scope_entity_id` in schema definitions and code. Since the test database will be recreated, do not carry legacy public API names forward.

Persisted inherited widgets must not rely on deterministic non-v7 synthetic ids. Use a stable unique source key and create UUID v7 ids once:

```sql
ALTER TABLE app_schema._app_widgets
  ADD COLUMN source_base_widget_id uuid NULL;

CREATE UNIQUE INDEX app_widgets_unique_inherited_source
  ON app_schema._app_widgets (layout_id, source_base_widget_id)
  WHERE source_base_widget_id IS NOT NULL AND _app_deleted = false;
```

Sync then updates existing inherited rows by `(layout_id, source_base_widget_id)` and inserts a new UUID v7 only when the inherited row does not exist yet.

### 5. Visibility Management UI

Extend the existing layout/widget editing surfaces instead of adding a new LMS-specific screen.

Required UI behavior:

- In the global layout widget editor, add a "Visibility by destination" section.
- The section lists Entities whose Entity type has `components.layoutConfig.enabled === true`, grouped by Entity type and ordered by Entity constructor order.
- Each destination has a switch or checkbox for this widget.
- Turning a destination off automatically creates or updates the destination scoped layout and stores a sparse inherited-widget override.
- Turning it back on removes the unnecessary override; if the scoped layout has no local changes left, it can be deleted or marked empty according to the service contract.
- In a scoped layout editor, inherited widgets show their base origin and can be hidden locally.
- The global layout editor reads all scoped overrides to show reverse state.

Do not create a separate LMS configuration UI for this.

### 6. Published App Rendering

The published runtime should remain data-driven:

- `packages/apps-template-mui` receives the already-resolved `layoutConfig` and `zoneWidgets`.
- It should not implement LMS-specific destination checks.
- It may keep generic defensive behavior: do not render empty widget containers when there are no active child widgets.
- Existing MUI cards, Grid layout, table surfaces, and dashboard styles should be reused.

Generic empty-container guard:

```tsx
const activeColumns = columns
  .map((column) => ({
    ...column,
    widgets: column.widgets.filter((widget) => widget.isActive !== false)
  }))
  .filter((column) => column.widgets.length > 0)

if (activeColumns.length === 0) {
  return null
}
```

This guard is generic and should be covered by tests, but it is not the primary visibility mechanism.

## LMS Fixture Direction

### Home Page

`LearnerHome` remains the configured start page through `menuWidget.config.startPage`.

Create an Entity-scoped layout for the `LearnerHome` Page:

- Inherit from the global Main layout.
- Enable overview cards and chart widgets.
- Keep introductory Page content visible below the dashboard summary.
- Use real localized labels and no demo-only text.

### Other Sections

For Catalog, Knowledge, Development, Reports, and Workspaces:

- Use clean scoped layouts or inherited global layout with dashboard widgets hidden.
- Show only the relevant details table, page content, or report surface.
- Keep active menu highlighting on root and section URLs.
- Do not render the global overview chart block on these sections unless explicitly configured.

### Three-Column Table Container

Current `columnsContainer` behavior is not acceptable because it appears globally and can be empty.

Preferred V1 decision:

- Remove `columnsContainer` from the global LMS layout.
- If the three-column summary is useful, scope it to a Reports or Progress destination and seed real data for all three nested tables.

Acceptance rules:

- No generated LMS section may show three empty table cards in a row.
- If a `columnsContainer` is present, every visible nested table must have a meaningful title and either real rows or a localized intentional empty state.
- The fixture contract must no longer require `columnsContainer` globally.

## Affected Areas

### Shared Types

- `packages/universo-types`
  - Add generic layout scope and widget override schemas.
  - Rename catalog-specific layout types to scoped layout types.
  - Replace layout-specific `linkedCollectionId` fields with `scopeEntityId`; keep record/data-source `linkedCollectionId` fields unchanged.
  - Add migration-safe parsers only if needed during internal refactor.

### Metahubs Backend

- `packages/metahubs-backend/base/src/domains/layouts/services/MetahubLayoutsService.ts`
  - Generalize catalog layout checks to scoped layout checks.
  - Validate that `scopeEntityId` exists and supports layout customization through `components.layoutConfig.enabled`.
  - Add create/update/delete services for widget visibility by destination.
  - Add reverse visibility aggregation for global widget editors.

- Design-time schema definitions:
  - Update `packages/metahubs-backend/base/src/domains/metahubs/services/systemTableDefinitions.ts`.
  - Replace `_mhb_layouts.catalog_id` with `_mhb_layouts.scope_entity_id`.
  - Replace `_mhb_catalog_widget_overrides` with `_mhb_layout_widget_overrides`.
  - Update indexes, foreign keys, and system table tests.

- Template/snapshot code:
  - Replace `catalogLayouts` with `scopedLayouts`.
  - Replace `catalogLayoutWidgetOverrides` with `layoutWidgetOverrides`.
  - Update LMS generator and import/export contracts.
  - Update `packages/metahubs-backend/base/src/domains/shared/snapshotLayouts.ts`.
  - Update `packages/metahubs-backend/base/src/domains/metahubs/services/SnapshotRestoreService.ts`.
  - Update template seed cleanup/migration/executor code that touches `_mhb_layouts`.

### Applications Backend

- Runtime DDL/schema definitions:
  - Replace `catalog_id` layout scope with `scope_entity_id` and `scope_kind`.
  - Add appropriate uniqueness constraints.
  - Add `source_base_widget_id` or equivalent source key to prevent duplicate inherited widget rows while preserving UUID v7 ids.
  - Update system app schema compilation paths that build `_app_layouts` and `_app_widgets`.

- Sync/materialization:
  - Materialize all Entity-scoped layouts, not only Catalog layouts.
  - Resolve source Entity ids safely during snapshot import and app creation.
  - Update `packages/applications-backend/base/src/routes/sync/syncHelpers.ts`.
  - Update `packages/applications-backend/base/src/routes/sync/syncLayoutPersistence.ts`.
  - Update `packages/applications-backend/base/src/persistence/applicationLayoutsStore.ts`.

- Runtime rows controller:
  - Resolve active destination Entity from route/menu state.
  - Load exact scoped layout first, then global fallback.
  - Keep all SQL parameterized and schema-qualified.
  - Update `packages/applications-backend/base/src/controllers/runtimeRowsController.ts`.

### Applications Frontend

- Application layout settings:
  - Replace catalog-specific labels with Entity-scoped labels.
  - Add widget visibility by destination in existing widget editing flows.
  - Use metadata-backed Entity pickers and grouping.
  - Use TanStack Query mutation rollback/invalidation for all layout visibility writes.

Optimistic mutation example:

```ts
const mutation = useMutation({
  mutationFn: saveWidgetVisibility,
  onMutate: async (patch) => {
    await queryClient.cancelQueries({ queryKey: layoutVisibilityQueryKey(layoutId) })
    const previous = queryClient.getQueryData(layoutVisibilityQueryKey(layoutId))

    queryClient.setQueryData(layoutVisibilityQueryKey(layoutId), (current) =>
      applyVisibilityPatch(current, patch)
    )

    return { previous }
  },
  onError: (_error, _patch, context) => {
    queryClient.setQueryData(layoutVisibilityQueryKey(layoutId), context?.previous)
  },
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: layoutVisibilityQueryKey(layoutId) })
  }
})
```

### Apps Template MUI

- Keep rendering generic and configuration-driven.
- Add generic empty-container guards where current widget composition can render visually empty blocks.
- Preserve MUI dashboard styling from the original template.
- Add tests proving that hidden widgets are not rendered for non-Home LMS sections.

### Test Fixtures and Product Generator

- Update `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`.
- Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json`.
- Update `tools/testing/e2e/support/lmsFixtureContract.ts`:
  - Require scoped Home dashboard widgets.
  - Reject global overview/chart/columns dashboard widgets when they are not intentionally global.
  - Reject empty three-column dashboard modules in imported runtime smoke checks.

### Documentation

- `docs/en/guides/application-layouts.md`
- `docs/ru/guides/application-layouts.md`
- `docs/en/guides/catalog-layouts.md` or a new `entity-layouts.md`
- `docs/ru/guides/catalog-layouts.md` or a new `entity-layouts.md`
- `docs/en/architecture/lms-entities.md`
- `docs/ru/architecture/lms-entities.md`
- `docs/en/guides/lms-setup.md`
- `docs/ru/guides/lms-setup.md`
- Relevant package README files.

## Implementation Phases

### Phase 0. Baseline Audit

Objective: capture current behavior before code changes.

Tasks:

1. Record current layout and widget counts from the LMS fixture.
2. Record current runtime behavior:
   - Root app URL.
   - Home Page.
   - Catalog section.
   - Knowledge section.
   - Reports section.
3. Capture Playwright screenshots on port 3100 when the local test runner is available.
4. Search for remaining catalog-only layout semantics:
   - `catalogLayouts`
   - `catalogLayoutWidgetOverrides`
   - `catalog_id`
   - `isCatalogLayout`
   - `_mhb_catalog_widget_overrides`
   - layout API/query-key `linkedCollectionId`
5. Confirm that "Home" is driven by `menuWidget.config.startPage`.

Deliverable:

- Short implementation note added to the working PR or progress entry with file references and baseline screenshots.

### Phase 1. Shared Contract Refactor

Objective: define the generic scoped layout contract.

Tasks:

1. Add `LayoutScope`, `ScopedLayout`, and `LayoutWidgetOverride` schemas in `packages/universo-types`.
2. Replace catalog-specific snapshot/runtime type names with scoped names.
3. Rename layout API fields from `linkedCollectionId` to `scopeEntityId` while keeping `linkedCollectionId` in record/datasource APIs.
4. Update snapshot hashing/normalization code that currently knows about `catalogLayouts` and `catalogLayoutWidgetOverrides`.
5. Add contract tests for:
   - Global scope.
   - Entity scope.
   - Entity type with `components.layoutConfig.enabled === true`.
   - Entity type with `components.layoutConfig` disabled.
   - Invalid ids.
   - Duplicate scope rejection.
   - Unknown future Entity kinds.
6. Keep i18n keys generic: "Entity layout", "Scoped layout", "Visibility by destination".

Acceptance:

- No new LMS-specific type appears in shared layout contracts.
- Type tests prove custom Entity kinds are accepted when metadata is valid.
- Type tests prove layout-disabled Entity types are rejected by service-level validation.

### Phase 2. Metahub Layout Service Generalization

Objective: make design-time layouts scope to any Entity.

Tasks:

1. Rename catalog layout service helpers to scoped layout helpers.
2. Validate target Entity existence through the Entity constructor metadata and `components.layoutConfig.enabled`, not hardcoded kind lists.
3. Implement sparse inherited widget overrides for any scoped Entity layout.
4. Add reverse aggregation API:
   - Given `baseWidgetId`, return all destinations where visibility or placement differs.
5. Add transaction-level locking for concurrent edits.
6. Update route/controller copy and response payloads so layout endpoints expose `scopeEntityId`, not `linkedCollectionId`.

Safe concurrency example:

```ts
await executor.query(
  'SELECT pg_advisory_xact_lock(hashtext($1))',
  [`layout:${metahubId}:${baseLayoutId}:${scopeEntityId}`]
)
```

Acceptance:

- A Page can get its own inherited layout overlay.
- A Catalog can still get the same behavior as before through the generic path.
- The global widget editor can detect that a widget is hidden on a Page.

### Phase 3. Snapshot Import/Export and App Sync

Objective: preserve scoped layouts from Metahub to application runtime.

Tasks:

1. Update snapshot export:
   - `scopedLayouts`
   - `layoutWidgetOverrides`
2. Update snapshot import id remapping for scoped layout targets.
3. Update application sync/materialization:
   - Create runtime scoped layouts for all Entity targets.
   - Flatten inherited widget states into `_app_widgets`.
4. Replace deterministic synthetic persisted inherited-widget ids with UUID v7 insert-once semantics plus unique source keys.
5. Add duplicate id and duplicate scope guards.
6. Update fixture contract to reject obsolete global LMS dashboard inheritance.
7. Update snapshot hash tests in `packages/universo-utils` so scoped layouts affect publication hashes deterministically.

Acceptance:

- Importing the generated LMS snapshot on a clean database creates Home Page scoped layout.
- Application schema sync preserves the Page scoped layout into runtime.
- No duplicated widget ids or unresolved source ids are present after import.
- Persisted inherited widget ids are UUID v7 ids created by the project id helper or database default.

### Phase 4. Runtime Destination Resolution

Objective: select the correct layout for the active destination.

Tasks:

1. Resolve destination Entity for:
   - Root app URL through `menuWidget.config.startPage`.
   - Page menu item.
   - Linked collection menu item.
   - Workspace page.
2. Replace catalog-only layout selection with generic `scopeEntityId` selection.
3. Keep fallback to the active global layout.
4. Add fail-closed checks for inaccessible or unpublished targets.
5. Treat menu items as navigation projections over Entity destinations in V1. Do not store menu-widget ids as durable layout scope ids unless a separate generic destination-scope design is approved.

Acceptance:

- Root app URL highlights Home and uses Home scoped layout.
- Home URL uses the same Home scoped layout.
- Catalog URL does not inherit Home dashboard widgets.
- Unknown section falls back safely or returns controlled error according to current runtime behavior.

### Phase 5. Layout Editor UX

Objective: expose widget visibility without adding a parallel UI.

Tasks:

1. Extend the existing widget behavior editor with "Visibility by destination".
2. Group destinations by Entity type ordered by Entity constructor settings.
3. Use localized Entity names and codenames according to existing connector label settings where applicable.
4. Add searchable destination list for large Metahubs.
5. Implement forward write path:
   - Toggle hidden in global editor.
   - Auto-create scoped layout and override.
6. Implement reverse read path:
   - Scoped layout hidden state appears in global widget editor.
7. Add empty-state copy and error messages through `packages/universo-i18n`.

Acceptance:

- User can hide a global widget on `LearnerHome` or on any Catalog/Page without leaving the layout editor.
- User can hide a global widget on any Entity whose type enables layout configuration, including future custom types.
- User can open a scoped Page layout and see inherited widgets.
- UI uses existing MUI Dialog/List/Card/DataGrid styles.

### Phase 6. Runtime Widget Rendering Hardening

Objective: prevent visually empty inherited containers from degrading the app.

Tasks:

1. Add generic guard for `columnsContainer` with zero active child widgets.
2. Add generic guard for child table widgets configured with missing datasource sections.
3. Keep intentional empty data states localized and visually consistent.
4. Do not hide valid empty tables if the section itself is the primary details table.

Acceptance:

- Empty inherited dashboard containers do not render.
- Details tables still show a proper empty state when the user is intentionally viewing an empty record collection.

### Phase 7. LMS Fixture Rebuild

Objective: make the generated LMS app demonstrate the scoped visibility model.

Tasks:

1. Update LMS template/generator:
   - Global layout: app shell and generic details surfaces only.
   - `LearnerHome` Page scoped layout: overview cards and charts enabled.
   - Non-Home destinations: dashboard widgets hidden by scoped overrides or not inherited as active.
2. Decide `columnsContainer` placement:
   - Remove from V1 LMS if no product-critical use remains.
   - Or scope it to Reports/Progress with real seeded data and clear titles.
3. Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` only through Playwright.
4. Update `lmsFixtureContract.ts` accordingly.

Acceptance:

- Fresh import and app creation immediately show Home dashboard widgets only on Home.
- Catalog, Knowledge, Development, and Reports do not show the global overview block.
- No three empty modules appear in non-Home sections.

### Phase 8. Tests

Objective: prevent a repeat of visually obvious product regressions.

Unit and contract tests:

1. `packages/universo-types`:
   - scoped layout schema parsing.
   - override patch validation.
   - custom Entity kind compatibility.
2. `packages/metahubs-backend`:
   - scoped layout creation for Page and Catalog.
   - inherited widget hide/show.
   - reverse visibility aggregation.
   - sharedBehavior enforcement.
3. `packages/applications-backend`:
   - snapshot scoped layout import/export.
   - runtime scoped layout selection.
   - root URL start page destination resolution.
   - duplicate scope/id rejection.
4. `packages/applications-frontend`:
   - visibility by destination editor.
   - optimistic update rollback.
   - localized destination names.
5. `packages/apps-template-mui`:
   - Home renders scoped dashboard widgets.
   - Catalog does not render Home dashboard widgets.
   - empty `columnsContainer` does not render.

Playwright tests:

1. Regenerate LMS fixture through the product generator.
2. Import snapshot into a clean test database.
3. Create an application and sync schema.
4. Open root app URL:
   - Home menu is active.
   - overview cards and charts are visible.
   - no `[object Object]`.
   - screenshot captured.
5. Open Home explicit URL:
   - same layout as root.
6. Open Catalog:
   - Catalog menu is active.
   - Home overview widgets are absent.
   - no three empty modules.
   - no meaningless table blocks such as `0-0 of 0` outside intentional details table.
   - screenshot captured.
7. Open Knowledge, Development, Reports:
   - same absence checks.
   - report-specific widgets only where configured.
8. Open layout editor:
   - hide a widget for one destination.
   - save.
   - verify reverse visibility in global widget editor.
9. Create or use a custom layout-capable Entity type in a focused authoring flow:
   - create an instance,
   - hide a global widget for it,
   - verify no catalog-specific labels or payload fields are exposed in the UI.

Low-overhead "product sanity" browser assertion:

```ts
await expect(page.getByText('[object Object]')).toHaveCount(0)
await expect(page.getByTestId('dashboard-overview-section')).toBeHidden()
await expect(page.getByTestId('empty-columns-container')).toHaveCount(0)
```

The final selectors should use stable test ids only where they represent real UI contracts. Prefer visible names and roles for user-facing flows.

### Phase 9. Documentation

Objective: document the new layout model and LMS usage.

Tasks:

1. Update GitBook docs:
   - Entity-scoped layouts.
   - Widget visibility by destination.
   - Application runtime layout selection.
   - LMS Home dashboard setup.
2. Update Russian docs with equivalent content.
3. Update package READMEs:
   - `packages/metahubs-backend/base/README.md`
   - `packages/applications-backend/base/README.md`
   - `packages/applications-frontend/base/README.md`
   - `packages/apps-template-mui/README.md`
4. Add screenshots captured from Playwright after implementation.

Acceptance:

- Docs explain why the same global widget no longer appears on every section.
- Docs show how an administrator can hide/show widgets per Entity destination.
- LMS setup docs describe Home as a configured Page with a scoped layout.

### Phase 10. Validation

Recommended targeted checks:

```bash
git diff --check
pnpm --filter @universo/types test -- layoutScope
pnpm --filter @universo/metahubs-backend test -- MetahubLayoutsService snapshotLayouts
pnpm --filter @universo/applications-backend test -- syncLayoutMaterialization runtimeRowsController
pnpm --filter @universo/applications-frontend test -- ApplicationWidgetBehaviorEditorDialog ApplicationLayouts
pnpm --filter @universo/apps-template-mui test -- MainGrid widgetRenderer DashboardApp
node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts
node tools/testing/e2e/run-playwright-suite.mjs flows/snapshot-import-lms-runtime.spec.ts
```

Use package-level lint/build checks for the changed packages. Run full root build only when the user explicitly starts the rebuild or approves it.

## Acceptance Matrix

| Area | Acceptance criterion |
| --- | --- |
| Architecture | No LMS-specific widget visibility code exists in runtime. |
| Scope model | Any Entity destination can have a scoped layout overlay. |
| Capability gate | Only Entity types with `components.layoutConfig.enabled` can be selected as layout destinations. |
| Naming | Generic layout contracts no longer expose catalog-specific names. |
| Inheritance | Scoped layouts inherit base widgets and store sparse overrides only. |
| Reverse state | Global widget editor shows destinations where the widget is hidden. |
| Runtime | Root app URL resolves to the configured start page and scoped layout. |
| LMS Home | Overview cards and charts render on Home only by configuration. |
| LMS sections | Catalog, Knowledge, Development, Reports do not show Home dashboard widgets. |
| Columns | Three empty table modules never appear after fresh LMS app creation. |
| Snapshot | LMS snapshot is regenerated by Playwright, not manually edited. |
| UUIDs | New persisted layout/widget ids use UUID v7 and inherited widget rows are deduplicated by source keys. |
| Security | SQL is parameterized and identifier-safe; invalid scope ids fail closed. |
| Tests | Unit, backend, frontend, and Playwright tests cover scoped visibility and UX sanity. |
| Docs | GitBook and package README docs are updated in EN/RU where applicable. |

## Risks and Mitigations

### Risk: Refactor touches many packages

Mitigation:

- Keep the first implementation focused on Entity-scoped layouts and widget visibility.
- Avoid role/workspace/condition scopes in V1.
- Use existing overlay behavior rather than inventing a new layout engine.

### Risk: Snapshot contract churn

Mitigation:

- Update generator, fixture, importer, exporter, and contract tests in the same phase.
- Because the database will be recreated and no schema version bump is needed, remove catalog-only snapshot names cleanly instead of preserving a long compatibility tail.

### Risk: UI becomes too complex

Mitigation:

- Keep visibility controls inside the existing widget editor.
- Use grouped searchable destinations.
- Do not add per-widget custom LMS screens.

### Risk: Runtime hidden-widget behavior drifts from authoring UI

Mitigation:

- Backend materializes flattened runtime layouts from the same override source.
- Playwright verifies actual browser behavior after creating an application from the generated snapshot.

### Risk: Empty data looks like broken UI

Mitigation:

- Add product sanity assertions for unexpected empty dashboard containers.
- Seed meaningful records for every visible dashboard/report widget or remove/scope the widget.

## Approval Gate

Before IMPLEMENT, confirm these decisions:

1. Rename catalog-scoped layout contracts to generic scoped layout contracts in place.
2. Use Entity-scoped layout overlays as the V1 visibility mechanism.
3. Remove the LMS `columnsContainer` from the global layout and only keep it if it is scoped to a meaningful destination with seed data.
4. Regenerate the LMS snapshot exclusively through the product Playwright generator.
