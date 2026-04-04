# Plan: Metahub Self-Hosted App Parity & Fixture Closure

> Created: 2026-04-04  
> Updated: 2026-04-04 (v4 — implemented, QA-remediated, and evidence-aligned)  
> Status: COMPLETE — implemented, validated, and memory-aligned  
> Complexity: Level 4 (cross-package product/runtime parity work)  
> Supersedes: `memory-bank/plan/metahub-self-hosted-app-and-snapshot-export-plan-2026-04-03.md` for the next continuation wave only

---

## Overview

The previous wave delivered snapshot import/export, application-level layout view settings, a first self-model generator, and baseline runtime proofs. It did **not** deliver full metahub-in-metahub parity. The next wave must close the remaining product gap so a metahub can author a publishable MVP metahub application that behaves like the current legacy metahub UI in the areas that matter most: per-catalog list behavior, per-attribute editor behavior, page-vs-dialog editing, child relations, seeded settings data, and a credible self-model fixture.

The QA audit confirmed that several critical extension seams already exist and must be reused instead of replaced: catalog and attribute authoring already use tabbed `EntityFormDialog` flows, attributes already persist `uiConfig` / `validationRules`, catalogs already persist `config` JSONB, `apps-template-mui` already has `CustomizedDataGrid`, `ItemCard`, `FlowListTable`, `RuntimeInlineTabularEditor`, and the current fixture/export flow already has both a Playwright generator and a CLI helper. The plan below therefore favors extending those seams over introducing parallel contracts.

This wave must stay aligned with the original constraints:

- Do not remove legacy metahub functionality.
- Do not invent new metadata entity kinds.
- Do not bump the metahub schema or template version solely for this work.
- Reuse the existing application/workspace access model for the multi-user MVP instead of inventing a parallel metahub-specific user/role subsystem inside the published app.
- Reuse current package boundaries and modern shared packages (`@universo/types`, `@universo/utils`, `@universo/template-mui`, `@universo-i18n`).
- Use UUID v7, i18n-first text handling, and snapshot-compatible JSONB/VLC contracts.

---

## Confirmed Gaps To Close

### Product Gaps Verified In Current Main

1. Runtime view settings are currently **layout-global**, not **catalog-specific**.
2. Enabling the current enhanced runtime mode switches away from the normal `DataGrid` surface, which drops built-in filtering/column behavior and creates a visibly worse table contract.
3. Row reordering is currently available only through the layout-global toggle and is implemented as local UI state without a durable persistence contract.
4. Attribute authoring does not yet expose a complete first-class multiline editor contract for published apps. The current Presentation tab covers enum/table/boolean display settings but not a finalized STRING multiline contract that is consistently validated and consumed by runtime forms.
5. Catalog/entity authoring does not expose a first-class `dialog` vs `page` editing surface contract for create/edit/copy flows.
6. The current self-model fixture is still a transitional artifact:
   - it has a technical filename,
   - it uses weak/partial localized metadata,
   - it models attributes as a standalone catalog instead of mirroring the current metahub product structure,
   - it does not seed a realistic settings baseline.
7. Backend support for direct metahub export exists, but the user-facing metahub UI does not yet expose it as a clear action.
8. The plan must treat migrations as a first-class self-hosted surface and document the shipped menu/page/guard flow explicitly instead of implying a synthetic fixture section.

### Architecture Gaps Verified In Code

1. `apps-template-mui` already supports app-level layout config (`showViewToggle`, `showFilterBar`, `cardColumns`, `rowHeight`, `enableRowReordering`) but does not yet merge per-catalog overrides.
2. Metadata objects already persist `config` JSONB, and attributes already persist `uiConfig` / `validationRules`, so the next wave should extend those seams instead of creating a second storage model.
3. Snapshot serialization already carries entity `config`, layout `config`, attribute `uiConfig`, and attribute `validationRules`, so the next wave can remain snapshot-compatible if new fields are added as optional extensions.
4. `EntityFormDialog` already supports multi-tab and custom-field composition, so page-vs-dialog planning should extend existing form infrastructure rather than replace it.
5. Catalog create/update/copy route schemas do **not** yet accept typed runtime/edit-surface config, so Phase 1 must explicitly extend controller validation instead of assuming generic JSONB passthrough is already available.
6. Attribute `uiConfig` already has an existing `widget` seam including `textarea`, but that seam is not yet exposed as a coherent metahub authoring/runtime contract for STRING multiline behavior.
7. The current fixture replacement is cross-cutting: the generator spec, CLI helper, E2E flows, docs, and memory-bank references all currently point to `tools/fixtures/self-model-metahub-snapshot.json`, so the rename/rebuild must be coordinated rather than treated as a single-file swap.
8. `packages/applications-backend/base/src/routes/sync/syncTypes.ts` still defines an older `dashboardLayoutConfigSchema` that lacks the enhanced runtime fields already present in `apps-template-mui`, so the next wave needs one shared schema source of truth instead of package-local drift.

---

## Non-Goals

- Do not delete or rewrite the legacy metahubs frontend.
- Do not replace `CustomizedDataGrid` with a separate generic table implementation for normal runtime lists.
- Do not introduce a second codename persistence seam.
- Do not switch snapshot transport to ZIP in this wave unless a concrete blocking requirement appears during implementation.
- Do not widen into generalized workspaces/roles redesign beyond what is needed for the metahub application MVP.
- Do not introduce a second generic relation-visibility DSL in phase 1; start from the real metahub relations that need parity and generalize only if repetition proves it is necessary.

---

## Affected Areas

| Area | Planned Change |
| --- | --- |
| `packages/metahubs-backend` | Persist and validate per-catalog runtime/editing config; extend snapshot/self-model generation; expose metahub export in a stable user-facing path if UI action is added |
| `packages/metahubs-frontend` | Add catalog-level Layout/Presentation tabs, attribute multiline/editor controls, entity editing-surface controls, and clearer export/import affordances |
| `packages/applications-backend` | Align sync/install/export schemas with the shared runtime config contracts so enhanced view settings are not silently dropped during publication sync |
| `packages/apps-template-mui` | Refactor runtime list surface to preserve built-in DataGrid features while layering catalog-specific toolbar/card/list/reorder behavior |
| `packages/migration-guard-shared` | Reuse the shared migration guard shell only if the self-hosted app needs the same blocking/optional migration UX semantics |
| `packages/universo-template-mui` | Extend shared form/page/list primitives only where generic reuse is clear and leaf-package direction remains valid |
| `packages/universo-types` | Add typed config schemas for catalog runtime config, entity editing-surface config, and attribute editor config |
| `packages/universo-utils` | Add safe config normalization/resolution helpers and snapshot upgrade defaults |
| `packages/universo-i18n` | Add shared EN/RU keys for new catalog/attribute settings and runtime controls |
| `tools/testing/e2e` | Add screenshot-driven baseline audit, new end-to-end authoring/publish/import checks, and regenerate self-model V2 fixture |
| `tools/fixtures` | Replace the current self-model fixture with a renamed, localized, seeded V2 artifact |
| `docs/` + package READMEs | Document per-catalog runtime config, page-surface editing, self-model generator V2, and snapshot/self-hosting workflow |

---

## Guiding Design Decisions

### 1. Keep `DataGrid` As The Canonical Runtime Table Surface

The next wave must treat `CustomizedDataGrid` as the default list surface and layer card toggle, quick search, page controls, and display preferences **around it**, not by swapping to an unrelated table implementation whenever enhanced mode is enabled.

Implication:

- `showFilterBar` must map to MUI DataGrid quick filter / custom toolbar integration.
- `rowHeight` must remain a `DataGrid` concern.
- Sorting, column menus, filter panels, localization, empty states, and pagination must stay available.
- Any alternate sortable-row surface may exist only for explicit reorder-enabled catalogs and must meet a parity checklist before it replaces the canonical grid for that route.

### 2. Move From Layout-Global Defaults To Catalog-Specific Overrides

Use a three-level precedence model:

1. hardcoded runtime defaults,
2. layout-level defaults,
3. catalog-level overrides.

This keeps the existing layout settings useful while making published metahub applications configurable per section.

### 3. Reuse Existing Storage Seams

- Per-catalog runtime/display/editing settings should live in metadata object `config` JSONB.
- Per-attribute editor/display hints should live in attribute `uiConfig` and `validationRules`.
- Snapshot/export/import must keep these fields optional and forward-compatible.

### 4. Mirror Metahub Structure, Not Earlier Self-Model Shortcuts

The new self-model fixture must mirror the real current metahub product structure wherever possible:

- catalogs remain the parent surface,
- attributes appear as a child relation of catalogs,
- settings are seeded with meaningful data,
- names/descriptions are fully localized (EN/RU),
- codename VLC uses a stable English primary machine key and optional Russian localized value without breaking uniqueness or routing.

### 5. Introduce Page Editing As A Configurable Surface, Not A One-Off Route Hack

Create a generic editing surface contract:

- `createSurface: 'dialog' | 'page'`
- `editSurface: 'dialog' | 'page'`
- `copySurface: 'dialog' | 'page'`

This should be available first for catalog-driven published app sections and for metahub authoring where the current dialog model is too shallow.

### 6. Reuse Existing Form, Tab, And Tabular Primitives

- Extend the existing catalog create/edit/copy tabbed dialogs instead of opening a separate catalog-settings dialog.
- Extend the existing attribute `Presentation` tab and the current `sanitizeAttributeUiConfig` helpers instead of creating a second attribute-display editor flow.
- Reuse `RuntimeInlineTabularEditor` / `RuntimeTabularPartView` conventions for child-table surfaces where possible.
- Treat full-page editing as a wrapper around existing form logic, not a forked CRUD implementation.

### 7. Prefer Incremental Contracts Over New Nested DSLs

The current layout runtime settings are already flat (`showViewToggle`, `showFilterBar`, `rowHeight`, `cardColumns`, `enableRowReordering`). The next wave should keep the catalog-level authoring contract as close to those established keys as possible.

Implications:

- Do not invent a deeply nested runtime-settings DSL if a flat extension of the current keys is sufficient.
- Prefer reusing the existing `uiConfig.widget = 'textarea'` seam for multiline STRING fields, with explicit row-count hints where needed, unless implementation proves that this existing contract is too overloaded.
- Defer generic relation-visibility flags until the MVP proves they are necessary beyond the metahub self-hosting use case.

### 8. Make Runtime Config Schemas Shared Across Authoring, Sync, And Runtime

The catalog/runtime config contracts must have one typed source of truth in `@universo/types`, then be reused by `metahubs-backend`, `metahubs-frontend`, `applications-backend`, and `apps-template-mui`.

Implications:

- Do not let `apps-template-mui` and `applications-backend` keep diverging `dashboardLayoutConfigSchema` definitions.
- Shared schema changes must flow through sync/install/export paths before runtime UI starts depending on new flags.
- Defaulting/merge precedence should live in shared helpers, not be reimplemented package-by-package.

### 9. Treat Migrations As A First-Class Self-Hosted Surface

The current metahub product has a real migration-control surface with status/history/plan/apply behavior. The self-hosted parity plan must describe that surface the way the implementation actually ships it: through dedicated navigation, page, and guard flows, not through fake migration rows or a synthetic fixture section.

Implications:

- Reuse existing migration-control routes and shared guard/status patterns where possible.
- Do not synthesize fake migration rows from snapshot metadata.
- Decide explicitly whether the self-hosted app needs a blocking guard, a non-blocking status banner, or both, and document which combination shipped.

### 10. Use Existing Workspace Access For Multi-User MVP

If the self-hosted metahub app needs multi-user behavior in this wave, it should rely on the existing application/workspace model rather than recreating metahub members, users, and roles as a second access-control system inside the published app.

---

## Proposed Config Contracts

### Catalog Runtime Config

```ts
type CatalogRuntimeViewConfig = {
  showSearch?: boolean
  searchMode?: 'server' | 'page-local'
  showCreateButton?: boolean
  showViewToggle?: boolean
  defaultViewMode?: 'table' | 'card'
  cardColumns?: 2 | 3 | 4
  rowHeight?: 'compact' | 'normal' | 'auto'
  enableRowReordering?: boolean
  reorderPersistenceField?: string | null
  createSurface?: 'dialog' | 'page'
  editSurface?: 'dialog' | 'page'
  copySurface?: 'dialog' | 'page'
}
```

This keeps the contract intentionally close to the current layout-level keys and avoids introducing a second nested settings grammar before the MVP proves it is necessary.

The Zod schema for this contract should live once in `@universo/types` and be imported by authoring, sync, and runtime packages rather than copied locally.

### Attribute UI Config

```ts
type AttributeEditorUiConfig = {
  widget?: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date' | 'datetime' | 'reference'
  minRows?: number
  maxRows?: number
  tableColumn?: {
    width?: number
    align?: 'left' | 'center' | 'right'
  }
  card?: {
    hidden?: boolean
    order?: number
  }
}
```

This deliberately reuses the existing backend `uiConfig.widget` seam instead of introducing a parallel `editorKind` key unless implementation later proves that the existing widget contract cannot safely represent multiline STRING behavior.

### Safe Resolution Helper

```ts
const resolvedCatalogRuntimeConfig = {
  ...DEFAULT_CATALOG_RUNTIME_CONFIG,
  ...layoutDefaults,
  ...catalogConfig,
}
```

This helper must live in a shared package, must be pure, and must apply defaults fail-closed.

---

## Plan Steps

### Phase 0 — Baseline Audit And UX Evidence

- [x] Capture the real current metahub UI surfaces that must be mirrored using Playwright screenshots before any implementation.
- [x] Document the target screens for parity: metahub list, catalog list, catalog attributes, layout details, publications/versions, and the most important edit/create/copy dialogs.
- [x] Capture the current published app runtime for the self-model fixture with both default table mode and current enhanced mode enabled, so regressions are measurable.
- [x] Validate the current fixture import/publish/runtime behavior against the hosted E2E Supabase and record concrete pain points in the plan appendices.
- [x] Produce a section-by-section parity matrix for the self-hosted metahub application that marks each current metahub surface as one of: top-level runtime section, child relation on a record page, settings overlay, or explicitly deferred. This matrix must include migrations.
- [x] Use direct `pnpm exec playwright screenshot` only for static visual captures against a known running app; use the repository wrapper-based E2E commands for any flow that relies on hosted Supabase reset, auth provisioning, or cleanup guarantees.

Deliverables:

- screenshot inventory,
- parity checklist by screen,
- explicit before-state evidence attached to the discussion.

### Phase 1 — Metadata Contract Hardening

- [x] Define typed schemas in `@universo/types` for catalog runtime config, entity editing-surface config, and attribute editor config.
- [x] Extract the enhanced dashboard/runtime config shape into a shared schema contract so `apps-template-mui` and `applications-backend` stop maintaining divergent copies.
- [x] Add normalization helpers in `@universo/utils` for config parsing, defaulting, merge precedence, and safe snapshot upgrade behavior.
- [x] Extend catalog create/update/copy route schemas so the new catalog runtime/editing fields are validated explicitly instead of relying on raw JSONB writes.
- [x] Extend backend request validation so catalog/object config accepts only the approved shape and rejects malformed editing/view settings.
- [x] Extend attribute `uiConfig` validation with multiline editor settings using the existing `widget` seam plus row-count hints, and update the shared sanitize helpers so create/edit/copy flows stay consistent.
- [x] Update publication sync/install/export paths in `applications-backend` so the shared runtime config survives snapshot publication and application installation without field loss.
- [x] Keep all new fields optional in snapshot transport and restore paths.

Safety constraints:

- no raw `Record<string, unknown>` writes from route handlers without schema validation,
- no route logic branching on untyped config flags,
- no duplicate config parsing logic in frontend and backend.

### Phase 2 — Catalog-Specific Runtime Settings In Metahub Authoring

- [x] Extend the existing tabbed catalog create/edit/copy dialogs with a `Layout` tab instead of creating a separate settings dialog.
- [x] Expose per-catalog controls for search bar, card/list toggle, default view mode, row height, card column count, and row reordering.
- [x] Add per-catalog editing-surface controls for create/edit/copy page-vs-dialog behavior.
- [x] Keep current layout-level Application View Settings as global defaults, but visually label them as defaults that can be overridden by catalog settings.
- [x] Add summary labels or preview chips so authors can see whether a catalog is inheriting defaults or overriding them.

Recommended UI pattern:

- Keep `EntityFormDialog` for metadata entry.
- Add one extra tab instead of inventing a new catalog settings dialog.
- Use shared localized field components and existing validation plumbing.

### Phase 3 — Attribute Presentation And Multiline Editing

- [x] Extend the existing attribute `Presentation` tab pattern so create/edit/copy and child-attribute flows all expose the same presentation controls.
- [x] Expose multiline editor configuration for STRING attributes through the existing `uiConfig.widget` seam plus row-count hints.
- [x] Connect multiline config to published runtime form controls and table/card rendering.
- [x] Define sensible defaults so existing attributes remain single-line unless explicitly changed.
- [x] Add validation that prevents multiline flags on unsupported data types.
- [x] Make an explicit implementation decision at the start of this phase: either fully standardize on `uiConfig.widget = 'textarea'` for multiline STRING behavior or document a narrowly justified replacement contract if the existing seam is insufficient.

Code-quality target:

```ts
if (attribute.dataType !== 'STRING' && nextUiConfig.widget === 'textarea') {
  throw new DomainValidationError('Multiline editor is supported only for STRING attributes')
}
```

### Phase 4 — Published Runtime Refactor Without Losing Grid Features

- [x] Refactor `apps-template-mui` so normal runtime lists remain `CustomizedDataGrid`-first.
- [x] Replace the current broad `isEnhancedMode` branch with additive composition:
  - toolbar shell,
  - quick filter,
  - card/list toggle,
  - footer/pagination shell,
  - row-height behavior,
  - optional reorder path.
- [x] Preserve built-in DataGrid column filters, sorting, localization, overlay behavior, and existing pagination behavior.
- [x] Keep the native DataGrid footer and pagination contract in normal table mode; use any external pagination shell only for surfaces that are intentionally not rendered as the canonical grid (for example card mode or an explicit reorder surface).
- [x] Use MUI quick filter / toolbar integration for search instead of page-local ad hoc filtering where server pagination is active.
- [x] Where server filtering is not available yet, either implement backend search translation or clearly constrain the search mode to loaded rows only and surface that contract in config, UI copy, and docs as `page-local` search.

Performance target:

- no per-render rebuilding of expensive row maps without memoization,
- no disabling virtualization unnecessarily,
- no full client-side filtering over incomplete server datasets while pretending it is global search.

### Phase 5 — Row Reordering With A Real Persistence Contract

- [x] Define when reordering is allowed: only for catalogs that explicitly map reorder persistence to a sortable field such as `sort_order`.
- [x] Add backend support for durable reorder writes where the target catalog/runtime route supports it.
- [x] Preserve the canonical list shell even when reorder is enabled.
- [x] Keep reorder disabled for datasets that do not have a valid persistence field or are paginated in a way that makes reorder ambiguous.
- [x] Add explicit UX cues for local-only preview vs persisted reorder if a temporary intermediate mode is needed.

Fail-closed rule:

- if reorder persistence cannot be guaranteed, do not silently offer draggable handles.

### Phase 6 — Child Tables And Page-Surface Editing

- [x] Design a generic published-app record page surface that can show child relations under a selected record.
- [x] Use it first for metahub self-hosting gaps that cannot be expressed as flat lists:
  - Catalog -> Attributes
  - Publication -> Versions
  - Layout -> Zone widgets
  - selected settings groups where appropriate
- [x] Add generic routing and page-state contracts so create/edit/copy can open on a full page when the catalog config requests it.
- [x] Reuse current dialog forms inside the page surface first, then progressively widen the page editor only where necessary.
- [x] Keep relation rendering driven by known metahub topology in the MVP instead of introducing a new generic relation-visibility configuration surface up front.

Important constraint:

- page editing is a configurable surface, not a second independent CRUD implementation.

### Phase 7 — Migration-Control Surface Parity

- [x] Decide the self-hosted metahub migration UX explicitly: blocking guard, non-blocking status banner, dedicated migrations section, or a combination.
- [x] Reuse existing migration-control routes and shared migration UI/guard patterns where practical instead of inventing snapshot-derived fake state.
- [x] Cover the minimal migration parity set required by the original metahub product: status, history, plan/apply affordance, and navigation to the migrations surface.
- [x] Make the section-level parity matrix and docs state clearly whether rollback stays in the legacy/admin surface or is exposed in the self-hosted MVP.
- [x] Add E2E validation for at least one pending-migration state and one successful migration-status recovery path if this surface is included in the MVP.

### Phase 8 — Self-Model Generator V2 And Fixture Replacement

- [x] Replace `tools/fixtures/self-model-metahub-snapshot.json` with a new clearly named fixture file, for example `tools/fixtures/metahubs-self-hosted-app-snapshot.json`.
- [x] Update the generator spec to export the new file name and remove reliance on the previous transitional artifact naming.
- [x] Update the CLI helper, dependent E2E flows, E2E READMEs, and any fixture consumers that still hardcode the old file name.
- [x] Rename the metahub and its publication/layouts with proper EN/RU localized names and descriptions.
- [x] Ensure all catalogs and major authored entities have complete EN/RU localized names and descriptions.
- [x] Keep English as the primary codename locale; add Russian localized codename values only where they remain safe for machine usage.
- [x] Remove the standalone `Attributes` catalog from the self-model fixture and model attributes through the `Catalogs` relation path instead.
- [x] Seed the `Settings` catalog with a realistic baseline that mirrors the current metahub settings contract rather than leaving it empty.
- [x] Review whether any other transitional sections in the self-model fixture should become child relations instead of top-level sections.

Fixture acceptance criteria:

- imports successfully into a clean E2E environment,
- can be published into an application,
- exposes the intended catalog-specific runtime behaviors,
- is understandable to a human reviewer without reverse-engineering internal IDs.

### Phase 9 — Snapshot, Export, And UX Completion

- [x] Add a user-facing metahub export action in the metahub frontend if discussion confirms that the backend route should be exposed directly.
- [x] Re-check import/export UX labels so they clearly distinguish metahub export, publication version export, metahub import, and version import.
- [x] Extend import/export regression tests to cover the new per-catalog and per-attribute config fields.
- [x] Keep transport backward-compatible with the earlier V1 JSON envelope.

### Phase 10 — Deep Testing Strategy

- [x] Add shared unit tests for config schemas, config merge precedence, and snapshot upgrade defaults.
- [x] Add backend integration tests for catalog config persistence, attribute uiConfig persistence, export/import round-trips, and reorder persistence rules.
- [x] Add frontend tests for:
  - catalog Layout tab,
  - attribute Presentation tab,
  - page-vs-dialog routing decisions,
  - runtime toolbar/quick-filter parity,
  - row height and multiline rendering,
  - reorder affordance gating.
- [x] Add E2E flows for:
  - author catalog-specific runtime settings,
  - author multiline attribute behavior,
  - publish metahub application,
  - verify card/list/search/grid parity in runtime,
  - verify page-surface editing,
  - verify migration surface parity if it is part of the MVP,
  - export snapshot,
  - import snapshot into clean DB,
  - republish and validate the imported result again.
- [x] Add screenshot baselines for current metahub screens and resulting published-app screens.

Mandatory validation stack:

- targeted package tests,
- targeted Playwright flows,
- generator rerun,
- import rerun from fresh hosted E2E Supabase,
- canonical root `pnpm build`.

### Phase 11 — Documentation And Rollout Notes

- [x] Update package READMEs for `metahubs-frontend`, `metahubs-backend`, and `apps-template-mui`.
- [x] Update GitBook docs in `docs/en` and `docs/ru` with:
  - per-catalog runtime settings,
  - attribute presentation settings,
  - page-surface editing,
  - self-model generator V2,
  - fixture import/export workflow,
  - troubleshooting for runtime config precedence.
- [x] Correct the existing app-template runtime docs so they no longer imply that the current enhanced mode already preserves full native DataGrid parity.
- [x] Document the exact fixture file path and generation command that the user can reuse locally.

## Completion Note

The parity wave defined in this plan is now fully implemented and QA-closed. The final completion pass specifically hardened the remaining honest-UI/runtime seams that the earlier nominal completion still left open: persisted reorder now fails closed on partial datasets, hidden create actions cannot be reactivated through direct page-surface routing, direct metahub export is available in the shipped frontend, and the touched frontend packages/tests/lint/build all revalidated successfully.

---

## Potential Challenges

1. **Grid feature parity risk**  
   The current enhanced-mode branch already proved that replacing the normal grid surface causes UX regression. The new wave must explicitly test column filters, sorting, pagination, loading states, and localization after every runtime refactor.

2. **Search semantics risk**  
   Client-only filtering over a server-paginated dataset is misleading. The plan must either implement backend-supported runtime search or mark page-local search as a distinct mode.

3. **Settings sprawl risk**  
   Catalog config, layout defaults, and attribute uiConfig can become incoherent unless one shared precedence resolver is enforced everywhere.

4. **Cross-package schema drift risk**  
  If `metahubs`, `applications-backend`, and `apps-template` keep separate copies of the same runtime config contract, new flags will silently disappear during sync/install/export.

5. **Self-model fidelity risk**  
   If the fixture remains structurally convenient instead of product-faithful, the resulting published metahub app will again look unlike the real metahub.

6. **Page-surface duplication risk**  
   Building separate dialog CRUD and page CRUD paths would multiply maintenance cost. The page surface must wrap shared form logic, not fork it.

7. **Migration parity scope risk**  
  Leaving migrations implicit would produce another parity hole even if lists/forms look correct. The plan must explicitly decide the MVP migration UX and test it.

8. **Snapshot compatibility risk**  
   Optional config expansion is safe; required-field expansion is not. All new snapshot fields must deserialize with sane defaults.

9. **Performance risk**  
   More runtime flexibility increases pressure on row/column memoization, parent container sizing, and virtualization. The implementation should follow MUI DataGrid layout/toolbar/quick-filter guidance instead of fighting the component.

---

## External Guidance Incorporated

- MUI DataGrid quick filter and toolbar should be composed through the supported toolbar and quick-filter APIs instead of a custom table replacement.
- MUI DataGrid dynamic height should remain parent-dimension-aware so virtualization is preserved.
- Playwright screenshots should be planned at page-level and element-level so UI parity can be reviewed before and after the refactor.

---

## Success Criteria

- A catalog author can configure list surface behavior per catalog, not only globally per layout.
- A catalog author can configure whether string attributes render as multiline editors in the published app.
- A catalog author can choose dialog vs page editing for create/edit/copy.
- The published metahub application preserves core DataGrid functionality while adding card/list/search/reorder behavior.
- Runtime config fields survive the full authoring -> publication sync -> application install/runtime path without package-local schema drift.
- The self-hosted metahub parity matrix explicitly covers migrations and states which sections remain top-level pages versus child relations.
- The self-model V2 fixture is localized, structurally credible, seeded with meaningful settings, and importable/exportable through the supported workflow.
- The resulting application can be published, validated in the browser, exported, re-imported into a clean E2E environment, and validated again.

---

## Recommended Execution Order

1. Baseline screenshots and parity checklist.
2. Type/schema/config resolver design.
3. Catalog and attribute authoring surfaces.
4. Runtime DataGrid-preserving refactor.
5. Reorder persistence contract.
6. Page-surface and child-relation support.
7. Migration-control parity decision and implementation.
8. Self-model generator V2 + fixture replacement.
9. Snapshot/export UX completion.
10. Full test and docs wave.

---

## Discussion Questions Before Implementation

1. Should Russian localized codename values be persisted for the self-model fixture everywhere, or only for human-facing entities where route/machine stability remains fully English-primary?
2. Should page-surface editing be implemented first for catalog records only, or also for layouts/publications in the same wave?
3. Is direct metahub export expected in the metahub UI in this wave, or is publication-version export sufficient for MVP?
4. Should server-backed runtime search be mandatory for published metahub catalogs in this wave, or can some catalogs temporarily use explicitly labeled page-local quick filtering?
5. Should the self-hosted metahub app enforce a migration guard comparable to the legacy metahub UI, or is an explicit migrations section plus status banner sufficient for MVP?
