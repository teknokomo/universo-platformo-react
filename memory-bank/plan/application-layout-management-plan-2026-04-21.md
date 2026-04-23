# Application Layout Management Plan (2026-04-21)

## Overview

Add first-class application-side layout management. Application admins must be able to inspect, customize, deactivate, delete, copy, and create layouts inside the application control panel while preserving the published metahub layout lineage and making connector sync conflicts explicit.

The existing implementation publishes metahub layouts into the application runtime schema tables `_app_layouts` and `_app_widgets`. The current sync path treats those rows as a pure projection of the publication snapshot: it updates rows by id, clears current defaults, and deletes rows that are missing from the new snapshot. That is correct for a read-only projection, but it is unsafe once applications can own local layout changes.

The new model should make `_app_layouts/_app_widgets` the application-owned runtime layout store, with explicit provenance and source baseline metadata for metahub-origin rows. Sync should become a policy-driven merge instead of unconditional replacement.

## Current Code Findings

- Metahub layout UI lives in `packages/metahubs-frontend/base/src/domains/layouts/ui/LayoutList.tsx` and `LayoutDetails.tsx`.
- Metahub layout backend lives in `packages/metahubs-backend/base/src/domains/layouts/services/MetahubLayoutsService.ts` and routes under `/api/v1/metahub/:metahubId/layout...`.
- Publication snapshot layout export is attached in `packages/metahubs-backend/base/src/domains/shared/snapshotLayouts.ts`.
- Application runtime materialization happens in `packages/applications-backend/base/src/routes/sync/syncLayoutPersistence.ts`.
- Runtime layout normalization and catalog-layout flattening happen in `packages/applications-backend/base/src/routes/sync/syncHelpers.ts`.
- Application runtime layout tables are created by `packages/schema-ddl/base/src/SchemaGenerator.ts`.
- Application admin menu and pages live in `packages/applications-frontend/base/src/menu-items/applicationDashboard.ts` and `packages/universo-core-frontend/base/src/routes/MainRoutes.tsx`.
- Sync diff UI currently only reports coarse markers: `ui.layout.update`, `ui.layouts.update`, and `ui.layout.zones.update`.
- No existing application admin page exposes `_app_layouts/_app_widgets` as editable layout resources.

## Design Decision

Use an explicit lineage model on application runtime layout rows:

- `source_kind`: `metahub` or `application`.
- `source_layout_id`: original metahub snapshot layout id for imported layouts, null for app-created layouts.
- `source_snapshot_hash`: publication snapshot hash that last wrote the imported baseline.
- `source_content_hash`: stable hash of the imported layout plus its widgets at the last accepted baseline.
- `local_content_hash`: stable hash of the current app-side layout plus widgets.
- `sync_state`: `clean`, `local_modified`, `source_updated`, `conflict`, `source_removed`, `source_excluded`.
- `is_source_excluded`: local exclusion marker for imported layouts that were deleted from the application by an admin.
- `source_deleted_at` / `source_deleted_by`: optional tombstone metadata when a source layout disappears or is locally excluded but the app keeps lineage for future sync decisions.

This avoids guessing whether a row is user-modified by comparing timestamps only. A row is locally modified when `local_content_hash !== source_content_hash` after normalizing fields that belong to the editable layout contract.

The application should keep the current runtime row id for imported layouts where possible so existing runtime references remain stable. App-created layouts use database UUID v7 (`public.uuid_generate_v7()` on backend insert or default table values).

## Creative UI Outcome

The UI design pass compared three options:

- A dedicated Application Admin `Layouts` section.
- A `Layouts` tab inside `ApplicationSettings`.
- A layout section inside `ConnectorBoard`.

The chosen option is a dedicated section:

```txt
/a/:applicationId/admin/layouts
/a/:applicationId/admin/layouts/:layoutId
```

This matches the existing application admin page model and keeps layouts as a real managed entity instead of overloading settings or connector sync screens. The sync dialog should still include a dedicated layout conflict decision block, but day-to-day layout management belongs in the new application-level section.

## Affected Areas

- `packages/schema-ddl/base`
  - Extend runtime system table DDL for `_app_layouts` and `_app_widgets`.
  - Add idempotent repair/ensure logic because clean test databases are expected, but sync must still tolerate partially-created schemas.
- `packages/applications-backend/base`
  - Add application layout domain routes, controller, service/store modules.
  - Replace unconditional layout sync persistence with merge-aware policy handling.
  - Expand diff payloads with structured layout conflicts and sync resolution choices.
- `packages/applications-frontend/base`
  - Add Application Admin `Layouts` route and menu item.
  - Add API hooks/mutations for application layouts.
  - Extend connector diff dialog with layout conflict resolution controls.
- `packages/universo-template-mui/base`
  - Extract domain-neutral layout list/detail shell components from metahubs frontend.
  - Keep metahub/application API wiring in consumer packages.
- `packages/universo-types/base`
  - Add shared DTOs and Zod schemas for application layout provenance, sync policy, conflict summaries, and layout mutation payloads.
- `packages/universo-utils/base`
  - Add stable layout hash helpers and lineage normalization helpers.
- `packages/universo-i18n/base` and package-local i18n resources
  - Add EN/RU keys for shared source badges and application layout UI.
- `packages/universo-core-frontend/base`
  - Wire lazy route for the new application layouts page.
- `packages/apps-template-mui`
  - Verify runtime continues consuming active/default application layout rows without metahub-only assumptions.
- `docs/en`, `docs/ru`
  - Update GitBook platform/guides/architecture pages and summaries.
- `tools/testing/e2e`
  - Add Playwright proof with screenshots for application layout management and conflict sync.

## Implementation Plan

### Phase 1 — Shared Contracts And Hashing

- [ ] Add shared types in `@universo/types`, for example:

```ts
export type ApplicationLayoutSourceKind = 'metahub' | 'application'
export type ApplicationLayoutSyncState =
    | 'clean'
    | 'local_modified'
    | 'source_updated'
    | 'conflict'
    | 'source_removed'
    | 'source_excluded'
export type ApplicationLayoutSyncResolution =
    | 'overwrite_local'
    | 'keep_local'
    | 'copy_source_as_application'
    | 'skip_source'
```

- [ ] Add DTOs for:
  - application layout list/detail rows;
  - application layout widget rows;
  - eligible layout scopes for the application runtime schema;
  - structured layout sync diff items;
  - sync request `layoutResolutionPolicy`.
- [ ] Add Zod schemas for every public payload and response used by the new routes. Keep runtime response schemas aligned with `apps-template-mui` expectations so the application admin API cannot store widget configs that the published runtime cannot parse.
- [ ] Add `normalizeApplicationLayoutForHash(...)` and `hashApplicationLayoutContent(...)` in `@universo/utils`.
- [ ] Include both layout row fields and widget rows in the hash. Exclude volatile fields: versions, timestamps, user ids, `sync_state`, and source markers.
- [ ] Use canonical stable serialization and plain sanitized objects only. Do not hash raw database rows or fields with unstable ordering.

Example hash input shape:

```ts
{
  layout: {
    linkedCollectionId,
    templateKey,
    name,
    description,
    config,
    isActive,
    isDefault,
    sortOrder
  },
  widgets: widgets.map(({ zone, widgetKey, sortOrder, config }) => ({ zone, widgetKey, sortOrder, config }))
}
```

### Phase 2 — Runtime Schema Support

- [ ] Extend `_app_layouts` in `SchemaGenerator.ts` with provenance and hash columns:
  - `source_kind TEXT NOT NULL DEFAULT 'metahub'`
  - `source_layout_id UUID NULL`
  - `source_snapshot_hash TEXT NULL`
  - `source_content_hash TEXT NULL`
  - `local_content_hash TEXT NULL`
  - `sync_state TEXT NOT NULL DEFAULT 'clean'`
  - `is_source_excluded BOOLEAN NOT NULL DEFAULT false`
  - `source_deleted_at TIMESTAMPTZ NULL`
  - `source_deleted_by UUID NULL`
- [ ] Extend `_app_widgets` with:
  - `is_active BOOLEAN NOT NULL DEFAULT true`
  - `source_widget_id UUID NULL`
  - `source_content_hash TEXT NULL`
  - `local_content_hash TEXT NULL`
- [ ] Add indexes:
  - `(source_kind, source_layout_id)`
  - `(sync_state)`
  - `(catalog_id, source_kind)`
- [ ] Add database constraints for enum-like fields where the runtime DDL boundary can do so safely:
  - `source_kind IN ('metahub', 'application')`
  - `sync_state IN ('clean', 'local_modified', 'source_updated', 'conflict', 'source_removed', 'source_excluded')`
- [ ] Add partial unique indexes that preserve runtime invariants at the database boundary:
  - one active default layout per scope;
  - no duplicate active widget assignment where the widget registry marks a widget as single-instance for a zone.
- [ ] Add idempotent runtime repair helpers in the application DDL boundary, not in route handlers.
- [ ] Update runtime loaders and persistence to treat `_app_widgets.is_active` as first-class state. The current runtime schema only stores active materialized widgets; application editing requires preserving inactive widgets so admins can disable and later re-enable them without losing config.
- [ ] Do not increase metahub template version or schema version for existing test data. The implementation can assume fresh DB creation, but the DDL repair path keeps runtime sync robust.

### Phase 3 — Backend Application Layout Domain

- [ ] Create `packages/applications-backend/base/src/services/applicationLayoutsService.ts`.
- [ ] Create SQL-first persistence helpers under `persistence/applicationLayoutsStore.ts`.
- [ ] Add controller/routes:
  - `GET /api/v1/applications/:applicationId/layout-scopes`
  - `GET /api/v1/applications/:applicationId/layouts`
  - `POST /api/v1/applications/:applicationId/layouts`
  - `GET /api/v1/applications/:applicationId/layouts/:layoutId`
  - `PATCH /api/v1/applications/:applicationId/layouts/:layoutId`
  - `DELETE /api/v1/applications/:applicationId/layouts/:layoutId`
  - `POST /api/v1/applications/:applicationId/layouts/:layoutId/copy`
  - `GET /api/v1/applications/:applicationId/layouts/:layoutId/zone-widgets`
  - `GET /api/v1/applications/:applicationId/layouts/:layoutId/zone-widgets/catalog`
  - `PUT /api/v1/applications/:applicationId/layouts/:layoutId/zone-widget`
  - `PATCH /api/v1/applications/:applicationId/layouts/:layoutId/zone-widgets/move`
  - `PATCH /api/v1/applications/:applicationId/layouts/:layoutId/zone-widget/:widgetId/config`
  - `PATCH /api/v1/applications/:applicationId/layouts/:layoutId/zone-widget/:widgetId/toggle-active`
  - `DELETE /api/v1/applications/:applicationId/layouts/:layoutId/zone-widget/:widgetId`
- [ ] Frontend API wrappers should follow the existing `apiClient` convention and omit the `/api/v1` prefix in local path strings, because `apiClient` already sets `baseURL: '/api/v1'`.
- [ ] Implement `GET /layout-scopes` from runtime `_app_objects`, returning:
  - global scope;
  - active runtime objects whose normalized component manifest has `layoutConfig.enabled === true`;
  - localized name/codename/table metadata for selectors and filters.
- [ ] Keep the database column contract as `catalog_id` for the first implementation, but expose neutral DTO names such as `scopeId`, `scopeKind`, and `linkedCollectionId` in APIs/UI. Do not rename the runtime column as part of this feature; that would expand the migration surface without improving the application admin experience.
- [ ] If the application schema is not created yet, layout routes must fail closed with a typed response, and the UI must show an empty/disabled state directing admins to connector schema sync.
- [ ] Reuse application admin role guard: owners/admins can manage layouts; editors/members can read only if current application policy allows it.
- [ ] Preserve layout invariants:
  - exactly one default active layout per scope;
  - cannot deactivate/delete the last active layout in a scope;
  - catalog-scoped layout must reference an existing runtime object/section;
  - widget key/zone validation must use `DASHBOARD_LAYOUT_WIDGETS`;
  - widget config validation must use the same schemas and allow-lists as runtime rendering, including nested `columnsContainer` child widgets.
- [ ] Use optimistic concurrency for editor mutations. Include `_upl_version` in detail responses and require `expectedVersion` or an equivalent conditional update for PATCH/DELETE/move/toggle flows so two admins cannot silently overwrite each other.
- [ ] Wrap multi-row layout mutations in one request-scoped transaction and acquire a transaction-scoped advisory lock for the affected application layout or scope before changing default flags, widget ordering, or source lineage. Use the existing database lock helper pattern from `@universo/utils/database`.
- [ ] Use schema-qualified, parameterized SQL for runtime schema access:

```ts
const table = qSchemaTable(schemaName, '_app_layouts')
await executor.query(
  `UPDATE ${table}
   SET is_active = $1,
       _upl_updated_at = NOW(),
       _upl_updated_by = $2,
       _upl_version = _upl_version + 1
   WHERE id = $3
     AND _upl_deleted = false
     AND _app_deleted = false
   RETURNING id`,
  [isActive, userId, layoutId]
)
```

- [ ] Recompute `local_content_hash` and `sync_state` after every layout/widget mutation inside the same transaction.
- [ ] Imported layout deletion is not the same operation as app-owned layout deletion:
  - app-owned layouts use ordinary soft delete;
  - metahub-origin layouts become local source exclusions (`is_source_excluded=true`, `sync_state='source_excluded'`) so later sync does not silently resurrect them.

### Phase 4 — Merge-Aware Layout Sync

- [ ] Replace `persistPublishedLayouts(...)` and `persistPublishedWidgets(...)` with a merge-aware function:
  - normalize source snapshot layouts/widgets;
  - load current app layouts/widgets;
  - compute source content hashes;
  - classify each source layout as new, unchanged, source-updated, local-modified, conflict, or source-removed;
  - apply only according to the selected resolution policy.
- [ ] Run the full layout merge inside the same transaction as connector schema sync and use an application-scoped advisory lock. A connector sync and an application layout edit must not interleave between diff classification and persistence.
- [ ] Recompute the layout diff immediately before applying `POST /sync`. If the current app state no longer matches the diff shown to the admin, fail closed with a typed stale-diff response and require the UI to refresh the diff.
- [ ] Default policy for non-conflicting sync:
  - new source layout: import as `source_kind='metahub'`;
  - clean source layout update: overwrite app row and update source baseline;
  - app-created layout: preserve;
  - source-excluded layout: do not restore unless the sync request explicitly chooses a restore/overwrite policy for that source layout;
  - source-removed layout with no local changes: soft-delete the imported row and mark its final state as `source_removed`;
  - source-removed layout with local changes: preserve the current row as an application-owned layout, clear default status if another default is needed, and keep previous source metadata only in audit/release metadata rather than active source matching fields.
- [ ] Detect default collisions as structured layout conflicts. A new or updated metahub default layout for a scope must not silently replace an application-selected default when that scope already has an app-created or locally modified default. Recommended resolution is `copy_source_as_application` with the imported copy non-default, unless the admin explicitly chooses `overwrite_local`.
- [ ] Conflict policy options:
  - `overwrite_local`: source wins, app customizations are replaced;
  - `keep_local`: app wins, baseline metadata updates only if explicitly accepted;
  - `copy_source_as_application`: keep app row and insert the new metahub version as an app-owned copy with a new UUID v7;
  - `skip_source`: leave current app state unchanged and keep sync warning open.
- [ ] Do not expose `overwrite_local` as a one-click bulk default for conflict groups. It may be selected per conflict only; safe bulk actions may use `keep_local`, `copy_source_as_application`, or `skip_source`.
- [ ] Treat `skip_source` as an explicit warning state, not a silent no-op. The sync response should keep a layout warning/conflict entry so admins can revisit the skipped source update later.
- [ ] Store conflict decisions in the sync response and persist the chosen decisions in migration metadata when a migration record exists. For meta-only sync paths without a migration record, persist the decision summary in installed release metadata so later audits can explain why application layout state differs from the publication baseline.
- [ ] Pass `snapshotHash` into layout merge persistence. Baseline metadata cannot be maintained correctly if the layout persistence function only receives the snapshot body.
- [ ] Change layout diff comparison to ignore lineage columns when deciding user-visible content differences, and to include lineage/sync state only in structured `layoutChanges`.
- [ ] Make `GET /application/:applicationId/diff` return structured `layoutChanges`:

```ts
{
  type: 'LAYOUT_CONFLICT',
  scope: 'global',
  sourceLayoutId: '...',
  applicationLayoutId: '...',
  sourceKind: 'metahub',
  currentSyncState: 'local_modified',
  recommendedResolution: 'copy_source_as_application',
  title: { en: 'Dashboard', ru: 'Панель' }
}
```

- [ ] Extend `POST /application/:applicationId/sync` request schema:

```ts
{
  confirmDestructive?: boolean,
  layoutResolutionPolicy?: {
    default?: ApplicationLayoutSyncResolution,
    bySourceLayoutId?: Record<string, ApplicationLayoutSyncResolution>
  }
}
```

- [ ] Continue failing closed for DDL-destructive schema changes. Layout conflicts should not be hidden inside `confirmDestructive`.
- [ ] Make sync idempotent by source layout id and snapshot hash. Retrying the same sync request after a network failure must not create duplicate app-owned copies for `copy_source_as_application`.

### Phase 5 — Shared UI Extraction

- [ ] Keep extraction minimal and evidence-driven:
  - first reuse existing `@universo/template-mui` primitives (`ItemCard`, `FlowListTable`, `ToolbarControls`, `EntityFormDialog`, `ConfirmDeleteDialog`, `ViewHeaderMUI`, `PaginationControls`);
  - extract only layout-specific pieces that are currently trapped in `metahubs-frontend` and are needed by both metahub and application layout screens;
  - avoid creating parallel replacements for existing generic cards, tables, dialogs, pagination, or toolbar controls.
- [ ] Move reusable layout UI pieces from `packages/metahubs-frontend` to `packages/universo-template-mui`, keeping domain-specific API hooks out of the shared package:
  - layout list/card/table presentational components;
  - layout form fields;
  - layout source/status badge component;
  - zone editor shell;
  - sortable widget chip and zone column;
  - widget editor dialog shells where they are domain-neutral.
- [ ] Keep metahub-specific wrappers in `metahubs-frontend`:
  - API calls under `/metahub/...`;
  - permission mapping from metahub permissions;
  - navigation path builders.
- [ ] Add application-specific wrappers in `applications-frontend`:
  - API calls under `/applications/:applicationId/layouts`;
  - permission mapping from application role/details;
  - application route path builders.
- [ ] Avoid placing business wording in `@universo/template-mui`; pass labels, tooltips, and i18n keys from consumers.
- [ ] Preserve accessibility behavior during extraction: keyboard sorting/focus management where already present, aria labels for icon-only actions, and visible disabled/error states for locked conflict decisions.

### Phase 6 — Application Admin UI

- [ ] Add `ApplicationLayouts.tsx` page and export it from `@universo/applications-frontend`.
- [ ] Add `applicationsQueryKeys.layouts(...)`, `layoutDetail(...)`, `layoutScopes(...)`, and `layoutZoneWidgets(...)` factories plus invalidation helpers. Mutations must invalidate layout lists/details, connector diff, runtime previews, and migration status where affected.
- [ ] Add menu entry:
  - id: `layouts`
  - title: `menu:layouts`
  - url: `/layouts`
  - icon: `IconLayoutDashboard`
- [ ] Add core route:
  - `/a/:applicationId/admin/layouts`
  - `/a/:applicationId/admin/layouts/:layoutId`
- [ ] UI behavior:
  - show cards/table using the same view preference pattern as metahub layouts;
  - show `Metahub` / `Application` source chips on cards and rows;
  - show `Modified`, `Conflict`, `Source removed`, `Clean` state chips;
  - show scope: global or linked collection/entity;
  - allow create app layout, copy any layout as application layout, edit, set default, toggle active, delete/deactivate;
  - keep source-origin rows editable but visibly traced to the metahub source;
  - show source details in the detail header and widget editor.
- [ ] Add a schema-not-created state for the layouts page. It should not show broken empty layout CRUD when `_app_layouts` does not exist yet.
- [ ] Add scope selector support backed by `GET /layout-scopes`, not by client-side inference from unrelated runtime table payloads.
- [ ] Add sync conflict panel to `ConnectorDiffDialog`:
  - list layout conflicts grouped by global and entity-specific scopes;
  - default recommendation: `copy_source_as_application` when both sides changed;
  - require explicit resolution for conflicts before the sync button becomes enabled;
  - allow bulk choice with per-layout overrides.
- [ ] Handle stale conflict decisions in the UI. If sync returns a stale-diff response, clear selected resolutions, refresh `applicationDiff`, and show an i18n error state instead of retrying with old decisions.

### Phase 7 — Runtime Integration

- [ ] Verify `runtimeRowsController.ts` and `apps-template-mui` runtime selection reads only active/default application layout rows and does not assume metahub provenance.
- [ ] Update runtime widget selection to filter `_app_widgets.is_active = true` while keeping inactive widget rows available to the application layout editor.
- [ ] Ensure app-created layout widgets are included in runtime payload and release bundles.
- [ ] Update release bundle export/import to preserve application-owned layouts and source metadata. In particular, `loadApplicationRuntimeLayouts(...)` currently selects only presentation/runtime fields; it must be extended or wrapped so application release bundles can preserve provenance when sourceKind is `application`.
- [ ] Application release bundles must include app-created and app-customized layouts by default because a release bundle represents the runnable application state, not only the metahub publication baseline.
- [ ] Confirm public guest runtime and workspace-enabled runtime still resolve the intended default layout per scope.

### Phase 8 — i18n

- [ ] Add EN/RU package-local keys in `applications-frontend` for:
  - menu labels;
  - list/detail titles;
  - source badges;
  - sync states;
  - conflict resolution actions;
  - validation messages.
- [ ] Add shared keys to `universo-i18n` only for truly cross-package text such as generic source/status labels, if reused by both metahub and application packages.
- [ ] Update i18n tests to ensure EN/RU parity and namespace merge coverage.

### Phase 9 — Tests

- [ ] Backend Jest:
  - layout hash normalization and stable ordering;
  - runtime schema repair/DDL constraints for new layout metadata columns and `_app_widgets.is_active`;
  - partial unique indexes for default layout invariants;
  - eligible layout scope loading from runtime `_app_objects`;
  - application layout CRUD store/service with SQL-first constraints;
  - optimistic concurrency failures for stale `_upl_version`;
  - transaction/advisory-lock behavior for default changes, widget reorder, and connector sync;
  - widget assignment/move/delete/config/toggle mutations;
  - widget config validation including nested widget configs;
  - runtime widget selection ignores inactive widgets while layout editor APIs still return them;
  - default/active invariant failures;
  - sync merge classifications;
  - conflict resolution policies;
  - stale diff detection before sync apply;
  - idempotent retry for `copy_source_as_application`;
  - source-excluded imported layout is not resurrected by default sync;
  - source-removed behavior;
  - release bundle export/import preserving app layouts.
- [ ] Frontend Vitest:
  - application layouts API wrappers and query keys;
  - query invalidation after create/edit/copy/delete/default/widget mutations;
  - schema-not-created state;
  - scope selector behavior;
  - card/table source badges and sync state chips;
  - create/edit/copy/delete/default flows;
  - detail page widget editor reuse;
  - `ConnectorDiffDialog` conflict resolution form behavior;
  - stale-diff UI recovery;
  - i18n resource merge tests.
- [ ] Shared UI tests in `@universo/template-mui`:
  - extracted layout list/detail presentational components;
  - zone editor drag/toggle/accessibility behavior where feasible.
- [ ] Playwright:
  - create metahub with global and entity-specific layouts;
  - publish and sync to application;
  - open application admin `Layouts`;
  - verify cards/table show metahub source badges;
  - edit imported app layout and add app-owned layout;
  - delete/exclude an imported layout and verify a later sync does not restore it without explicit choice;
  - update metahub layout, publish, open connector sync dialog;
  - verify conflict warning and resolution choices;
  - apply `copy_source_as_application`;
  - verify runtime renders selected default layout.
- [ ] Screenshot evidence:
  - application layouts list;
  - application layout detail widget editor;
  - connector sync conflict dialog;
  - runtime after conflict resolution.

### Phase 10 — Documentation

- [ ] Update package READMEs:
  - `packages/applications-frontend/base/README.md`
  - `packages/applications-backend/base/README.md`
  - `packages/universo-template-mui/base/README.md`
  - `packages/apps-template-mui/README.md` if runtime behavior notes change.
- [ ] Add/update GitBook docs:
  - `docs/en/platform/applications.md`
  - `docs/ru/platform/applications.md`
  - new `docs/en/guides/application-layouts.md`
  - new `docs/ru/guides/application-layouts.md`
  - `docs/en/guides/catalog-layouts.md`
  - `docs/ru/guides/catalog-layouts.md`
  - `docs/en/architecture/metahub-schema.md`
  - `docs/ru/architecture/metahub-schema.md`
  - `docs/en/SUMMARY.md`
  - `docs/ru/SUMMARY.md`
- [ ] Make docs describe the lifecycle:
  - metahub authors define published baseline;
  - applications can customize runtime layouts;
  - connector sync detects layout drift;
  - admins choose a resolution per conflict.

## Potential Challenges

- Current sync deletes every runtime layout not present in the publication snapshot. This must be replaced before enabling app-created layouts, otherwise local layouts will disappear during sync.
- Source-row ids are currently reused from metahub snapshots. App-created copies must use new UUID v7 ids and must not collide with metahub-origin ids.
- Catalog layouts are flattened during application sync. The app-side UX should use neutral "entity-specific" wording while still supporting the current `catalog_id` column contract.
- Widget override inheritance exists in metahubs, but application runtime rows are already materialized. The application UI should edit materialized rows directly, not reintroduce metahub inheritance semantics unless a later feature explicitly needs that.
- Conflict detection needs stable hash normalization. Direct JSON stringify or timestamp comparisons will produce false conflicts.
- The diff dialog must not overload destructive schema confirmation. Layout conflict resolution is a separate decision surface.
- Shared UI extraction can easily leak metahub-specific imports into `@universo/template-mui`; extracted components must receive behavior through props.

## Validation Commands

Targeted validation after implementation:

```bash
pnpm --filter @universo/types build
pnpm --filter @universo/utils test
pnpm --filter @universo/template-mui test
pnpm --filter @universo/applications-backend test -- --runInBand src/tests/services/applicationLayouts*.test.ts src/tests/services/syncLayout*.test.ts src/tests/routes/applicationSyncRoutes.test.ts
pnpm --filter @universo/applications-frontend exec vitest run src/pages/__tests__/ApplicationLayouts.test.tsx src/components/__tests__/ConnectorDiffDialog.test.tsx src/api/__tests__/apiWrappers.test.ts
pnpm --filter @universo/applications-frontend lint
pnpm --filter @universo/applications-backend build
pnpm --filter @universo/applications-frontend build
pnpm build
node tools/testing/e2e/run-playwright-suite.mjs specs/flows/application-layout-management.spec.ts
```

Do not run `pnpm dev`; the project rule reserves dev server startup for the user. Playwright wrapper flows may be used for browser validation and screenshots.

## Acceptance Gates

- [ ] Application admins can manage global and entity-specific layouts from the application admin `Layouts` section without opening metahub screens.
- [ ] Cards and table rows consistently show source provenance (`Metahub` or `Application`) and sync state.
- [ ] Imported metahub layouts can be edited in place, copied, deactivated, made default, or excluded without losing source lineage.
- [ ] App-owned layouts survive connector sync, release bundle export/import, and public/runtime rendering.
- [ ] Connector sync reports updated/removed/default-collision layout conflicts before writing data and requires explicit admin decisions for destructive or divergent cases.
- [ ] Runtime only renders active default layouts and active widgets, while the application editor still exposes inactive widgets for reactivation.
- [ ] Shared layout UI is extracted only where reused by both metahub and application packages, with no metahub-specific imports inside `@universo/template-mui`.
- [ ] All new user-facing text is localized in EN/RU, with package-local keys unless text is genuinely shared.
- [ ] Targeted Jest, Vitest, package builds, root build, and Playwright screenshot proof pass.
- [ ] GitBook docs and package READMEs describe the final lifecycle and conflict model.

## Resolved Decisions

- If a metahub source layout is removed and the application row has no local changes, sync soft-deletes the imported row and records `source_removed` for audit/diagnostics.
- If a metahub source layout is removed but the application row has local changes, sync preserves the current row as application-owned runtime state so user customization is not lost.
- `overwrite_local` is available only per-conflict, not as a bulk default, to reduce accidental loss of application customizations.
- App-created and app-customized layouts are included in application release bundles by default.
- Application admins edit metahub-origin rows directly. The first edit marks the row `local_modified` and keeps stable layout identity instead of auto-copying to a new id.

## Recommended Next Step

Review and approve this plan, then implement in `IMPLEMENT` mode starting with shared contracts, runtime schema metadata, and backend merge classification tests before adding UI.
