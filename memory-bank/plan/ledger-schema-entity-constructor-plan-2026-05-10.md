# Ledger Schema Entity Constructor Plan

> Date: 2026-05-10
> Mode: PLAN
> Status: implemented and validated
> Complexity: Level 4 - cross-package platform architecture and UI/runtime contract

## Overview

The current Ledger implementation has a real runtime/backend contract, but the metahub UI does not expose enough of that contract. Ledgers are still visually close to Catalogs because the UI only reuses the generic field-definition surface and a minimal `ledgerSchema` component toggle. This plan upgrades the Entity constructor so Ledger behavior is a first-class generic component capability, not a Ledger-only hardcoded screen.

The target state is:

1. `ledgerSchema` is a generic Entity component that can be enabled for any compatible entity type with `dataSchema` and `physicalTable`.
2. The standard `ledger` type uses this component by default.
3. Future metahub configurations can keep a 1C-like separated structure (`catalog` + `ledger`) or create hybrid `catalog` types that combine reference, document, posting, and ledger semantics.
4. The LMS fixture remains generator-owned and is regenerated from the product Playwright flow after template changes.
5. All user-facing text is internationalized from the first implementation pass.

## Requirements Coverage

-   Remove hardcoded Ledger UI behavior and drive it from the Entity constructor component contract.
-   Expose the real `config.ledger` capabilities in UI: mode, mutation policy, source policy, registrar kinds, field roles, projections, period/effective date, and idempotency.
-   Keep existing shared UI style by using `EntityFormDialog`, shared tab patterns, `FieldDefinitionListContent`, `FlowListTable`, `ItemCard`, `ToolbarControls`, and MUI controls.
-   Do not create a standalone `LedgerListPage`, `LedgerFieldEditor`, or LMS-specific widget/editor.
-   Allow `ledgerSchema` on standard `ledger` and future custom/hybrid entity types, including Catalog-derived types.
-   Remove kind-only gates from both frontend and backend component registries. `ledgerSchema` must be validated by component compatibility, not by `kindKey === 'ledger'`.
-   Keep the application control panel and published `packages/apps-template-mui` runtime generic: existing table/card/chart widgets must be extended to consume ledger datasources instead of adding LMS-only widgets.
-   Preserve the three configuration layers:
    -   metahub metadata defines base logic and schema;
    -   application control panel defines app-wide layout, connector, datasource, and default behavior;
    -   published app workspaces define final workspace-level settings and data.
-   Avoid schema/template version bump; the test DB can be recreated.
-   Preserve UUID v7 and existing strict backend validation patterns.
-   Add Jest/Vitest/Playwright coverage and browser screenshots.
-   Update GitBook-style docs and package READMEs.

## QA Review Update - 2026-05-10

Additional code review found that the original draft had the correct direction but under-specified six critical areas:

1. `COMPONENT_REGISTRY.ledgerSchema.supportedKinds` currently limits the component to `ledger`; the plan must explicitly replace this with generic compatibility rules.
2. `SchemaGenerator.isLedgerEntity()` currently checks `entity.kind === 'ledger'`; hybrid Catalog-like entities with `ledgerSchema` would not get ledger system columns unless schema generation is component-driven.
3. `RuntimeDatasourceDescriptor` already includes `ledger.facts` and `ledger.projection`, but `applications-frontend` and `apps-template-mui` mostly expose/render `records.list`. The plan must include the application control panel and published app runtime.
4. The sample normalizer referenced `safeLedgerPatch(raw)` without defining it. The implementation must use a strict patch schema or explicit allow-list parser.
5. Runtime `_app_objects.config` currently persists concrete entity config, while component capability data comes from entity type definitions during publication. Generic runtime services need a safe published capability source, otherwise they will keep falling back to `kind = 'ledger'`.
6. Workspace copy/delete and idempotency flows still contain kind/prefix gates such as `entity.kind !== 'ledger'` and `cat_%`/`tbl_%`. These flows must use published runtime metadata and physical table capability, not fixed standard-kind or table-prefix assumptions.

These items are now treated as required work, not optional follow-up.

## Context Findings

### Current Code State

-   `ledger` already exists as a standard entity kind. In `standardEntityTypeDefinitions.ts`, it has `dataSchema`, `physicalTable` with prefix `led`, `runtimeBehavior`, `layoutConfig`, and `ledgerSchema` enabled.
-   `ledger` currently has `records: false`, so it does not behave as normal runtime CRUD.
-   `config.ledger` already exists in `@universo/types` with:
    -   `mode`
    -   `mutationPolicy`
    -   `periodicity`
    -   `effectiveDateField`
    -   `sourcePolicy`
    -   `registrarKinds`
    -   `fieldRoles`
    -   `projections`
    -   `idempotency`
-   `RuntimeLedgerService` reads `config.ledger` and enforces source and mutation policy at runtime.
-   `SchemaGenerator` already treats `ledger` as a physical runtime table and adds ledger-specific system columns.
-   The current metahub UI exposes only the generic field-definition surface plus a constructor-level toggle for `ledgerSchema` and `allowProjections`.
-   There is no UI editor for `config.ledger`, no role chips in the field-definition list, and no projection editor.

### External Reference Findings

1C register concepts that matter for our generic design:

-   Accumulation registers are multi-dimensional records with dimensions, resources, and attributes; they support balances, turnovers, and aggregates.
-   Register records are typically connected to a registrar document and line number.
-   Calculation registers add periodic calculation semantics and dependency between calculation records.
-   Register data can be manual in some cases, but typical business movement writes are registrar-driven.

Sources reviewed:

-   https://v8.1c.ru/platforma/registr-nakopleniya/
-   https://v8.1c.ru/platforma/registr-rascheta/
-   https://kb.1ci.com/1C_Enterprise_Platform/Guides/Developer_Guides/1C_Enterprise_8.3.23_Developer_Guide/Chapter_5._Configuration_objects/5.12._Registers/5.12.3._Accumulation_registers/

Current documentation lookup:

-   MUI X Data Grid recommends explicit server-side pagination, sorting, and filtering or the Data Source layer for data-heavy tables.
-   TanStack Query v5 recommends mutation callbacks with `onMutate`, rollback through returned context, and `invalidateQueries` on settle for server-state consistency.

## Architecture Decisions

### AD-1: `ledgerSchema` Is A Generic Entity Component

Do not hardcode Ledger configuration to `kind === 'ledger'`. The UI and validation must use:

```ts
isEnabledComponentConfig(entityType.components.ledgerSchema)
```

This lets any future entity type combine components:

```ts
const HYBRID_CATALOG_COMPONENTS = {
    dataSchema: { enabled: true },
    records: { enabled: true },
    physicalTable: { enabled: true, prefix: 'cat' },
    identityFields: { enabled: true, allowNumber: true, allowEffectiveDate: true },
    recordLifecycle: { enabled: true, allowCustomStates: true },
    posting: { enabled: true, allowManualPosting: true, allowAutomaticPosting: true },
    ledgerSchema: { enabled: true, allowProjections: true }
} satisfies Partial<ComponentManifest>
```

The standard `ledger` type is just the default type where `ledgerSchema` is enabled and `records` is disabled.

### AD-2: `config.ledger` Remains The Runtime Source Of Truth

Field definitions define physical columns. `config.ledger` defines how those columns behave as dimensions, resources, attributes, projections, and idempotency keys.

Do not duplicate field roles into `validationRules` as the canonical source. The UI may display role chips in the field list, but it should save roles into `config.ledger.fieldRoles`.

### AD-3: The Entity Dialog Gets A Generic `ledgerSchema` Tab

The Entity create/edit/copy dialog should support a tab with id `ledgerSchema` whenever the current entity type has `components.ledgerSchema.enabled`.

The standard Ledger template should include this tab:

```ts
export const LEDGER_TYPE_UI: EntityTypeUIConfig = {
    iconName: 'IconDatabase',
    tabs: ['general', 'ledgerSchema', 'hubs', 'layout', 'scripts'],
    sidebarSection: 'objects',
    sidebarOrder: 60,
    nameKey: 'metahubs:ledgers.title',
    resourceSurfaces: [FIELD_DEFINITIONS_RESOURCE_SURFACE]
}
```

Catalog remains:

```ts
tabs: ['general', 'behavior', 'hubs', 'layout', 'scripts']
```

but future Catalog-like types can include:

```ts
tabs: ['general', 'behavior', 'ledgerSchema', 'hubs', 'layout', 'scripts']
```

### AD-4: Field Definitions Stay Shared, With Optional Ledger Role Awareness

`FieldDefinitionListContent` should stay the single field-definition UI. It should accept optional ledger schema context and render non-invasive role chips/actions only when `ledgerSchema` is enabled for the owning entity.

No separate Ledger attribute editor should be introduced.

### AD-5: Runtime Safety Must Stay Fail-Closed

All backend and runtime paths must keep strict validation:

-   unsupported mode or policy values are rejected or normalized at typed boundaries;
-   projection dimensions/resources must reference existing field definitions;
-   resource fields must be numeric for sum/min/max unless the aggregate supports a non-numeric value;
-   idempotency fields must exist;
-   registrar-only writes must reject manual calls;
-   append-only Ledgers must reject in-place edits and direct reversals unless policy allows them.

### AD-6: Separate Component Capability From Instance Configuration

There are two layers that must not be mixed:

-   Entity type component configuration answers "is this entity type allowed to have ledger semantics?"
    -   Example: `components.ledgerSchema = { enabled: true, allowProjections: true }`.
-   Entity instance configuration answers "how does this concrete Ledger or hybrid metadata object behave?"
    -   Example: `config.ledger = { mode: 'balance', sourcePolicy: 'registrar', fieldRoles: [...] }`.

The Entity constructor owns component compatibility and tabs. The Entity instance dialog owns `config.ledger` values.

### AD-7: Application Runtime Uses Generic Datasources

The LMS app must not get special dashboards or report widgets. Runtime layouts should use generic datasource descriptors:

-   `records.list` for Catalog records;
-   `ledger.facts` for raw fact lists;
-   `ledger.projection` for balances, turnovers, timelines, and report-ready aggregates;
-   `metric` for summary counters.

The existing application widget behavior editor and existing `apps-template-mui` widgets should be extended to configure and consume these datasource kinds.

### AD-8: Published Runtime Metadata Carries Safe Component Capabilities

The metahub constructor can use full entity type definitions, but the published application runtime mostly works from `_app_objects`, `_app_attributes`, and layout metadata. Runtime services must not infer Ledger capability from `kind = 'ledger'` only.

Publication and schema sync must persist or expose a normalized, safe component capability summary for every runtime object. Two acceptable implementations are:

-   merge a safe `components` capability manifest into `_app_objects.config.components`;
-   or add a normalized runtime object type metadata source that can be joined by `kind`.

The chosen contract must include enough information to evaluate `supportsLedgerSchema`, `hasPhysicalRuntimeTable`, and `supportsLayoutConfig` without loading author-only UI internals or unsafe arbitrary config. It must not expose secrets, script source, or author-only draft data in runtime metadata.

## Target Data Contract

Create a shared Zod schema and normalizer in `@universo/types`, next to `ledgers.ts`:

```ts
export const ledgerConfigSchema = z
    .object({
        mode: z.enum(LEDGER_MODES),
        mutationPolicy: z.enum(LEDGER_MUTATION_POLICIES),
        periodicity: z.enum(LEDGER_PERIODICITIES),
        effectiveDateField: z.string().trim().min(1).max(128).optional(),
        sourcePolicy: z.enum(LEDGER_SOURCE_POLICIES),
        registrarKinds: z.array(z.string().trim().min(1).max(64)).max(32),
        fieldRoles: z.array(ledgerFieldRoleSchema).max(256),
        projections: z.array(ledgerProjectionDefinitionSchema).max(64),
        idempotency: z.object({
            keyFields: z.array(z.string().trim().min(1).max(128)).max(16)
        }).strict()
    })
    .strict()

export const ledgerConfigPatchSchema = z
    .object({
        mode: z.enum(LEDGER_MODES).optional(),
        mutationPolicy: z.enum(LEDGER_MUTATION_POLICIES).optional(),
        periodicity: z.enum(LEDGER_PERIODICITIES).optional(),
        effectiveDateField: z.string().trim().min(1).max(128).optional(),
        sourcePolicy: z.enum(LEDGER_SOURCE_POLICIES).optional(),
        registrarKinds: z.array(z.string().trim().min(1).max(64)).max(32).optional(),
        fieldRoles: z.array(ledgerFieldRoleSchema).max(256).optional(),
        projections: z.array(ledgerProjectionDefinitionSchema).max(64).optional(),
        idempotency: z
            .object({
                keyFields: z.array(z.string().trim().min(1).max(128)).max(16)
            })
            .strict()
            .optional()
    })
    .strict()

export const normalizeLedgerConfig = (value: unknown): LedgerConfig => {
    const raw = isRecord(value) ? value : {}
    const patch = ledgerConfigPatchSchema.parse(raw)
    return ledgerConfigSchema.parse({
        ...DEFAULT_LEDGER_CONFIG,
        ...patch,
        idempotency: {
            ...DEFAULT_LEDGER_CONFIG.idempotency,
            ...(patch.idempotency ?? {})
        }
    })
}

export const normalizeLedgerConfigFromConfig = (config: Record<string, unknown> | null | undefined): LedgerConfig =>
    normalizeLedgerConfig(isRecord(config?.ledger) ? config.ledger : undefined)
```

Add validation helpers that need field definitions:

```ts
export const validateLedgerConfigReferences = (params: {
    config: LedgerConfig
    fields: Array<{ codename: string; dataType: FieldDefinitionDataType }>
}): LedgerConfigReferenceError[] => {
    const fieldsByCodename = new Map(params.fields.map((field) => [field.codename.toLowerCase(), field]))
    const errors: LedgerConfigReferenceError[] = []

    for (const role of params.config.fieldRoles) {
        const field = fieldsByCodename.get(role.fieldCodename.toLowerCase())
        if (!field) {
            errors.push({ path: ['fieldRoles', role.fieldCodename], code: 'FIELD_NOT_FOUND' })
            continue
        }
        if (role.role === 'resource' && role.aggregate !== 'count' && field.dataType !== 'NUMBER') {
            errors.push({ path: ['fieldRoles', role.fieldCodename, 'aggregate'], code: 'RESOURCE_REQUIRES_NUMBER' })
        }
    }

    return errors
}
```

## Affected Areas

### Shared Types

-   `packages/universo-types/base/src/common/ledgers.ts`
-   `packages/universo-types/base/src/common/entityComponents.ts`
-   `packages/universo-types/base/src/common/entityTypeDefinition.ts`
-   `packages/universo-types/base/src/common/metahubs.ts`
-   `packages/universo-types/base/src/index.ts`

### Metahubs Backend

-   `packages/metahubs-backend/base/src/domains/templates/data/standardEntityTypeDefinitions.ts`
-   `packages/metahubs-backend/base/src/domains/templates/data/ledger.entity-preset.ts`
-   `packages/metahubs-backend/base/src/domains/templates/data/basic.template.ts`
-   `packages/metahubs-backend/base/src/domains/templates/data/basic-demo.template.ts`
-   `packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts`
-   `packages/metahubs-backend/base/src/domains/templates/services/TemplateManifestValidator.ts`
-   `packages/metahubs-backend/base/src/domains/entities/controllers/entityControllerShared.ts`
-   `packages/metahubs-backend/base/src/domains/entities/services/EntityTypeService.ts`
-   `packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts`
-   `packages/metahubs-backend/base/src/domains/metahubs/services/SnapshotRestoreService.ts`

### Metahubs Frontend

-   `packages/metahubs-frontend/base/src/domains/entities/ui/EntityInstanceListContent.tsx`
-   `packages/metahubs-frontend/base/src/domains/entities/ui/entityInstanceListHelpers.ts`
-   `packages/metahubs-frontend/base/src/domains/entities/ui/EntitiesWorkspace.tsx`
-   `packages/metahubs-frontend/base/src/domains/entities/ui/RecordBehaviorFields.tsx` only if shared option helpers should be extracted
-   New generic UI:
    -   `packages/metahubs-frontend/base/src/domains/entities/ui/LedgerSchemaFields.tsx`
    -   `packages/metahubs-frontend/base/src/domains/entities/ui/LedgerProjectionEditor.tsx`
    -   `packages/metahubs-frontend/base/src/domains/entities/ui/LedgerFieldRoleChips.tsx`
    -   These must be compositional subcomponents inside the existing Entity dialog and field-definition surfaces, reusing current table/form primitives. They are not standalone Ledger pages or alternative list/edit frameworks.
-   `packages/metahubs-frontend/base/src/domains/entities/metadata/fieldDefinition/ui/FieldDefinitionList.tsx`
-   `packages/metahubs-frontend/base/src/domains/entities/metadata/fieldDefinition/ui/FieldDefinitionActions.tsx`
-   `packages/metahubs-frontend/base/src/domains/entities/presets/ui/LinkedCollectionActions.tsx` if a future Catalog-like preset uses `ledgerSchema`
-   `packages/metahubs-frontend/base/src/i18n/locales/en/metahubs.json`
-   `packages/metahubs-frontend/base/src/i18n/locales/ru/metahubs.json`

### Runtime And Schema

-   `packages/schema-ddl/base/src/SchemaGenerator.ts`
-   `packages/schema-ddl/base/src/builtinEntityKinds.ts`
-   `packages/applications-backend/base/src/controllers/runtimeLedgersController.ts`
-   `packages/applications-backend/base/src/services/runtimeLedgersService.ts`
-   `packages/applications-backend/base/src/services/runtimeScriptsService.ts`
-   `packages/applications-backend/base/src/services/runtimeWorkspaceService.ts`
-   `packages/applications-backend/base/src/services/runtimePostingMovements.ts`
-   `packages/applications-backend/base/src/services/applicationWorkspaces.ts`
-   `packages/extension-sdk/base/src/apis/ledgers.ts`

### Application Control Panel And Runtime Template

-   `packages/applications-frontend/base/src/components/layouts/ApplicationWidgetBehaviorEditorDialog.tsx`
-   `packages/applications-frontend/base/src/i18n/locales/en/applications.json`
-   `packages/applications-frontend/base/src/i18n/locales/ru/applications.json`
-   `packages/apps-template-mui/src/api/api.ts`
-   `packages/apps-template-mui/src/api/types.ts`
-   `packages/apps-template-mui/src/dashboard/components/MainGrid.tsx`
-   `packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx`
-   `packages/apps-template-mui/src/dashboard/components/CustomizedDataGrid.tsx`
-   `packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx`
-   `packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`

### Shared I18n

-   `packages/universo-i18n/base/src/locales/en/common.json`
-   `packages/universo-i18n/base/src/locales/ru/common.json`
-   Package-local namespaces only for package-specific labels.

### Tests And Fixtures

-   `packages/universo-types/base/src/__tests__/ledgers.test.ts`
-   `packages/metahubs-frontend/base/src/domains/entities/ui/__tests__/LedgerSchemaFields.test.tsx`
-   `packages/metahubs-frontend/base/src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx`
-   `packages/metahubs-frontend/base/src/domains/entities/metadata/fieldDefinition/ui/__tests__/FieldDefinitionList.ledgerRoles.test.tsx`
-   `packages/metahubs-backend/base/src/tests/services/templateManifestValidator.test.ts`
-   `packages/metahubs-backend/base/src/tests/services/metahubSchemaService.test.ts`
-   `packages/applications-backend/base/src/tests/services/runtimeLedgersService.test.ts`
-   `packages/schema-ddl/base/src/__tests__/SchemaGenerator.test.ts`
-   `tools/testing/e2e/support/lmsFixtureContract.ts`
-   `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`
-   `tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`

### Docs

-   `docs/en/architecture/ledgers.md`
-   `docs/ru/architecture/ledgers.md`
-   `docs/en/guides/ledgers.md`
-   `docs/ru/guides/ledgers.md`
-   `docs/en/guides/transactional-catalogs.md`
-   `docs/ru/guides/transactional-catalogs.md`
-   `docs/en/SUMMARY.md`
-   `docs/ru/SUMMARY.md`
-   package READMEs for `metahubs-backend`, `metahubs-frontend`, `applications-backend`, `schema-ddl`, and `universo-types`

## Implementation Plan

### Phase 1 - Shared Ledger Contract Hardening

-   [ ] Add `ledgerConfigSchema`, `ledgerFieldRoleSchema`, `ledgerProjectionDefinitionSchema`, `normalizeLedgerConfig`, `normalizeLedgerConfigFromConfig`, and reference validation helpers to `@universo/types`.
-   [ ] Export `supportsLedgerSchema(components)` from `entityComponents.ts`.
-   [ ] Add `isLedgerSchemaCapableEntity(components)` for schema/runtime use; it should require `ledgerSchema`, `dataSchema`, and `physicalTable`, not a specific `kind`.
-   [ ] Extend `LedgerSchemaComponentConfig` from a minimal toggle into a capability descriptor:

```ts
export interface LedgerSchemaComponentConfig extends ComponentConfig {
    allowProjections?: boolean
    allowRegistrarPolicy?: boolean
    allowManualFacts?: boolean
    allowedModes?: readonly LedgerMode[]
}
```

-   [ ] Keep defaults conservative:
    -   standard `ledger`: `allowProjections: true`, `allowRegistrarPolicy: true`, `allowManualFacts: false`;
    -   future hybrid Catalogs may opt into `allowManualFacts` only when explicitly configured.
-   [ ] Add type tests for normalization, strict schema rejection, duplicate fields, invalid projections, and invalid resource aggregate/data type combinations.
-   [ ] Move reusable labels such as Dimension, Resource, Attribute, Projection, and Idempotency to shared i18n only if they are reused across packages; keep metahub-only labels in the `metahubs` namespace.

### Phase 2 - Generic Entity Dialog `ledgerSchema` Tab

-   [ ] Extend the generic entity form tab union to include `ledgerSchema`.
-   [ ] Add `ledgerConfig` to `EntityInstanceFormValues` and initialize it from `config.ledger` only when `supportsLedgerSchema(entityType.components)`.
-   [ ] Persist `config.ledger` through create/edit/copy payloads without dropping unrelated `config` keys.
-   [ ] Keep component capability editing in `EntitiesWorkspace` separate from concrete `config.ledger` editing in `EntityInstanceListContent`.
-   [ ] Add `LedgerSchemaFields` as a generic tab component:

```tsx
<LedgerSchemaFields
    value={getLedgerConfigFormValue(values.ledgerConfig)}
    onChange={(nextValue) => setValue('ledgerConfig', nextValue)}
    disabled={isLoading}
    componentConfig={entityType.components.ledgerSchema}
    fieldOptions={ledgerFieldOptions}
    entityKindOptions={entityKindOptions}
    errors={errors}
/>
```

-   [ ] Fetch field definitions only while a create/edit/copy dialog with a `ledgerSchema` tab is open.
-   [ ] Fetch entity type/kind options for registrar-kind selection through existing entity type queries.
-   [ ] Use TanStack Query invalidation after save/copy/delete; use optimistic UI only for local chip state, not for persisted ledger config unless rollback is implemented.

### Phase 3 - `LedgerSchemaFields` UX

-   [ ] Implement sections in the shared dialog style:
    -   Ledger mode.
    -   Mutation policy.
    -   Source policy.
    -   Registrar kinds.
    -   Periodicity and effective date field.
    -   Field roles.
    -   Projections.
    -   Idempotency keys.
-   [ ] Use familiar MUI controls:
    -   `Select` for mode/policies/periodicity.
    -   `Autocomplete` or multi-select chips for registrar kinds and key fields.
    -   compact `FlowListTable` or repeated small sections for projections.
    -   checkboxes/toggles only for binary options.
-   [ ] Avoid explanatory in-app essays. Use concise helper text and tooltips only where the concept is otherwise unclear.
-   [ ] Keep layout dense and aligned with existing MUI template surfaces; no nested cards.
-   [ ] Add validation that blocks save when:
    -   a projection references a missing dimension or resource;
    -   a resource role uses sum/min/max/latest against an incompatible field;
    -   `sourcePolicy = registrar` but no registrar kind is configured when the component policy requires one;
    -   idempotency fields are missing;
    -   duplicate field roles or duplicate projection codenames exist.

### Phase 4 - Field Definition Role Awareness

-   [ ] Extend `FieldDefinitionListContent` with optional ledger role metadata from the owning entity config.
-   [ ] Render role chips in the existing field definition table/card rows:
    -   Dimension
    -   Resource
    -   Attribute
    -   aggregate label for resources
    -   required marker
-   [ ] Add row action "Configure ledger role" only when the owning entity type supports `ledgerSchema`.
-   [ ] The action should open the same generic `LedgerSchemaFields` tab or a small shared role editor that writes to `config.ledger.fieldRoles`; do not write ledger role data into field-definition `validationRules` as the canonical source.
-   [ ] When a field definition is renamed or copied, keep `config.ledger.fieldRoles` safe:
    -   copy can include field roles only when copying field definitions;
    -   deleting a field should either block if used by required ledger config or show a blocking dependency dialog.

### Phase 5 - Standard Ledger Template Update

-   [ ] Update standard `ledger` UI tabs to include `ledgerSchema`.
-   [ ] Rename the Ledger field-definition resource surface title from generic "Attributes" to a localized domain label such as "Fields" or "Ledger fields", while still using the shared field-definition capability.
-   [ ] Keep the left menu order after Enumerations.
-   [ ] Make default Ledger instances use visible `config.ledger` values so the UI demonstrates why a Ledger is not just a Catalog.
-   [ ] Update `basic`, `basic-demo`, and LMS templates with the normalized `ledgerSchema` tab and `config.ledger` defaults.
-   [ ] Update tests that assert standard menu order and standard type tabs.

### Phase 6 - Future Hybrid Catalog Support

-   [ ] Ensure `ledgerSchema` can be enabled on `catalog`-based custom entity types in the Entity constructor.
-   [ ] Replace `COMPONENT_REGISTRY.ledgerSchema.supportedKinds: ['ledger']` with generic component-compatibility validation, or set it to `null` and rely on dependency validation plus explicit capability rules.
-   [ ] Validate compatible component combinations:

```ts
const validateEntityComponentCombination = (manifest: ComponentManifest): string[] => {
    const errors = validateComponentDependencies(manifest)

    if (isEnabledComponentConfig(manifest.ledgerSchema) && !isEnabledComponentConfig(manifest.dataSchema)) {
        errors.push('ledgerSchema requires dataSchema')
    }
    if (isEnabledComponentConfig(manifest.ledgerSchema) && !isEnabledComponentConfig(manifest.physicalTable)) {
        errors.push('ledgerSchema requires physicalTable')
    }
    if (isEnabledComponentConfig(manifest.posting) && !isEnabledComponentConfig(manifest.ledgerSchema)) {
        // This should stay allowed for document-like Catalogs that post into separate Ledgers.
        // The warning belongs in UI, not as a hard validation error.
    }

    return errors
}
```

-   [ ] Add UI warnings, not hard blocks, for Catalogs that combine records + posting + ledger schema:
    -   useful for advanced 1C-like configurations;
    -   not recommended for simple LMS Catalogs unless the author intentionally wants local fact storage on the Catalog table.
-   [ ] Keep runtime writes strict: hybrid Catalog ledger facts must still go through the same Ledger service rules when used as facts.
-   [ ] Add a regression test for a non-`ledger` kind with `ledgerSchema` enabled so future code cannot silently reintroduce `kind === 'ledger'` UI gates.

### Phase 7 - Backend Validation And Snapshot Safety

-   [ ] Reuse `normalizeLedgerConfig` in:
    -   template manifest validation;
    -   entity create/update/copy payload normalization;
    -   snapshot restore;
    -   publication serialization;
    -   application schema sync.
-   [ ] During publication serialization and application schema sync, persist or expose the safe component capability contract needed by runtime services:
    -   if using `_app_objects.config.components`, merge normalized component capability data with entity instance config without overwriting `config.ledger`;
    -   if using a separate runtime object type metadata source, make runtime services join through that source instead of reading authoring-only definitions;
    -   test that a published non-`ledger` entity with `ledgerSchema` enabled is discoverable by runtime Ledger APIs.
-   [ ] Add backend reference validation before saving `config.ledger` when field definitions are available.
-   [ ] Make copy behavior explicit:
    -   copy entity + field definitions copies `config.ledger.fieldRoles`, projections, and idempotency;
    -   copy entity without field definitions resets field-role and projection references unless the target already has matching fields.
-   [ ] Make delete behavior explicit:
    -   deleting a field used by `config.ledger` should be blocked or should require confirmed cleanup;
    -   deleting a Ledger used by Catalog posting should show blocking references.
-   [ ] Keep all SQL schema-qualified, parameterized, and routed through existing store/executor patterns.

### Phase 8 - Runtime And API Consistency

-   [ ] Audit `RuntimeLedgerService` to ensure it uses the shared normalizer, not raw casts.
-   [ ] Replace runtime Ledger discovery filters based on `WHERE kind = 'ledger'` with published component-capability checks:
    -   `RuntimeLedgerService.listLedgers`;
    -   `RuntimeLedgerService.resolveLedgerBinding`;
    -   script APIs such as `resolveLedgerMetadataByCodename`;
    -   runtime Ledger controllers and SDK surface if they repeat the same assumption.
-   [ ] Keep standard `kind = 'ledger'` as a valid built-in type, but not as the only runtime gate for Ledger behavior.
-   [ ] Ensure ledger projection reads validate projection codename and referenced fields through normalized config.
-   [ ] Ensure manual ledger writes remain rejected for registrar-only configs.
-   [ ] Ensure append-only ledgers still reject update/delete/reversal except through controlled compensation flows.
-   [ ] Ensure application workspace schema generation uses the same normalized config and component-capability contract for idempotency indexes and projection metadata.
-   [ ] Replace `applicationWorkspaces.ensureLedgerIdempotencyIndex` kind checks with `isLedgerSchemaCapableEntity(entity.components)` or the chosen normalized runtime capability equivalent.
-   [ ] Replace schema-generation ledger checks based on `entity.kind === 'ledger'` with `isLedgerSchemaCapableEntity(entity.components)` or an equivalent normalized component contract.
-   [ ] Add indexes for common fact-query access patterns where safe:
    -   registrar object/row/line;
    -   effective period/date field;
    -   configured dimension fields.
-   [ ] Keep DDL idempotent and safe for recreated test DBs without introducing schema version bumps.

### Phase 9 - Application Control Panel And Published App Runtime

-   [ ] Extend `ApplicationWidgetBehaviorEditorDialog` datasource selection with existing runtime datasource kinds:
    -   `records.list`;
    -   `ledger.facts`;
    -   `ledger.projection`;
    -   `metric`.
-   [ ] Reuse the existing widget behavior dialog layout and MUI controls; do not create a separate LMS report widget editor.
-   [ ] Add generic ledger selectors to the application control panel:
    -   Ledger by id/codename;
    -   projection codename from normalized `config.ledger.projections`;
    -   field filters for projection/fact queries.
-   [ ] Extend `apps-template-mui` table and chart renderers so existing widgets can render:
    -   `ledger.facts` in the same `CustomizedDataGrid` path as `records.list`;
    -   `ledger.projection` as table rows or chart series;
    -   metric cards from real datasource responses where configured.
-   [ ] Keep configured widgets empty or show a localized no-data state when runtime rows are empty; do not fall back to demo chart data after a datasource is configured.
-   [ ] Preserve workspace scoping according to application settings and current workspace context.
-   [ ] Update workspace copy/delete flows to enumerate scoped physical tables from runtime object metadata and component capabilities, not from fixed table-name prefixes such as `cat_%` or `tbl_%`; this must cover standard Ledgers, hybrid Catalog-like Ledgers, and future custom prefixes.
-   [ ] Ensure all application control panel and published app labels are localized in application/template namespaces, with common reusable labels in `packages/universo-i18n`.

### Phase 10 - LMS Template And Fixture Regeneration

-   [ ] Update LMS Ledger definitions so every Ledger demonstrates:
    -   dimensions;
    -   resources;
    -   attributes;
    -   projection;
    -   registrar-only policy;
    -   idempotency keys.
-   [ ] Add an LMS capability matrix based on iSpring-like flows:
    -   learners, groups, departments, roles;
    -   content items, courses, pages, assignments, quizzes, learning tracks;
    -   enrollments, progress, scores, attempts, attendance, certificates, notifications;
    -   reports and dashboard metrics sourced from records and ledger projections.
-   [ ] Update `tools/testing/e2e/support/lmsFixtureContract.ts` to assert normalized `config.ledger`, not just entity existence.
-   [ ] Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` only through the product Playwright generator:

```bash
node tools/testing/e2e/run-playwright-suite.mjs \
  tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts \
  --project generators
```

-   [ ] Run the full LMS import/runtime flow after regeneration:

```bash
node tools/testing/e2e/run-playwright-suite.mjs \
  tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts \
  --project chromium \
  --grep "lms snapshot fixture imports"
```

### Phase 11 - Tests

#### Unit And Type Tests

-   [ ] `@universo/types`: ledger schema normalizer, strict schema parsing, reference validation.
-   [ ] `@universo/schema-ddl`: ledger DDL, system columns, idempotency indexes, hybrid component combinations.
-   [ ] `@universo/applications-backend`: source policy, mutation policy, projection validation, compensation facts.
-   [ ] `@universo/metahubs-backend`: template validation, snapshot restore, entity copy/delete behavior.
-   [ ] `applications-frontend`: widget behavior editor supports `ledger.facts` and `ledger.projection` without LMS-specific branches.
-   [ ] `apps-template-mui`: table/chart/stat widgets render ledger datasources and suppress demo data when a datasource is configured.

#### Frontend Vitest Tests

-   [ ] `LedgerSchemaFields` renders all sections with EN/RU labels.
-   [ ] Changing mode/policy/roles/projections updates nested state without dropping unrelated config.
-   [ ] Invalid projections block save.
-   [ ] Entity dialogs show `ledgerSchema` tab based on components, not kind key.
-   [ ] Field definition rows show role chips only when the owning entity type supports `ledgerSchema`.
-   [ ] Hybrid Catalog entity types can show both `behavior` and `ledgerSchema` tabs.
-   [ ] No raw i18n keys appear for new labels.

#### Playwright Tests

Use the existing Playwright CLI flow on port 3100. Do not rely on `pnpm dev`.

-   [ ] Create/import a metahub from the LMS snapshot.
-   [ ] Open `Ledgers` in Russian locale and verify:
    -   page title is localized;
    -   search placeholder is localized;
    -   Ledger cards/table rows open the shared field-definition surface.
-   [ ] Edit `ProgressLedger` and verify:
    -   `Ledger schema` tab is visible and localized;
    -   dimensions/resources/attributes are visible as role chips;
    -   projection editor shows the configured projection;
    -   save/reopen preserves values.
-   [ ] Create a new Ledger manually:
    -   add fields;
    -   configure dimension/resource roles;
    -   add idempotency keys;
    -   add a projection;
    -   save and reopen.
-   [ ] Create a custom Catalog-like type with both `behavior` and `ledgerSchema` components enabled and verify both tabs render.
-   [ ] Publish/sync the application and verify runtime:
    -   registrar-only Ledger rejects direct manual writes;
    -   Catalog post/unpost writes and compensates facts;
    -   projections return expected rows.
-   [ ] Open the published LMS app and verify that dashboard tables/charts/cards either use real record/ledger datasource rows or show localized empty states; no configured datasource should render demo-only English labels.
-   [ ] Capture screenshots for:
    -   Ledger list;
    -   Ledger schema tab;
    -   field-definition role chips;
    -   projection editor;
    -   hybrid Catalog tabs.
-   [ ] Fail the test on browser console errors, page errors, unexpected 4xx/5xx responses, and visible layout overlap.

### Phase 12 - Documentation

-   [ ] Update GitBook architecture docs:
    -   what a Ledger is;
    -   how it differs from Catalog;
    -   dimensions/resources/attributes;
    -   registrar policy;
    -   projections;
    -   hybrid Catalog + Ledger configurations.
-   [ ] Document the three-layer configuration model: metahub defaults, application control panel defaults, and published app workspace settings.
-   [ ] Document how generic runtime datasources map Catalog records and Ledger projections into existing `apps-template-mui` widgets.
-   [ ] Update guides:
    -   how to create a Ledger;
    -   how to connect a Catalog posting behavior to a Ledger;
    -   how to configure a projection;
    -   how to decide between separated 1C-like structure and hybrid entity design.
-   [ ] Update package READMEs with the new shared `ledgerSchema` component contract.
-   [ ] Run docs i18n checks.

## Safe Code Examples

### Generic Tab Gate

```tsx
const showLedgerSchemaTab = Boolean(entityType && supportsLedgerSchema(entityType.components))

if (showLedgerSchemaTab) {
    tabs.push({
        id: 'ledgerSchema',
        label: t('entities.instances.tabs.ledgerSchema', 'Ledger schema'),
        content: (
            <LedgerSchemaFields
                value={getLedgerConfigFormValue(values.ledgerConfig)}
                onChange={(nextValue) => setValue('ledgerConfig', nextValue)}
                disabled={isLoading}
                componentConfig={entityType.components.ledgerSchema}
                fieldOptions={ledgerFieldOptions}
                entityKindOptions={entityKindOptions}
                errors={errors}
            />
        )
    })
}
```

This is generic because it depends on `components.ledgerSchema`, not `kind === 'ledger'`.

### Payload Merge Without Config Loss

```ts
const buildConfigPayload = (values: EntityInstanceFormValues, baseConfig: Record<string, unknown> | null) => {
    const nextConfig = { ...(baseConfig ?? {}) }

    if (showBehaviorTab) {
        nextConfig.recordBehavior = normalizeCatalogRecordBehavior(values.recordBehavior)
    }

    if (showLedgerSchemaTab) {
        nextConfig.ledger = normalizeLedgerConfig(values.ledgerConfig)
    }

    return Object.keys(nextConfig).length > 0 ? nextConfig : undefined
}
```

### Projection Validation

```ts
const validateProjectionReferences = (config: LedgerConfig, fieldCodenames: Set<string>): string[] => {
    const errors: string[] = []
    for (const projection of config.projections) {
        for (const field of [...projection.dimensions, ...projection.resources]) {
            if (!fieldCodenames.has(field.toLowerCase())) {
                errors.push(`Projection "${projection.codename}" references missing field "${field}"`)
            }
        }
    }
    return errors
}
```

### Safe Runtime Query Pattern

```ts
const rows = await executor.query(
    `
      SELECT id, kind, config
      FROM ${qSchemaTable(schemaName, '_app_objects')}
      WHERE id = $1
        AND _app_deleted = false
        AND _upl_deleted = false
        AND COALESCE((config->'components'->'ledgerSchema'->>'enabled')::boolean, false) = true
        AND config ? 'ledger'
    `,
    [ledgerObjectId]
)
```

Use existing identifier helpers for dynamic schema/table names and parameter placeholders for values. If the implementation chooses a separate runtime object type metadata source instead of `config.components`, use a parameterized join to that source; the important rule is that runtime Ledger behavior is gated by published component capability plus normalized `config.ledger`, not by `kind = 'ledger'` alone.

## Validation Commands

Run focused checks first:

```bash
pnpm --filter @universo/types test -- ledgers
pnpm --filter @universo/metahubs-frontend exec vitest run \
  src/domains/entities/ui/__tests__/LedgerSchemaFields.test.tsx \
  src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx \
  src/domains/entities/metadata/fieldDefinition/ui/__tests__/FieldDefinitionList.ledgerRoles.test.tsx
pnpm --filter @universo/metahubs-backend test -- templateManifestValidator metahubSchemaService
pnpm --filter @universo/applications-backend test -- runtimeLedgersService runtimePostingMovements
pnpm --filter @universo/schema-ddl test -- SchemaGenerator
```

Then package builds and lint:

```bash
rg "kind === 'ledger'|kind !== 'ledger'|WHERE kind = 'ledger'|supportedKinds: \\['ledger'\\]|cat_%|tbl_%" \
  packages/schema-ddl/base \
  packages/metahubs-backend/base/src \
  packages/applications-backend/base/src \
  packages/applications-frontend/base/src \
  packages/apps-template-mui/src
pnpm --filter @universo/types build
pnpm --filter @universo/metahubs-frontend lint
pnpm --filter @universo/metahubs-frontend build
pnpm --filter @universo/metahubs-backend build
pnpm --filter @universo/applications-backend build
pnpm --filter @universo/schema-ddl build
pnpm docs:i18n:check
git diff --check
```

Then browser proof:

```bash
node tools/testing/e2e/run-playwright-suite.mjs \
  tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts \
  --project generators

node tools/testing/e2e/run-playwright-suite.mjs \
  tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts \
  --project chromium \
  --grep "lms snapshot fixture imports"
```

If the touched packages are stable, run the root build:

```bash
pnpm build
```

## Risks And Mitigations

### Risk: Ledger UI Becomes A New Hardcoded Standard-Kind Screen

Mitigation: all UI gates must use `components.ledgerSchema`, not `kind === 'ledger'`. Tests must include a non-Ledger custom kind or hybrid Catalog-like type with `ledgerSchema` enabled.

### Risk: Backend Keeps Kind-Only Ledger Rules

Mitigation: component registry, schema generation, template validation, snapshot restore, runtime Ledger services, script Ledger APIs, workspace copy/delete, and idempotency index creation must validate ledger behavior by component capability. A focused `rg "kind === 'ledger'|kind !== 'ledger'|WHERE kind = 'ledger'|supportedKinds: \\['ledger'\\]|cat_%|tbl_%"` audit must be part of implementation review, with any remaining standard-kind checks documented as compatibility-only.

### Risk: Published Runtime Metadata Does Not Contain Component Capabilities

Mitigation: publication/schema sync must persist or expose a safe capability manifest that runtime services can use. Tests must prove that a non-`ledger` published entity with `ledgerSchema` enabled is visible to Ledger APIs and receives Ledger DDL/runtime behavior.

### Risk: Published LMS App Still Shows Demo Data

Mitigation: once a widget has `records.list`, `ledger.facts`, `ledger.projection`, or `metric` datasource config, the published app must render real data or a localized no-data state. It must not fall back to hardcoded dashboard demo data.

### Risk: Field Roles Drift From Field Definitions

Mitigation: roles stay in `config.ledger.fieldRoles`, and every save validates references against current field definitions. Field deletion/copy must explicitly handle role references.

### Risk: Hybrid Catalogs Blur Product Semantics

Mitigation: permit the component combination technically, but add UI warnings and docs explaining when separated `catalog` + `ledger` is preferred.

### Risk: Projection Queries Become Unsafe

Mitigation: only allow projection fields declared in normalized `config.ledger` and existing field definitions. Dynamic identifiers must use existing schema/table/column quoting helpers.

### Risk: LMS Fixture Gets Manually Edited

Mitigation: update generator and fixture contract first, then regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` only through Playwright.

### Risk: Dialog Performance Degrades

Mitigation: fetch field and entity-kind options only while the relevant dialog/tab is open; memoize options and keep projection editors local until save.

## Acceptance Criteria

-   Standard Ledgers visibly differ from Catalogs in the metahub UI through a localized `Ledger schema` tab and field role/projection surfaces.
-   No Ledger authoring UI is hardcoded to `kind === 'ledger'`; the same surfaces work for any entity type with `components.ledgerSchema.enabled`.
-   Backend component validation and schema generation do not hardcode `ledgerSchema` to the standard `ledger` kind.
-   Published runtime metadata contains enough safe component capability data for runtime services to resolve Ledger-capable objects without relying on standard kind names.
-   `config.ledger` can be edited, saved, copied, restored from snapshots, published, and used by runtime services.
-   Runtime Ledger APIs can list, resolve, write, reject, and project facts for any published object that has `ledgerSchema` capability and normalized `config.ledger`, including future hybrid Catalog-like types.
-   Workspace copy/delete and idempotency index flows cover standard Ledgers, hybrid Catalog-like Ledgers, and custom physical table prefixes without prefix-only discovery.
-   Field roles and projections are validated against field definitions.
-   The standard LMS Ledgers show dimensions, resources, attributes, projections, source policy, mutation policy, and idempotency in UI.
-   Future hybrid Catalog-like types can technically combine Catalog record behavior and Ledger schema behavior.
-   Application control panel widgets can select record and ledger datasources through one shared editor.
-   Published `apps-template-mui` dashboards render configured ledger facts/projections through existing table/chart/card widgets, without LMS-specific widgets and without demo fallback for configured datasources.
-   `tools/fixtures/metahubs-lms-app-snapshot.json` is regenerated from the product Playwright generator.
-   Unit, backend, frontend, schema, and Playwright tests prove the flow.
-   Docs and READMEs explain the separated 1C-like model and the hybrid entity option.
