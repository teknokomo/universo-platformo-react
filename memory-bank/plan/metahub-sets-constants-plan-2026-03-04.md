# Plan: Metahub Sets & Constants (Clone-Refactor Strategy, QA-Hardened)

**Date**: 2026-03-04  
**Complexity**: Level 4 (cross-backend/frontend/schema/snapshot/runtime)  
**Status**: PLAN (QA-hardened discussion draft, no implementation yet)

---

## Overview

Implement new **Sets** and **Constants** functionality in Metahubs as a structural analogue of existing **Catalogs** and **Attributes**, with one hard process constraint:

1. **First step must be file copying and renaming** from Catalog/Attribute domains to Set/Constant domains.
2. **Then only line-by-line refactor** of copied files.
3. **Alternative implementation paths are forbidden** for this task.

Functional intent:
- Set = container of constants (like Catalog is container of attributes).
- Constant = typed value definition with editable current value.
- Constant types in this iteration: `STRING`, `NUMBER`, `BOOLEAN`, `DATE`.
- No `REF`, `JSON`, `TABLE` for constants (for now).
- No `isRequired` for constants.
- Constants support reorder (buttons and drag-and-drop).
- Attribute REF should support new target kind `set` with constant selection.
- UI/UX must stay visually and behaviorally aligned with existing Catalog/Attribute flows by reusing existing components/patterns first.

---

## Mandatory Delivery Rule (Non-Negotiable)

- [ ] **Must execute clone step before any manual coding**.
- [ ] **Must refactor copied files line-by-line** (naming + behavior), preserving architecture/style parity with Catalog/Attribute UX and API.
- [ ] **Must not build Sets/Constants from scratch via a different architecture path**.
- [ ] **Must run post-refactor residue scan** to ensure no stale Catalog/Attribute identifiers remain in new Set/Constant files.
- [ ] **Must not introduce extra UI entities that are not required by the specification** (for example TABLE-child constant flows).

> If this rule is violated, the implementation must be considered invalid and re-done using the clone-refactor process.

---

## Research Inputs Used for This Plan

### Context7 (latest docs, checked 2026-03-04)
- TanStack Query (`/tanstack/query`): optimistic update flow (`onMutate` snapshot -> `onError` rollback -> `onSettled` invalidation), precise query key strategies.
- Zod (`/colinhacks/zod`): `discriminatedUnion`, `superRefine`, `safeParse` for robust polymorphic API payload validation.
- dnd-kit (`/clauderic/dnd-kit`): sortable and multi-container patterns, stable drag-end state updates.

### Web checks (official/primary docs, checked 2026-03-04)
- TanStack Query docs: optimistic updates/query keys.
- PostgreSQL docs: advisory lock semantics and transaction-level safety.

### Supabase (UP-test) verification
- Project: `UP-test` (`osnvhnawsmyfduygsajj`) is active.
- `metahubs.metahubs_branches.structure_version` currently `1`.
- Branch schemas exist (`mhb_<id>_b1..b3`), with system tables `_mhb_objects`, `_mhb_attributes`, `_mhb_values`, `_mhb_elements`, etc.
- `_mhb_attributes` currently contains catalog-attribute-specific columns (`is_required`, `is_display_attribute`, `target_object_kind`, `parent_attribute_id`) and no dedicated constant value column.

---

## Additional Codebase Analysis (Key Couplings & Risks)

### 1) Entity kind propagation risk
Current `MetaEntityKind` does not include `set`.

Direct impacts:
- `packages/universo-types/base/src/common/metahubs.ts`
- `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubObjectsService.ts`
- Zod schemas in routes and template validators.
- Schema-DDL naming (`packages/schema-ddl/base/src/naming.ts`)

### 2) Branch copy compatibility risk
Branch copy options currently include only:
- `copyLayouts`, `copyHubs`, `copyCatalogs`, `copyEnumerations`

Direct impacts:
- `packages/universo-types/base/src/common/copyOptions.ts`
- `packages/universo-utils/base/src/validation/copyOptions.ts`
- `packages/metahubs-backend/base/src/domains/branches/routes/branchesRoutes.ts`
- `packages/metahubs-backend/base/src/domains/branches/services/MetahubBranchesService.ts`
- `packages/metahubs-frontend/base/src/domains/branches/**`

### 3) Snapshot/runtime sync risk
Publication snapshot and application sync are catalog/enumeration-centric.

Direct impacts:
- `packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts`
- `packages/metahubs-backend/base/src/domains/applications/routes/applicationSyncRoutes.ts`
- `packages/schema-ddl/base/src/SchemaGenerator.ts`

### 4) REF target UX risk
REF selector currently supports only `catalog` and `enumeration`.

Direct impacts:
- `packages/metahubs-frontend/base/src/components/TargetEntitySelector.tsx`
- `packages/metahubs-frontend/base/src/domains/attributes/ui/AttributeFormFields.tsx`
- `packages/metahubs-backend/base/src/domains/attributes/routes/attributesRoutes.ts`

### 5) Menu/route dual-source risk
Metahub navigation is configured in **two places** and must stay aligned.

Direct impacts:
- `packages/metahubs-frontend/base/src/menu-items/metahubDashboard.ts`
- `packages/universo-template-mui/base/src/navigation/menuConfigs.ts`
- `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx`

### 6) Settings tab model risk
Settings tabs/types currently hardcoded for hubs/catalogs/enumerations.

Direct impacts:
- `packages/universo-types/base/src/common/metahubs.ts`
- `packages/metahubs-frontend/base/src/domains/settings/ui/SettingsPage.tsx`

### 7) Hub relation aggregation risk
Hub-level counters and relation-copy code currently account only for catalogs/enumerations.

Direct impacts:
- `packages/metahubs-backend/base/src/domains/hubs/routes/hubsRoutes.ts`
- `packages/metahubs-frontend/base/src/domains/hubs/hooks/mutations.ts`

### 8) Branch-copy UI and helper coupling risk
Branch copy checkboxes and compatibility code are wired to fixed option keys and messages.

Direct impacts:
- `packages/metahubs-frontend/base/src/domains/branches/ui/BranchActions.tsx`
- `packages/metahubs-frontend/base/src/domains/branches/utils/copyOptions.ts`

---

## Mandatory Clone Step (Exact File Copy Map)

## Backend clone (must run first)

```bash
mkdir -p packages/metahubs-backend/base/src/domains/sets/routes
mkdir -p packages/metahubs-backend/base/src/domains/constants/routes
mkdir -p packages/metahubs-backend/base/src/tests/routes

cp packages/metahubs-backend/base/src/domains/catalogs/index.ts \
   packages/metahubs-backend/base/src/domains/sets/index.ts
cp packages/metahubs-backend/base/src/domains/catalogs/routes/catalogsRoutes.ts \
   packages/metahubs-backend/base/src/domains/sets/routes/setsRoutes.ts

cp packages/metahubs-backend/base/src/domains/attributes/index.ts \
   packages/metahubs-backend/base/src/domains/constants/index.ts
cp packages/metahubs-backend/base/src/domains/attributes/routes/attributesRoutes.ts \
   packages/metahubs-backend/base/src/domains/constants/routes/constantsRoutes.ts

cp packages/metahubs-backend/base/src/tests/routes/catalogsRoutes.test.ts \
   packages/metahubs-backend/base/src/tests/routes/setsRoutes.test.ts
cp packages/metahubs-backend/base/src/tests/routes/attributesRoutes.test.ts \
   packages/metahubs-backend/base/src/tests/routes/constantsRoutes.test.ts
```

## Frontend clone (must run first)

```bash
mkdir -p packages/metahubs-frontend/base/src/domains/sets/{api,hooks,ui}
mkdir -p packages/metahubs-frontend/base/src/domains/constants/{api,hooks,ui,dnd}

cp packages/metahubs-frontend/base/src/domains/catalogs/index.ts \
   packages/metahubs-frontend/base/src/domains/sets/index.ts
cp packages/metahubs-frontend/base/src/domains/catalogs/api/catalogs.ts \
   packages/metahubs-frontend/base/src/domains/sets/api/sets.ts
cp packages/metahubs-frontend/base/src/domains/catalogs/api/index.ts \
   packages/metahubs-frontend/base/src/domains/sets/api/index.ts
cp packages/metahubs-frontend/base/src/domains/catalogs/hooks/index.ts \
   packages/metahubs-frontend/base/src/domains/sets/hooks/index.ts
cp packages/metahubs-frontend/base/src/domains/catalogs/hooks/mutations.ts \
   packages/metahubs-frontend/base/src/domains/sets/hooks/mutations.ts
cp packages/metahubs-frontend/base/src/domains/catalogs/ui/CatalogActions.tsx \
   packages/metahubs-frontend/base/src/domains/sets/ui/SetActions.tsx
cp packages/metahubs-frontend/base/src/domains/catalogs/ui/CatalogList.tsx \
   packages/metahubs-frontend/base/src/domains/sets/ui/SetList.tsx

cp packages/metahubs-frontend/base/src/domains/attributes/index.ts \
   packages/metahubs-frontend/base/src/domains/constants/index.ts
cp packages/metahubs-frontend/base/src/domains/attributes/api/attributes.ts \
   packages/metahubs-frontend/base/src/domains/constants/api/constants.ts
cp packages/metahubs-frontend/base/src/domains/attributes/api/index.ts \
   packages/metahubs-frontend/base/src/domains/constants/api/index.ts
cp packages/metahubs-frontend/base/src/domains/attributes/hooks/index.ts \
   packages/metahubs-frontend/base/src/domains/constants/hooks/index.ts
cp packages/metahubs-frontend/base/src/domains/attributes/hooks/mutations.ts \
   packages/metahubs-frontend/base/src/domains/constants/hooks/mutations.ts
cp packages/metahubs-frontend/base/src/domains/attributes/ui/AttributeActions.tsx \
   packages/metahubs-frontend/base/src/domains/constants/ui/ConstantActions.tsx
cp packages/metahubs-frontend/base/src/domains/attributes/ui/AttributeFormFields.tsx \
   packages/metahubs-frontend/base/src/domains/constants/ui/ConstantFormFields.tsx
cp packages/metahubs-frontend/base/src/domains/attributes/ui/AttributeList.tsx \
   packages/metahubs-frontend/base/src/domains/constants/ui/ConstantList.tsx
cp packages/metahubs-frontend/base/src/domains/attributes/ui/dnd/AttributeDndContainerRegistry.tsx \
   packages/metahubs-frontend/base/src/domains/constants/ui/dnd/ConstantDndContainerRegistry.tsx
cp packages/metahubs-frontend/base/src/domains/attributes/ui/dnd/AttributeDndProvider.tsx \
   packages/metahubs-frontend/base/src/domains/constants/ui/dnd/ConstantDndProvider.tsx
cp packages/metahubs-frontend/base/src/domains/attributes/ui/dnd/DragOverlayRow.tsx \
   packages/metahubs-frontend/base/src/domains/constants/ui/dnd/DragOverlayRow.tsx
cp packages/metahubs-frontend/base/src/domains/attributes/ui/dnd/useAttributeDnd.ts \
   packages/metahubs-frontend/base/src/domains/constants/ui/dnd/useConstantDnd.ts
cp packages/metahubs-frontend/base/src/domains/attributes/ui/dnd/index.ts \
   packages/metahubs-frontend/base/src/domains/constants/ui/dnd/index.ts
```

---

## Post-Copy Line-by-Line Refactor Rule

After clone, refactor copied files line-by-line:

- `Catalog` -> `Set`
- `catalog` -> `set`
- `catalogs` -> `sets`
- `Attribute` -> `Constant`
- `attribute` -> `constant`
- `attributes` -> `constants`

And then apply behavior deltas required by spec:
- remove elements-related logic for Sets.
- remove TABLE/JSON/REF-type constant logic.
- remove `isRequired` from constants.
- add value-tab/value-editor for constants.
- remove TABLE-child constant UI/logic (`Child*` lists, parent/child transfer rules, nested reorder constraints).
- keep constant DnD as single-list reorder only (no cross-container transfer semantics).

---

## Mandatory Residue Audit (after refactor)

Run residue scan only inside new Set/Constant files:

```bash
rg -n "catalog|Catalog|attributes?|Attribute|elements?|Element|/catalog|catalogId|attributeId" \
  packages/metahubs-backend/base/src/domains/sets \
  packages/metahubs-backend/base/src/domains/constants \
  packages/metahubs-frontend/base/src/domains/sets \
  packages/metahubs-frontend/base/src/domains/constants
```

Acceptance rule:
- [ ] No stale names remain in new Set/Constant domains (including comments, labels, and route aliases).

---

## Reuse-First Rule (UI/Architecture Guardrails)

- [ ] Reuse existing domain patterns and shared components from Catalog/Attribute implementations.
- [ ] Do not introduce new shared UI components or abstractions unless there is a proven hard blocker.
- [ ] Keep route/menu/dialog behavior consistent with existing metahub modules.
- [ ] Keep refactor scope tight: implement only specification-required deltas.

---

## No-Legacy Contract (Strict)

- [ ] Do not preserve deprecated compatibility payloads/fields in new Sets/Constants code paths.
- [ ] Do not add compatibility aliases like `targetCatalogId` in new constants/set APIs.
- [ ] Do not keep TABLE-child-related compatibility flags in constants APIs.
- [ ] Prefer clean, explicit contracts over backward-compat shims because test DB will be recreated.

---

## Architecture Decision for Constants Storage (Recommended)

Use a dedicated table `_mhb_constants` (not `_mhb_attributes`) for clean separation and safe evolution.

Recommended columns:
- `id` UUID v7 PK
- `object_id` (Set ID)
- `codename`
- `data_type` (`STRING|NUMBER|BOOLEAN|DATE`)
- `presentation` JSONB
- `validation_rules` JSONB
- `ui_config` JSONB
- `value_json` JSONB (typed value payload)
- `sort_order`
- standard `_upl_*` and `_mhb_*`

Recommended constraints/indexes:
- unique active codename per set: `(object_id, codename)` with `_upl_deleted=false AND _mhb_deleted=false`.
- index for ordered list queries: `(object_id, sort_order)`.
- check constraint for allowed types: `data_type IN ('STRING','NUMBER','BOOLEAN','DATE')`.
- optional value consistency checks in service layer (Zod + `superRefine`) before persistence.

Attribute REF->set storage contract:
- add `target_constant_id UUID NULL` to `_mhb_attributes`.
- FK: `target_constant_id -> _mhb_constants.id` (`ON DELETE SET NULL`).
- backend invariant:
  - if `target_entity_kind='set'` then `target_object_id` (setId) and `target_constant_id` must both be present.
  - for all non-`set` kinds, `target_constant_id` must be null.

Rationale:
- avoids overloading attribute semantics (`is_required`, `parent_attribute_id`, TABLE child logic).
- enables strict constant-specific validation and future extension.
- cleanly supports Set -> Constant ownership and reorder semantics.

---

## Safe Code Patterns (Reference Snippets)

### 1) Zod discriminated union for typed constant values

```ts
const constantValueSchema = z.discriminatedUnion('dataType', [
  z.object({ dataType: z.literal('STRING'), value: z.string().nullable() }),
  z.object({ dataType: z.literal('NUMBER'), value: z.number().finite().nullable() }),
  z.object({ dataType: z.literal('BOOLEAN'), value: z.boolean().nullable() }),
  z.object({ dataType: z.literal('DATE'), value: z.string().datetime().nullable() })
])

const createConstantSchema = z
  .object({
    codename: z.string().min(1).max(100),
    dataType: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'DATE']),
    name: localizedInputSchema,
    validationRules: constantValidationRulesSchema.optional(),
    uiConfig: constantUiConfigSchema.optional(),
    valuePayload: constantValueSchema
  })
  .superRefine((data, ctx) => {
    if (data.valuePayload.dataType !== data.dataType) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['valuePayload'], message: 'valuePayload.dataType mismatch' })
    }
  })
```

### 2) TanStack Query optimistic reorder with rollback

```ts
const mutation = useMutation({
  mutationFn: reorderConstant,
  onMutate: async (variables) => {
    await queryClient.cancelQueries({ queryKey: metahubsQueryKeys.constantsListDirect(variables.metahubId, variables.setId) })
    const prev = queryClient.getQueryData(metahubsQueryKeys.constantsListDirect(variables.metahubId, variables.setId))

    queryClient.setQueryData(metahubsQueryKeys.constantsListDirect(variables.metahubId, variables.setId), (old) =>
      applyReorder(old, variables)
    )

    return { prev }
  },
  onError: (_err, vars, ctx) => {
    queryClient.setQueryData(metahubsQueryKeys.constantsListDirect(vars.metahubId, vars.setId), ctx?.prev)
  },
  onSettled: (_data, _err, vars) => {
    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.constants(vars.metahubId, vars.setId) })
  }
})
```

### 3) Transaction + advisory lock for safe clone/copy

```ts
const lockKey = uuidToLockKey(`set-constants-copy:${metahubId}:${setId}`)
const acquired = await acquireAdvisoryLock(knex, lockKey)
if (!acquired) throw new Error('Copy in progress')

try {
  await manager.transaction(async (trx) => {
    // clone set object
    // clone constants with deterministic sort_order
    // validate codenames under unique constraints
  })
} finally {
  await releaseAdvisoryLock(knex, lockKey)
}
```

---

## Detailed Step-by-Step Plan

## Phase 1: Clone & Mechanical Refactor Baseline

- [ ] Execute mandatory copy commands (backend + frontend).
- [ ] Adjust file/module names and exported symbols to `sets` and `constants`.
- [ ] Wire new domain indexes into package exports.
- [ ] Keep code compiling before behavior changes.
- [ ] Explicitly remove/avoid child-constant artifacts after clone (no TABLE-children in constants scope).

## Phase 2: Backend Domain Integration

- [ ] Add `createSetsRoutes` and `createConstantsRoutes` in router:
  - `packages/metahubs-backend/base/src/domains/router.ts`
  - `packages/metahubs-backend/base/src/index.ts`
- [ ] Create `MetahubConstantsService` by cloning/refactoring `MetahubAttributesService` semantics for constants.
- [ ] Refactor `setsRoutes.ts` from `catalogsRoutes.ts`:
  - remove element counters/blockers logic for sets.
  - keep create/edit/copy/delete/list + hub association behavior parity with catalogs.
- [ ] Refactor `constantsRoutes.ts` from `attributesRoutes.ts`:
  - allowed types only `STRING|NUMBER|BOOLEAN|DATE`.
  - remove TABLE-child endpoints and TABLE restrictions.
  - remove `isRequired` toggles/endpoints.
  - keep reorder/move/copy endpoints.
  - add value payload validation and persistence.
  - remove backward-compat-only request/response aliases in new constants endpoints.
- [ ] Update hub-related backend logic to include sets where relation/counter logic currently targets only catalogs/enumerations.

## Phase 3: Data Schema & Type Layer

- [ ] Extend `MetaEntityKind` with `set`:
  - `packages/universo-types/base/src/common/metahubs.ts`
- [ ] Add `CONSTANT_DATA_TYPES` (or equivalent) in `@universo/types`.
- [ ] Add new `_mhb_constants` system table definition in:
  - `packages/metahubs-backend/base/src/domains/metahubs/services/systemTableDefinitions.ts`
- [ ] Add `target_constant_id` to `_mhb_attributes` in declarative definitions + migration.
- [ ] Bump structure version (`CURRENT_STRUCTURE_VERSION`) and include clean additive migration path (without compatibility shims).
- [ ] Update `MetahubObjectsService` kind union and table-name generation policy for sets.
- [ ] Update `packages/schema-ddl/base/src/naming.ts` mapping for `set` prefix handling.

## Phase 4: Frontend Set/Constant Modules

- [ ] Integrate new pages/components into metahubs exports:
  - `packages/metahubs-frontend/base/src/index.ts`
- [ ] Add routes in template router:
  - `/metahub/:metahubId/sets`
  - `/metahub/:metahubId/set/:setId/constants`
  - hub-scoped variants if required.
- [ ] Update both menu configs:
  - `packages/metahubs-frontend/base/src/menu-items/metahubDashboard.ts`
  - `packages/universo-template-mui/base/src/navigation/menuConfigs.ts`
- [ ] Add query keys in `metahubsQueryKeys` for sets/constants.
- [ ] Implement SetList/SetActions from cloned Catalog files.
- [ ] Implement ConstantList/ConstantActions/ConstantFormFields from cloned Attribute files.
- [ ] Keep reorder UX parity: move up/down + dnd sortable list (single-list only).
- [ ] Reuse existing dialog/layout/selector components instead of introducing new visual patterns.

## Phase 5: Constant Value UX

- [ ] Constant form tabs:
  - keep Create/Edit/Copy visual parity with attributes.
  - remove `Presentation` tab for constants.
  - add `Value` tab.
- [ ] Value controls by type:
  - `STRING`: text + VLC input when localized is enabled.
  - `NUMBER`: numeric input with precision/scale constraints.
  - `BOOLEAN`: switch/checkbox.
  - `DATE`: date/time input respecting date composition rules.
- [ ] On save, persist typed value atomically with constant metadata.

## Phase 6: Attribute REF Extension (`set` target)

- [ ] Backend validation in attributes routes:
  - allow `targetEntityKind = 'set'`.
  - require selected constant when kind is `set` (`targetConstantId`).
  - verify constant belongs to selected set.
  - ensure non-set kinds reject non-null `targetConstantId`.
- [ ] Frontend selector:
  - add `Set` option in `TargetEntitySelector`.
  - show second selector for constants after set is selected.
- [ ] Persist selector payload in stable schema (`targetEntityKind`, `targetEntityId`=setId, `targetConstantId`).
- [ ] Update list renderers and helper labels for new target kind.

## Phase 7: Branch Copy & Compatibility Rules

- [ ] Add `copySets` in branch copy options types + normalization:
  - `@universo/types` and `@universo/utils`.
- [ ] Update backend branch clone compatibility checks to include set dependencies.
- [ ] Update frontend branch create/copy dialogs and tests.
- [ ] Add/adjust compatibility error codes/messages if set/constants references are disabled inconsistently.

## Phase 8: Snapshot, Publication, Runtime Sync

- [ ] Extend snapshot model to include sets/constants.
- [ ] Update `SnapshotSerializer` serialization and hash normalization.
- [ ] Update `applicationSyncRoutes` to sync constants metadata/value storage for runtime access.
- [ ] Ensure no runtime DDL breakage for REF->set behavior.

## Phase 9: i18n & Shared Packages Alignment

- [ ] Add full RU/EN keys in metahubs locale bundles for sets/constants and selector errors.
- [ ] Add shared reusable keys to `packages/universo-i18n` when generic.
- [ ] Keep all new user-facing text i18n-first (no hardcoded literals).

## Phase 10: Tests & Verification

- [ ] Backend tests (cloned + refactored):
  - sets routes CRUD/copy/reorder.
  - constants routes CRUD/copy/reorder/value validation.
  - attributes REF->set validation.
  - attributes REF contract validation for `targetConstantId` nullability rules.
  - branch copy options including `copySets`.
- [ ] Frontend tests:
  - selector flow for REF->set->constant.
  - constants form value tab behavior by type.
  - reorder optimistic update rollback.
  - query key invalidation coverage.
  - no extra TABLE-child UI in constants screens.
- [ ] Residue scan in copied files (mandatory).
- [ ] Lint/build checks in touched packages.

---

## Affected Areas Checklist (High Priority)

- [ ] `packages/metahubs-backend/base/src/domains/router.ts`
- [ ] `packages/metahubs-backend/base/src/index.ts`
- [ ] `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubObjectsService.ts`
- [ ] `packages/metahubs-backend/base/src/domains/metahubs/services/systemTableDefinitions.ts`
- [ ] `packages/metahubs-backend/base/src/domains/metahubs/services/structureVersions.ts`
- [ ] `packages/metahubs-backend/base/src/domains/branches/routes/branchesRoutes.ts`
- [ ] `packages/metahubs-backend/base/src/domains/branches/services/MetahubBranchesService.ts`
- [ ] `packages/metahubs-backend/base/src/domains/hubs/routes/hubsRoutes.ts`
- [ ] `packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts`
- [ ] `packages/metahubs-backend/base/src/domains/applications/routes/applicationSyncRoutes.ts`
- [ ] `packages/metahubs-backend/base/src/domains/templates/services/TemplateManifestValidator.ts`
- [ ] `packages/metahubs-backend/base/src/domains/templates/services/TemplateSeedExecutor.ts`
- [ ] `packages/metahubs-backend/base/src/domains/templates/services/TemplateSeedMigrator.ts`

- [ ] `packages/metahubs-frontend/base/src/domains/shared/queryKeys.ts`
- [ ] `packages/metahubs-frontend/base/src/components/TargetEntitySelector.tsx`
- [ ] `packages/metahubs-frontend/base/src/index.ts`
- [ ] `packages/metahubs-frontend/base/src/types.ts`
- [ ] `packages/metahubs-frontend/base/src/i18n/index.ts`
- [ ] `packages/metahubs-frontend/base/src/domains/branches/ui/BranchActions.tsx`
- [ ] `packages/metahubs-frontend/base/src/domains/branches/utils/copyOptions.ts`
- [ ] `packages/metahubs-frontend/base/src/domains/hubs/hooks/mutations.ts`
- [ ] `packages/metahubs-frontend/base/src/menu-items/metahubDashboard.ts`
- [ ] `packages/universo-template-mui/base/src/navigation/menuConfigs.ts`
- [ ] `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx`

- [ ] `packages/universo-types/base/src/common/metahubs.ts`
- [ ] `packages/universo-types/base/src/common/copyOptions.ts`
- [ ] `packages/universo-utils/base/src/validation/copyOptions.ts`
- [ ] `packages/schema-ddl/base/src/naming.ts`

---

## Risks & Mitigations

1. **Risk**: New kind `set` breaks existing kind-based logic.
- Mitigation: global grep for `kind === 'catalog'|'enumeration'` and explicitly review each branch.

2. **Risk**: REF->set semantics cause runtime FK breakage.
- Mitigation: introduce explicit handling in schema-ddl and sync layers before enabling UI path.

3. **Risk**: Branch copy options become inconsistent.
- Mitigation: shared option keys and normalization in `@universo/types` + `@universo/utils` first.

4. **Risk**: clone-refactor leaves stale naming.
- Mitigation: mandatory residue scan and checklist sign-off before merge.

5. **Risk**: i18n regressions due missing keys.
- Mitigation: fail-safe default texts + locale key parity review (`en`/`ru`).

---

## Completion Criteria

- [ ] Sets and Constants domains implemented strictly via clone + line-by-line refactor.
- [ ] Constant value tab fully functional for four allowed types.
- [ ] No `isRequired` in constants.
- [ ] Reorder works (buttons + dnd).
- [ ] Attribute REF supports `set` with constant selection.
- [ ] REF storage contract (`targetConstantId`) is implemented without legacy aliases.
- [ ] Branch copy supports sets safely.
- [ ] Snapshot/sync paths account for sets/constants.
- [ ] Residue scan clean for copied domains.
- [ ] Tests/lint/build for touched packages pass.

---

## Specification Coverage Matrix (Original 1..8)

1. **Mandatory clone-first implementation path**: covered by Mandatory Delivery Rule + exact copy map.
2. **Line-by-line refactor only, no alternative implementation**: covered by Post-Copy Refactor Rule + non-negotiable constraints.
3. **Constant types only STRING/NUMBER/BOOLEAN/DATE with matching settings**: covered in Phase 2 and Phase 5.
4. **Set as container with create/edit/copy parity to Catalog**: covered in Phase 2 and Phase 4.
5. **No Presentation tab for constants; Value tab required including VLC for localizable string**: covered in Phase 5.
6. **No `isRequired` for constants, keep other settings and codename**: covered in Phase 2 and Completion Criteria.
7. **Constant reorder via Up/Down and drag-and-drop**: covered in Overview, Phase 4, Completion Criteria.
8. **Attribute REF extends with Set + Constant selection**: covered in Phase 6 and Completion Criteria.

---

## Open Questions for Final Implementation Contract

1. Should sets/constants be exposed in runtime navigation, or remain metadata-only in this iteration?
