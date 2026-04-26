# Entity Resources Hardcoding And Quality Refactoring Plan

> **Created**: 2026-04-26  
> **Status**: Plan — ready for discussion  
> **Complexity**: Level 4 — Major/Complex  
> **Scope**: metahub entity resources, entity type seeding, shared resource labels, entity authoring quality, tests, and GitBook docs  
> **Important constraint**: no legacy preservation is required. Test databases can be recreated. Do not bump metahub schema or template versions for this cleanup.

---

## Overview

The current Resources tabs are **partly entity-driven**: `SharedResourcesPage.tsx` fetches entity type definitions, checks enabled components, and reads `ui.resourceSurfaces` to resolve tab labels. This is the right direction.

However, the implementation is not yet clean enough for a strict "everything comes from Entities" architecture:

- Standard tab labels are still duplicated in frontend defaults and backend standard definitions.
- `EntityTypeService` still synthesizes standard entity type definitions when DB rows are missing.
- `SharedResourcesPage.tsx` has a built-in-priority label resolver and fixed tab identifiers for only three metadata capabilities.
- Shared pool containers are still fixed to standard pools (`shared_attributes`, `shared_constants`, `shared_values`), which is acceptable for current shared authoring behavior but should be explicitly modeled as platform resource pools instead of hidden UI assumptions.
- Standard entity type rows are visible in the Entities workspace, but the backend currently rejects standard-kind updates through `EntityTypeService.updateType(...)`. That means standard resource tab labels are not yet fully configurable through the Entities constructor.
- Publication snapshots already carry `entityTypeDefinitions`, and snapshot import restores `ui_config`. Application schema sync, however, builds executable runtime schema from `snapshot.entities`, not from `entityTypeDefinitions`. Resource surface labels therefore must be preserved as design-time/publication metadata without becoming an accidental runtime DDL dependency.
- Several entity files are large and hard to reason about, especially frontend authoring surfaces and backend metadata controllers.

The target state is: **metahub templates seed all standard and custom entity type definitions as data; standard entity type presentation/resource labels are safely configurable through the Entities constructor; Resources renders from persisted entity type `resourceSurfaces`; missing type definitions fail closed; labels are localized through entity metadata; tests prove the browser result in EN/RU.**

---

## Current Findings

### What already works

- Standard entity presets define component manifests and resource surfaces in `packages/metahubs-backend/base/src/domains/templates/data/standardEntityTypeDefinitions.ts`.
- Basic and Basic Demo templates include presets for `hub`, `catalog`, `set`, and `enumeration`.
- `MetahubSchemaService.syncEntityTypePresets(...)` persists enabled presets into `_mhb_entity_type_definitions`.
- `SharedResourcesPage.tsx` uses `useAllEntityTypesQuery(...)`, `isEnabledComponentConfig(...)`, and `ui.resourceSurfaces` to decide whether to show `fieldDefinitions`, `fixedValues`, and `optionValues`.
- The Entities builder already exposes editable `resourceSurfaces` fields for custom entity types.
- Existing reusable UI foundations already cover the required UX: `EntityFormDialog`, `LocalizedInlineField`, `GeneralTabFields`, `BaseEntityMenu`, `FlowListTable`, `ToolbarControls`, and the shared layout/list shells from `@universo/template-mui`. This plan should reuse those instead of inventing a new form/dialog system.

### What is still too hardcoded

- `EntityTypeService` imports `standardEntityTypeDefinitions` and returns `SYNTHETIC_BUILTIN_ENTITY_TYPES` if persisted rows are missing. That means a metahub can appear to have standard types even when the database did not create them as Entities.
- `SharedResourcesPage.tsx` contains `DEFAULT_RESOURCE_TAB_LABELS` with `Attributes`, `Constants`, and `Values`, plus `RESOURCE_SURFACE_KIND_PRIORITY` for `catalog`, `set`, and `enumeration`.
- The frontend builder has its own `RESOURCE_SURFACE_METADATA` defaults with the same labels and route segments.
- `isBuiltinEntityKind(...)` is still used by label resolution and standard route branching. Some uses are legitimate as platform behavior dispatch, but label resolution should not need a built-in registry.
- Standard kind `create/update/delete` policy is too coarse: create/delete should stay restricted, but safe local updates for standard type presentation and resource surface labels are needed if the Entity constructor is expected to own these labels.
- Large files increase risk and hide coupling:
  - `EntitiesWorkspace.tsx` ~2326 lines.
  - `FieldDefinitionList.tsx` ~1902 lines.
  - `RecordList.tsx` ~1842 lines.
  - `EntityInstanceListContent.tsx` ~1565 lines.
  - Standard list components are ~1300-1500 lines each.
  - Backend `metadata/fieldDefinition/controller.ts` ~2130 lines.
  - Backend template seed/migration services are ~800-870 lines each.

---

## Affected Areas

- `packages/universo-types/base/src/common/entityTypeDefinition.ts`
- `packages/universo-types/base/src/common/entityComponents.ts`
- `packages/metahubs-backend/base/src/domains/templates/data/*entity-preset.ts`
- `packages/metahubs-backend/base/src/domains/templates/data/standardEntityTypeDefinitions.ts`
- `packages/metahubs-backend/base/src/domains/templates/services/TemplateManifestValidator.ts`
- `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubSchemaService.ts`
- `packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts`
- `packages/metahubs-backend/base/src/domains/metahubs/services/SnapshotRestoreService.ts`
- `packages/metahubs-backend/base/src/domains/entities/services/EntityTypeService.ts`
- `packages/metahubs-frontend/base/src/domains/entities/shared/ui/SharedResourcesPage.tsx`
- `packages/metahubs-frontend/base/src/domains/entities/ui/EntitiesWorkspace.tsx`
- `packages/metahubs-frontend/base/src/domains/entities/ui/EntityInstanceListContent.tsx`
- `packages/metahubs-frontend/base/src/domains/entities/metadata/**`
- `packages/metahubs-frontend/base/src/domains/entities/presets/**`
- `packages/metahubs-frontend/base/src/i18n/locales/{en,ru}/metahubs.json`
- `packages/applications-backend/base/src/services/applicationReleaseBundle.ts`
- `packages/applications-backend/base/src/services/applicationSyncContracts.ts`
- `packages/applications-backend/base/src/services/publishedApplicationSnapshotEntities.ts`
- `packages/applications-backend/base/src/routes/sync/**`
- `packages/universo-i18n/base/src/locales/**` if shared menu labels are affected
- `packages/apps-template-mui/src/**` only if published runtime UI starts reading entity type metadata
- Playwright specs under `tools/testing/e2e/specs/flows/`
- GitBook docs under `docs/en/**` and `docs/ru/**`

---

## Target Contracts

1. **No synthetic standard entity type fallback** in production services.
2. **Standard kinds are reserved keys, not in-code type definitions**. Their definitions are seeded through entity type presets.
3. **Resources labels come from persisted entity type UI metadata**:
   - `ui.resourceSurfaces[].title` as VLC is the primary user-visible label for both standard and custom entity types.
   - `titleKey` should be phased out of active standard preset/runtime label resolution; keep it only as a temporary compatibility input during the refactor if needed.
   - `fallbackTitle` remains a developer/debug fallback, not the primary user-visible localization path.
4. **Resource tab visibility comes from enabled components**, not from hardcoded kind names.
5. **Resource content routing is capability-driven**, with a small internal registry mapping only currently implemented shared capabilities to existing authoring surfaces. Do not introduce generic UI for unsupported capabilities in this pass.
6. **Shared resource pools are explicit platform pools**, not hidden names in UI logic.
7. **Missing or contradictory entity type resource metadata fails closed** with tests and visible diagnostics, instead of silently falling back to canonical labels.
8. **Standard type structural fields remain protected**, but admins can update safe presentation/UI fields such as resource surface localized titles through the same Entity constructor flow.
9. **Publication/application propagation is explicit**: `entityTypeDefinitions[].ui.resourceSurfaces.title` must survive publication snapshot export/import and release bundle hashing, while application executable schema generation remains based on structural entity definitions unless a runtime UI feature deliberately consumes entity type metadata.

---

## Plan Steps

### Phase 1: Lock the Current Behavior With Characterization Tests

- [ ] Add backend tests proving Basic/Basic Demo metahub creation persists entity type rows for `hub`, `catalog`, `set`, `enumeration` with `components` and `ui.resourceSurfaces`.
- [ ] Add frontend tests showing current Resources tabs are derived from entity type definitions and disappear when matching components are disabled.
- [ ] Add regression tests for RU/EN tab labels before refactoring, using actual i18n resources.
- [ ] Add a red/green characterization test for "missing persisted standard type row must not be synthesized" and make it pass in Phase 3; do not leave intentionally failing tests committed.
- [ ] Add a characterization test proving standard entity type update currently fails, then replace it with the new safe-update contract in Phase 3.
- [ ] Add a small static audit script or test that searches for new hardcoded Resources labels outside approved seed/i18n files.

Example safe audit pattern:

```ts
const forbiddenHardcodedLabels = ['Attributes', 'Constants', 'Values', 'Атрибуты', 'Константы', 'Значения']
const allowedPaths = [
  'packages/metahubs-backend/base/src/domains/templates/data',
  'packages/metahubs-frontend/base/src/i18n/locales',
  'packages/universo-i18n/base/src/locales'
]
```

### Phase 2: Move Resource Surface Contract Into Shared Types

- [ ] Extend `EntityResourceSurfaceDefinition` with localized title metadata.
- [ ] Keep `titleKey` only as an optional temporary input accepted by validators during the transition; the updated standard presets should store VLC `title` values directly.
- [ ] Add pure shared validators/helpers to `@universo/types`:
  - `normalizeEntityResourceSurfaceDefinition(...)`
  - `validateEntityResourceSurfacesAgainstComponents(...)`
- [ ] Add locale/title resolution in a browser-safe utility layer (`@universo/utils/vlc` or a metahubs frontend shared helper), not in a React/i18n-dependent type module.
- [ ] Move duplicated regex/capability/order logic out of frontend/backend files into shared utilities.
- [ ] Add `@universo/types` Vitest coverage for normalization, duplicate capability rejection, route segment validation, and component mismatch.

Example target type:

```ts
export interface EntityResourceSurfaceDefinition {
  key: string
  capability: EntityResourceSurfaceCapability
  routeSegment: string
  title?: VersionedLocalizedContent<string>
  titleKey?: string
  fallbackTitle?: string
}
```

Example title resolution:

```ts
export function resolveResourceSurfaceTitle(
  surface: EntityResourceSurfaceDefinition,
  locale: string,
  translate?: (key: string, fallback?: string) => string
): string {
  const localized = surface.title ? getVlcContent(surface.title, locale) : null
  if (localized) return localized
  if (surface.titleKey && translate) return translate(surface.titleKey, surface.fallbackTitle)
  return surface.fallbackTitle ?? surface.key
}
```

### Phase 3: Make Standard Presets the Only Source of Standard Entity Definitions

- [ ] Remove `SYNTHETIC_BUILTIN_ENTITY_TYPES` from `EntityTypeService`.
- [ ] Remove imports from `EntityTypeService` to `standardEntityTypeDefinitions.ts`.
- [ ] Change `listTypesInSchema(...)` and `resolveTypeInSchema(...)` to return only persisted rows.
- [ ] Keep `isBuiltinEntityKind(...)` only where the system needs to reserve platform kind keys or dispatch standard behavior.
- [ ] Update create/update/delete checks so reserved standard kind restrictions are enforced by policy, not by synthetic definitions:
  - create: standard kind keys remain reserved for template presets/bootstrap;
  - delete: standard kind rows remain protected;
  - update: standard kind rows allow safe local updates for presentation and `ui.resourceSurfaces[].title`, but reject `kindKey`, destructive component changes, and unsupported route/capability changes unless a separate explicit platform migration says otherwise.
- [ ] Make template/bootstrap paths fail closed when enabled presets did not persist required entity types.
- [ ] Add tests for:
  - Basic metahub has four persisted type definitions.
  - Empty template can intentionally have none.
  - Missing `catalog` type means catalog routes fail with a clear domain error.
  - Standard `catalog` resource label can be changed through the Entities constructor and appears in Resources without changing hardcoded locale files.
  - Standard kind structural edits are rejected while safe label/presentation edits pass.
  - Snapshot export/import preserves entity type definitions without service fallback.
  - Publication snapshot includes localized `ui.resourceSurfaces[].title` for standard and custom entity types.
  - Application release bundle hash changes when published entity type design-time metadata changes, but generated executable schema diff does not include DDL changes for label-only resource surface edits.

Example safer service behavior:

```ts
async resolveTypeInSchema(schemaName: string, kindKey: string, db: SqlQueryable = this.exec) {
  const row = await this.findTypeRowByKindKey(schemaName, kindKey.trim(), db)
  return row ? this.normalizeTypeRow(row) : null
}
```

### Phase 4: Replace Fixed Resources Tab Definitions With a Capability Registry

- [ ] Extract a `resourceSurfaceRegistry` from `SharedResourcesPage.tsx`.
- [ ] Registry entries should map component capability to:
  - content renderer,
  - shared pool kind,
  - default platform fallback key,
  - empty/error states.
- [ ] Build visible tabs by grouping persisted entity type `resourceSurfaces` by capability.
- [ ] Remove `RESOURCE_SURFACE_KIND_PRIORITY` and `isBuiltinEntityKind(...)` from label resolution.
- [ ] Prefer VLC `title` from the persisted entity type surface. If only `titleKey` is present during transition, convert it during bootstrap/normalization or resolve it as a temporary fallback.
- [ ] Decide conflict behavior:
  - preferred: if multiple active entity types define different titles for the same shared capability, show a deterministic platform title and surface a non-blocking diagnostics warning for admins;
  - stricter option: fail closed and show the tab disabled with an error.
- [ ] Preserve `Layouts` and `Scripts` as platform resource tabs, but model them as explicit platform tabs outside metadata component surfaces.
- [ ] Add unit tests for custom titles, conflicting titles, disabled components, and active-tab fallback.

Example target shape:

```ts
const RESOURCE_RENDERERS: Record<EntityResourceSurfaceCapability, ResourceRendererConfig> = {
  dataSchema: {
    poolKind: SHARED_OBJECT_KINDS.SHARED_CATALOG_POOL,
    render: ({ metahubId, objectId }) => (
      <FieldDefinitionListContent metahubId={metahubId} linkedCollectionId={objectId} sharedEntityMode />
    )
  },
  fixedValues: {
    poolKind: SHARED_OBJECT_KINDS.SHARED_SET_POOL,
    render: ({ metahubId, objectId }) => (
      <FixedValueListContent metahubId={metahubId} valueGroupId={objectId} sharedEntityMode />
    )
  },
  optionValues: {
    poolKind: SHARED_OBJECT_KINDS.SHARED_ENUM_POOL,
    render: ({ metahubId, objectId }) => (
      <SelectableOptionListContent metahubId={metahubId} optionListId={objectId} sharedEntityMode />
    )
  }
}
```

### Phase 5: Make Entity Builder Resource Surfaces Data-First

- [ ] Remove local `RESOURCE_SURFACE_METADATA` defaults from `EntitiesWorkspace.tsx`.
- [ ] Use shared `@universo/types` helpers for resource surface defaults and validation.
- [ ] Add localized title fields in the entity-type form using the existing `EntityFormDialog` + `LocalizedInlineField` + VLC helpers; do not add a new form framework or bespoke localized-input component.
- [ ] Reuse `GeneralTabFields`, existing `TabConfig` patterns, existing action descriptors, and the current `BaseEntityMenu` action flow.
- [ ] Ensure all UI strings are EN/RU i18n keys, with no visible English fallback as the intended runtime copy.
- [ ] Add tests proving standard and custom entity type creation/update stores localized resource surface titles and Resources uses them.

### Phase 6: Explicitly Model Shared Resource Pools

- [ ] Keep the current three shared pool containers for now, but rename and document them as platform shared pools:
  - `SHARED_FIELD_DEFINITION_POOL`
  - `SHARED_FIXED_VALUE_POOL`
  - `SHARED_OPTION_VALUE_POOL`
- [ ] Preserve stored codenames only if needed internally; do not expose them in UI.
- [ ] Move pool creation/lookup metadata into a single backend module and shared type map.
- [ ] Add backend tests for idempotent shared pool creation and frontend tests for missing-pool fail-closed messages.
- [ ] Do not add new generic pool tables in this phase unless custom capabilities require it; keep scope focused on making the existing behavior explicit and safe.

### Phase 7: Refactor Large Frontend Entity Files

- [ ] Split `EntitiesWorkspace.tsx` into:
  - `entityTypeFormModel.ts`
  - `entityTypeFormValidation.ts`
  - `EntityTypeFormDialog.tsx`
  - `EntityTypeComponentsEditor.tsx`
  - `EntityTypeResourceSurfacesEditor.tsx`
  - `EntityTypeListTable.tsx`
  - `EntitiesWorkspace.tsx` as orchestration only.
- [ ] Treat extracted components as thin wrappers over existing `@universo/template-mui` primitives. Do not create a parallel design system, new table component, or new dialog component.
- [ ] Split `FieldDefinitionList.tsx` into data hooks, dialog/actions, table rendering, and type-settings editor.
- [ ] Split `RecordList.tsx` into field-model construction, record table, record dialog, inline table editor integration, and mutation orchestration.
- [ ] Extract shared list shell logic from `LinkedCollectionList`, `ValueGroupList`, `OptionListList`, and `TreeEntityList` only where it removes real duplication and keeps the current UX identical.
- [ ] Keep behavior unchanged while splitting; add tests around extracted units before deeper behavior changes.

Recommended size targets:

- orchestration components: under 400-600 lines;
- form model/validation modules: under 300 lines;
- action modules: under 400 lines;
- table renderers: under 500 lines.

### Phase 8: Refactor Backend Entity And Template Services

- [ ] Split `metadata/fieldDefinition/controller.ts` into route validation, command handlers, target validation, system field-definition handlers, and response mapping.
- [ ] Move duplicated resource surface validation from `TemplateManifestValidator` and `EntityTypeService` into shared validation helpers.
- [ ] Split `TemplateSeedExecutor.ts` and `TemplateSeedMigrator.ts` by responsibility:
  - entity instance seed,
  - field definition seed,
  - fixed value seed,
  - option value seed,
  - layout/widget seed,
  - setting seed.
- [ ] Where domain code still uses raw Knex outside DDL/template boundaries, convert to `DbExecutor.query()` or isolate the DDL boundary clearly.
- [ ] Add direct tests for each extracted store/service path, especially SQL mutation fail-closed behavior.

Example safe SQL pattern:

```ts
const row = await queryOneOrThrow<EntityTypeRow>(
  executor,
  `UPDATE ${qSchemaTable(schemaName, '_mhb_entity_type_definitions')}
   SET ui_config = $1::jsonb,
       _upl_updated_at = now(),
       _upl_version = _upl_version + 1
   WHERE id = $2
     AND _upl_deleted = false
     AND _mhb_deleted = false
   RETURNING *`,
  [JSON.stringify(nextUi), entityTypeId]
)
```

### Phase 9: Verify Publication And Application Propagation

- [ ] Audit and test the full chain:
  - metahub entity type row in `_mhb_entity_type_definitions`;
  - publication snapshot `entityTypeDefinitions`;
  - snapshot export/import transport envelope;
  - application release bundle snapshot and hash;
  - application sync executable payload and generated schema diff.
- [ ] Keep resource surface titles as design-time/publication metadata. Do not copy them into runtime `_app_objects.config` or DDL metadata unless a concrete runtime UI consumer is added in the same pass.
- [ ] Add tests proving a label-only resource surface change:
  - is visible in metahub Resources after query invalidation;
  - appears in a newly created publication snapshot;
  - is preserved by snapshot export/import;
  - changes the publication/release snapshot hash where metadata fidelity requires it;
  - does not produce table/column DDL changes during application schema sync.
- [ ] If `packages/apps-template-mui` or public runtime pages begin to display entity type resource labels, add a typed selector and tests there instead of reading arbitrary snapshot JSON inline.

Example release-bundle assertion:

```ts
expect(bundle.snapshot.entityTypeDefinitions?.catalog?.ui?.resourceSurfaces?.[0]?.title).toEqual({
  version: 1,
  content: { en: 'Properties', ru: 'Свойства' }
})
expect(bundle.bootstrap.payload.entities).toEqual(previousStructuralEntities)
```

### Phase 10: Deep Test System

- [ ] `@universo/types` Vitest:
  - resource surface normalization;
  - localized title resolution;
  - component/capability validation;
  - duplicate route/key/capability rejection.
- [ ] `@universo/metahubs-backend` Jest:
  - template preset sync persists definitions;
  - no synthetic fallback;
  - safe standard entity type resource-label update;
  - standard entity type structural update rejection;
  - create/update entity type resource surface validation;
  - Basic and Basic Demo creation;
  - snapshot export/import;
  - publication snapshot preserves entity type resource titles;
  - application release bundle preserves design-time entity type metadata without DDL drift;
  - shared pool creation;
  - SQL fail-closed mutation paths.
- [ ] `@universo/metahubs-frontend` Vitest:
  - `SharedResourcesPage`;
  - entity type resource surface editor;
  - query invalidation after entity type updates;
  - EN/RU labels;
  - hidden tabs and conflict diagnostics.
- [ ] Playwright:
  - create Basic metahub and verify Resources tabs in EN and RU;
  - edit the standard Catalogs resource surface title through the Entities constructor and verify the Resources tab changes in the real UI;
  - create Empty metahub, manually add a custom data-schema entity type with localized resource title, verify tab title and screenshot;
  - disable/remove a component and verify tab disappears or fails closed;
  - publish metahub, create application, sync connector, verify resource surface metadata survives publication/release paths and label-only changes do not create runtime DDL churn;
  - screenshot Resources, Entities builder, and application sync paths.
- [ ] Use the existing wrapper:

```bash
node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-entity-resources.spec.ts --project chromium
```

### Phase 11: Visual And Supabase Verification

- [ ] Use Playwright CLI on port `3100` for real UI proof; do not run `pnpm dev`.
- [ ] Capture screenshots for:
  - Basic Resources EN;
  - Basic Resources RU;
  - edited standard Catalogs resource label;
  - custom entity resource title;
  - conflict/fail-closed state;
  - entity type form resource surfaces editor.
- [ ] If database state must be inspected, use the e2e credentials from `packages/universo-core-backend/base/.env.e2e` and verify:
  - `_mhb_entity_type_definitions` rows exist;
  - `ui_config.resourceSurfaces` contains expected localized titles;
  - latest publication snapshot contains matching `entityTypeDefinitions`;
  - application release bundle/sync state does not report DDL changes for label-only resource surface edits;
  - no service path relies on missing rows.

### Phase 12: Documentation And README Updates

- [ ] Update `packages/metahubs-backend/base/README.md`:
  - entity type presets are the only standard definition source;
  - no synthetic fallback;
  - resource surface validation and seed flow.
- [ ] Update `packages/metahubs-frontend/base/README.md`:
  - Resources tab derivation;
  - custom resource surface title editing;
  - testing expectations.
- [ ] Update GitBook docs in EN/RU:
  - `docs/en/architecture/entity-component-system.md`
  - `docs/ru/architecture/entity-component-system.md`
  - `docs/en/architecture/entity-systems.md`
  - `docs/ru/architecture/entity-systems.md`
  - `docs/en/guides/custom-entity-types.md`
  - `docs/ru/guides/custom-entity-types.md`
  - `docs/en/guides/browser-e2e-testing.md`
  - `docs/ru/guides/browser-e2e-testing.md`
- [ ] Update publication/application docs if the metadata propagation contract is user-visible:
  - `docs/en/platform/publications.md`
  - `docs/ru/platform/publications.md`
  - `docs/en/platform/applications.md`
  - `docs/ru/platform/applications.md`
- [ ] Add fresh screenshots generated by Playwright where the docs already use screenshot workflows.
- [ ] Regenerate affected canonical fixtures/snapshots through existing Playwright generator flows if entity type definitions or resource surface serialization changes touch committed fixture contracts.
- [ ] Update `memory-bank/systemPatterns.md`, `memory-bank/techContext.md`, `memory-bank/progress.md`, and `memory-bank/tasks.md` only after implementation and validation are complete.

### Phase 13: Final Validation

- [ ] Run focused package checks:

```bash
pnpm --filter @universo/types test
pnpm --filter @universo/types build
pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/EntityTypeService.test.ts src/tests/services/templateManifestValidator.test.ts
pnpm --filter @universo/metahubs-frontend exec vitest run src/domains/entities/shared/ui/__tests__/SharedResourcesPage.test.tsx src/domains/entities/ui/__tests__/EntitiesWorkspace.test.tsx
pnpm --filter @universo/metahubs-frontend lint
pnpm --filter @universo/metahubs-backend build
pnpm --filter @universo/metahubs-frontend build
pnpm --filter @universo/applications-backend test -- --runInBand src/tests/services/applicationReleaseBundle.test.ts src/tests/routes/applicationSyncRoutes.test.ts
pnpm --filter @universo/applications-backend build
```

- [ ] Run Playwright proof on the built/e2e path:

```bash
node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-entity-resources.spec.ts --project chromium
```

- [ ] Run the root build after focused checks are green:

```bash
pnpm build
```

- [ ] Run final hardcoding audit:

```bash
rg -n "SYNTHETIC_BUILTIN_ENTITY_TYPES|getSyntheticBuiltinEntityType|DEFAULT_RESOURCE_TAB_LABELS|RESOURCE_SURFACE_KIND_PRIORITY|Attributes|Constants|Values|Атрибуты|Константы|Значения" packages/metahubs-frontend/base/src packages/metahubs-backend/base/src packages/universo-types/base/src
```

Every remaining match must be in approved seed, i18n, tests, or documentation paths.
- [ ] Run the DB access lint if backend store/service boundaries were touched:

```bash
node tools/lint-db-access.mjs
```

---

## Potential Challenges

- **Standard kind dispatch is still real platform behavior.** Removing synthetic definitions must not remove valid standard kind routing. The difference is: route dispatch may know reserved standard kind keys, but type metadata must come from persisted entity definitions.
- **Standard type editing needs a narrow policy.** The Entity constructor should own user-visible labels, but standard kind structural changes can break route/runtime assumptions. Use explicit allowed-field updates with optimistic locking.
- **Resource labels can conflict across custom entity types.** The plan should pick deterministic behavior before implementation. My recommendation is admin-visible diagnostics plus stable platform fallback for shared capability tabs.
- **Custom resource surfaces currently share only three metadata capabilities.** If future custom capabilities need new shared pools, that should be a separate feature after this cleanup.
- **Large file refactoring can create noisy diffs.** Split behavior-preserving modules first, then change semantics in small validated slices.
- **Playwright screenshots are mandatory for UI claims.** Do not rely on unit tests to conclude the Resources UI looks correct.

---

## Dependencies

- `@universo/types` must land first for shared resource surface contracts.
- `@universo/metahubs-backend` service changes must land before frontend assumes no synthetic fallback.
- `@universo/metahubs-frontend` resource rendering changes depend on backend returning persisted `ui.resourceSurfaces`.
- Docs and screenshots depend on green Playwright verification.

---

## Discussion Points Before IMPLEMENT

1. For conflicting custom resource tab titles, should Resources show a canonical platform title with diagnostics, or fail closed and require the admin to resolve the conflict?
2. Confirm the target: localized resource surface titles should be stored as `title: VLC` for both standard and custom entity types, with `titleKey` removed from active standard runtime label resolution.
3. Should we rename shared pool constants in this pass while preserving DB codenames, or leave names as-is and only document them?
4. Should the first implementation pass prioritize removing synthetic backend fallback before frontend file decomposition?
5. Which standard entity type fields should be admin-editable in this pass: only resource surface titles, or also presentation name/description and sidebar metadata?
