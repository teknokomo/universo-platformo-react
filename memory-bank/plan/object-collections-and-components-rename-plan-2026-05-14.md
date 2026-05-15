# Object Collections And Components Rename Plan

> Created: 2026-05-14
> Mode: PLAN, QA-updated
> Status: Draft - confirmed vocabulary and QA corrections applied
> Complexity: Level 4 - major cross-package platform vocabulary, persistence, runtime, fixture, and documentation refactor

## Overview

Rename the current universal `Catalog` standard entity type so it no longer conflicts with future 1C-compatible `Catalogs`/directories and no longer understates its actual role as a record-bearing, lifecycle-aware, scriptable, ledger-capable runtime object type. At the same time, remove remaining `Attribute` terminology from the active implementation surface and align the platform on the product-approved `Component` concept.

The work is intentionally not backward-compatible. The E2E database will be recreated, and the current schema/template versions must not be bumped. Existing migration definitions, template manifests, snapshot generators, fixtures, tests, and docs can be changed directly. Temporary compatibility aliases may be used only inside a phase to keep intermediate tests debuggable; they must be deleted before final acceptance.

## Confirmed Naming Contract

### Catalogs

`Objects` / `Объекты` is a reasonable user-facing label for the current universal Catalog concept, but plain `object` is overloaded in code: JavaScript `Object`, `_mhb_objects`, metadata objects, runtime rows, and "object" as a general noun all collide.

Recommended contract:

- User-facing English label: `Objects`
- User-facing Russian label: `Объекты`
- Persisted standard kind key: `object`
- Internal surface/helper name: `objectCollection`
- Physical runtime table prefix: `obj`
- Documentation term on first mention: `Object collections`

This keeps the UI short while preserving precision in code:

```ts
export const STANDARD_OBJECT_KIND = 'object' as const

export const ENTITY_SURFACE_TO_SETTINGS_KIND_MAP = {
  treeEntity: 'hub',
  objectCollection: STANDARD_OBJECT_KIND,
  valueGroup: 'set',
  optionList: 'enumeration',
  page: 'page',
  ledger: 'ledger'
} satisfies Record<EntitySurfaceKey, EntitySettingsKind>
```

Rejected alternatives:

- `Catalogs`: conflicts with future 1C-compatible directories and current behavior is wider than a catalog.
- `Collections`: technically accurate, but too generic and less clear in Russian UI.
- `Record Collections`: most precise, but verbose for navigation and dialogs.
- `Business Objects`: clear in enterprise apps, but too business-specific for the wider Universo platform.

### Attributes To Components

The product decision is to rename the current Attribute concept to `Components` / `Компоненты`. This is a better fit than `Fields` because the model now supports script attachment, events, table-like child structures, behavior settings, reuse scenarios, and future non-field runtime roles. Separate UPDL Components are no longer a competing concept; these Entity Components are the replacement direction for that layer.

This creates one architectural conflict that must be resolved before implementation: the project already uses "component" for Entity type capability flags, especially `ComponentManifest`, `ENTITY_COMPONENT_KEYS`, and `components.physicalTable`. Those names should be renamed to capability terminology so that `Component` is reserved for former Attributes.

Recommended contract:

- User-facing English label: `Components`
- User-facing Russian label: `Компоненты`
- Technical term: `Entity Components` or `Component Definitions`
- Route segment: `components`
- Design-time metadata table: `_mhb_components`
- Runtime metadata table: `_app_components`
- SQL column prefix default for runtime component-backed columns: `cmp`
- Former Entity type `components` capability map: rename to `capabilities`
- Former `ComponentManifest`: rename to `EntityCapabilityManifest` or `EntityTypeCapabilities`

The Entity constructor should expose behavior through capabilities, not through hardcoded kind checks:

```ts
export interface EntityTypeCapabilities {
  dataSchema?: EnabledCapabilityConfig
  records?: EnabledCapabilityConfig
  physicalTable?: {
    enabled: true
    prefix: string
  }
  scripting?: EnabledCapabilityConfig
  ledgerSchema?: EnabledCapabilityConfig
}

export interface EntityComponentDefinition {
  id: string
  ownerEntityId: string
  codename: string
  dataType: ComponentDataType
  parentComponentId?: string
  isDisplayComponent?: boolean
}
```

## Context Loaded

Local rules and context reviewed:

- `.gemini/rules/custom_modes/plan_mode.md`
- `.gemini/rules/memory-bank.md`
- `memory-bank/tasks.md`
- `memory-bank/activeContext.md`
- `memory-bank/techContext.md`
- `memory-bank/systemPatterns.md`
- Existing plans for Entity architecture, LMS, ledgers, layouts, and E2E Supabase.
- Package READMEs for metahubs backend/frontend, apps-template-mui, and E2E testing.
- Playwright repository skill: `.agents/skills/playwright-best-practices/SKILL.md`
- Context7 docs:
  - Playwright current guidance: locators, web-first assertions, screenshots, tracing, no fixed waits.
  - Zod current guidance: use `safeParse` for boundary validation, strict schemas for persisted contracts, and inferred types from schemas where practical.
  - TanStack Query v5 current guidance: keep optimistic mutation behavior limited to local cache changes with cancellation, rollback, and invalidation.
  - Official 1C documentation (`https://1c-dn.com/1c_enterprise/catalogs/`, `https://1c-dn.com/1c_enterprise/configuration_objects/`, `https://1c-dn.com/library/tutorials/practical_developer_guide_objects_objects_objects/`): 1C uses `Catalogs` as a distinct configuration object type and also uses "object" in multiple contexts; this confirms both the Catalog naming conflict and the need to document `Object collections` precisely.

## Local Findings

1. The current `catalog` kind is not only UI text. It is a persisted kind key, template preset codename, settings namespace, route parameter, script attachment kind, snapshot value, fixture contract, DDL naming input, runtime row classifier, system-app business table kind, migration validation input, and test contract.
2. The repository already partially neutralized the old Attribute model into `fieldDefinition` folders, APIs, and docs, but the product decision is now `Component`. Active DB tables, columns, i18n, comments, fixtures, snapshots, system-app definitions, migration compiler artifacts, and runtime code still expose both `attribute` and `fieldDefinition` vocabulary and must converge to `component`.
3. The current `catalog` standard type enables `dataSchema`, `records`, `hierarchy`, `relations`, `scripting`, `layoutConfig`, `runtimeBehavior`, `physicalTable`, `identityFields`, `recordLifecycle`, `posting`, and `ledgerSchema`. The new name must cover all of those capabilities, and `identityFields` should become `identityComponents`.
4. Standard entity type definitions are seeded rows in `_mhb_entity_type_definitions`; services fail closed when standard definitions are missing. Therefore the new `object` standard type must be seeded by the templates, not synthesized in code.
5. `basic`, `basic-demo`, and `lms` templates explicitly include the `catalog` preset and settings such as `entity.catalog.allowAttributeCopy`.
6. LMS template and fixture contracts contain many `kind: 'catalog'`, `attachedToKind: 'catalog'`, `targetEntityKind: 'catalog'`, and "Catalog-backed" assumptions.
7. `schema-ddl` currently has partial prefix configurability through `physicalTablePrefix`, but it still contains a hardcoded kind prefix map (`catalog -> cat`) and hardcoded attribute-derived column/table naming (`attr`, `_app_attributes`). Fresh runtime schemas must derive Object table prefixes from Entity type capabilities and must create `_app_components`.
8. Application runtime code still contains "linked collection" abstractions. That name is better than Catalog, but for this work it should converge to `objectCollection` where it specifically means the renamed standard type.
9. The self-hosted generator still uses direct `waitForTimeout` around screenshots. New or touched browser code should use Playwright locators and web-first assertions instead.
10. Docs contain both target terms and unrelated "catalog" uses. The optional global migration catalog and historical progress logs are not part of this rename. Platform fixed system tables such as `applications.cat_applications` must be audited separately: if they are Entity-like Object tables, rename them; if they are truly non-Entity migration catalog storage, document a narrow allowlist.
11. Application sync code still filters runtime entities with `entity.kind === 'catalog'` and relationship code checks `targetEntityKind === 'catalog'`. This is the main architectural risk: runtime behavior must be capability-driven, not renamed to `entity.kind === 'object'` in the same hardcoded pattern.
12. Workspace seed code contains legacy table-name parsing for `cat_*`, `doc_*`, and `rel_*`. Because the target is a fresh database with no legacy preservation, this fallback should be removed and replaced with snapshot-provided physical table names/prefixes.
13. `@universo/migrations-core` and platform system-app definitions still encode `SystemAppBusinessTableKind = 'catalog'` and canonical `cat_` prefixes. If left unchanged, the platform would keep an active second Catalog vocabulary outside Metahubs, so the plan must either rename it to Object or document a narrow non-Entity exception. The target for this task is rename, not legacy preservation.
14. Shared snapshot and schema contracts still use `fields`, `systemFields`, `MetaFieldDefinition`, `FieldDefinitionDataType`, `FieldDefinitionValidationRules`, `TemplateSeedAttribute`, `childFields`, and `childAttributes`. These are not just implementation details because they are serialized into fixtures and generated apps.

## QA Corrections Applied

- The former Attribute model now targets `Components` / `Компоненты`, not `Fields`.
- Entity type capability infrastructure must be renamed from `components` / `ComponentManifest` to `capabilities` / `EntityCapability*` before or during the Attribute -> Component implementation phase.
- Runtime Object table naming must be driven by the Entity constructor and snapshot (`capabilities.physicalTable.prefix`) rather than hardcoded `catalog -> cat` or `object -> obj` logic.
- Fresh application runtime tables should be `obj_*` only for the standard Object preset. Custom Object-like Entity types must be able to publish another safe prefix and have the runtime create matching tables.
- Design-time and runtime metadata tables should become `_mhb_components` and `_app_components`; active code should not keep `_mhb_attributes`, `_app_attributes`, `parent_attribute_id`, or `is_display_attribute`.
- Application sync and workspace seeding must switch from kind checks and legacy table-name parsing to capability validation and snapshot-provided physical table metadata.
- System-app and migration compiler vocabulary must be audited with the same rule: active Entity-like table definitions use Object/Component terminology, while only the central migration catalog domain may keep "catalog" as a repository/catalog noun.
- Existing UI surfaces should be renamed and reused. The implementation should keep current patterns such as `EntityFormDialog`, resource tabs, shared entity menus, tables, dialogs, settings overlays, and runtime dashboard density instead of introducing a parallel UI component set.

## Affected Areas

### Shared Types And Contracts

- `packages/universo-types/base/src/common/metahubs.ts`
- `packages/universo-types/base/src/common/entityComponents.ts` -> `entityCapabilities.ts`
- `packages/universo-types/base/src/common/entityTypeDefinition.ts`
- `packages/universo-types/base/src/common/recordBehavior.ts`
- `packages/universo-types/base/src/common/linkedCollectionRuntimeConfig.ts`
- `packages/universo-types/base/src/common/catalogRuntimeConfig.ts`
- `packages/universo-types/base/src/common/applicationLayouts.ts`
- `packages/universo-types/base/src/common/scripts.ts`
- `packages/universo-types/base/src/common/ledgers.ts`
- `packages/universo-types/base/src/__tests__/**`
- Rename shared serialized contracts where they represent former Attributes:
  - `MetaFieldDefinition` -> `MetaComponent`
  - `FieldDefinitionDataType` -> `ComponentDataType`
  - `FieldDefinitionValidationRules` -> `ComponentValidationRules`
  - `MetaEntityDefinition.fields` -> `components`
  - `childFields` -> `childComponents`
  - `identityFields` -> `identityComponents`
  - `TemplateSeedAttribute` -> `TemplateSeedComponent`
  - `attributes` / `childAttributes` template keys -> `components` / `childComponents`
  - `systemFields` snapshot key -> `systemComponents`

### Schema DDL And Runtime Metadata

- `packages/schema-ddl/base/src/builtinEntityKinds.ts`
- `packages/schema-ddl/base/src/naming.ts`
- `packages/schema-ddl/base/src/SchemaGenerator.ts`
- `packages/schema-ddl/base/src/diff.ts`
- `packages/schema-ddl/base/src/snapshot.ts`
- `packages/schema-ddl/base/src/systemTables.ts`
- `packages/schema-ddl/base/src/types.ts`
- `packages/schema-ddl/base/src/__tests__/**`
- Serialized schema types:
  - `FieldDefinition` -> `EntityComponentDefinition`
  - `SchemaFieldSnapshot` -> `SchemaComponentSnapshot`
  - `SchemaEntitySnapshot.fields` -> `components`
  - `SysAttributeRecord` -> `SysComponentRecord`

### Platform Migrations And System Apps

- `packages/universo-migrations-core/base/src/types.ts`
- `packages/universo-migrations-core/base/src/validate.ts`
- `packages/universo-migrations-platform/base/src/**`
- `packages/admin-backend/base/src/platform/systemAppDefinition.ts`
- `packages/profile-backend/base/src/platform/systemAppDefinition.ts`
- `packages/start-backend/base/src/platform/systemAppDefinition.ts`
- `packages/applications-backend/base/src/platform/systemAppDefinition.ts`
- `packages/metahubs-backend/base/src/platform/systemAppDefinition.ts`
- RLS policy optimization files that reference `cat_*` platform tables.
- System-app schema/compiler tests that currently assert `catalog`, `cat_*`, `attribute`, or `__attr__` artifact names.

### Metahubs Backend

- `packages/metahubs-backend/base/src/domains/templates/data/standardEntityTypeDefinitions.ts`
- `packages/metahubs-backend/base/src/domains/templates/data/basic.template.ts`
- `packages/metahubs-backend/base/src/domains/templates/data/basic-demo.template.ts`
- `packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts`
- `packages/metahubs-backend/base/src/domains/templates/data/linked-collection.entity-preset.ts`
- New replacement preset file, preferably `object.entity-preset.ts` or `object-collection.entity-preset.ts`.
- Template validation, seeding, cleanup, and migration services.
- Entity instance routes/controllers/services.
- Component, fixed-value, record, action, event-binding, layout, script, snapshot export/restore services.
- Platform/system app definitions that bootstrap `_app_objects` and `_app_components`.
- Backend Jest tests.

### Metahubs Frontend

- `packages/metahubs-frontend/base/src/domains/entities/presets/**`
- `packages/metahubs-frontend/base/src/domains/entities/metadata/fieldDefinition/**` -> `packages/metahubs-frontend/base/src/domains/entities/metadata/component/**`
- `packages/metahubs-frontend/base/src/domains/entities/ui/**`
- `packages/metahubs-frontend/base/src/domains/entities/shared/**`
- `packages/metahubs-frontend/base/src/domains/layouts/**`
- `packages/metahubs-frontend/base/src/domains/scripts/**`
- `packages/metahubs-frontend/base/src/domains/settings/**`
- `packages/metahubs-frontend/base/src/i18n/locales/{en,ru}/metahubs.json`
- Frontend Vitest and visual/E2E selectors.

### Applications Backend And Frontend Runtime

- `packages/applications-backend/base/src/routes/sync/**`
- `packages/applications-backend/base/src/controllers/runtimeRowsController.ts`
- `packages/applications-backend/base/src/controllers/runtimeChildRowsController.ts`
- `packages/applications-backend/base/src/controllers/runtimeGuestController.ts`
- `packages/applications-backend/base/src/controllers/runtimeLedgersController.ts`
- `packages/applications-backend/base/src/controllers/runtimeReportsController.ts`
- `packages/applications-backend/base/src/services/runtimeScriptsService.ts`
- `packages/applications-backend/base/src/services/runtimeRecordBehavior.ts`
- `packages/applications-backend/base/src/services/runtimeLedgersService.ts`
- `packages/applications-backend/base/src/services/applicationWorkspaces.ts`
- `packages/applications-backend/base/src/services/publishedApplicationSnapshotEntities.ts`
- `packages/applications-frontend/base/src/pages/**`
- `packages/applications-frontend/base/src/components/**`
- `packages/applications-frontend/base/src/i18n/locales/{en,ru}/applications.json`

### Published App Template

- `packages/apps-template-mui/src/api/**`
- `packages/apps-template-mui/src/components/**`
- `packages/apps-template-mui/src/dashboard/**`
- `packages/apps-template-mui/src/hooks/**`
- `packages/apps-template-mui/src/utils/**`
- `packages/apps-template-mui/src/i18n/locales/{en,ru}/apps.json`

### Fixtures, Generators, And E2E

- `tools/testing/e2e/support/lmsFixtureContract.ts`
- `tools/testing/e2e/support/quizFixtureContract.ts`
- `tools/testing/e2e/support/selfHostedAppFixtureContract.mjs`
- `tools/testing/e2e/support/lmsRuntime.ts`
- `tools/testing/e2e/support/backend/api-session.mjs`
- `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`
- `tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts`
- `tools/testing/e2e/specs/generators/metahubs-self-hosted-app-export.spec.ts`
- Existing flow specs that currently open `/entities/catalog/instances` or assert Catalog/Attribute copy.
- `tools/fixtures/metahubs-lms-app-snapshot.json`
- `tools/fixtures/metahubs-quiz-app-snapshot.json`
- `tools/fixtures/metahubs-self-hosted-app-snapshot.json`

### Documentation

- Package READMEs in EN/RU for metahubs, applications, core backend/frontend where referenced.
- GitBook docs under `docs/en/**` and `docs/ru/**`.
- `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md`.
- Existing generated screenshots under `docs/**/.gitbook/assets/entities/**` where names or UI are no longer accurate.

## Implementation Plan

### Phase 0 - Vocabulary Freeze And Baseline Gates

- [ ] Confirm final product vocabulary before implementation:
  - `Catalogs` -> UI `Objects` / `Объекты`.
  - Internal surface `objectCollection`.
  - Persisted kind key `object`.
  - `Attributes` -> UI `Components` / `Компоненты`, technical `Components`.
- [ ] Add a short glossary to this plan or `docs/en/architecture/entity-systems.md` during implementation.
- [ ] Capture a baseline search inventory:
  - `rg "catalog|Catalog|attribute|Attribute|fieldDefinition|FieldDefinition|linkedCollection|_mhb_attributes|_app_attributes" packages tools docs`
  - classify each hit as product term, persisted contract, unrelated migration catalog, historical docs, or test fixture.
- [ ] Add temporary allowlist files for final grep gates so unrelated terms are not confused with active legacy seams.
- [ ] Run a baseline focused validation slice before edits:
  - `pnpm --filter @universo/types test`
  - `pnpm --filter @universo/schema-ddl test`
  - `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/services/templateManifestValidator.test.ts`
  - `pnpm --filter @universo/metahubs-frontend test -- src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx`

### Phase 1 - Shared Contract Rename

- [ ] Replace standard kind and surface contracts in `@universo/types`.
- [ ] Rename `CatalogRecordBehavior` to `ObjectRecordBehavior` or `ObjectCollectionBehavior`.
- [ ] Rename `catalogRecordBehaviorSchema` and normalizers.
- [ ] Rename former Attribute/FieldDefinition type exports and serialized properties:
  - `MetaFieldDefinition` -> `MetaComponent`
  - `FieldDefinitionDataType` -> `ComponentDataType`
  - `FieldDefinitionValidationRules` -> `ComponentValidationRules`
  - `TemplateSeedAttribute` -> `TemplateSeedComponent`
  - entity `fields` arrays -> `components` arrays where the data is former Attribute metadata.
  - `childFields` / `childAttributes` -> `childComponents`.
  - `systemFields` / `sharedFields` -> `systemComponents` / `sharedComponents`.
  - keep the word "field" only for unrelated generic form/input fields or SQL field-map internals, and document any allowlist.
- [ ] Replace settings namespaces:
  - `entity.catalog.*` -> `entity.object.*`
  - `allowAttributeCopy` -> `allowComponentCopy`
  - `allowAttributeDelete` -> `allowComponentDelete`
  - `attributeCodenameScope` -> `componentCodenameScope`
  - `allowedAttributeTypes` -> `allowedComponentTypes`
- [ ] Rename Entity type capability terminology so the former Attribute model can own the `Component` name:
  - `entityComponents.ts` -> `entityCapabilities.ts`
  - `ComponentManifest` -> `EntityCapabilityManifest` or `EntityTypeCapabilities`
  - `ENTITY_COMPONENT_KEYS` -> `ENTITY_CAPABILITY_KEYS`
  - `components.physicalTable` -> `capabilities.physicalTable`
  - persisted template/snapshot key `entityType.components` -> `entityType.capabilities`
- [ ] Replace script attachment kinds:
  - `catalog` -> `object`
  - `attribute` -> `component`
- [ ] Rename runtime layout config keys:
  - `catalogBehavior` -> `objectBehavior` or `objectCollectionBehavior`
  - keep a temporary parse-only fallback only inside the same phase if tests require it, then remove before final.

Example target type:

```ts
export const OBJECT_RECORD_MODES = ['reference', 'transactional', 'hybrid'] as const
export type ObjectRecordMode = (typeof OBJECT_RECORD_MODES)[number]

export const objectRecordBehaviorSchema = z
  .object({
    mode: z.enum(OBJECT_RECORD_MODES),
    numbering: recordNumberingBehaviorSchema,
    effectiveDate: recordDateBehaviorSchema,
    lifecycle: recordLifecycleBehaviorSchema,
    posting: recordPostingBehaviorSchema,
    immutability: z.enum(RECORD_IMMUTABILITY_MODES)
  })
  .strict()
```

Acceptance checks:

- [ ] `@universo/types` tests cover the new kind, settings keys, script attachment kinds, layout config keys, and schema names.
- [ ] No production export named `catalogRecordBehavior*` remains.
- [ ] No production export named `MetaFieldDefinition`, `FieldDefinitionDataType`, `FieldDefinitionValidationRules`, or `TemplateSeedAttribute` remains unless it is an explicitly unrelated UI/form concept.

### Phase 2 - Schema DDL And Database Metadata Rename

- [ ] Change standard DDL kind support:
  - `SchemaBuiltinEntityKind = 'object' | 'hub' | 'set' | 'enumeration' | 'page' | 'ledger'`
  - remove active runtime reliance on a hardcoded kind-to-prefix map such as `catalog -> cat`.
  - table names must be resolved from `EntityDefinition.physicalTableName` or validated `EntityTypeCapabilities.physicalTable.prefix` copied into the published snapshot.
  - the standard Object preset supplies `capabilities.physicalTable.prefix = 'obj'`; custom Object-based Entity types may supply another prefix through the Entity constructor.
- [ ] Refactor `packages/schema-ddl/base/src/naming.ts` so `generateTableName` accepts an explicit prefix for runtime-managed tables and fails closed when a physical table capable Entity lacks a prefix after constructor validation.
- [ ] Keep any remaining kind fallback only for package-local platform/system tables that are explicitly outside metahub/app runtime data schemas, and document the allowlist.
- [ ] Rename runtime metadata tables for fresh databases:
  - `_app_attributes` -> `_app_components`
  - `_mhb_attributes` -> `_mhb_components`
  - `_mhb_elements` -> `_mhb_records` if active design-time record storage still uses Element terminology.
- [ ] Rename columns:
  - `parent_attribute_id` -> `parent_component_id`
  - `is_display_attribute` -> `is_display_component`
  - `target_object_kind` remains acceptable if it means target entity kind; otherwise rename to `target_entity_kind`.
- [ ] Update schema system table bootstrap, cloner, diff, snapshot, generator, and migrations in place. No version bump.
- [ ] Keep all SQL schema-qualified and parameterized.
- [ ] Centralize `_mhb_components`, `_app_components`, component column prefix `cmp`, and child component table naming in schema contract helpers. Do not scatter literal metadata table names through services.

Safe SQL pattern for mutation services:

```ts
const qt = qSchemaTable(schemaName, METAHUB_METADATA_TABLES.components)
const { rows } = await exec.query<{ id: string }>(
  `
    UPDATE ${qt}
       SET name = $3,
           _upl_updated_at = now(),
           _upl_updated_by = $4
     WHERE object_id = $1
       AND id = $2
       AND _upl_deleted = false
       AND _mhb_deleted = false
     RETURNING id
  `,
  [objectId, componentId, name, userId]
)

if (rows.length === 0) {
  throw new MetahubDomainError(404, 'COMPONENT_NOT_FOUND')
}
```

Acceptance checks:

- [ ] `pnpm --filter @universo/schema-ddl test` passes.
- [ ] Runtime Object data tables are named `obj_*` only because the standard Object capability prefix is `obj`, not because DDL special-cases `kind === 'object'`.
- [ ] A custom Object-like Entity type with `capabilities.physicalTable.prefix = 'doc'` or another safe prefix creates `doc_*` (or that custom prefix), proving the constructor path is used.
- [ ] Runtime schemas created from fresh snapshots contain `_app_components`, not `_app_attributes`.
- [ ] Fresh metahub schemas contain `_mhb_components`, not `_mhb_attributes`.
- [ ] Final grep has no active production SQL references to `_app_attributes` or `_mhb_attributes`.

### Phase 2A - Platform System-App And Migration Compiler Contracts

- [ ] Rename system-app business table kinds where they represent Entity-like metadata:
  - `SystemAppBusinessTableKind = 'catalog' | ...` -> `'object' | ...`
  - `catalogTables` capability -> `objectTables`
  - canonical generated prefix `cat_` -> prefix resolved from the system-app object definition, defaulting to `obj_` for Object-like tables.
  - `SystemAppBusinessFieldDefinition` -> `SystemAppBusinessComponentDefinition`
  - `attributeValueTables` -> `componentValueTables`
  - `isDisplayAttribute` -> `isDisplayComponent`
- [ ] Update platform system app manifests/definitions in admin, profile, start, metahubs, and applications packages so active Entity-like tables are Objects with Components.
- [ ] Update platform RLS optimization and schema compiler tests to the new physical table names for fresh databases. If any existing `cat_*` platform table is intentionally kept, document it in the final grep allowlist with a product reason; do not keep it as accidental legacy.
- [ ] Keep the central migration catalog repository terminology only where "catalog" means migration registry/storage, not an Entity type.

Acceptance checks:

- [ ] `@universo/migrations-core` validation accepts Object table definitions and rejects accidental `kind: 'catalog'` in active system-app manifests.
- [ ] `@universo/migrations-platform` compiler tests assert `object`/`component` artifact names instead of `catalog`/`attribute` artifact names.
- [ ] Platform RLS policy optimization references the new Object table names or a documented allowlist.

### Phase 3 - Template Presets And Standard Entity Definitions

- [ ] Replace `catalogEntityPreset` with the new Object preset:
  - codename: `object`
  - kindKey: `object`
  - presentation: `Object` / `Object`, `Objects` / `Объекты`
  - `capabilities.physicalTable.prefix: 'obj'`
  - resource surface title: `Components` / `Компоненты`
- [ ] Replace `CATALOG_TYPE_COMPONENTS`, `CATALOG_TYPE_UI`, `STANDARD_CATALOG_NAME`, and `CATALOG_DEFAULT_INSTANCES`; the new capability constant should be `OBJECT_TYPE_CAPABILITIES`, not `OBJECT_TYPE_COMPONENTS`.
- [ ] Update `basic` and `basic-demo` templates:
  - include `{ presetCodename: 'object', includedByDefault: true }`
  - remove `entity.catalog.*` settings.
- [ ] Update LMS template:
  - `kind: 'catalog'` -> `kind: 'object'`
  - `targetEntityKind: 'catalog'` -> `targetEntityKind: 'object'`
  - `registrarKinds: ['catalog']` -> `registrarKinds: ['object']`
  - `attachedToKind: 'catalog'` -> `attachedToKind: 'object'`
  - product copy from "catalog" to "object catalog" only where the human learning catalog concept is intended; otherwise "object", "section", or "resource library".
- [ ] Keep `ledger` as a separate standard entity type; do not collapse it back into Objects.
- [ ] Ensure `basic` and `basic-demo` are the only default metahub templates that seed the base standard object type unless other templates intentionally opt in.

Example target preset shape:

```ts
export const objectEntityPreset: EntityTypePresetManifest = {
  $schema: 'entity-type-preset/v1',
  codename: 'object',
  version: '0.1.0',
  minStructureVersion: '0.4.0',
  name: vlc('Objects', 'Объекты'),
  description: vlc(
    'Standard object entity type with components, records, hierarchy, scripts, layouts, lifecycle, posting, and ledger support.',
    'Стандартный тип объекта с компонентами, записями, иерархией, скриптами, макетами, жизненным циклом, проведением и регистрами.'
  ),
  entityType: {
    kindKey: 'object',
    codename: vlc('Object', 'Object'),
    capabilities: OBJECT_TYPE_CAPABILITIES,
    ui: OBJECT_TYPE_UI,
    config: {
      recordBehavior: DEFAULT_OBJECT_RECORD_BEHAVIOR
    }
  },
  defaultInstances: OBJECT_DEFAULT_INSTANCES
}
```

Acceptance checks:

- [ ] Template validator rejects old `catalog` preset references.
- [ ] Fresh `basic`, `basic-demo`, and `lms` metahubs seed Object definitions and Object instances.
- [ ] Template snapshots preserve `capabilities.physicalTable.prefix` and application sync receives the prefix through the snapshot, not through application-side kind inference.
- [ ] `tools/fixtures/*.json` regenerated through Playwright contain no `kind: "catalog"` in active snapshot entities.
- [ ] Fresh fixtures use `components`, `childComponents`, `sharedComponents`, and `systemComponents`, not `attributes`, `fields`, `sharedFields`, or `systemFields` for former Attribute metadata.

### Phase 4 - Metahubs Backend Refactor

- [ ] Rename linked collection backend helpers to object collection terminology:
  - `linkedCollectionHelpers.ts` -> `objectCollectionHelpers.ts`
  - `linkedCollectionContext.ts` -> `objectCollectionContext.ts`
  - related service/controller symbols.
- [ ] Update entity behavior registry and builtin kind capabilities from Catalog to Object.
- [ ] Update Component controller/service/store code to use the new table and column names.
- [ ] Update copy/delete/blocking logic:
  - messages and error codes use Object/Component.
  - compatibility arrays no longer include `catalog`.
- [ ] Update snapshot serializer/restore to read/write `components`, `sharedComponents`, and `object` entities. If JSON snapshot keys must remain `sharedAttributes` during a phase, remove that fallback before the final fixture generation.
- [ ] Update snapshot serializer/restore to remove `fields` / `systemFields` when they represent former Attribute metadata; use `components` / `systemComponents` consistently in export, import, publication, application sync, and fixture contracts.
- [ ] Update `MetahubSchemaService` and DDL integration to produce fresh schemas with Object and component tables.
- [ ] Update script routes and attachment filters to use `component` and `object`.
- [ ] Ensure all dynamic identifiers still use `qSchema`, `qTable`, `qSchemaTable`, and `qColumn`.

Backend performance guard:

```ts
const { limit, offset } = validateListQuery(req.query)
const rows = await store.listComponents(exec, {
  schemaName,
  objectId,
  parentComponentId,
  limit: limit + 1,
  offset
})

return paginateItems(rows, { limit, offset })
```

Acceptance checks:

- [ ] Backend route tests cover object create/copy/delete, component create/copy/delete, shared component inheritance, blocking references, scripts, layouts, and snapshot export/restore.
- [ ] `node tools/lint-db-access.mjs` passes if this linter is part of the current CI path.
- [ ] No domain route/service imports raw Knex outside DDL boundaries.

### Phase 5 - Metahubs Frontend Refactor

- [ ] Rename and reuse existing UI modules where they no longer describe the product:
  - `LinkedCollectionList` -> `ObjectCollectionList` or `ObjectList`
  - `linkedCollectionMutations` -> `objectCollectionMutations`
  - user-visible "Catalog" copy -> "Object".
- [ ] Rename former `FieldDefinition*` UI modules to domain-specific names such as `EntityComponent*` or `ObjectComponent*`; avoid ambiguous bare `Component*` React names in UI-only code.
  - `Attributes` -> `Components`
  - `System Attributes` -> `System Components`
  - `Child Attributes` -> `Child Components`
- [ ] Keep the existing Metahubs UI architecture:
  - continue using `EntityFormDialog` for create/edit/settings overlays.
  - continue using the existing resource-tab model instead of adding a parallel Object-specific page shell.
  - continue using existing table/menu/action primitives such as `FlowListTable`, `BaseEntityMenu`, existing delete dialogs, shared selectors, and settings tabs.
  - update labels, query keys, route segments, and props in place so the UX remains visually consistent with Hubs, Sets, Enumerations, Pages, Ledgers, scripts, and layouts.
- [ ] Update Settings tabs and labels from `catalog` to `object`.
- [ ] Update entity resource surface labels:
  - `components.resourceTabTitle = Components / Компоненты`
- [ ] Update deletion dialogs, target selectors, relationship editors, ledger schema component-role labels, script tabs, and layout editors.
- [ ] Update query keys and optimistic mutation tests for renamed routes.
- [ ] Preserve TanStack Query safe mutation patterns:
  - cancel affected queries in `onMutate`
  - snapshot previous cache state
  - rollback in `onError`
  - invalidate on `onSettled`

Example optimistic mutation pattern:

```ts
const mutation = useMutation({
  mutationFn: updateEntityComponent,
  onMutate: async (input, context) => {
    await context.client.cancelQueries({ queryKey: objectComponentKeys.list(input.objectId) })
    const previous = context.client.getQueryData(objectComponentKeys.list(input.objectId))
    context.client.setQueryData(objectComponentKeys.list(input.objectId), (old) =>
      patchEntityComponentList(old, input)
    )
    return { previous }
  },
  onError: (_error, input, snapshot, context) => {
    context.client.setQueryData(objectComponentKeys.list(input.objectId), snapshot?.previous)
  },
  onSettled: (_data, _error, input, _snapshot, context) => {
    context.client.invalidateQueries({ queryKey: objectComponentKeys.list(input.objectId) })
  }
})
```

Acceptance checks:

- [ ] EN/RU i18n has no raw missing keys.
- [ ] Frontend tests cover Object list, Object dialogs, component list, System Components, child TABLE components, settings continuity, scripts, and layout tab navigation.
- [ ] Browser screenshots show the actual Object and component UI in EN and RU.

### Phase 6 - Applications Backend And Published Runtime

- [ ] Replace runtime catalog terminology in sync and runtime routes:
  - runtime object collection metadata
  - runtime components metadata
  - record behavior
  - reports
  - ledgers
  - scripts
  - public guest runtime
  - workspace seeding
- [ ] Replace hardcoded sync predicates with capability predicates:
  - `entity.kind === 'catalog'` -> `hasRecordsCapability(entity)` / `hasPhysicalRuntimeTable(entity)` as appropriate.
  - `targetEntityKind === 'catalog'` -> target Entity lookup followed by capability validation.
  - `kind === 'catalog'` branch logic -> Entity constructor capabilities plus snapshot metadata.
- [ ] Rename helpers:
  - `isRuntimeCatalogTargetKind` -> `isRuntimeObjectTargetKind`
  - `RuntimeCatalogSeedAttributeRow` -> `RuntimeObjectSeedComponentRow`
  - `linkedCollection` state where it strictly means the standard Object type.
- [ ] Update runtime SQL to `_app_components`.
- [ ] Remove legacy workspace seed table-name parsing for `cat_*`; use the snapshot-provided `physicalTableName` or the prefix generated from `capabilities.physicalTable.prefix`.
- [ ] Update report target discovery to exclude registrar-only Object-backed ledgers where applicable.
- [ ] Update application settings validation and i18n for object runtime behavior.
- [ ] Update snapshot hash/materialization logic so renamed keys participate deterministically.
- [ ] Preserve fail-closed runtime command behavior for post/unpost/void.

Acceptance checks:

- [ ] Runtime list/create/edit/copy/delete flows work against Object sections.
- [ ] Runtime sync creates `obj_*` tables for standard Objects and a non-`obj` prefix for a custom Object-like Entity type configured through the constructor.
- [ ] Runtime record commands still append/compensate ledger facts.
- [ ] Workspace seed remapping works for Object `REF` components and TABLE child components.
- [ ] Public LMS guest flows still work with the renamed object runtime.

### Phase 7 - Apps Template Runtime UI

- [ ] Rename public API types and runtime UI props from catalog/attribute to object/component where applicable.
- [ ] Update `CatalogTable.tsx` or replace it with a neutral `ObjectTable.tsx` / `RecordTable.tsx`.
- [ ] Update `FormDialog`, `TabularPartAdapter`, `RuntimeInlineTabularEditor`, `RuntimeTabularPartView`, and DataGrid column helpers for component terminology.
- [ ] Ensure row action commands still use neutral record terms and localized strings.
- [ ] Preserve MUI dashboard density and existing runtime shell patterns; do not add LMS-only runtime components.

Acceptance checks:

- [ ] `@universo/apps-template-mui` Vitest tests cover tables, dialogs, row commands, structured values, tabular components, and workspace pages.
- [ ] Published app screenshots show Objects/Components labels without layout overlap.

### Phase 8 - Fixture Generators And Snapshot Contracts

- [ ] Update API helper names:
  - `waitForMetahubCatalogId` -> `waitForMetahubObjectId`
  - `createRecord(api, metahubId, objectId, ...)`
  - list/get helpers for object collections and components.
- [ ] Rewrite LMS fixture contract:
  - Object entity type exposes behavior and ledger schema tabs.
  - LMS operational metadata entities have `kind: 'object'`.
  - Ledger-capable Objects carry canonical `config.ledger`.
  - Scripts attach to `object` or `component`.
  - No active snapshot entity has `kind: 'catalog'`.
- [ ] Rewrite quiz and self-hosted fixture contracts similarly.
- [ ] Replace fixed waits in touched generator screenshot code with locator waits and assertions.
- [ ] Regenerate fixtures only through Playwright generator specs:
  - `tools/fixtures/metahubs-lms-app-snapshot.json`
  - `tools/fixtures/metahubs-quiz-app-snapshot.json`
  - `tools/fixtures/metahubs-self-hosted-app-snapshot.json`
- [ ] Include screenshot artifacts in generator or flow output for real UI inspection.

Playwright pattern to use:

```ts
await page.goto(`/metahub/${metahubId}/entities/object/instances`)
await expect(page.getByRole('heading', { name: 'Objects' })).toBeVisible()
await expect(page.getByTestId('object-collection-list')).toContainText('Learning Resources')
await expect(page).toHaveScreenshot('objects-list-en.png', {
  fullPage: true,
  animations: 'disabled'
})
```

Do not use fixed waits such as `page.waitForTimeout(2000)` in new or touched tests.

### Phase 9 - Deep Test System

#### Unit And Contract Tests

- [ ] `@universo/types`
  - kind/surface maps
  - settings registry
  - script attachment kinds
  - component data types, validation rules, template seed component schema, and snapshot component keys
  - Entity capability schema after `components` -> `capabilities`
  - object record behavior schema
  - application layout config schema
- [ ] `@universo/schema-ddl`
  - table naming through explicit capability prefixes, including standard `object -> obj` and custom non-`obj` prefixes
  - `_app_components` creation
  - TABLE child component DDL
  - diff add/drop component behavior
  - snapshot generation
  - record behavior columns
- [ ] `@universo/migrations-core` and `@universo/migrations-platform`
  - Object system-app table kinds and prefixes
  - component artifact names
  - RLS policy references for fresh platform schemas
  - rejection of accidental active `catalog` / `attribute` system-app definitions
- [ ] `@universo/metahubs-backend`
  - standard template seeding
  - template validator
  - object routes
  - component routes
  - shared components and overrides
  - scripts/actions/events
  - layouts
  - snapshot serializer/restore
  - schema service
- [ ] `@universo/applications-backend`
  - sync data loader
  - runtime rows
  - child rows
  - workspace seeds and REF remapping
  - scripts
  - ledgers and posting
  - reports
  - public guest runtime
- [ ] Frontend Vitest
  - metahubs object list and components UI
  - settings tabs
  - shared resources tabs
  - script attachment UI
  - application settings/diff UI
  - apps-template runtime table/form/commands.

#### Browser E2E And Visual Tests

Use repository Playwright rules:

- Do not run `pnpm dev`.
- Use `tools/testing/e2e/run-playwright-suite.mjs`; it owns startup on `http://127.0.0.1:3100`.
- Use hosted dedicated E2E Supabase by default.
- Use local minimal Supabase when fresh local DB validation is needed:

```bash
pnpm supabase:e2e:start:minimal
pnpm run build:e2e:local-supabase
pnpm run test:e2e:flows:local-supabase
```

Browser coverage to add or update:

- [ ] Object authoring: create/copy/delete, settings, scripts, components, child TABLE components, shared components.
- [ ] Object publication and runtime: create/edit/copy/delete records, sort/filter/search, row commands.
- [ ] LMS generator and imported runtime: product-level LMS snapshot imports, syncs, opens app, creates workspace, runs reports, posts/unposts records, checks no leaked home widgets.
- [ ] Quiz generator and imported runtime: script attachment kinds and component metadata after rename.
- [ ] Self-hosted generator and imported runtime: object sections, shared components, layout overrides.
- [ ] RU locale and dark theme matrix for renamed terms.
- [ ] Visual screenshots for:
  - Entities workspace
  - Object list
  - Components list
  - Object behavior tab
  - LMS runtime home and non-home sections

Use Playwright web-first assertions and traces for failures:

```ts
await test.step('Open object components', async () => {
  await page.goto(`/metahub/${metahubId}/entities/object/instance/${objectId}/components`)
  await expect(page.getByRole('heading', { name: 'Components' })).toBeVisible()
  await expect(page.getByText('System Components')).toBeVisible()
})
```

### Phase 10 - Documentation And README Refresh

- [ ] Update GitBook EN/RU docs:
  - rename or rewrite `architecture/entity-component-system.md` to separate Entity capabilities from Object Components, for example `architecture/entity-capabilities.md` plus Object Component sections in `architecture/entity-systems.md`
  - `architecture/entity-systems.md`
  - `architecture/ledgers.md`
  - `architecture/lms-entities.md`
  - `architecture/metahub-schema.md`
  - `guides/custom-entity-types.md`
  - `guides/entity-scoped-layouts.md`
  - rename or rewrite `guides/transactional-catalogs.md` to `transactional-objects.md`
  - `guides/lms-*`
  - `platform/metahubs/**`
  - API references for shared overrides and scripting scopes
- [ ] Update `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md`.
- [ ] Update package READMEs:
  - metahubs backend/frontend
  - applications backend/frontend if references exist
  - apps-template-mui
  - E2E README if generator names or examples change.
- [ ] Regenerate or update screenshots through Playwright generator specs, not by hand.
- [ ] Run docs checks:

```bash
pnpm run docs:i18n:check
```

### Phase 11 - Final Legacy Removal Gates

- [ ] Remove temporary aliases and compatibility parsers created during implementation.
- [ ] Run active-source grep gates:

```bash
rg "kind: 'catalog'|kind: \"catalog\"|attachedToKind: 'catalog'|targetEntityKind: 'catalog'|SystemAppBusinessTableKind.*catalog|catalogTables|cat_" packages tools
rg "_mhb_attributes|_app_attributes|parent_attribute_id|is_display_attribute|__attr__|attributeValueTables|SystemAppBusinessFieldDefinition" packages tools
rg "Catalogs|Catalog|Attributes|Attribute|FieldDefinition|fieldDefinition|fields:|systemFields|sharedFields" packages/metahubs-frontend packages/applications-frontend packages/apps-template-mui packages/universo-types packages/schema-ddl tools/fixtures
```

- [ ] Maintain an explicit allowlist for unrelated terms:
  - `@universo/migrations-catalog` and optional global migration catalog docs.
  - historical progress/plan files.
  - 1C-compatible future-template docs where "Catalogs" intentionally means 1C directories.
- [ ] Any remaining active `cat_*` table names must be explicitly justified as non-Entity migration catalog storage. Platform system-app Object tables should not keep `cat_*` by inertia.
- [ ] Verify committed fixtures have no active legacy `catalog`, `attribute`, or `fieldDefinition` terms except allowlisted historical text.
- [ ] Verify no hidden UI strings render raw i18n keys.

### Phase 12 - Validation Order

Recommended validation sequence:

```bash
pnpm --filter @universo/types test
pnpm --filter @universo/types build
pnpm --filter @universo/schema-ddl test
pnpm --filter @universo/schema-ddl build
pnpm --filter @universo/migrations-core test
pnpm --filter @universo/migrations-core build
pnpm --filter @universo/migrations-platform test
pnpm --filter @universo/migrations-platform build
pnpm --filter @universo/metahubs-backend test -- --runInBand
pnpm --filter @universo/applications-backend test -- --runInBand
pnpm --filter @universo/metahubs-frontend test
pnpm --filter @universo/applications-frontend test
pnpm --filter @universo/apps-template-mui test
pnpm --filter @universo/metahubs-backend build
pnpm --filter @universo/applications-backend build
pnpm --filter @universo/metahubs-frontend build
pnpm --filter @universo/applications-frontend build
pnpm --filter @universo/apps-template-mui build
pnpm run build:e2e
pnpm run test:e2e:generators
node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium
node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-quiz-runtime.spec.ts --project chromium
node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-domain-entities.spec.ts --project chromium
pnpm run test:e2e:visual
pnpm run docs:i18n:check
pnpm build
```

For local fresh-database confirmation:

```bash
pnpm supabase:e2e:start:minimal
pnpm run build:e2e:local-supabase
pnpm run test:e2e:flows:local-supabase
```

Do not start `pnpm dev`; the E2E runner owns built-app startup.

## Risks And Mitigations

### Risk: `object` Creates New Ambiguity

Mitigation: keep `object` as persisted product kind only, and use `objectCollection` in code symbols where ambiguity matters. UI can say `Objects`; docs should introduce the phrase `Object collections`.

### Risk: `Components` Overloads Existing Architecture

Mitigation: reserve `Component` for the former Attribute model and rename Entity type capability infrastructure to `EntityCapability*` / `capabilities`. In React code, avoid ambiguous bare names such as `ComponentList`; use domain names like `EntityComponentList`.

### Risk: Fixture Regeneration Masks Broken Runtime Behavior

Mitigation: fixture contracts must assert product invariants, not just JSON shape. Imported runtime flows must create a new app from the regenerated fixture and exercise real UI, reports, scripts, workspaces, posting, and screenshots.

### Risk: Search/Replace Breaks SQL Or Snapshot Semantics

Mitigation: use typed shared helpers and structured parsers. Do not rewrite JSON snapshots by ad hoc string replacement. Regenerate fixtures through product Playwright generators.

### Risk: Too Much Rename In One Commit

Mitigation: implement by phase with green tests after each phase. Temporary compatibility can exist only inside the phase branch and must be deleted before final acceptance because this plan intentionally targets a fresh database.

### Risk: Old User-Facing Terms Remain In Nested UI

Mitigation: add EN/RU screenshot checks and grep gates for active frontend packages. Browser screenshots must be inspected before closing the implementation.

## Acceptance Criteria

- [ ] A fresh database seeded from templates exposes Hubs, Pages, Objects, Sets, Enumerations, and Ledgers.
- [ ] Basic and Basic Demo templates no longer seed a `catalog` standard type.
- [ ] LMS, quiz, and self-hosted fixtures are regenerated through Playwright and contain the new Object/Component contract.
- [ ] Application creation from the LMS fixture succeeds, schema sync succeeds, workspace creation succeeds, and runtime object records are usable.
- [ ] Posting, unposting, ledger facts, reports, scripts, and public guest LMS flows continue to work.
- [ ] Design-time UI and runtime UI show `Objects` / `Объекты` and `Components` / `Компоненты`, not Catalogs/Attributes.
- [ ] No production code path depends on `catalog` as the universal object type.
- [ ] No production schema path creates `_mhb_attributes` or `_app_attributes`.
- [ ] Docs and READMEs describe Object collections and Components consistently in EN/RU.
- [ ] Full targeted Jest, Vitest, Playwright, docs, and root build validation pass.

## Confirmed Decisions And Remaining Sequencing Choice

Confirmed:

1. Use `Objects` / `Объекты` for the former universal Catalog type, with persisted kind `object` and code surface `objectCollection` where extra clarity is needed.
2. Use `Components` / `Компоненты` for the former Attribute model.
3. Rename fresh metadata tables and columns to `_mhb_components`, `_app_components`, `parent_component_id`, and `is_display_component`.
4. Standard Object tables use `obj_*` through `capabilities.physicalTable.prefix = 'obj'`; custom Object-like Entity types may publish another safe prefix through the Entity constructor and snapshot.
5. No legacy compatibility is required for the test database, schema version, or metahub template version.

Remaining sequencing choice:

- Rename the Entity type capability JSON key from `components` to `capabilities` as an explicit first implementation sub-phase, then perform the Attribute/FieldDefinition -> Component rename. This is the safer order because it removes the biggest naming collision before the new Component model lands.
