# Catalog Record Behavior UI Plan

Date: 2026-05-09

## Status

QA-revised draft for discussion. This plan covers the missing UI layer for configuring the already introduced `recordBehavior` runtime contract through the Entities constructor component model, updates the standard Catalog entity type template, and fixes raw script capability keys in Russian UI.

## QA Revision Summary

The first draft was too narrow because it described a Catalog-only tab. The codebase already has a generic entity type component model:

- `identityFields`
- `recordLifecycle`
- `posting`
- `ledgerSchema`

These components are defined in `packages/universo-types/base/src/common/entityComponents.ts` and are already enabled in `CATALOG_TYPE_COMPONENTS`. Therefore, the UI must be driven by entity type capabilities and `ui.tabs`, not by a direct `kind === 'catalog'` branch. The standard Catalog preset should enable the behavior tab, and Basic, Basic Demo, and LMS templates should inherit it through the preset flow.

## Problem Statement

The platform already has backend/runtime support for transactional Catalog behavior:

- `packages/universo-types/base/src/common/recordBehavior.ts` defines `CatalogRecordBehavior`.
- `packages/schema-ddl/base/src/SchemaGenerator.ts` materializes system columns from `config.recordBehavior`.
- `packages/applications-backend/base/src/services/runtimeRecordBehavior.ts` and `runtimeRowsController.ts` execute numbering, lifecycle, posting, and immutability rules.
- `packages/apps-template-mui` reads `recordBehavior` and exposes record commands.
- The LMS template seeds Catalogs with `recordBehavior`.

The missing piece is the metahub authoring UI. Entity instance create/edit dialogs currently expose only `General`, `Hubs`, `Attributes`, `Layouts`, `Scripts`, `Actions`, and `Events`; they do not expose `config.recordBehavior` even when the entity type declares `identityFields`, `recordLifecycle`, and `posting`. As a result, users cannot discover or configure the new Catalog functionality from the constructor.

There is also an i18n defect in the script editor: `posting`, `ledger.read`, and `ledger.write` are valid script capabilities, but `EntityScriptsTab` falls back to raw capability strings because its label switch only covers older capabilities.

## Current Code Findings

- `EntityInstanceListContent.tsx` builds entity instance create/edit tabs in `buildFormTabs`.
- `buildConfigPayload` only persists hub assignment options into `config`.
- `buildInitialFormValues` in `entityInstanceListHelpers.ts` does not hydrate `recordBehavior`.
- `EntityScriptsTab.tsx` has raw fallback for new capabilities.
- `packages/apps-template-mui/src/api/api.ts` defines a local `recordBehaviorSchema`, duplicating a contract that belongs in shared types.
- `CATALOG_TYPE_COMPONENTS` already enables `identityFields`, `recordLifecycle`, and `posting`.
- `CATALOG_TYPE_UI.tabs` currently does not include a structured `behavior` tab.
- `EntitiesWorkspace.tsx` exposes structured tab toggles only for `treeEntities`, `layout`, and `scripts`; it does not yet expose `behavior`.
- Existing UI should be reused: `EntityFormDialog`, `GeneralTabFields`, `ContainerSelectionPanel`, `FieldDefinitionListContent`, MUI form controls, and template MUI layout primitives.

## Goals

1. Add a discoverable component-driven UI tab for record behavior settings in create/edit dialogs.
2. Persist settings in `entity.config.recordBehavior` without losing unrelated config keys.
3. Reuse the existing entity dialog architecture and visual style.
4. Fix script capability i18n for Russian and English.
5. Add tests across shared contract, metahub frontend, and browser flows.
6. Update GitBook-style docs and screenshots.
7. Update the standard Catalog entity type template so Basic, Basic Demo, and LMS inherit the behavior tab through presets.
8. Do not manually edit `tools/fixtures/metahubs-lms-app-snapshot.json`; regenerate it from the product Playwright generator when template data or exported contracts change.

## Non-Goals

- Do not add a separate LMS-specific settings UI.
- Do not create a new standalone UI framework or duplicate entity forms.
- Do not bump the metahub template or schema version.
- Do not hardcode the behavior tab only for Catalogs. Catalog should receive it because its entity type template enables the relevant components and tab.
- Do not change the existing runtime command semantics unless tests expose a concrete defect.

## Target UX

Entity instance dialogs get a new tab when the entity type supports record behavior:

- RU: `Поведение`
- EN: `Behavior`

The tab appears when:

- `entityType.ui.tabs` contains `behavior`; and
- at least one of `identityFields`, `recordLifecycle`, or `posting` is enabled in `entityType.components`.

The standard Catalog template should satisfy these conditions. Other entity types can opt in later through the Entities constructor without changing `EntityInstanceListContent` again.

The tab uses compact MUI form sections inside the existing `EntityFormDialog`:

- `Режим записей`: reference, transactional, hybrid.
- `Нумерация`: enable, scope, periodicity, prefix, min length.
- `Дата записи`: enable, default to now, optional field codename.
- `Жизненный цикл`: enable, state field codename, states.
- `Проведение`: disabled, manual, automatic, target ledgers, posting script.
- `Неизменяемость`: none, posted, final.

The LMS seeded Catalogs should open with their actual configured values. A new Catalog should open with the default behavior declared by its entity type config or `DEFAULT_CATALOG_RECORD_BEHAVIOR`.

## Architecture Decisions

### 1. Keep Catalog Behavior as Metadata Configuration

The settings remain under:

```ts
entity.config.recordBehavior
```

This preserves the current metahub-to-application publication flow. The published app already receives the behavior as part of the linked collection metadata and the runtime schema generator already materializes it.

### 2. Add Shared Validation Instead of UI-Only Shapes

Move the duplicated `zod` schema from `apps-template-mui` into `@universo/types` next to the TypeScript contract:

```ts
export const catalogRecordBehaviorSchema = z.object({
  mode: z.enum(CATALOG_RECORD_MODES),
  numbering: z.object({
    enabled: z.boolean(),
    scope: z.enum(RECORD_NUMBERING_SCOPES),
    periodicity: z.enum(RECORD_NUMBERING_PERIODICITIES),
    prefix: z.string().trim().max(32).optional(),
    minLength: z.number().int().min(1).max(32).optional()
  }),
  effectiveDate: z.object({
    enabled: z.boolean(),
    fieldCodename: z.string().trim().max(128).optional(),
    defaultToNow: z.boolean()
  }),
  lifecycle: z.object({
    enabled: z.boolean(),
    stateFieldCodename: z.string().trim().max(128).optional(),
    states: z.array(
      z.object({
        codename: z.string().trim().min(1).max(128),
        title: z.string().trim().min(1).max(128),
        isInitial: z.boolean().optional(),
        isFinal: z.boolean().optional()
      })
    ).max(32)
  }),
  posting: z.object({
    mode: z.enum(RECORD_POSTING_MODES),
    targetLedgers: z.array(z.string().trim().min(1).max(128)).max(64),
    scriptCodename: z.string().trim().max(128).optional()
  }),
  immutability: z.enum(RECORD_IMMUTABILITY_MODES)
}) satisfies z.ZodType<CatalogRecordBehavior>
```

Add a normalization helper that merges partial legacy data with defaults and strips invalid values. Use it in frontend form hydration, save payload building, schema generation, application template API parsing, and runtime services.

### 3. Do Not Confuse Entity Type Components With Catalog Instance Behavior

`entityComponents.ts` describes feature flags on entity type definitions. `recordBehavior` is per entity instance configuration. The new UI must edit instance config, but its availability must be derived from the entity type component manifest and `ui.tabs`.

The implementation should introduce a helper similar to:

```ts
export const supportsRecordBehavior = (components: ComponentManifest | undefined): boolean =>
  Boolean(
    isEnabledComponentConfig(components?.identityFields) ||
      isEnabledComponentConfig(components?.recordLifecycle) ||
      isEnabledComponentConfig(components?.posting)
  )
```

### 4. Preserve Unrelated Config Keys

`buildConfigPayload` must merge `recordBehavior` into the existing config without dropping `hubs`, `isSingleHub`, `isRequiredHub`, `sortOrder`, `ledger`, or future config keys:

```ts
const nextConfig = isRecord(baseConfig) ? { ...baseConfig } : {}

if (supportsRecordBehavior(entityType?.components)) {
  nextConfig.recordBehavior = normalizeCatalogRecordBehaviorInput(values.recordBehavior)
}
```

When copying an entity instance with record behavior support, preserve the source behavior by default and allow future copy options to override it.

### 5. Add Behavior as a Structured Entity Authoring Tab

`EntitiesWorkspace.tsx` should treat `behavior` like `treeEntities`, `layout`, and `scripts`:

```ts
type SupportedEntityTab = 'general' | 'behavior' | 'treeEntities' | 'layout' | 'scripts'
```

The behavior tab toggle must be disabled or pruned when the relevant components are disabled. For the standard Catalog entity type, the structure is locked, so the template must include `behavior` in `CATALOG_TYPE_UI.tabs`.

## Implementation Phases

### Phase 1. Shared Contract Cleanup

Files:

- `packages/universo-types/base/src/common/recordBehavior.ts`
- `packages/universo-types/base/src/index.ts`
- `packages/apps-template-mui/src/api/api.ts`
- `packages/schema-ddl/base/src/SchemaGenerator.ts`
- `packages/applications-backend/base/src/services/runtimeRecordBehavior.ts`

Steps:

1. Add `catalogRecordBehaviorSchema` and `normalizeCatalogRecordBehavior` to `@universo/types`.
2. Reuse the shared schema in `apps-template-mui` instead of the local duplicate.
3. Replace ad hoc partial merges in `SchemaGenerator` and runtime services with the shared normalizer.
4. Add unit tests for partial configs, invalid enum values, duplicate/empty ledgers, empty lifecycle states, and default behavior.

### Phase 2. Entity Type Constructor Support

Files:

- `packages/metahubs-frontend/base/src/domains/entities/ui/EntitiesWorkspace.tsx`
- `packages/metahubs-backend/base/src/domains/templates/data/standardEntityTypeDefinitions.ts`
- `packages/universo-types/base/src/common/entityComponents.ts`

Steps:

1. Add `behavior` to structured entity authoring tabs.
2. Show the structured `behavior` tab checkbox in the entity type constructor.
3. Add guided component controls for `identityFields`, `recordLifecycle`, `posting`, and `ledgerSchema` if they are not already visible in the Components tab.
4. Enforce dependencies already declared in `COMPONENT_DEPENDENCIES`.
5. Update `CATALOG_TYPE_UI.tabs` to include `behavior`.
6. Keep standard Catalog components enabled:
   - `records`
   - `identityFields`
   - `recordLifecycle`
   - `posting`
   - `scripting`
   - `physicalTable`
7. Confirm Basic and Basic Demo inherit the updated Catalog preset because both include `{ presetCodename: 'catalog' }`.

### Phase 3. Generic Record Behavior Form Component

New file:

- `packages/metahubs-frontend/base/src/domains/entities/ui/RecordBehaviorFields.tsx`

Responsibilities:

- Render only form controls; no data fetching side effects.
- Accept `value`, `onChange`, `disabled`, `ledgerOptions`, `scriptOptions`, `fieldOptions`, and translated labels.
- Use existing MUI controls and dialog spacing.
- Keep state updates immutable and typed.
- Keep long texts in i18n, not inline.

Recommended component boundary:

```ts
interface RecordBehaviorFieldsProps {
  value: CatalogRecordBehavior
  onChange: (value: CatalogRecordBehavior) => void
  disabled?: boolean
  components: ComponentManifest
  fieldOptions: Array<{ codename: string; label: string }>
  ledgerOptions: Array<{ codename: string; label: string }>
  scriptOptions: Array<{ codename: string; label: string }>
}
```

The component must hide or disable sections based on component capabilities:

- `identityFields` controls numbering and effective date.
- `recordLifecycle` controls lifecycle state settings.
- `posting` controls posting mode, target Ledgers, and posting script.

### Phase 4. Wire the Form Into Entity Instance Dialogs

Files:

- `EntityInstanceListContent.tsx`
- `entityInstanceListHelpers.ts`

Steps:

1. Hydrate `recordBehavior` in `buildInitialFormValues`.
2. Add `recordBehavior` to create, edit, and copy initial values.
3. Add a component-driven `behavior` tab after `General` and before `Hubs`.
4. Extend `buildConfigPayload` to persist normalized behavior.
5. Extend validation:
   - transactional/hybrid mode with posting enabled should require at least one target Ledger before save;
   - automatic/manual posting with lifecycle enabled should have at least one initial state;
   - min length must be an integer from 1 to 32;
   - state codenames must be unique.
6. Make the save button disabled when behavior validation fails through the existing `canSaveEntityForm`.

### Phase 5. Lookup Data for Behavior Options

Files:

- `EntityInstanceListContent.tsx`
- Existing entity instance API hooks where possible.

Steps:

1. Reuse existing entity instance list/query APIs to fetch Ledgers for target ledger selection.
2. Reuse existing script API to list scripts attached to the Catalog for posting script selection.
3. Reuse existing field definition API when editing a Catalog to offer date/state field codenames.
4. For create mode, show a localized hint that field-bound options can be selected after the Catalog is saved and attributes are created.
5. Avoid N+1 requests; fetch only when the behavior tab is possible and the dialog is open.

### Phase 6. Script Capability I18n Fix

Files:

- `packages/metahubs-frontend/base/src/domains/scripts/ui/EntityScriptsTab.tsx`
- `packages/metahubs-frontend/base/src/i18n/locales/en/metahubs.json`
- `packages/metahubs-frontend/base/src/i18n/locales/ru/metahubs.json`

Steps:

1. Replace the switch fallback with a typed mapping that covers every `ScriptCapability`.
2. Add keys:
   - `scripts.capabilities.posting`
   - `scripts.capabilities.ledgerRead`
   - `scripts.capabilities.ledgerWrite`
3. Add a test that fails if any value from `SCRIPT_CAPABILITIES` renders as a raw key.

### Phase 7. Templates, Fixture Contract, and Snapshot Policy

Files:

- `packages/metahubs-backend/base/src/domains/templates/data/standardEntityTypeDefinitions.ts`
- `packages/metahubs-backend/base/src/domains/templates/data/linked-collection.entity-preset.ts`
- `packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts`
- `tools/testing/e2e/support/lmsFixtureContract.ts`
- Product Playwright generator that creates `tools/fixtures/metahubs-lms-app-snapshot.json`

Steps:

1. Update the standard Catalog entity type UI contract with `behavior` in `ui.tabs`.
2. Confirm the Catalog preset carries default `recordBehavior`.
3. Confirm Basic and Basic Demo templates inherit the updated Catalog preset.
4. Inspect whether LMS Catalogs already have complete behavior configs.
5. Extend `lmsFixtureContract.ts` to assert:
   - the Catalog entity type includes `behavior` in `ui.tabs`;
   - Catalog components include `identityFields`, `recordLifecycle`, and `posting`;
   - transactional LMS Catalogs keep expected `recordBehavior`;
   - posting scripts keep localized labels and required capabilities.
6. If exported data changes, regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` from `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`.
7. Do not manually patch the JSON fixture.

Generator command:

```bash
pnpm run build:e2e
node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "Metahubs LMS App Export"
```

### Phase 8. Tests

Unit and component tests:

- `packages/universo-types/base/src/__tests__/recordBehavior.test.ts`
- `packages/metahubs-frontend/base/src/domains/entities/ui/__tests__/RecordBehaviorFields.test.tsx`
- `packages/metahubs-frontend/base/src/domains/entities/ui/__tests__/EntitiesWorkspace.behaviorTab.test.tsx`
- `packages/metahubs-frontend/base/src/domains/entities/ui/__tests__/EntityInstanceList.recordBehavior.test.tsx`
- `packages/metahubs-frontend/base/src/domains/scripts/ui/__tests__/EntityScriptsTab.capabilities.test.tsx`

Coverage targets:

- structured `behavior` tab support in the entity type constructor;
- default record behavior on create for entity types that support it;
- existing LMS behavior on edit;
- validation errors and disabled save;
- persistence without dropping unrelated `config` keys;
- Russian labels for all new controls;
- no raw script capability strings in RU UI.

Playwright tests:

1. Import/create a metahub from the LMS snapshot.
2. Open the Entities constructor and verify the standard Catalog entity type exposes behavior-related components and the `behavior` authoring tab.
3. Open Catalogs in RU locale.
4. Create a new Catalog and verify the `Поведение` tab defaults.
5. Edit a seeded transactional Catalog and verify numbering, lifecycle, posting, target Ledgers, and immutability.
6. Open the Scripts tab and verify capability labels are localized.
7. Save changes, reopen the Catalog, and verify persistence.
8. Capture screenshots for entity type components, create/edit behavior, and script tabs and compare them manually during QA.

### Phase 9. Documentation

Update GitBook-style docs:

- `docs/ru/guides/transactional-catalogs.md`
- `docs/ru/architecture/ledgers.md`
- English equivalents if present or create them if missing.
- Relevant package READMEs for `@universo/types`, `schema-ddl`, and `apps-template-mui` if shared contract changes.

Docs must explain:

- what a reference, transactional, and hybrid Catalog means;
- how numbering, date, lifecycle, posting, and immutability work;
- how Catalogs relate to Ledgers;
- where settings are configured in the metahub constructor;
- how the behavior tab is enabled through entity type components and `ui.tabs`;
- why these settings are generic platform behavior, not LMS-specific behavior.

## Validation Commands

Run targeted checks first:

```bash
pnpm --filter @universo/types test
pnpm --filter @universo/types build
pnpm --filter metahubs-frontend test -- RecordBehaviorFields EntitiesWorkspace EntityInstanceList EntityScriptsTab
pnpm --filter metahubs-frontend build
pnpm --filter apps-template-mui test -- recordBehavior RowActionsMenu
pnpm --filter apps-template-mui build
pnpm --filter schema-ddl test -- recordBehavior SchemaGenerator
pnpm --filter applications-backend test -- runtimeRecordBehavior runtimeRowsController
```

Run browser checks through the existing Playwright CLI flow. Do not start `pnpm dev` manually from the agent:

```bash
node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "catalog behavior|script capabilities"
node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "Metahubs LMS App Export"
```

Final repository checks:

```bash
git diff --check
pnpm build
```

The full root build can be left for the user if local resources are constrained, but targeted package builds must pass before handoff.

## Risks and Mitigations

- Risk: existing Catalog configs are partial or malformed.
  Mitigation: shared normalizer merges with defaults and strips invalid values.

- Risk: UI accidentally drops unrelated config.
  Mitigation: update `buildConfigPayload` tests to assert preservation of unknown keys.

- Risk: behavior UI is accidentally hardcoded to Catalog again.
  Mitigation: test a generic custom entity type with the same components and `behavior` tab enabled.

- Risk: behavior tab becomes too large for the current dialog.
  Mitigation: use compact MUI sections inside the existing dialog; no nested cards.

- Risk: duplicated schema diverges again.
  Mitigation: export the shared schema from `@universo/types` and delete the local duplicate in `apps-template-mui`.

- Risk: script capability labels regress when capabilities are added.
  Mitigation: test every `SCRIPT_CAPABILITIES` value against the label map.

## Acceptance Criteria

- A user can enable behavior support through the entity type constructor components and authoring tabs.
- A user can open standard Catalog create/edit dialogs and see the `Поведение` tab in RU because the Catalog preset enables it.
- A user can configure numbering, date, lifecycle, posting, target Ledgers, posting script, and immutability.
- Saving persists `config.recordBehavior` and does not erase other config keys.
- Basic and Basic Demo templates inherit the updated standard Catalog type.
- LMS Catalogs seeded from the generated snapshot display their actual behavior settings.
- The LMS snapshot is regenerated from the Playwright generator when exported template contracts change.
- Script capability labels are localized, including posting and ledger permissions.
- Unit, component, and Playwright tests cover the new UI path.
- Docs explain where the functionality is configured and how it maps to runtime behavior.
