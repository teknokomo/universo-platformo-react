# Plan: Metahub Catalog System Attributes + Migration Hardening

> Date: 2026-03-16  
> Mode: PLAN  
> Status: DRAFT FOR DISCUSSION  
> Complexity: Level 4 (multi-package backend + frontend + runtime contract)  
> Scope: configurable catalog lifecycle system attributes, publication/runtime schema propagation, runtime delete-strategy hardening, and catalog UI restructuring  
> Note: fresh database baseline is allowed; no legacy compatibility layer is required; do not add a schema/template version bump unless implementation proves it is technically unavoidable.

---

## Executive Summary

The requested feature is not only a metahub attribute-editor change.

Today the repository hardcodes runtime `_app_*` lifecycle fields in the schema generator and then assumes the same fields exist in runtime synchronization and CRUD routes. Because of that coupling, a safe implementation must introduce one explicit contract that starts in metahub catalog configuration, survives publication snapshot generation, becomes part of the runtime application schema contract, and is then consumed by application runtime services without per-request schema introspection.

The recommended implementation direction is:

1. keep physical system column names canonical (`_app_*`, `_upl_*`),
2. make lifecycle families configurable at the catalog-definition level,
3. persist that configuration as explicit design-time metadata with stable system keys,
4. derive a compact runtime lifecycle contract during publication/app sync,
5. make runtime routes consume that contract instead of hardcoding `_app_deleted` assumptions.

This keeps the design modern, avoids runtime guesswork, preserves performance, and prevents the feature from becoming a fragile mix of UI toggles and silent schema drift.

---

## Requirement Coverage

| Requested outcome | Planned coverage |
| --- | --- |
| New catalogs get publication/archive/delete system attributes automatically | Covered in Phases 2-3 via shared registry + catalog seeding service |
| Existing `_app_*` hardcoding becomes configurable per catalog | Covered in Phases 1, 4, 5 via lifecycle registry + publication/runtime contract |
| Users may deactivate system attributes but not delete them | Covered in Phases 2 and 6 via immutable system rows + guarded UI/actions |
| Deactivating `_app_deleted` changes delete mode from soft to hard | Covered in Phase 5 via runtime delete-strategy abstraction |
| Deactivating `_app_deleted_at` / `_app_deleted_by` suppresses those audit fields | Covered in Phases 4-5 via derived runtime lifecycle contract |
| Human-readable RU/EN system attributes with visible type information | Covered in Phases 1 and 6 via shared i18n keys + typed UI rendering |
| Base and base-demo templates seed the same system attributes | Covered in Phase 3 |
| Catalog tabs become `Attributes -> System -> Elements -> Settings` and Settings stays visible | Covered in Phase 6 |
| No legacy compatibility requirement | Explicitly assumed throughout the plan |
| Deep test system planned up front | Covered in Phase 7 |

---

## Verified Current-State Findings

### 1. Runtime lifecycle fields are hardcoded today

- `@universo/schema-ddl` currently injects runtime `_app_*` fields directly into generated business tables and runtime metadata tables.
- This is currently a generator concern, not a metahub catalog-definition concern.

### 2. Runtime applications assume `_app_deleted` exists

- `@universo/applications-backend` synchronization and runtime CRUD routes explicitly filter on `_app_deleted = false` and update `_app_deleted`, `_app_deleted_at`, `_app_deleted_by` directly.
- Therefore deactivating `_app_deleted` is a behavior change, not only a schema change.

### 3. Metahub design-time attributes do not yet have a stable system-attribute identity layer

- The current attribute flow treats catalog attributes as ordinary design-time entities.
- There is no verified explicit metadata contract yet for `is_system`, `system_key`, or `managed-by-platform` behavior on catalog attributes.

### 4. Publication snapshot generation is the critical seam

- Published runtime applications are derived from metahub snapshot serialization/deserialization.
- If catalog system-attribute configuration does not enter the snapshot/runtime-definition pipeline, runtime applications cannot honor it deterministically.

### 5. Base templates do not seed this capability yet

- `basic.template.ts` and `basic-demo.template.ts` currently seed ordinary domain objects and layout/settings data, but no dedicated catalog lifecycle system-attribute metadata.

### 6. Current catalog tabs do not match the requested UX

- Current catalog pages expose `Attributes`, `Elements`, and `Settings` only.
- `Settings` visibility is also inconsistent between tab hosts.

---

## Recommended Scope Cut

To keep the implementation safe and tractable, this plan intentionally limits configurability to the lifecycle families that the request explicitly targets.

### Configurable in this wave

- `_app_published`, `_app_published_at`, `_app_published_by`
- `_app_archived`, `_app_archived_at`, `_app_archived_by`
- `_app_deleted`, `_app_deleted_at`, `_app_deleted_by`
- Platform-level lifecycle analogs where the current metahub layer already models them as `_upl_*`

### Not configurable in this wave

- `_app_owner_id`
- `_app_access_level`
- core `_upl_created_*` / `_upl_updated_*` audit fields
- physical renaming of canonical system column names
- free-form creation/deletion of arbitrary custom system attributes

Reasoning: owner/access/security and baseline audit columns behave like runtime infrastructure, not like optional catalog lifecycle controls. Pulling them into this wave would enlarge risk significantly without matching the user requirement.

---

## Target Architecture

### A. Shared System-Attribute Registry

Create one shared registry that describes every supported lifecycle system attribute by stable key rather than by ad hoc UI labels or duplicated route constants.

Recommended package placement:

- `@universo/types`: registry-facing types and runtime contract types
- `@universo/utils`: pure helper functions for deriving runtime contracts and validating toggle combinations
- `@universo/i18n`: shared RU/EN labels for reusable system-field names/groups/types

Important reuse rule:

- Do not create a second independent low-level source of truth for `_app_*` / `_upl_*` column names.
- Reuse the existing shared system-field contract in `@universo/utils/database/systemFields.ts` as the canonical low-level field-name layer.
- If a richer registry is introduced for UI/runtime-contract purposes, it must be derived from that existing field contract instead of repeating raw string literals in a parallel catalog.

Recommended core types:

```ts
export type CatalogSystemFieldKey =
  | 'app.published'
  | 'app.published_at'
  | 'app.published_by'
  | 'app.archived'
  | 'app.archived_at'
  | 'app.archived_by'
  | 'app.deleted'
  | 'app.deleted_at'
  | 'app.deleted_by'
  | 'upl.published'
  | 'upl.published_at'
  | 'upl.published_by'
  | 'upl.archived'
  | 'upl.archived_at'
  | 'upl.archived_by'
  | 'upl.deleted'
  | 'upl.deleted_at'
  | 'upl.deleted_by'

export interface CatalogSystemFieldDefinition {
  key: CatalogSystemFieldKey
  columnName: string
  layer: 'app' | 'upl'
  family: 'published' | 'archived' | 'deleted'
  valueType: 'boolean' | 'timestamp' | 'uuid'
  defaultEnabled: boolean
  canDisable: boolean
  requires?: CatalogSystemFieldKey[]
}

export interface ApplicationLifecycleContract {
  publish: { enabled: boolean; trackAt: boolean; trackBy: boolean }
  archive: { enabled: boolean; trackAt: boolean; trackBy: boolean }
  delete: {
    mode: 'soft' | 'hard'
    trackAt: boolean
    trackBy: boolean
  }
}
```

Rules:

- Stable key is the source of truth.
- Canonical physical column name is registry-owned, not user-editable.
- Dependency rules are explicit, for example `_app_deleted_at` requires `_app_deleted`.
- The registry must be pure data, so it can be reused in backend, frontend, tests, and docs.

### B. Design-Time Persistence Contract

Do not rely on runtime `_app_attributes` metadata alone as the design-time source of truth.

Recommended direction for this repository:

- extend the existing `_mhb_attributes` design-time contract directly,
- do not introduce a parallel side-table for system attributes in wave 1,
- do not hide runtime-critical system identity only inside `ui_config`.

Reasoning:

- template seeding, template migration, template cleanup, snapshot serialization, optimistic CRUD, and attribute ordering logic already center on `_mhb_attributes`.
- introducing a second persistence surface would duplicate those flows and increase drift risk.
- storing `systemKey`/`isSystem` semantics only in `ui_config` would mix UI concerns with runtime-critical lifecycle behavior.

Preferred shape for this wave: add explicit first-class metadata to `_mhb_attributes` and keep ordinary presentation/UI settings in existing JSON fields.

Recommended minimum metadata:

```ts
interface CatalogAttributeSystemMetadata {
  isSystem: boolean
  systemKey: CatalogSystemFieldKey | null
  isManaged: boolean
  isEnabled: boolean
}
```

Rules:

- user-defined attributes have `isSystem = false`
- system attributes have stable `systemKey`
- system rows cannot be deleted or have their key/data type changed
- only `isEnabled` may be toggled from the UI for system rows
- system rows must also be protected from backend reorder and cross-list transfer operations, not only from UI actions
- generic design-time attribute queries must exclude system rows by default; system rows should be returned only from explicit system-attribute list APIs or explicit include-system code paths

Critical repository-specific implication:

- current metahub attribute routes and metahub element validation already consume `findAll(...)` / `findAllFlat(...)` over `_mhb_attributes`.
- therefore the implementation must split ordinary attribute consumption from system-attribute consumption explicitly, otherwise system rows will leak into normal Attributes screens and element validation/input flows.

### C. Publication-to-Runtime Contract

At publication/app-sync time, derive a compact runtime lifecycle contract once and store it with the runtime application state/release metadata instead of re-reading information_schema on every request.

Recommended rule:

- publication snapshot includes explicit system-field metadata for each catalog,
- app-sync resolves that metadata into `ApplicationLifecycleContract`,
- the contract is persisted alongside application sync metadata or release metadata,
- runtime CRUD/sync services consume the contract directly.

Serialization rule:

- system attributes stored in `_mhb_attributes` must not be emitted into the generic runtime `fields` list used for ordinary business attributes.
- snapshot serialization should export system metadata in a dedicated structure and keep generic `fields` / `childFields` for ordinary business attributes only.
- this avoids duplicate runtime column generation and prevents lifecycle fields from appearing as normal editable attributes in generated application metadata.

Versioning rule:

- the default implementation target is to keep `snapshotFormatVersion = 1` and add only backward-compatible optional metadata.
- if implementation proves that consumers cannot safely interpret the enriched snapshot under format v1, stop and document why a format bump is technically unavoidable before changing the version contract.

This is both safer and faster than column-existence probing on every request.

### D. Runtime Delete Strategy Abstraction

All runtime delete/update/list flows must stop encoding `_app_deleted` directly and instead call a shared contract-aware helper.

Recommended helper shape:

```ts
export function buildDeleteStrategy(contract: ApplicationLifecycleContract) {
  return {
    activeRowPredicate(alias?: string) {
      if (contract.delete.mode === 'hard') {
        return 'TRUE'
      }
      const prefix = alias ? `${alias}.` : ''
      return `${prefix}_app_deleted = false`
    },
    buildDeleteMutation(now: string, userId: string | null) {
      if (contract.delete.mode === 'hard') {
        return { kind: 'hard-delete' as const }
      }
      return {
        kind: 'soft-delete' as const,
        fields: {
          _app_deleted: true,
          ...(contract.delete.trackAt ? { _app_deleted_at: now } : {}),
          ...(contract.delete.trackBy ? { _app_deleted_by: userId } : {}),
        },
      }
    },
  }
}
```

This keeps runtime semantics explicit and centrally testable.

---

## Package Impact Summary

| Package | Planned responsibility |
| --- | --- |
| `@universo/types` | system-field keys, definition types, lifecycle contract types |
| `@universo/utils` | registry helpers, dependency validation, contract derivation helpers |
| `@universo/i18n` | shared RU/EN labels for system fields/families/types |
| `@universo/metahubs-backend` | catalog metadata persistence, seeding, snapshot serialization, routes/services |
| `@universo/schema-ddl` | consume lifecycle contract when generating runtime tables |
| `@universo/applications-backend` | contract-aware runtime CRUD + sync behavior |
| `@universo/metahubs-frontend` | new System tab, toggle UX, tab-order consistency, query invalidation |
| `@universo/template-mui` | only extract generic UI primitives if duplication is real after implementation |
| `@universo/apps-template-mui` | validate runtime app behavior if lifecycle contract affects shared runtime UI expectations |

---

## Implementation Phases

### Phase 1: Shared Contract Foundation

- [ ] Add the shared registry types to `@universo/types`.
- [ ] Add pure helpers to `@universo/utils`:
  - `getCatalogSystemFieldDefinitions()`
  - `validateCatalogSystemFieldToggleSet(...)`
  - `deriveApplicationLifecycleContract(...)`
- [ ] Add shared i18n keys for system-field labels, family labels, and type labels.
- [ ] Add unit tests that cover registry completeness, dependency validation, and derived delete-mode logic.

Implementation rules:

- No package should hardcode system-field lists after this phase.
- Shared helpers must be side-effect-free and test-only by default.
- Use existing UUID v7 helpers for generated system rows.

### Phase 2: Metahubs Backend Metadata Persistence

- [ ] Extend the metahub design-time catalog-attribute persistence model with stable system metadata.
- [ ] Add unique protection so one catalog cannot have duplicate rows for the same `systemKey`.
- [ ] Add service/store helpers:
  - `ensureCatalogSystemAttributes(...)`
  - `listCatalogSystemAttributes(...)`
  - `toggleCatalogSystemAttribute(...)`
- [ ] Make delete/update services fail closed when a caller attempts to delete or structurally mutate a system row.
- [ ] Block sort-order mutation, neighbor-swap, reorder, and cross-list move operations for system rows at the backend service/route layer, not only in the UI.
- [ ] Change ordinary attribute service/query methods so they exclude system rows by default, and add explicit include-system or dedicated system-list methods for the System tab.
- [ ] Keep metahub element validation and metahub element CRUD bound to ordinary non-system attributes only.

Recommended write pattern:

```ts
await executor.query(
  `
    insert into ... (id, catalog_id, system_key, is_system, is_managed, is_enabled, ...)
    values (...)
    on conflict (catalog_id, system_key)
    do update set
      is_enabled = excluded.is_enabled,
      _upl_updated_at = now(),
      _upl_updated_by = excluded._upl_updated_by
  `,
  params,
)
```

Reasoning: idempotent seeding is mandatory because both template application and repeated catalog hardening may call the same code path.

### Phase 3: Catalog Creation and Template Seeding

- [ ] Call `ensureCatalogSystemAttributes(...)` from catalog creation orchestration.
- [ ] Apply the same helper during builtin template seeding for both `basic` and `basic-demo`.
- [ ] Keep one shared seed path so template behavior and manual catalog creation cannot drift.
- [ ] Update all template-seed paths that currently operate on `_mhb_attributes`, including executor, migrator, and cleanup logic, so template sync remains consistent after the feature is introduced.
- [ ] Add targeted tests proving:
  - new catalog creation always seeds the required system rows,
  - repeated template application remains idempotent,
  - disabling a system row survives subsequent non-destructive reapply flows if that is the chosen product rule.

Recommended product rule for discussion:

- first creation seeds defaults from registry,
- later repair/hardening may add missing rows,
- later repair must not silently re-enable an intentionally disabled system row.

### Phase 4: Publication Snapshot and Runtime Definition Propagation

- [ ] Extend metahub snapshot serialization so catalog system-field metadata is exported explicitly.
- [ ] Extend snapshot deserialization so runtime entity definitions include the effective lifecycle contract input.
- [ ] Keep snapshot hashes deterministic by normalizing system metadata ordering before hashing.
- [ ] Ensure release bundles preserve the same contract.
- [ ] Keep generic entity field arrays free of lifecycle system rows so runtime attribute metadata remains business-field-only.

Important safety rule:

- The snapshot must carry explicit system metadata instead of relying on “infer from current attribute names”.

Otherwise bundle validation and runtime rebuilds can become nondeterministic.

### Phase 5: Runtime Schema Generation and Application Behavior Hardening

- [ ] Refactor `@universo/schema-ddl` so lifecycle system columns are not injected unconditionally.
- [ ] Keep infrastructure columns that remain out of scope as unconditional if runtime logic still requires them.
- [ ] Generate per-entity runtime columns from the derived lifecycle contract.
- [ ] Persist the derived `ApplicationLifecycleContract` in the existing central application sync/release metadata surface inside `applications.cat_applications`; do not introduce a second metadata table for this feature.
- [ ] Refactor `@universo/applications-backend` helpers/routes/services to use contract-aware helpers for:
  - active-row predicates,
  - delete mutations,
  - restore behavior,
  - metadata sync updates,
  - enumeration/value sync where `_app_deleted*` is currently assumed.
- [ ] Keep ordinary runtime attribute metadata and generated runtime forms free of lifecycle system fields; lifecycle behavior should come from the explicit contract, not from exposing those fields as editable business attributes.

Recommended sequencing:

1. introduce shared lifecycle-contract helpers,
2. refactor sync routes to consume them,
3. refactor runtime CRUD routes to consume them,
4. only then switch schema generation to conditional lifecycle columns.

Reasoning: this order avoids a transient state where runtime routes still expect `_app_deleted` after schema generation stops creating it.

### Phase 6: Frontend System Tab and UX Consolidation

- [ ] Add a dedicated `System` tab to catalog detail navigation.
- [ ] Standardize tab order across catalog surfaces:
  - `Attributes`
  - `System`
  - `Elements`
  - `Settings`
- [ ] Ensure `Settings` remains visible regardless of the currently open catalog sub-view.
- [ ] Build dedicated system-attribute queries/mutations with centralized query keys.
- [ ] Render type badges and localized RU/EN names from the shared registry/i18n keys.
- [ ] Disable destructive actions for system rows in the UI.
- [ ] Expose only supported toggles; do not expose type/name editing.
- [ ] Keep the existing Attributes tab bound to ordinary attributes only; do not show system rows there.
- [ ] Keep metahub element editors and runtime-generated business forms free of lifecycle system rows.

Reuse rules for this phase:

- reuse the existing MUI Tabs pattern already used in `AttributeList`, `ElementList`, `ConstantList`, and `OptionValueList` instead of inventing a new tab shell abstraction for one feature.
- reuse the existing `FlowListTable`/`BaseEntityMenu`/edit-dialog composition unless implementation proves that a system-row list truly needs a new primitive.
- reuse the existing `metahubsQueryKeys` + `invalidate*Queries` pattern for new list/detail invalidation paths instead of creating an unrelated cache-management style.
- keep the Settings behavior aligned with the existing edit-dialog pattern already used by neighboring metahub screens.

Recommended UI split:

- keep metahub-specific tab shell and page orchestration in `@universo/metahubs-frontend`,
- extract a generic `SystemFieldBadge` / `TypeBadge` primitive to `@universo/template-mui` only if at least two screens truly reuse it.

Recommended TanStack Query shape:

```ts
systemAttributes: {
  all: ['metahubs', 'system-attributes'] as const,
  byCatalog: (catalogId: string) => ['metahubs', 'system-attributes', 'catalog', catalogId] as const,
}
```

### Phase 7: Deep Test Matrix

- [ ] `@universo/types` / `@universo/utils`
  - registry integrity
  - dependency validation
  - lifecycle contract derivation

- [ ] `@universo/metahubs-backend`
  - catalog creation seeds system rows
  - template seeding seeds the same rows
  - system rows cannot be deleted
  - toggle route/service validation
  - ordinary attribute list endpoints exclude system rows by default
  - element validation ignores system rows
  - snapshot round-trip keeps contract stable

- [ ] `@universo/schema-ddl`
  - generated table with all lifecycle families enabled
  - generated table with delete disabled
  - generated table with delete enabled but deleted_at/deleted_by disabled
  - generated table with publish/archive family subsets

- [ ] `@universo/applications-backend`
  - runtime list/update/delete flows in soft-delete mode
  - runtime delete in hard-delete mode
  - sync/value/enumeration flows without `_app_deleted_at` and/or `_app_deleted_by`
  - active-row predicate behavior derived from contract instead of hardcoded columns
  - release-bundle export/import preserves lifecycle contract
  - ordinary runtime attribute metadata endpoints do not expose lifecycle system fields as editable business fields

- [ ] `@universo/metahubs-frontend`
  - tab-order rendering
  - Settings visibility from all catalog tabs
  - system rows render localized labels and types
  - toggle mutation invalidation and optimistic UI behavior
  - delete action hidden/disabled for system rows
  - ordinary Attributes tab does not show system rows

- [ ] integration / acceptance
  - fresh-db bootstrap with both builtin templates
  - catalog create -> publish -> runtime app sync -> CRUD in soft-delete mode
  - catalog create -> disable delete -> publish -> runtime app sync -> CRUD in hard-delete mode
  - catalog create -> disable deleted_at/by only -> publish -> runtime delete writes only enabled audit columns

### Phase 8: Validation, Docs, and Rollout Guardrails

- [ ] Update package READMEs or migration docs only where the runtime contract materially changes.
- [ ] Document the lifecycle-contract rule in `memory-bank/systemPatterns.md` after implementation, not during planning.
- [ ] Validate with targeted package test runs during each phase.
- [ ] Finish with a full root `pnpm build`.

Recommended validation sequence during implementation:

1. `pnpm --filter @universo/types build`
2. `pnpm --filter @universo/utils test`
3. `pnpm --filter @universo/metahubs-backend test`
4. `pnpm --filter @universo/schema-ddl test`
5. `pnpm --filter @universo/applications-backend test`
6. `pnpm --filter @universo/metahubs-frontend test`
7. `pnpm build`

---

## Safety and Performance Rules

### Safety

1. Never infer lifecycle behavior from optional column existence at request time.
2. Never let the UI delete system rows.
3. Never let system-row toggles rewrite system keys or physical types.
4. Refactor runtime routes before disabling unconditional schema generation.
5. Keep SQL parameterized; any dynamic identifier must go through validated identifier helpers.

### Performance

1. Derive lifecycle contracts once during publication/app sync, not per request.
2. Reuse centralized query keys and targeted invalidation on the frontend.
3. Use idempotent set-based SQL for seeding/hardening rather than row-by-row loops.
4. Avoid repeated metadata joins inside hot CRUD paths if the contract can be read from cached application state.

### Maintainability

1. One shared registry, no repeated field lists.
2. One delete-strategy helper used by sync and CRUD.
3. One seeding helper used by manual catalog creation and builtin templates.
4. One snapshot contract for publication, release bundle, and runtime app sync.
5. Reuse existing metahub list/dialog/query-key patterns before creating any new UI or cache abstraction.

---

## Main Risks and Mitigations

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Runtime routes still assume `_app_deleted` after generator changes | Would break deletes, updates, and active-row reads immediately | Refactor routes/services before conditional schema rollout |
| Snapshot format drifts from runtime contract | Would make publication/release-bundle behavior nondeterministic | Carry explicit normalized system metadata in snapshots |
| Template seeding and manual creation diverge | Would create inconsistent catalogs | Use one shared `ensureCatalogSystemAttributes(...)` service |
| UI allows unsupported mutation of system rows | Would corrupt the design-time contract | Expose toggle-only UI, block destructive actions in backend and frontend |
| Over-scoping into owner/access/security fields | Would add large hidden coupling and delay delivery | Limit wave 1 to lifecycle families only |

---

## Recommended First Implementation Slice

If implementation starts immediately after plan approval, the safest first slice is:

1. shared registry/types/helpers,
2. metahubs-backend persistence + catalog seeding,
3. frontend System tab over that persistence,
4. snapshot/runtime contract propagation,
5. runtime applications/schema-ddl refactor,
6. full acceptance validation.

This yields visible progress early while still respecting the real backend/runtime coupling.

---

## Definition of Done

This initiative is done only when all of the following are true:

1. new catalogs consistently receive canonical lifecycle system rows,
2. those rows are toggleable but not deletable,
3. both builtin templates seed the same capability,
4. publication snapshots and release bundles preserve lifecycle configuration explicitly,
5. runtime schema generation reflects the derived contract,
6. runtime CRUD/sync behavior works in both soft-delete and hard-delete modes,
7. catalog tabs match the requested order and keep Settings visible,
8. all new user-facing text is internationalized,
9. deep tests cover the configuration matrix,
10. the final root `pnpm build` passes.