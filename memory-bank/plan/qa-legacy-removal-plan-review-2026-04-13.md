# QA Review: Legacy Removal + Entity-Based Metadata Types Promotion Plan

> **Date**: 2026-04-13  
> **Reviewed plan**: [legacy-removal-entity-promotion-plan-2026-04-13.md](legacy-removal-entity-promotion-plan-2026-04-13.md)  
> **Status**: Issues found — plan needs corrections before implementation

---

## Executive Summary

The 13-phase plan is **structurally sound** and covers most of the TZ scope. However, QA found **4 contradictions with the TZ**, **3 factual errors** about the current codebase, **5 missing scope items**, and **5 E2E specs omitted from the test plan**. Security patterns (ACL, RLS, transactions) are correctly preserved. No unnecessary new components were invented for areas that already have solutions, **except** for one case (`GenericEntityListRenderer`).

**Verdict: Plan needs corrections before proceeding to IMPLEMENT.**

---

## Section 1: TZ Contradictions (Critical)

### 1.1 DOCUMENT in StandardEntityKinds — contradicts TZ #2

**Plan Step 1.1** includes `DOCUMENT: 'document'` in `StandardEntityKinds`.  
**TZ #2** explicitly states: *"пока не будет Документов"*.

**Fix**: Remove `DOCUMENT` from `StandardEntityKinds` entirely. Also remove `DOCUMENT_TYPE` from `BUILTIN_ENTITY_TYPES` / `STANDARD_ENTITY_PRESETS`. The `document-workspace.entity-preset.ts` file should be deleted or excluded from the presets array.

### 1.2 `source: EntityTypeSource` field — contradicts TZ #3

**Plan Step 1.2** replaces `isBuiltin: boolean` with `source: 'preset' | 'custom'`.  
**TZ #3** explicitly states: *"я пока не вижу необходимости их как-то специальным образом помечать в таблице типов сущностей, поэтому нужно убрать колонку 'Источник'"*.

**Fix**: Do NOT add `source` field. Simply remove `isBuiltin` / `is_builtin` column from the DB and type definitions without replacement. Entity type definitions from presets and custom entity types should be stored identically — no distinguishing column. All entity type definitions go into `_mhb_entity_type_definitions` as equal rows.

**Impact**: This simplifies the plan significantly:
- Step 1.2: Delete `isBuiltin`, do NOT add `source`
- Step 1.3: Remove `source: 'preset'` from preset definitions
- Step 2.5: `EntityTypeResolver.resolveBuiltin()` must be removed (no more builtin fallback — all resolution from DB)
- Step 2.6: `EntityTypeService.listCustomTypes()` → just `listTypes()` (no more filtering by builtin/custom)
- Step 4.3: "Source" column removed from EntitiesWorkspace — no `preset` badge needed
- Step 7.1: No `source` in snapshot `entityTypeDefinitions`
- Step 11.1: No `source: 'preset'` in fixture contract

### 1.3 `BUILTIN_ENTITY_TYPE_REGISTRY` retention — contradicts TZ #3

**Plan Step 1.3** renames `BUILTIN_ENTITY_TYPE_REGISTRY` → `STANDARD_ENTITY_PRESETS` but keeps it as a runtime registry.  
**TZ #3** says entity types should NOT be specially marked. The registry should only be used at **metahub creation time** (to seed initial entity types from presets into the DB), NOT at runtime for type resolution.

**Fix**: Keep preset definitions as **seed data** in template files only (`packages/metahubs-backend/base/src/domains/templates/data/presets/`). Remove the `@universo/types` registry entirely. At metahub creation, `TemplateSeedExecutor` reads preset manifests and inserts rows into `_mhb_entity_type_definitions`. After that, all entity type resolution comes from the DB.

**Impact on EntityTypeResolver**: Must be simplified to DB-only lookup. No more `resolveBuiltin()` fallback. If an entity type isn't in the DB for a given metahub, it doesn't exist — period.

### 1.4 Preset-level `kindKey` hardcoding — contradicts TZ #6 spirit

**Plan Step 3.1** assigns fixed `kindKey: 'catalog'` to presets.  
**TZ #6** says *"каждый пресет должен иметь свой уникальный kindKey, который станет ключом для сущности"*.

**Nuance**: This is partially acceptable (catalog, hub, set, enumeration ARE the kind keys). But the plan should clarify that presets define **default** kindKey values that can be overridden at creation time. The current plan correctly has `presetCodename` separate from `kindKey`, but the wording should be clearer about this distinction.

---

## Section 2: Factual Errors About the Codebase

### 2.1 `filterSeedByCreateOptions` location (Step 3.3)

**Plan says**: Update `filterSeedByCreateOptions()` in `TemplateSeedExecutor.ts`.  
**Actual**: `filterSeedByCreateOptions()` is a **static method on `MetahubSchemaService`** (line 631 of `MetahubSchemaService.ts`), NOT in `TemplateSeedExecutor`.

**Fix**: Move the `filterSeedByCreateOptions` update to Step 3.4 (MetahubSchemaService), not Step 3.3.

### 2.2 Unified entity API "creation" (Step 4.6)

**Plan says**: "Create unified `entityInstancesApi.ts` if not already present".  
**Actual**: `entityInstances.ts` **already exists** at `entities/api/entityInstances.ts` with full CRUD coverage (list, get, create, update, delete, restore, permanentDelete, copy, reorder).

**Fix**: Step 4.6 should say: "Migrate legacy list components (CatalogList, HubList, SetList, EnumerationList) from their per-kind APIs (`catalogsApi`, `hubsApi`, `setsApi`, `enumerationsApi`) to the **existing** unified `entityInstancesApi`." The real work is migration, not creation.

### 2.3 Legacy API/hook parallel system (Step 4.1)

The plan correctly identifies the need to move list components but **underestimates the migration scope**. Currently:
- CatalogList → useLinkedCollectionListData → catalogsApi (legacy endpoints)
- HubList → useTreeListData → hubsApi (legacy endpoints)
- SetList → useValueGroupListData → setsApi (legacy endpoints)
- EnumerationList → useOptionListData → enumerationsApi (legacy endpoints)

Each renderer must be migrated from its per-kind hook+API to the unified entity hooks+API **before** the legacy backend routes are removed (Phase 2). This means **Phase 4 must precede Phase 2**, or the renderers will break immediately.

**Fix**: Either reorder phases (4 before 2) or add explicit migration sub-steps within Phase 2 (after extracting hub logic but before deleting routes, migrate frontend consumers to unified API).

---

## Section 3: Missing Scope Items

### 3.1 `boardSummary` endpoint — not mentioned

`metahubsController.boardSummary` uses `resolveLegacyCompatibleKindsInSchema()` to count hubs and catalogs. This will break when legacy compatibility utilities are removed.

**Fix**: Add to Phase 2 or Phase 7: Update `boardSummary` to query entity counts generically from `_mhb_objects` grouped by `kind`, or remove per-kind counts entirely.

### 3.2 `document-workspace.entity-preset.ts` — not addressed

This preset file directly imports and spreads `DOCUMENT_TYPE.components` and `DOCUMENT_TYPE.ui`. Since TZ says "no documents", this file must be explicitly deleted. Without deletion, the build will fail when `DOCUMENT_TYPE` is removed.

**Fix**: Add to Phase 3.1: Delete `document-workspace.entity-preset.ts` and remove it from `builtinEntityTypePresets` array in the barrel file.

### 3.3 `constants-library.entity-preset.ts` — not addressed

This preset uses `SET_TYPE` (not `DOCUMENT_TYPE`) so it's safe, but its `kindKey` is `custom.constants-library` which uses the old `custom.` prefix. The plan should clarify whether this preset is kept (with updated `kindKey: 'constants-library'`) or deprecated.

**Fix**: Add a decision to Phase 3.1 about `constants-library` preset.

### 3.4 Sidebar query parameter change — not addressed

The sidebar currently loads entity types with `GET /entity-types?includeBuiltins=false` to show only custom types. After removing `isBuiltin`, this query parameter loses meaning.

**Fix**: Add to Phase 5.1: Remove `includeBuiltins` query parameter from the endpoint. All entity types should be returned (they're all equal now). Update `entityTypeListQuerySchema` in `entityTypesController.ts`.

### 3.5 Snapshot export behavioral change — not addressed

Currently, `loadSnapshotTypeDefinitions()` calls `listCustomTypes()` which excludes builtins. After removing `isBuiltin`, **all** entity types (including preset-based ones like catalog, hub, set, enumeration) will be exported in snapshots.

This is actually **correct behavior** for the new model (since entity types are DB-resident and may differ between metahubs), but the plan should explicitly acknowledge this change and verify that snapshot import handles it correctly.

**Fix**: Add a note to Phase 7.1 acknowledging that entity type definitions will now be included in snapshots for ALL kinds, and verify the import path handles type definition upsert/merge.

---

## Section 4: Unnecessary New Components

### 4.1 `GenericEntityListRenderer` — unnecessary

**Plan Step 4.2** proposes creating a `GenericEntityListRenderer` component for entity types that don't match catalog/hub/set/enumeration.

**Verdict**: The existing `EntityInstanceList` already has a generic fallback path for custom entity types (after the if-chain for legacy-compatible kinds). This fallback renders a generic list with EntityFormDialog. Creating a separate `GenericEntityListRenderer` is unnecessary.

**Fix**: Instead of extracting a separate component, keep the existing generic path in `EntityInstanceList` after the `INSTANCE_RENDERERS` lookup. If `kindKey` doesn't match any known renderer, render the generic list inline (as it does now).

---

## Section 5: E2E Test Plan Gaps

### 5.1 `metahub-domain-entities.spec.ts` — CRITICAL OMISSION

Tests ALL legacy domain collection routes (`/hubs`, `/catalogs`, `/sets`, `/enumerations`) with 12+ legacy API calls. Will **completely break** after Phase 2. Not mentioned in the plan at all.

**Fix**: Add to Phase 10.1: Delete `metahub-domain-entities.spec.ts` entirely (its coverage is superseded by the new `metahub-entity-lifecycle.spec.ts`).

### 5.2 `metahub-create-options-codename.spec.ts` — OMISSION

Tests the OLD boolean flags (checkboxes for Hub, Catalog, Set, Enumeration) and verifies counts using legacy API functions (`listMetahubHubs`, `listMetahubCatalogs`, etc.). Will break when Phase 5 changes the create dialog.

**Fix**: Add to Phase 10.1: Either rewrite this spec to use preset toggles, or merge its coverage into the new `metahub-create-options.spec.ts` and delete the old one.

### 5.3 `boards-overview.spec.ts` — OMISSION

Tests `MetahubBoardSummary` with `hubsCount` and `catalogsCount` fields. Will break when `boardSummary` endpoint changes.

**Fix**: Add to Phase 10.1: Update `boards-overview.spec.ts` to match the new board summary format.

### 5.4 `metahub-entities-workspace.spec.ts` — INCOMPLETE

Plan mentions removing "Source" column assertions but doesn't address:
- Line 35: type `source?: 'builtin' | 'custom'` must be removed entirely (not changed to 'preset')
- Line 337: `includeBuiltins: false` parameter must be removed

### 5.5 `selfHostedAppFixtureContract.mjs` — INSUFFICIENT DETAIL

Plan Phase 11.1 mentions updating but doesn't list specific changes:
- All `kindKey: 'custom.X-v2'` → `kindKey: 'X'` (4 types)
- All `templateCodename: 'X-v2'` → `templateCodename: 'X'`
- Remove `compatibility: { legacyObjectKind: '...' }` from all types
- Remove `isBuiltin` field (not replace with `source`)

---

## Section 6: Phase Ordering Issue

**Problem**: Phase 2 (Backend — delete legacy routes) runs BEFORE Phase 4 (Frontend — migrate components to unified API). But the legacy list components (CatalogList, HubList, etc.) currently call legacy backend endpoints. If backend routes are deleted first, the frontend will be broken and untestable during development.

**Recommended order**:
1. Phase 1 (Types) — as planned
2. Phase 4 (Frontend cleanup) — migrate renderers to unified API first
3. Phase 2 (Backend) — now safe to delete legacy routes
4. Phase 3 (Templates) — as planned
5. Phase 5+ — as planned

Or alternatively: do Phases 2 and 4 together in a single commit, ensuring both sides are updated atomically.

---

## Section 7: Security Assessment

**Verdict**: ✅ No security issues found in the proposed changes.

| Aspect | Status | Notes |
|--------|--------|-------|
| ACL enforcement | ✅ Preserved | All mutations gated by permission checks. Plan correctly keeps `editContent` for instances, `manageMetahub` for types |
| RLS context | ✅ Preserved | Request-scoped DB executor propagation unchanged |
| Transaction safety | ✅ Preserved | `EntityMutationService.run()` wraps all mutations in transactions |
| Input validation | ✅ Preserved | Zod schemas validate all controller inputs |
| SQL injection | ✅ Safe | All queries use parameterized `$1, $2` bindings via `DbExecutor.query()` |
| Legacy ACL migration | ⚠️ Simplification | `resolveLegacyAclPermission()` will be removed. ACL should default to `editContent`/`deleteContent` for all entity kinds equally. This is correct per TZ but should be explicitly documented in the plan |

---

## Section 8: Positive Findings

The plan correctly handles:
- ✅ Kind key renaming (`custom.catalog-v2` → `catalog`)
- ✅ Legacy route removal (comprehensive list)
- ✅ Hub behavior extraction into `HubBehaviorService`
- ✅ Specialized renderer preservation (not collapsed into a single generic renderer)
- ✅ Query key unification pattern
- ✅ Settings namespace migration (`catalogs.*` → `entity.catalog.*`)
- ✅ Snapshot format simplification
- ✅ i18n update scope
- ✅ EN/RU documentation update plan
- ✅ Fixture regeneration through Playwright generators
- ✅ `TemplatePresetReference` with `defaultInstances[]` is a clean architecture
- ✅ `MetahubCreateOptions.presetToggles` is cleaner than boolean flags

---

## Summary of Required Corrections

| # | Category | Severity | Item |
|---|----------|----------|------|
| 1 | TZ contradiction | 🔴 Critical | Remove DOCUMENT from StandardEntityKinds |
| 2 | TZ contradiction | 🔴 Critical | Do NOT add `source` field — just remove `isBuiltin` without replacement |
| 3 | TZ contradiction | 🔴 Critical | Remove `BUILTIN_ENTITY_TYPE_REGISTRY` from runtime — presets are seed-only data |
| 4 | Factual error | 🟡 Medium | `filterSeedByCreateOptions` is in MetahubSchemaService, not TemplateSeedExecutor |
| 5 | Factual error | 🟡 Medium | Unified `entityInstancesApi.ts` already exists — step 4.6 is migration, not creation |
| 6 | Factual error | 🟡 Medium | Legacy renderers use per-kind APIs — migration scope underestimated |
| 7 | Missing scope | 🟡 Medium | `boardSummary` endpoint needs update |
| 8 | Missing scope | 🟡 Medium | `document-workspace.entity-preset.ts` must be deleted |
| 9 | Missing scope | 🟠 Low | `constants-library.entity-preset.ts` needs decision |
| 10 | Missing scope | 🟡 Medium | Sidebar `includeBuiltins` query parameter removal |
| 11 | Missing scope | 🟡 Medium | Snapshot export behavior change acknowledgment |
| 12 | Unnecessary | 🟠 Low | `GenericEntityListRenderer` — use existing inline fallback |
| 13 | E2E gap | 🟡 Medium | `metahub-domain-entities.spec.ts` not mentioned (will break) |
| 14 | E2E gap | 🟡 Medium | `metahub-create-options-codename.spec.ts` not mentioned (will break) |
| 15 | E2E gap | 🟡 Medium | `boards-overview.spec.ts` not mentioned (will break) |
| 16 | E2E gap | 🟠 Low | `metahub-entities-workspace.spec.ts` update incomplete |
| 17 | E2E gap | 🟠 Low | `selfHostedAppFixtureContract.mjs` changes not detailed |
| 18 | Phase order | 🟡 Medium | Phase 4 should precede Phase 2, or both must be atomic |

---

## Recommended Next Steps

1. **Update the plan** to address all 18 items above
2. After corrections, re-run QA to confirm all issues resolved
3. Then proceed to IMPLEMENT mode
