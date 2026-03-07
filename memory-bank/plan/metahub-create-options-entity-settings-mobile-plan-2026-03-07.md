# Plan: Metahub Create Options, Entity Settings, Mobile UX, Logout

> **Date**: 2026-03-07 (Revised after QA #1, #2, #3)  
> **Complexity**: Level 4 (Multi-package, frontend + backend, template system changes)  
> **Branch**: TBD (suggest `feature/metahub-create-options-entity-settings-mobile`)  
> **Note**: Test database will be recreated — no legacy preservation needed. No schema/template version bumps required.  
> **QA Report**: `memory-bank/plan/metahub-create-options-entity-settings-mobile-plan-2026-03-07-QA.md`

---

## Overview

Eight functional blocks requested:

1. **"Options" tab** in the metahub creation dialog with entity-kind toggle switches
2. **Toggle behavior** — Branch and Layout always created (locked ON); Hub/Catalog/Set/Enumeration togglable (default ON)
3. **Server-side validation** — `createOptions` API contract with proper seed entity filtering
4. **Documentation** — update MIGRATIONS.md / MIGRATIONS-RU.md / AGENTS.md
5. **Template split** — "Basic" (minimal) + "Basic-demo" (all widgets active) with widget/layout changes
6. **"Settings" tab** in 5 entity detail views (Hub, Catalog, Set, Enumeration, Publication) — opens **edit dialog overlay** (same as three-dots → Edit), NOT a page navigation
7. **Mobile responsiveness** — AppNavbar cleanup, ViewHeader responsive with collapsible search, Drawer cleanup
8. **Desktop logout** — functional Logout in SideMenu with confirmation dialog

---

## Affected Areas

### Packages Modified

| Package | Scope |
|---------|-------|
| `@universo/types` | New `MetahubCreateOptions` type |
| `@universo/metahubs-backend` | POST /metahubs Zod schema, `createInitialBranch` pipeline, template split, seed entity filtering |
| `@universo/metahubs-frontend` | MetahubActions.tsx (Options tab), MetahubList.tsx (pass createOptions), HubList/AttributeList/ConstantList/EnumerationValueList/PublicationVersionList (Settings tab as edit dialog), i18n EN+RU |
| `@universo/template-mui` | AppNavbar.tsx, ViewHeader.tsx, SideMenuMobile.tsx, SideMenu.tsx, CardAlert.tsx, MainLayoutMUI.tsx |
| `@universo/i18n` | Common logout keys |

### Key Files

**Types:**
- `packages/universo-types/base/src/common/metahubs.ts` — `MetahubCreateOptions` type

**Backend (template + API):**
- `packages/metahubs-backend/base/src/domains/templates/data/basic.template.ts` — modified basic template
- `packages/metahubs-backend/base/src/domains/templates/data/basic-demo.template.ts` — NEW file
- `packages/metahubs-backend/base/src/domains/templates/data/index.ts` — template registry
- `packages/metahubs-backend/base/src/domains/shared/layoutDefaults.ts` — widget defaults
- `packages/metahubs-backend/base/src/domains/metahubs/routes/metahubsRoutes.ts` — POST /metahubs
- `packages/metahubs-backend/base/src/domains/branches/services/MetahubBranchesService.ts` — createInitialBranch
- `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubSchemaService.ts` — initSystemTables
- `packages/metahubs-backend/base/src/domains/templates/services/TemplateSeedExecutor.ts` — apply()

**Frontend (create dialog + entity settings tabs):**
- `packages/metahubs-frontend/base/src/domains/metahubs/ui/MetahubActions.tsx` — Options tab in create dialog
- `packages/metahubs-frontend/base/src/domains/metahubs/ui/MetahubList.tsx` — create handler passes `createOptions`
- `packages/metahubs-frontend/base/src/domains/metahubs/api/metahubsApi.ts` — API client
- `packages/metahubs-frontend/base/src/domains/hubs/ui/HubList.tsx` — hub detail (hub-scoped) → Settings tab → edit dialog
- `packages/metahubs-frontend/base/src/domains/hubs/ui/HubActions.tsx` — reused `buildInitialValues`, `buildFormTabs`, `validateHubForm`, `toPayload`
- `packages/metahubs-frontend/base/src/domains/attributes/ui/AttributeList.tsx` — catalog detail → Settings tab → edit dialog
- `packages/metahubs-frontend/base/src/domains/catalogs/ui/CatalogActions.tsx` — reused edit logic
- `packages/metahubs-frontend/base/src/domains/constants/ui/ConstantList.tsx` — set detail (NO tabs → add tabs) → Settings tab → edit dialog
- `packages/metahubs-frontend/base/src/domains/sets/ui/SetActions.tsx` — reused edit logic
- `packages/metahubs-frontend/base/src/domains/enumerations/ui/EnumerationValueList.tsx` — enumeration detail (NO tabs → add tabs) → Settings tab → edit dialog
- `packages/metahubs-frontend/base/src/domains/enumerations/ui/EnumerationActions.tsx` — reused edit logic
- `packages/metahubs-frontend/base/src/domains/publications/ui/PublicationVersionList.tsx` — publication detail → Settings tab → edit dialog
- `packages/metahubs-frontend/base/src/domains/publications/ui/PublicationActions.tsx` — reused edit logic

**i18n:**
- `packages/metahubs-frontend/base/src/i18n/locales/en/metahubs.json` — EN translations
- `packages/metahubs-frontend/base/src/i18n/locales/ru/metahubs.json` — RU translations
- `packages/universo-i18n/base/src/locales/en/core/common.json` — logout keys EN
- `packages/universo-i18n/base/src/locales/ru/core/common.json` — logout keys RU

**Template-MUI (mobile + logout):**
- `packages/universo-template-mui/base/src/components/dashboard/AppNavbar.tsx`
- `packages/universo-template-mui/base/src/components/headers/ViewHeader.tsx`
- `packages/universo-template-mui/base/src/components/dashboard/SideMenuMobile.tsx`
- `packages/universo-template-mui/base/src/components/dashboard/SideMenu.tsx`
- `packages/universo-template-mui/base/src/components/dashboard/CardAlert.tsx`
- `packages/universo-template-mui/base/src/layout/MainLayoutMUI.tsx` — add `<ConfirmDialog />`

**Documentation:**
- `packages/metahubs-backend/base/MIGRATIONS.md` / `MIGRATIONS-RU.md`
- `packages/metahubs-frontend/base/MIGRATIONS.md` / `MIGRATIONS-RU.md`
- `AGENTS.md`

---

## Plan Steps

### Phase 1: Types & Contracts (shared foundation)

- [ ] **Step 1.1** — Add `MetahubCreateOptions` type to `@universo/types`

  **File**: `packages/universo-types/base/src/common/metahubs.ts`

  Add after existing template types:

  ```typescript
  /**
   * Entity creation toggles passed at metahub creation time.
   * Determines which default entities from the template seed are created.
   * Branch and Layout are always required (no toggle).
   */
  export interface MetahubCreateOptions {
    /** Create default Hub entity. Default: true */
    createHub?: boolean
    /** Create default Catalog entity. Default: true */
    createCatalog?: boolean
    /** Create default Set entity. Default: true */
    createSet?: boolean
    /** Create default Enumeration entity. Default: true */
    createEnumeration?: boolean
  }
  ```

- [ ] **Step 1.2** — Export `MetahubCreateOptions` from `@universo/types` index

  Ensure the new type is accessible from external packages via the standard import path.

  > **Note**: `requiredEntityKinds` field on `MetahubTemplateSeed` is **deferred** — no template currently needs it, and the `filterSeedByCreateOptions` logic works without it. Can be added later if template-specific enforcement is needed.

### Phase 2: Backend — Template Split & API Changes

- [ ] **Step 2.1** — Split basic template: create `basic-demo.template.ts`

  **File (new)**: `packages/metahubs-backend/base/src/domains/templates/data/basic-demo.template.ts`

  The **basic-demo** template (renamed from current basic):
  - Codename: `'basic-demo'`
  - Name: `vlc('Basic Demo', 'Базовый-демо')`
  - Layout name: `vlc('Main', 'Основной')` (was 'Dashboard' / 'Дашборд')
  - Layout description: `vlc('Main layout for published applications', 'Основной макет для опубликованных приложений')`
  - ALL widgets active (clone from `DEFAULT_DASHBOARD_ZONE_WIDGETS` with `isActive: true` for all)
  - Remove standalone `detailsTable` widget (sortOrder 6 in center)
  - Activate `columnsContainer` (sortOrder 7 in center) which contains detailsTable + productTree columns
  - Include demo `entities` in seed with proper Russian gender forms
  - Same settings as basic template

  ```typescript
  // Key widget transformation for basic-demo:
  function buildDemoSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    return DEFAULT_DASHBOARD_ZONE_WIDGETS
      .filter(w => !(w.widgetKey === 'detailsTable' && w.zone === 'center'))
      .map(item => {
        const widget: TemplateSeedZoneWidget = {
          zone: item.zone,
          widgetKey: item.widgetKey,
          sortOrder: item.sortOrder,
          // All widgets active in demo — do NOT set isActive: false
        }
        if (item.config) {
          widget.config = enrichConfigWithVlcTimestamps(item.config)
        }
        return widget
      })
  }
  ```

- [ ] **Step 2.2** — Modify **basic** template to be minimal

  **File**: `packages/metahubs-backend/base/src/domains/templates/data/basic.template.ts`

  Changes:
  - Name stays: `vlc('Basic', 'Базовый')`
  - Layout name: `vlc('Main', 'Основной')` (was 'Dashboard' / 'Дашборд')
  - Layout description: `vlc('Main layout for published applications', 'Основной макет для опубликованных приложений')`
  - Keep ONLY essential active widgets: `menuWidget` (left), `header` (top), `detailsTitle` (center), `columnsContainer` (center) with detailsTable+productTree columns
  - Remove all inactive widgets entirely from seed

  ```typescript
  function buildBasicMinimalSeedZoneWidgets(): TemplateSeedZoneWidget[] {
    const essentialWidgets: TemplateSeedZoneWidget[] = [
      {
        zone: 'left',
        widgetKey: 'menuWidget',
        sortOrder: 3,
        config: enrichConfigWithVlcTimestamps({ /* same menuWidget config from layoutDefaults */ })
      },
      { zone: 'top', widgetKey: 'header', sortOrder: 2 },
      { zone: 'center', widgetKey: 'detailsTitle', sortOrder: 5 },
      {
        zone: 'center',
        widgetKey: 'columnsContainer',
        sortOrder: 7,
        config: {
          columns: [
            { id: 'seed-col-details-table', width: 9, widgets: [{ widgetKey: 'detailsTable' }] },
            { id: 'seed-col-sidebar', width: 3, widgets: [{ widgetKey: 'productTree' }] }
          ]
        }
      }
    ]
    return essentialWidgets
  }
  ```

- [ ] **Step 2.3** — Register `basicDemoTemplate` in template registry

  **File**: `packages/metahubs-backend/base/src/domains/templates/data/index.ts`

  ```typescript
  import { basicTemplate } from './basic.template'
  import { basicDemoTemplate } from './basic-demo.template'

  export const builtinTemplates: MetahubTemplateManifest[] = [basicTemplate, basicDemoTemplate]
  export const DEFAULT_TEMPLATE_CODENAME = 'basic'
  ```

- [ ] **Step 2.4** — Add `createOptions` to POST /metahubs Zod schema

  **File**: `packages/metahubs-backend/base/src/domains/metahubs/routes/metahubsRoutes.ts`

  Add to the schema object after `templateId`:

  ```typescript
  createOptions: z.object({
    createHub: z.boolean().optional().default(true),
    createCatalog: z.boolean().optional().default(true),
    createSet: z.boolean().optional().default(true),
    createEnumeration: z.boolean().optional().default(true),
  }).optional()
  ```

  Pass `createOptions` to `branchesService.createInitialBranch()`:

  ```typescript
  await branchesService.createInitialBranch({
    metahubId: metahub.id,
    name: branchName,
    description: branchDescription ?? null,
    createdBy: userId,
    createOptions: result.data.createOptions // NEW
  })
  ```

- [ ] **Step 2.5** — Thread `createOptions` through `MetahubBranchesService.createInitialBranch`

  **File**: `packages/metahubs-backend/base/src/domains/branches/services/MetahubBranchesService.ts`

  Update the `createInitialBranch` method signature to accept `createOptions?: MetahubCreateOptions`.
  Pass it down to `schemaService.initializeSchema()` (or `initSystemTables()`):

  ```typescript
  async createInitialBranch(params: {
    metahubId: string
    name: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string> | null
    createdBy: string
    createOptions?: MetahubCreateOptions // NEW
  }) {
    // ... existing code ...
    await this.schemaService.initializeSchema(schemaName, manifest, params.createOptions)
    // ...
  }
  ```

- [ ] **Step 2.6** — Filter seed entities in `MetahubSchemaService.initSystemTables`

  **File**: `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubSchemaService.ts`

  Before calling `TemplateSeedExecutor.apply(seed)`, filter entities based on `createOptions`:

  ```typescript
  async initSystemTables(
    schemaName: string,
    manifest: MetahubTemplateManifest,
    createOptions?: MetahubCreateOptions
  ) {
    // ... existing DDL code ...

    // Filter seed entities based on createOptions
    const filteredSeed = this.filterSeedByCreateOptions(manifest.seed, createOptions)
    const executor = new TemplateSeedExecutor(queryRunner, schemaName)
    await executor.apply(filteredSeed)
    // ...
  }

  private filterSeedByCreateOptions(
    seed: MetahubTemplateSeed,
    options?: MetahubCreateOptions
  ): MetahubTemplateSeed {
    if (!seed.entities || !options) return seed

    const filteredEntities = seed.entities.filter(entity => {
      // Check user options (all default to true if not specified)
      switch (entity.kind) {
        case 'hub': return options.createHub !== false
        case 'catalog': return options.createCatalog !== false
        case 'set': return options.createSet !== false
        case 'enumeration': return options.createEnumeration !== false
        default: return true
      }
    })

    // Also filter related elements and enumerationValues for excluded entities
    const includedCodenames = new Set(filteredEntities.map(e => e.codename))

    const filteredElements: Record<string, typeof seed.elements[string]> = {}
    if (seed.elements) {
      for (const [key, value] of Object.entries(seed.elements)) {
        if (includedCodenames.has(key)) filteredElements[key] = value
      }
    }

    const filteredEnumValues: Record<string, typeof seed.enumerationValues[string]> = {}
    if (seed.enumerationValues) {
      for (const [key, value] of Object.entries(seed.enumerationValues)) {
        if (includedCodenames.has(key)) filteredEnumValues[key] = value
      }
    }

    return {
      ...seed,
      entities: filteredEntities,
      elements: filteredElements,
      enumerationValues: filteredEnumValues
    }
  }
  ```

  > **Note**: `MetahubTemplateSeed.elements` and `enumerationValues` are `Record<string, ...[]>` keyed by entity codename. Filtering is done by checking whether the entity codename is in `includedCodenames`.

- [ ] **Step 2.7** — Add entity definitions to both template seeds

  Both templates need `entities` in their seed to make the "Options" tab meaningful.

  **Naming convention per ТЗ**: "Main" / "Основной (Основная / Основное в зависимости от рода)"

  **basic.template.ts** — minimal entities with gender-correct Russian names:

  ```typescript
  seed: {
    // ... layouts, layoutZoneWidgets, settings ...
    entities: [
      {
        codename: 'MainHub',
        kind: 'hub',
        name: vlc('Main', 'Основной'),
      },
      {
        codename: 'MainCatalog',
        kind: 'catalog',
        name: vlc('Main', 'Основной'),
        // Note: hubs field exists on TemplateSeedEntity type but is NOT processed
        // by TemplateSeedExecutor. Hub-entity associations are managed at runtime.
      },
      {
        codename: 'MainSet',
        kind: 'set',
        name: vlc('Main', 'Основной'),
      },
      {
        codename: 'MainEnumeration',
        kind: 'enumeration',
        name: vlc('Main', 'Основное'),   // neuter gender: перечисление — средний род
      }
    ]
  }
  ```

  **Branch name** (already created by the pipeline): `vlc('Main', 'Основная')` — feminine gender: ветка — женский род.

  **Layout name** (Step 2.2 above): `vlc('Main', 'Основной')` — masculine gender: макет — мужской род.

  **basic-demo.template.ts** — richer demo entities with attributes and sample data. Same gender rules apply.

### Phase 3: Frontend — "Options" Tab in Create Dialog

> **Architecture note (QA #2 fix)**: The create dialog in `MetahubList.tsx` does NOT use `buildEditTabs` from `MetahubActions.tsx`. It has its OWN `buildFormTabs` (useCallback at line 320) that returns 2 tabs: `general` (using `GeneralTabFields` with `showTemplateSelector`) and `storage`. The `buildEditTabs` in `MetahubActions.tsx` is only used by the **edit** and **copy** action descriptors.
>
> Therefore, the Options tab must be added to `MetahubList.tsx`'s local `buildFormTabs`, NOT to `MetahubActions.tsx`'s `buildEditTabs`.
>
> **UI component decision (QA #2 fix)**: The ТЗ says "переключатели (switches)", but ALL existing copy-options tabs across the codebase use `Checkbox` (MetahubActions, HubActions, CatalogActions, SetActions, EnumerationActions). To maintain visual consistency with the established pattern, we use `Checkbox` for the create-options tab as well. Semantically, Checkbox is appropriate for "select which entities to create" (multiselect), while Switch implies binary on/off toggles. The locked items (Branch, Layout) use `disabled Checkbox checked` to show they're always included.

- [ ] **Step 3.1** — Add `MetahubCreateOptionsTab` component in `MetahubList.tsx`

  **File**: `packages/metahubs-frontend/base/src/domains/metahubs/ui/MetahubList.tsx`

  New component defined **inside MetahubList.tsx** (not MetahubActions.tsx), placed before the component or as a separate inline:

  ```tsx
  import { Checkbox, Divider, FormControlLabel, Stack, Typography } from '@mui/material'

  const MetahubCreateOptionsTab: React.FC<{
    values: Record<string, unknown>
    setValue: (key: string, value: unknown) => void
    isLoading: boolean
    t: TFunction
  }> = ({ values, setValue, isLoading, t }) => {
    const entityKinds = [
      { key: 'createHub', label: t('createOptions.hub') },
      { key: 'createCatalog', label: t('createOptions.catalog') },
      { key: 'createSet', label: t('createOptions.set') },
      { key: 'createEnumeration', label: t('createOptions.enumeration') },
    ]

    return (
      <Stack spacing={1} sx={{ mt: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {t('createOptions.alwaysCreated')}
        </Typography>
        {/* Locked items — always created, shown as disabled checked for clarity */}
        <FormControlLabel
          control={<Checkbox checked disabled />}
          label={t('createOptions.branch')}
        />
        <FormControlLabel
          control={<Checkbox checked disabled />}
          label={t('createOptions.layout')}
        />

        <Divider />

        <Typography variant="subtitle2" color="text.secondary">
          {t('createOptions.optionalEntities')}
        </Typography>
        {entityKinds.map(({ key, label }) => (
          <FormControlLabel
            key={key}
            control={
              <Checkbox
                checked={values[key] !== false}
                onChange={(e) => setValue(key, e.target.checked)}
                disabled={isLoading}
              />
            }
            label={label}
          />
        ))}
      </Stack>
    )
  }
  ```

  > **Why Checkbox, not Switch**: Matches the existing copy-options pattern in MetahubActions.tsx (line 334), HubActions.tsx (line 349), CatalogActions.tsx (line 355) etc. All entity option toggles in the project use `FormControlLabel` + `Checkbox`.

- [ ] **Step 3.2** — Add "Options" tab to `buildFormTabs` in MetahubList.tsx

  **File**: `packages/metahubs-frontend/base/src/domains/metahubs/ui/MetahubList.tsx`

  The create dialog's local `buildFormTabs` useCallback (line 320) currently returns 2 tabs: `general` (with `GeneralTabFields` + `showTemplateSelector`) and `storage`.

  Add a 3rd "create-options" tab at the end:

  ```typescript
  const buildFormTabs = useCallback(
    ({ values, setValue, isLoading, errors }: BuildFormTabsArgs) => {
      const fieldErrors = errors ?? {}
      const storageMode = values.storageMode ?? 'main_db'

      return [
        {
          id: 'general',
          label: t('tabs.general'),
          content: (
            <GeneralTabFields              // ← PRESERVED: GeneralTabFields (not MetahubEditFields)
              values={values}              //   This is critical — it has showTemplateSelector for create
              setValue={setValue}
              isLoading={isLoading}
              errors={fieldErrors}
              uiLocale={i18n.language}
              nameLabel={tc('fields.name', 'Name')}
              descriptionLabel={tc('fields.description', 'Description')}
              codenameLabel={t('codename', 'Codename')}
              codenameHelper={t(getCodenameHelperKey(codenameConfig), 'Unique identifier')}
              showTemplateSelector          // ← PRESERVED: template selector enabled for create
            />
          )
        },
        {
          id: 'storage',
          label: t('tabs.storage'),
          content: ( /* ... existing RadioGroup ... */ )
        },
        {
          id: 'create-options',             // NEW TAB
          label: t('createOptions.tab'),
          content: (
            <MetahubCreateOptionsTab
              values={values}
              setValue={setValue}
              isLoading={isLoading}
              t={t}
            />
          )
        }
      ]
    },
    [codenameConfig, i18n.language, tc, t]
  )
  ```

  > **Note**: `buildEditTabs` in `MetahubActions.tsx` is NOT modified — it remains used only for edit/copy dialogs. The create dialog's `GeneralTabFields` with `showTemplateSelector` is preserved, which differs from `MetahubEditFields` (used in edit dialog, template selector disabled).

- [ ] **Step 3.3** — Wire `handleCreateMetahub` to extract and pass `createOptions`

  **File**: `packages/metahubs-frontend/base/src/domains/metahubs/ui/MetahubList.tsx`

  1. Update `localizedFormDefaults` (line 315) to include create option defaults:

  ```typescript
  const localizedFormDefaults = useMemo<MetahubFormValues>(
    () => ({
      nameVlc: null, descriptionVlc: null, codenameVlc: null,
      codename: '', codenameTouched: false, storageMode: 'main_db',
      // Create options — all default to true (all entities created)
      createHub: true,
      createCatalog: true,
      createSet: true,
      createEnumeration: true,
    }),
    []
  )
  ```

  2. Update `handleCreateMetahub` (line 432) to extract `createOptions` from form data and pass to API:

  ```typescript
  const handleCreateMetahub = async (data: GenericFormValues) => {
    // ... existing name/codename/description extraction ...

    const createOptions = {
      createHub: data.createHub !== false,
      createCatalog: data.createCatalog !== false,
      createSet: data.createSet !== false,
      createEnumeration: data.createEnumeration !== false,
    }

    const result = await metahubsApi.createMetahub({
      codename: validatedCodename,
      codenameInput,
      codenamePrimaryLocale,
      name: nameInput,
      description: descriptionInput,
      namePrimaryLocale,
      descriptionPrimaryLocale,
      templateId: data.templateId as string | undefined,
      createOptions,      // NEW — pass entity creation toggles to API
    })

    // ... existing success handling ...
  }
  ```

- [ ] **Step 3.4** — Update metahubs API client to accept `createOptions`

  **File**: `packages/metahubs-frontend/base/src/domains/metahubs/api/metahubsApi.ts`

  Add `createOptions?: MetahubCreateOptions` to the create payload type and include in POST body.

### Phase 4: Frontend — "Settings" Tab as Edit Dialog Overlay in Entity Detail Views

> **Architecture Decision (per ТЗ)**: The "Settings" tab does NOT navigate away. It opens the **same EntityFormDialog** that the three-dots menu → "Edit" action uses, as an overlay on top of the current page. The user stays on their current page the entire time.
>
> **Pattern**: Each detail page manages a `editDialogOpen` state. When the "Settings" tab is clicked, we set `editDialogOpen = true` and render `<EntityFormDialog>` with the same `tabs`, `initialExtraValues`, `validate`, `canSave`, `onSave` callbacks that the `ActionDescriptor[id='edit']` in the respective `*Actions.tsx` uses. This avoids code duplication by calling the same builder functions (`buildInitialValues`, `buildFormTabs`, `toPayload`, etc.) that already exist.
>
> **ActionContext construction (H2 fix)**: Each detail page must construct an `ActionContext` object for the builder functions. The reference implementation is `createHubContext` in `HubList.tsx` (line ~632). The `ActionContext<TEntity, TData>` interface (from `@universo/template-mui`) has these fields:
> - **Required**: `entity: TEntity`, `entityKind: string`, `t: (key, params?) => string`
> - **Optional but used**: `api?: { updateEntity?, deleteEntity? }`, `helpers?: { enqueueSnackbar?, confirm?, refreshList?, openDeleteDialog? }`, `meta?: Record<string, any>`, `[key: string]: any` (index signature for extra fields like `hubMap`, `uiLocale`)
>
> For the Settings edit dialog, we only need a **minimal ActionContext** — just enough for `buildInitialValues` and `buildFormTabs` to work. We do NOT need `api.deleteEntity`, `helpers.openDeleteDialog`, or copy-related fields.
>
> **Critical detail**: `buildFormTabs` in each *Actions.tsx takes different parameters beyond `ctx`:
> - `HubActions.tsx`: `buildFormTabs(ctx, hubs, { editingEntityId?, allowHubNesting?, mode? })` → higher-order fn
> - `CatalogActions.tsx`: `buildFormTabs(ctx, hubs, editingEntityId?)` → higher-order fn
> - `SetActions.tsx`: `buildFormTabs(ctx, hubs, editingEntityId?)` → higher-order fn
> - `EnumerationActions.tsx`: `buildFormTabs(ctx, hubs, editingEntityId?)` → higher-order fn
> - `PublicationActions.tsx`: `buildFormTabs(ctx, metahubId)` → higher-order fn
>
> All return a **higher-order function** `(tabArgs) => TabConfig[]` — matching the `tabs` prop of `EntityFormDialog`.

**Target pages** (entity detail views):

| Entity | Detail Page File | Current Tabs | Change |
|--------|-----------------|--------------|--------|
| Hub | `HubList.tsx` (when `isHubScoped`) | Hubs / Catalogs / Sets / Enumerations | Add 5th "Settings" tab |
| Catalog | `AttributeList.tsx` | Attributes / Elements | Add 3rd "Settings" tab |
| Set | `ConstantList.tsx` | _(none)_ | **Create** `<Tabs>` with Constants / Settings |
| Enumeration | `EnumerationValueList.tsx` | _(none)_ | **Create** `<Tabs>` with Values / Settings |
| Publication | `PublicationVersionList.tsx` | Versions / Applications | Add 3rd "Settings" tab |

- [ ] **Step 4.1** — Add "Settings" tab + edit dialog overlay in `HubList.tsx`

  **File**: `packages/metahubs-frontend/base/src/domains/hubs/ui/HubList.tsx`

  Current hub-scoped tabs (line ~1057): `Hubs`, `Catalogs`, `Sets`, `Enumerations`

  **Available in scope** (already present in HubList.tsx):
  - `hubMap: Map<string, Hub>` — resolved from query
  - `allHubs: Hub[]` — all hubs list
  - `hubId` — current hub route param (the "parent hub" being viewed)
  - `allowHubNesting: boolean` — from settings
  - `preferredVlcLocale: string` — from `useMetahubPrimaryLocale()`
  - `t` — from `useTranslation`
  - `updateHubMutation` — from `useUpdateHub()`
  - `queryClient` — from `useQueryClient()`
  - `confirm` — from `useConfirm()`
  - `enqueueSnackbar` — from `useSnackbar()`
  - `codenameConfig` — from `useCodenameConfig()`
  - Note: `createHubContext` already builds full ActionContext. We can reuse it.

  **Changes**:
  1. Import `EntityFormDialog` (lazy), and `buildInitialValues`, `buildFormTabs`, `validateHubForm`, `canSaveHubForm`, `toPayload` from `./HubActions`.
  2. Add state: `const [editDialogOpen, setEditDialogOpen] = useState(false)`
  3. The **parent hub entity** is available as `hubMap.get(hubId)` (the hub for the current route).
  4. Add 5th tab "Settings" to the `<Tabs>` component.
  5. In `handleHubTabChange`: when `newValue === 'settings'`, call `setEditDialogOpen(true)` and **return** without changing the active tab.
  6. Build the ActionContext using the same pattern as `createHubContext`:

  ```tsx
  import { buildInitialValues, buildFormTabs, validateHubForm, canSaveHubForm, toPayload } from './HubActions'

  // Inside component:
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // Get current hub entity for edit dialog
  const currentHub = hubId ? hubMap.get(hubId) : undefined
  const currentHubDisplay: HubDisplay | undefined = currentHub ? {
    id: currentHub.id,
    codename: currentHub.codename,
    name: getVLCString(currentHub.name, preferredVlcLocale) || currentHub.codename,
    description: getVLCString(currentHub.description, preferredVlcLocale) || '',
    // ... other HubDisplay fields from existing mapping
  } : undefined

  // ActionContext for the edit dialog — minimal version of createHubContext
  const settingsDialogCtx = useMemo(() => {
    if (!currentHubDisplay || !currentHub) return null
    return {
      entity: currentHubDisplay,
      entityKind: 'hub',
      t,
      hubMap,
      uiLocale: preferredVlcLocale,
      _codenameConfig: codenameConfig,  // used by _cc() helper inside HubActions
      api: {
        updateEntity: async (id: string, patch: HubLocalizedPayload) => {
          if (!metahubId) return
          const normalizedCodename = normalizeCodenameForStyle(patch.codename, codenameConfig.style, codenameConfig.alphabet)
          await updateHubMutation.mutateAsync({
            metahubId, hubId: id,
            data: { ...patch, codename: normalizedCodename, expectedVersion: currentHub.version }
          })
        },
      },
      helpers: {
        refreshList: async () => {
          if (metahubId) await invalidateHubsQueries.all(queryClient, metahubId)
        },
        enqueueSnackbar: (payload: { message: string; options?: { variant?: string } }) => {
          if (payload?.message) enqueueSnackbar(payload.message, payload.options)
        },
      },
    } satisfies Partial<ActionContext<HubDisplay, HubLocalizedPayload>> & Record<string, unknown>
  }, [currentHub, currentHubDisplay, t, hubMap, preferredVlcLocale, codenameConfig, metahubId, updateHubMutation, queryClient, enqueueSnackbar])

  const handleHubTabChange = (_: React.SyntheticEvent, newValue: string) => {
    if (newValue === 'settings') {
      setEditDialogOpen(true)
      return  // Don't change tab — dialog opens as overlay
    }
    // ... existing navigation logic for hubs/catalogs/sets/enumerations ...
  }
  ```

  7. Render `<EntityFormDialog>` at the end of the component JSX:

  ```tsx
  <Tabs value='hubs' onChange={handleHubTabChange} ...>
    <Tab value='hubs' label={t('hubs.title')} />
    <Tab value='catalogs' label={t('catalogs.title')} />
    <Tab value='sets' label={t('sets.title')} />
    <Tab value='enumerations' label={t('enumerations.title')} />
    <Tab value='settings' label={t('settings.title')} />  {/* NEW */}
  </Tabs>

  {settingsDialogCtx && currentHub && (
    <EntityFormDialog
      open={editDialogOpen}
      mode="edit"
      title={t('hubs.editTitle', 'Edit Hub')}
      nameLabel={t('common:fields.name')}
      descriptionLabel={t('common:fields.description')}
      saveButtonText={t('common:actions.save')}
      savingButtonText={t('common:actions.saving')}
      cancelButtonText={t('common:actions.cancel')}
      hideDefaultFields
      initialExtraValues={buildInitialValues(settingsDialogCtx)}
      tabs={buildFormTabs(settingsDialogCtx, allHubs, { editingEntityId: currentHub.id, allowHubNesting, mode: 'edit' })}
      validate={(values) => validateHubForm(settingsDialogCtx, values)}
      canSave={canSaveHubForm}
      onSave={async (data) => {
        const payload = toPayload(data)
        await settingsDialogCtx.api!.updateEntity!(currentHub.id, payload)
        await settingsDialogCtx.helpers!.refreshList!()
        // Dialog auto-closes via onClose after successful save (autoCloseOnSuccess=true by default)
      }}
      onClose={() => setEditDialogOpen(false)}
    />
  )}
  ```

  > **Note**: `buildInitialValues`, `buildFormTabs`, `validateHubForm`, `canSaveHubForm`, `toPayload` must be exported from `HubActions.tsx` if they are not already — see Step 4.6.

- [ ] **Step 4.2** — Add "Settings" tab + edit dialog overlay in `AttributeList.tsx`

  **File**: `packages/metahubs-frontend/base/src/domains/attributes/ui/AttributeList.tsx`

  Current tabs (line ~1233): `Attributes`, `Elements`

  **Available in scope** (already present in AttributeList.tsx):
  - `catalogForHubResolution` — the parent catalog entity from `useQuery` with `metahubsQueryKeys.catalogDetail`
  - `metahubId`, `catalogId` — route params
  - `t` — from `useTranslation`
  - `queryClient` — from `useQueryClient()`
  - `enqueueSnackbar` — from `useSnackbar()`
  - `confirm` — from `useConfirm()`
  - `codenameConfig` — from `useCodenameConfig()`

  **NOT in scope — must add**:
  - `hubs: Hub[]` — required by `CatalogActions.buildFormTabs(ctx, hubs, editingEntityId)`. Fetch via `useQuery` with `metahubsQueryKeys.hubsList(metahubId, { limit: 100 })` — same pattern as `CatalogList.tsx` line 313.
  - `preferredVlcLocale` — add `useMetahubPrimaryLocale()` hook call.
  - Update mutation — `useUpdateCatalog()` or `useUpdateCatalogAtMetahub()` depending on route context.

  **Changes**:
  1. Import `buildInitialValues`, `buildFormTabs`, `validateCatalogForm`, `canSaveCatalogForm`, `toPayload` from `../catalogs/ui/CatalogActions`.
  2. Add `const preferredVlcLocale = useMetahubPrimaryLocale()`.
  3. Add hubs query: `const { data: hubsData } = useQuery({ queryKey: metahubsQueryKeys.hubsList(metahubId, { limit: 100 }), ... })`.
  4. Add state: `const [editDialogOpen, setEditDialogOpen] = useState(false)`.
  5. Build `CatalogDisplayWithHub` from `catalogForHubResolution` — the type expected by `CatalogActions.tsx`.
  6. Construct ActionContext:

  ```tsx
  const settingsDialogCtx = useMemo(() => {
    if (!catalogForHubResolution) return null
    const catalogDisplay: CatalogDisplayWithHub = {
      id: catalogForHubResolution.id,
      codename: catalogForHubResolution.codename,
      name: getVLCString(catalogForHubResolution.name, preferredVlcLocale) || catalogForHubResolution.codename,
      description: getVLCString(catalogForHubResolution.description, preferredVlcLocale) || '',
      hubId: effectiveHubId || null,
      hubName: '', // will be resolved by form tab rendering
      // ... other display fields
    }
    return {
      entity: catalogDisplay,
      entityKind: 'catalog',
      t,
      uiLocale: preferredVlcLocale,
      _codenameConfig: codenameConfig,
      // raw entity for buildInitialValues to extract VLC fields:
      _rawCatalog: catalogForHubResolution,
      api: {
        updateEntity: async (id: string, patch: CatalogLocalizedPayload) => {
          // use updateCatalogMutation analogous to CatalogList's createCatalogContext
          await updateCatalogMutation.mutateAsync({ metahubId: metahubId!, catalogId: id, data: patch })
        },
      },
      helpers: {
        refreshList: async () => {
          await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(metahubId!, catalogId!) })
          await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(metahubId!) })
        },
        enqueueSnackbar: (payload: { message: string; options?: { variant?: string } }) => {
          if (payload?.message) enqueueSnackbar(payload.message, payload.options)
        },
      },
    }
  }, [catalogForHubResolution, preferredVlcLocale, t, codenameConfig, metahubId, catalogId, effectiveHubId, updateCatalogMutation, queryClient, enqueueSnackbar])
  ```

  7. Add 3rd tab "Settings":

  ```tsx
  <Tabs value='attributes' onChange={handleCatalogTabChange} ...>
    <Tab value='attributes' label={t('attributes.title')} />
    <Tab value='elements' label={t('elements.title')} />
    <Tab value='settings' label={t('settings.title')} />  {/* NEW */}
  </Tabs>
  ```

  8. In `handleCatalogTabChange`: when `newValue === 'settings'`, call `setEditDialogOpen(true)` and return.
  9. Render `<EntityFormDialog>` with `buildFormTabs(settingsDialogCtx, hubs, catalogId)` tabs.

- [ ] **Step 4.3** — Add NEW tab structure + "Settings" tab + edit dialog overlay in `ConstantList.tsx`

  **File**: `packages/metahubs-frontend/base/src/domains/constants/ui/ConstantList.tsx`

  **This page currently has NO `<Tabs>` component.** Must add one from scratch.

  **Available in scope**:
  - `setForHubResolution` — the parent set entity from `useQuery` with `metahubsQueryKeys.setDetail`
  - `metahubId`, `setId` — route params
  - `effectiveHubId` — resolved from URL or set's hubs
  - `t`, `queryClient`, `enqueueSnackbar`, `codenameConfig` — standard hooks

  **NOT in scope — must add**:
  - `hubs: Hub[]` — required by `SetActions.buildFormTabs(ctx, hubs, editingEntityId)`. Fetch via `useQuery`.
  - `preferredVlcLocale` — add hook.
  - Update mutation for the parent set.

  **Changes**:
  1. Import `Tabs`, `Tab` from `@mui/material`.
  2. Import `buildInitialValues`, `buildFormTabs`, `validateSetForm`, `canSaveSetForm`, `toPayload` from `../sets/ui/SetActions`.
  3. Add hubs query, `preferredVlcLocale`, update mutation.
  4. Add state: `const [editDialogOpen, setEditDialogOpen] = useState(false)`.
  5. Construct ActionContext from `setForHubResolution`:

  ```tsx
  const settingsDialogCtx = useMemo(() => {
    if (!setForHubResolution) return null
    const setDisplay: SetDisplayWithHub = {
      id: setForHubResolution.id,
      codename: setForHubResolution.codename,
      name: getVLCString(setForHubResolution.name, preferredVlcLocale) || setForHubResolution.codename,
      description: getVLCString(setForHubResolution.description, preferredVlcLocale) || '',
      hubId: effectiveHubId || null,
      hubName: '',
    }
    return {
      entity: setDisplay,
      entityKind: 'set',
      t,
      uiLocale: preferredVlcLocale,
      _codenameConfig: codenameConfig,
      _rawSet: setForHubResolution,
      api: {
        updateEntity: async (id: string, patch: SetLocalizedPayload) => {
          await updateSetMutation.mutateAsync({ metahubId: metahubId!, setId: id, data: patch })
        },
      },
      helpers: {
        refreshList: async () => {
          await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.setDetail(metahubId!, setId!) })
        },
        enqueueSnackbar: (payload: { message: string; options?: { variant?: string } }) => {
          if (payload?.message) enqueueSnackbar(payload.message, payload.options)
        },
      },
    }
  }, [setForHubResolution, preferredVlcLocale, t, codenameConfig, metahubId, setId, effectiveHubId, updateSetMutation, queryClient, enqueueSnackbar])
  ```

  6. Add tabs before the constants list content:

  ```tsx
  <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
    <Tabs value='constants' onChange={handleSetTabChange} textColor='primary' indicatorColor='primary'
      sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none' } }}>
      <Tab value='constants' label={t('constants.title')} />
      <Tab value='settings' label={t('settings.title')} />
    </Tabs>
  </Box>
  ```

  7. Handler:

  ```typescript
  const handleSetTabChange = (_: React.SyntheticEvent, newValue: string) => {
    if (newValue === 'settings') {
      setEditDialogOpen(true)
    }
  }
  ```

  8. Render `<EntityFormDialog>` with `buildFormTabs(settingsDialogCtx, hubs, setId)` tabs.

- [ ] **Step 4.4** — Add NEW tab structure + "Settings" tab + edit dialog overlay in `EnumerationValueList.tsx`

  **File**: `packages/metahubs-frontend/base/src/domains/enumerations/ui/EnumerationValueList.tsx`

  **This page currently has NO `<Tabs>` component.** Must add one from scratch.

  **Available in scope**:
  - Enumeration entity from `useQuery` at line ~272 — fetches enumeration values, but we need the **parent enumeration** entity itself. Check if `enumerationDetail` query exists. If not, add a query for it.
  - `metahubId`, `enumerationId` — route params
  - `t`, `enqueueSnackbar` — standard hooks

  **NOT in scope — must add**:
  - Parent enumeration entity query (if not present)
  - `hubs: Hub[]` — required by `EnumerationActions.buildFormTabs(ctx, hubs, editingEntityId)`
  - `preferredVlcLocale`, `codenameConfig`, `queryClient`, update mutation for the enumeration

  **Changes**:
  1. Import `Tabs`, `Tab`, `Box` from `@mui/material`.
  2. Import `buildInitialValues`, `buildFormTabs`, `validateEnumerationForm`, `canSaveEnumerationForm`, `toPayload` from `./EnumerationActions`.
  3. Add parent enumeration detail query, hubs query, `preferredVlcLocale`, update mutation.
  4. Add state: `const [editDialogOpen, setEditDialogOpen] = useState(false)`.
  5. Construct ActionContext (same pattern as Step 4.3 but for enumerations).
  6. Add tabs:

  ```tsx
  <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
    <Tabs value='values' onChange={handleEnumTabChange} ...>
      <Tab value='values' label={t('enumerationValues.title')} />
      <Tab value='settings' label={t('settings.title')} />
    </Tabs>
  </Box>
  ```

  7. Handler: `settings` → `setEditDialogOpen(true)`.
  8. Render `<EntityFormDialog>` with `buildFormTabs(settingsDialogCtx, hubs, enumerationId)` tabs.

- [ ] **Step 4.5** — Add "Settings" tab + edit dialog overlay in `PublicationVersionList.tsx`

  **File**: `packages/metahubs-frontend/base/src/domains/publications/ui/PublicationVersionList.tsx`

  Current tabs (line ~400): `Versions`, `Applications`

  **Available in scope**:
  - Publication entity is NOT directly queried on this page — it only queries `usePublicationVersions()` and `branchesResponse`. Must add a query for the parent publication.
  - `metahubId`, `publicationId` — route params
  - `t`, various mutations

  **NOT in scope — must add**:
  - Parent publication entity query — re-import `usePublicationDetails` from `../hooks` (hook exists but was removed from this file in a prior cleanup task; needs to be re-added)
  - `preferredVlcLocale`, `codenameConfig`, `queryClient`, `enqueueSnackbar`
  - Note: `PublicationActions.buildFormTabs(ctx, metahubId)` — different signature, takes just `metahubId` (no hubs array needed)

  **Changes**:
  1. Import `buildInitialValues`, `buildFormTabs`, `validatePublicationForm`, `canSavePublicationForm`, `toPayload` from `./PublicationActions`.
  2. Re-import `usePublicationDetails` from `../hooks` for parent publication entity query.
  3. Add `preferredVlcLocale`, `codenameConfig`, `queryClient`, `enqueueSnackbar` hooks.
  4. Add state: `const [editDialogOpen, setEditDialogOpen] = useState(false)`.
  5. Construct ActionContext:

  ```tsx
  const settingsDialogCtx = useMemo(() => {
    if (!publication) return null
    return {
      entity: publicationDisplay,
      entityKind: 'publication',
      t,
      uiLocale: preferredVlcLocale,
      _codenameConfig: codenameConfig,
      api: {
        updateEntity: async (id: string, patch: PublicationLocalizedPayload) => {
          await updatePublicationMutation.mutateAsync({ metahubId: metahubId!, publicationId: id, data: patch })
        },
      },
      helpers: {
        refreshList: async () => {
          await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.publicationDetail(metahubId!, publicationId!) })
        },
        enqueueSnackbar: (payload: { message: string; options?: { variant?: string } }) => {
          if (payload?.message) enqueueSnackbar(payload.message, payload.options)
        },
      },
    }
  }, [publication, publicationDisplay, preferredVlcLocale, t, codenameConfig, metahubId, publicationId, updatePublicationMutation, queryClient, enqueueSnackbar])
  ```

  6. Add 3rd tab:

  ```tsx
  <Tabs value='versions' onChange={handlePublicationTabChange} ...>
    <Tab value='versions' label={t('metahubs:publications.versions.title', 'Versions')} />
    <Tab value='applications' label={t('metahubs:publications.applications.title', 'Applications')} />
    <Tab value='settings' label={t('settings.title')} />  {/* NEW */}
  </Tabs>
  ```

  7. In `handlePublicationTabChange`: add `settings` case → `setEditDialogOpen(true)`.
  8. Render `<EntityFormDialog>` with `buildFormTabs(settingsDialogCtx, metahubId!)` tabs.

- [ ] **Step 4.6** — Export builder functions AND types from `*Actions.tsx` files

  Ensure the following functions and types are exported (add `export` keyword if they are currently file-private):

  | File | Functions to export | Types to export |
  |------|---------------------|-----------------|
  | `HubActions.tsx` | `buildInitialValues`, `buildFormTabs`, `validateHubForm`, `canSaveHubForm`, `toPayload` | `HubActionContext`, `HubFormValues`, `HubFormSetValue`, `HubDialogTabArgs` |
  | `CatalogActions.tsx` | `buildInitialValues`, `buildFormTabs`, `validateCatalogForm`, `canSaveCatalogForm`, `toPayload` | `CatalogActionContext`, `CatalogFormValues`, `CatalogFormSetValue` |
  | `SetActions.tsx` | `buildInitialValues`, `buildFormTabs`, `validateSetForm`, `canSaveSetForm`, `toPayload` | `SetActionContext`, `SetFormValues`, `SetFormSetValue` |
  | `EnumerationActions.tsx` | `buildInitialValues`, `buildFormTabs`, `validateEnumerationForm`, `canSaveEnumerationForm`, `toPayload` | `EnumerationActionContext`, `EnumerationFormValues`, `EnumerationFormSetValue` |
  | `PublicationActions.tsx` | `buildInitialValues`, `buildFormTabs`, `validatePublicationForm`, `canSavePublicationForm`, `toPayload` | _(no custom context type)_ |

  **How to export**: Change `const buildInitialValues = ...` → `export const buildInitialValues = ...` and `type HubActionContext = ...` → `export type HubActionContext = ...`.

  These are pure functions and type aliases — safe to export. The types are needed in the detail page files to type the ActionContext construction and avoid `any` casts.

### Phase 5: Mobile Responsiveness Fixes

- [ ] **Step 5.1** — Clean up `AppNavbar.tsx`

  **File**: `packages/universo-template-mui/base/src/components/dashboard/AppNavbar.tsx`

  - Remove hardcoded "Kiberplano" text
  - Remove `CustomIcon` component and its usage
  - Keep only: `ColorModeIconDropdown`, `LanguageSwitcher`, `MenuButton` (hamburger)
  - Leave the left side of the navbar clean (just a spacer `<Box sx={{ flexGrow: 1 }} />` or empty)

  ```tsx
  // Before:
  <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
    <CustomIcon />
    <Typography variant="h4" component="h1" sx={{ color: 'text.primary' }}>
      Kiberplano
    </Typography>
  </Stack>

  // After:
  <Box sx={{ flexGrow: 1 }} />
  ```

- [ ] **Step 5.2** — Make `ViewHeader.tsx` responsive with CollapsibleSearch

  **File**: `packages/universo-template-mui/base/src/components/headers/ViewHeader.tsx`

  Current layout: single row with title+back+edit on left, search+filters+children on right. Search is `display: { xs: 'none', sm: 'flex' }` — completely hidden on mobile.

  **ТЗ requirement**: On mobile, search becomes an icon button. When tapped, it expands to full action-bar width overlaying the filter/action buttons. Tap outside collapses it back.

  **Implementation**:
  1. Add `searchExpanded` state and a ref for click-outside detection
  2. On `xs` breakpoint, render search as `IconButton` with `<IconSearch />`
  3. When tapped, expand to full-width `OutlinedInput` with absolute positioning over action buttons
  4. On blur or click-outside, collapse back to icon

  ```tsx
  // New internal CollapsibleMobileSearch component in ViewHeader.tsx:
  const CollapsibleMobileSearch: React.FC<{
    searchInputRef: React.RefObject<HTMLInputElement | null>
    searchPlaceholder: string
    onSearchChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  }> = ({ searchInputRef, searchPlaceholder, onSearchChange }) => {
    const [expanded, setExpanded] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      if (!expanded) return
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setExpanded(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [expanded])

    if (!expanded) {
      return (
        <IconButton onClick={() => setExpanded(true)} size='small'>
          <IconSearch style={{ width: 20, height: 20 }} />
        </IconButton>
      )
    }

    return (
      <Box
        ref={containerRef}
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          bgcolor: 'background.paper',
        }}
      >
        <OutlinedInput
          inputRef={searchInputRef}
          autoFocus
          fullWidth
          size='small'
          placeholder={searchPlaceholder}
          onChange={onSearchChange}
          onBlur={() => {
            // Small delay to allow click-outside handler to fire first
            setTimeout(() => setExpanded(false), 150)
          }}
          startAdornment={
            <Box sx={{ color: 'grey.400', display: 'flex', mr: 1 }}>
              <IconSearch style={{ color: 'inherit', width: 16, height: 16 }} />
            </Box>
          }
          type='search'
        />
      </Box>
    )
  }
  ```

  In the main `ViewHeader` render:
  ```tsx
  <Box sx={{ height: 40, display: 'flex', alignItems: 'center', gap: 1, position: 'relative', ... }}>
    {search && (
      <>
        {/* Desktop: normal search field */}
        <OutlinedInput sx={{ display: { xs: 'none', sm: 'flex' }, ... }} ... />

        {/* Mobile: collapsible search icon → full-width overlay */}
        <Box sx={{ display: { xs: 'flex', sm: 'none' } }}>
          <CollapsibleMobileSearch
            searchInputRef={searchInputRef}
            searchPlaceholder={searchPlaceholder}
            onSearchChange={onSearchChange}
          />
        </Box>
      </>
    )}
    {filters}
    {children}
  </Box>
  ```

  The action buttons row needs `position: 'relative'` so the absolute overlay positions correctly within it.

- [ ] **Step 5.3** — Clean up `SideMenuMobile.tsx` and make Logout functional

  **File**: `packages/universo-template-mui/base/src/components/dashboard/SideMenuMobile.tsx`

  Changes:
  1. Comment out Avatar/Name/notification bell block (lines ~39-49)
  2. Comment out `CardAlert` import and usage (line ~53)
  3. Make Logout functional using `useAuth().logout()` with `useConfirm()` confirmation

  ```tsx
  import { useAuth } from '@universo/auth-frontend'
  import { useConfirm } from '../../hooks/useConfirm'
  import { useTranslation } from 'react-i18next'

  export default function SideMenuMobile({ open, toggleDrawer }: SideMenuMobileProps) {
    const { logout } = useAuth()
    const { t } = useTranslation()
    const { confirm } = useConfirm()

    const handleLogout = async () => {
      const confirmed = await confirm({
        title: t('common:logoutConfirmTitle'),
        description: t('common:logoutConfirmMessage'),
        confirmButtonName: t('common:logout'),
      })
      if (confirmed) {
        await logout()
      }
    }

    return (
      <Drawer anchor="right" open={open} onClose={toggleDrawer(false)} ...>
        <Stack sx={{ maxWidth: '70dvw', height: '100%' }}>
          {/* Avatar/Name/notification commented out */}
          <Divider />
          <Stack sx={{ flexGrow: 1 }}>
            <MenuContent />
            <Divider />
          </Stack>
          {/* CardAlert commented out */}
          <Stack sx={{ p: 2 }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<LogoutRoundedIcon />}
              onClick={handleLogout}
            >
              {t('common:logout')}
            </Button>
          </Stack>
        </Stack>
      </Drawer>
    )
  }
  ```

  > **IMPORTANT**: `ConfirmDialog` is NOT rendered inside this component. It does NOT accept props. Instead, a single `<ConfirmDialog />` is rendered at the `MainLayoutMUI` level (see Step 5.5). The `useConfirm()` hook communicates via `ConfirmContext`.

- [ ] **Step 5.4** — Comment out `CardAlert.tsx` internal content

  **File**: `packages/universo-template-mui/base/src/components/dashboard/CardAlert.tsx`

  Keep the component file but return `null`. This way existing imports don't break:

  ```tsx
  export default function CardAlert() {
    // TODO: Implement real alert content when subscription/plan feature is ready
    return null
  }
  ```

- [ ] **Step 5.5** — Add `<ConfirmDialog />` to `MainLayoutMUI.tsx`

  **File**: `packages/universo-template-mui/base/src/layout/MainLayoutMUI.tsx`

  `ConfirmContextProvider` is already rendered at line 33. But **no `<ConfirmDialog />` is rendered at this level** — it's only rendered per-page where needed. Since `SideMenu` and `SideMenuMobile` live inside `MainLayoutMUI`, their `useConfirm()` calls need a `ConfirmDialog` at this level.

  ```tsx
  import { ConfirmDialog } from '../components/dialogs/ConfirmDialog'

  // Inside the JSX, at the end of ConfirmContextProvider:
  <ConfirmContextProvider>
    <CssBaseline enableColorScheme />
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <SideMenu />
      <AppNavbar />
      <Box component='main' ...>
        <Stack ...>
          <Header />
          {children || <Outlet />}
        </Stack>
      </Box>
    </Box>
    <ConfirmDialog />   {/* NEW — for logout confirmation from SideMenu/SideMenuMobile */}
  </ConfirmContextProvider>
  ```

  > **Note**: This is safe because `ConfirmDialog` checks `confirmState.show` and returns `null` when no confirm is pending. Multiple `<ConfirmDialog />` renders (one at layout level + one per page) are fine — they all read from the same `ConfirmContext` and only the one detecting `show=true` will render.

### Phase 6: Desktop Logout

- [ ] **Step 6.1** — Add Logout item to `SideMenu.tsx`

  **File**: `packages/universo-template-mui/base/src/components/dashboard/SideMenu.tsx`

  The desktop SideMenu is a permanent left drawer. The bottom section (avatar/options) is already commented out. Add a Logout button at the bottom:

  ```tsx
  import { useAuth } from '@universo/auth-frontend'
  import { useConfirm } from '../../hooks/useConfirm'
  import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
  import { Button, Stack } from '@mui/material'
  import { useTranslation } from 'react-i18next'

  export default function SideMenu() {
    const { logout } = useAuth()
    const { t } = useTranslation()
    const { confirm } = useConfirm()

    const handleLogout = async () => {
      const confirmed = await confirm({
        title: t('common:logoutConfirmTitle'),
        description: t('common:logoutConfirmMessage'),
        confirmButtonName: t('common:logout'),
      })
      if (confirmed) {
        await logout()
      }
    }

    return (
      <Drawer variant='permanent' ...>
        <Divider />
        <Box sx={{ overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <MenuContent />
        </Box>
        {/* Logout button at the bottom of the drawer */}
        <Stack sx={{ p: 2 }}>
          <Button
            variant='outlined'
            fullWidth
            startIcon={<LogoutRoundedIcon />}
            onClick={handleLogout}
          >
            {t('common:logout')}
          </Button>
        </Stack>
      </Drawer>
    )
  }
  ```

  > **Note**: `ConfirmDialog` is rendered at `MainLayoutMUI` level (Step 5.5), so `useConfirm()` works here without adding another `<ConfirmDialog />`.

- [ ] **Step 6.2** — Add common i18n keys for logout confirmation

  The existing `"logout": "Logout"` key is a **flat key** at the root of `common.json` (EN line 63, RU line 63). We keep the same flat pattern for the new confirmation keys. Do NOT add a nested `auth` object.

  **Files**: `packages/universo-i18n/base/src/locales/en/core/common.json` and `ru/core/common.json`

  Add these **flat keys** adjacent to the existing `"logout"` key:

  EN (near line 63):
  ```json
  "logout": "Logout",
  "logoutConfirmTitle": "Log out?",
  "logoutConfirmMessage": "Are you sure you want to log out?",
  ```

  RU (near line 63):
  ```json
  "logout": "Выйти",
  "logoutConfirmTitle": "Выйти из системы?",
  "logoutConfirmMessage": "Вы уверены, что хотите выйти?",
  ```

  **Usage in code** (Steps 5.5, 6.1): `t('common:logoutConfirmTitle')`, `t('common:logoutConfirmMessage')`, `t('common:logout')`.

### Phase 7: i18n Keys for Frontend Changes

- [ ] **Step 7.1** — Add create options i18n keys (EN + RU)

  **Files**: `packages/metahubs-frontend/base/src/i18n/locales/{en,ru}/metahubs.json`

  EN:
  ```json
  "createOptions": {
    "tab": "Options",
    "alwaysCreated": "Always created",
    "branch": "Branch (Main)",
    "layout": "Layout (Main)",
    "optionalEntities": "Default entities",
    "hub": "Hub",
    "catalog": "Catalog",
    "set": "Set",
    "enumeration": "Enumeration"
  }
  ```

  RU:
  ```json
  "createOptions": {
    "tab": "Параметры",
    "alwaysCreated": "Создаются всегда",
    "branch": "Ветка (Основная)",
    "layout": "Макет (Основной)",
    "optionalEntities": "Стандартные сущности",
    "hub": "Хаб",
    "catalog": "Каталог",
    "set": "Набор",
    "enumeration": "Перечисление"
  }
  ```

- [ ] **Step 7.2** — Ensure settings tab label is i18n'd across all entity pages

  Verify that `t('settings.title')` (which is already "Settings" / "Настройки") is used consistently across all 5 entity detail pages from Phase 4.

### Phase 8: Documentation Updates

- [ ] **Step 8.1** — Update `packages/metahubs-backend/base/MIGRATIONS.md`

  Add section about the template split and `createOptions` feature:

  ```markdown
  ## Template Registry

  Two built-in templates are shipped:
  - **basic** — Minimal template with essential widgets (menu, header, details title, columns container). Default entities created based on `createOptions`.
  - **basic-demo** — Full demo template with ALL widgets active and sample entities (hub, catalog, set, enumeration with attributes and data).

  ## Entity Creation Options

  When creating a metahub via `POST /metahubs`, an optional `createOptions` object controls which default entities are seeded:
  - `createHub` (default: true) — Create default hub entity
  - `createCatalog` (default: true) — Create default catalog entity
  - `createSet` (default: true) — Create default set entity
  - `createEnumeration` (default: true) — Create default enumeration entity

  Branch and Layout are always created regardless of options.
  ```

- [ ] **Step 8.2** — Update `packages/metahubs-backend/base/MIGRATIONS-RU.md` (same content in Russian)

- [ ] **Step 8.3** — Update `packages/metahubs-frontend/base/MIGRATIONS.md` and `MIGRATIONS-RU.md`

  Document the new "Options" tab in create dialog and the "Settings" tab (edit dialog overlay) in entity detail views.

- [ ] **Step 8.4** — Update `AGENTS.md`

  Add mention of the template split and `createOptions` API in the relevant section.

### Phase 9: Verification & Build

- [ ] **Step 9.1** — Lint touched packages

  ```bash
  pnpm --filter @universo/types lint
  pnpm --filter @universo/metahubs-backend lint
  pnpm --filter @universo/metahubs-frontend lint
  pnpm --filter @universo/template-mui lint
  ```

- [ ] **Step 9.2** — Build touched packages individually

  ```bash
  pnpm --filter @universo/types build
  pnpm --filter @universo/i18n build
  pnpm --filter @universo/metahubs-backend build
  pnpm --filter @universo/metahubs-frontend build
  pnpm --filter @universo/template-mui build
  ```

- [ ] **Step 9.3** — Full project build

  ```bash
  pnpm build
  ```

- [ ] **Step 9.4** — Run existing tests

  ```bash
  pnpm --filter @universo/metahubs-backend test
  pnpm --filter @universo/metahubs-frontend test
  ```

---

## Potential Challenges

### 1. Seed Entity `hubs` Field Is Dead Metadata
The `TemplateSeedEntity.hubs` field exists in the type definition but is **NOT processed** by `TemplateSeedExecutor.createEntities()`. Hub-entity associations are managed at runtime by users, not seeded. Therefore, `hubs` references in seed entity definitions are ignored. This also means the cross-entity dependency concern (filtering out a hub used by a catalog) is moot — no hub links are created from seed data. The seed entity definitions in Step 2.7 do not include `hubs` references to avoid confusion.

### 2. Widget Config Deep Cloning
The `enrichConfigWithVlcTimestamps` function uses `JSON.parse(JSON.stringify(...))` with a reviver. The new basic template's minimal widget list must still go through this for VLC consistency in menuWidget config.

### 3. Edit Dialog Data Availability in Detail Pages
For the "Settings" tab to open an edit dialog, the detail page must have access to the **parent entity** data (e.g., `ConstantList` needs the parent Set entity). Most detail pages already fetch this via existing queries (e.g., `getSetById`). Verify that all 5 pages have the parent entity available. If not, an additional query may be needed.

### 4. Exporting Functions from *Actions.tsx
Making `buildInitialValues`, `buildFormTabs`, `toPayload`, and validation functions exportable requires checking they don't depend on implicit closure variables. These are typically pure functions that take a `ctx` parameter — should be straightforward to export.

### 5. CollapsibleSearch Position Context
The absolute-positioned expanded search on mobile needs the parent container to have `position: relative`. Verify the action bar container already has this or add it. The `OutlinedInput` autoFocus should grab keyboard focus immediately on expansion.

### 6. Auth Context Availability in Template-MUI
`SideMenu.tsx` and `SideMenuMobile.tsx` are in `@universo/template-mui`, which already has `@universo/auth-frontend` as a dependency (used in `AppAppBar.tsx`, `AuthGuard.tsx`, `ResourceGuard.tsx`, `AdminGuard.tsx`). The `useAuth()` hook is confirmed available.

### 7. Multiple ConfirmDialog Instances
With `<ConfirmDialog />` added at `MainLayoutMUI` level (Step 5.5), and also rendered per-page (e.g., `HubList.tsx`, `SettingsPage.tsx`), there may be two active ConfirmDialog components reading the same context. This is safe because only one shows when `confirmState.show === true`, and the z-index (`modal + 20`) ensures proper stacking.

---

## Dependencies

- `@universo/types` must build first (Phase 1) before backend/frontend phases
- Backend template changes (Phase 2) are independent of frontend tabs/dialogs (Phases 3-4)
- Mobile/Logout changes (Phases 5-6) are fully independent and can be parallelized
- i18n keys (Phase 7) should be added before or alongside frontend component changes
- Documentation (Phase 8) can be done last after code is stable
- Build verification (Phase 9) must be the final step

---

## Implementation Order (recommended)

1. **Phase 1** — Types (foundation for everything)
2. **Phase 7** — i18n keys (needed by frontend phases)
3. **Phase 2** — Backend template split + API (can start in parallel with Phase 7)
4. **Phase 3** — Frontend create dialog Options tab
5. **Phase 4** — Settings tab as edit dialog in entity detail views
   - Step 4.6 (export functions) first, then Steps 4.1–4.5
6. **Phase 5 + 6** — Mobile fixes + Logout (independent, can be parallelized with Phase 4)
7. **Phase 8** — Documentation
8. **Phase 9** — Verification & build

---

## QA Corrections Applied

This plan revision addresses all issues from QA reports #1, #2, and #3:

### QA #1 Corrections (10 issues)

| # | Issue | Fix Applied |
|---|-------|-------------|
| C1 | Phase 4 used navigation instead of dialog overlay | ✅ Phase 4 rewritten: Settings tab opens `EntityFormDialog` as overlay via React state |
| C2 | Wrong target files for 3/5 entity detail pages | ✅ Corrected: AttributeList, ConstantList, EnumerationValueList (not CatalogList, SetList, EnumerationList) |
| H1 | ConfirmDialog API used incorrectly (spread props) | ✅ Fixed: `ConfirmDialog` rendered prop-less, `useConfirm()` via context only |
| H2 | Entity names used "Главный" instead of "Основной" | ✅ Fixed: Gender-correct names per ТЗ ("Основной"/"Основное") |
| H3 | Missing tab container for ConstantList/EnumerationValueList | ✅ Steps 4.3/4.4 explicitly create new `<Tabs>` from scratch |
| H4 | Key Files section listed wrong files | ✅ Key Files section updated with correct files |
| M1 | CollapsibleSearch underspecified | ✅ Step 5.2: detailed `CollapsibleMobileSearch` component with click-outside, autoFocus, absolute overlay |
| M2 | Step 4.6 (SettingsPage ?tab=) unnecessary | ✅ Removed — Phase 4 no longer navigates to SettingsPage |
| M3 | `requiredEntityKinds` premature | ✅ Deferred — removed from Phase 1, noted as future option |
| M4 | `<ConfirmDialog />` missing in MainLayoutMUI | ✅ Added Step 5.5: `<ConfirmDialog />` rendered inside `ConfirmContextProvider` in MainLayoutMUI |

### QA #2 Corrections (6 issues)

| # | Issue | Fix Applied |
|---|-------|-------------|
| C1 | Phase 3 targeted wrong function (buildEditTabs vs local buildFormTabs) | ✅ Phase 3 rewritten to modify MetahubList.tsx's local `buildFormTabs` |
| H1 | Switch vs Checkbox inconsistency | ✅ Changed to Checkbox to match codebase pattern |
| H2 | ActionContext construction not detailed | ✅ Full ActionContext examples added to Phase 4 |
| H3 | GeneralTabFields vs MetahubEditFields not noted | ✅ Explicitly preserved GeneralTabFields with showTemplateSelector |
| M1 | `settings.title` i18n key undefined | ✅ Verified: key exists in both EN and RU metahubs.json |
| M2 | Type exports missing from Step 4.6 | ✅ Types added to export table |

### QA #3 Corrections (1 HIGH + 3 MEDIUM + 3 LOW)

| # | Issue | Fix Applied |
|---|-------|-------------|
| H1 | EntityFormDialog uses `onCancel` prop (doesn't exist) | ✅ Changed to `onClose` in Step 4.1 code and pattern for Steps 4.2–4.5 |
| M1 | Double-close in onSave + autoCloseOnSuccess | ✅ Removed manual `setEditDialogOpen(false)` from onSave, relying on autoCloseOnSuccess |
| M2 | `entity.hubs` in seed is dead metadata | ✅ Removed hubs from seed entities in Step 2.7, updated Potential Challenges #1 |
| M3 | `usePublicationDetails` re-import not noted | ✅ Added explicit note in Step 4.5 about re-importing the hook |
| L2 | @universo/i18n missing from build verification | ✅ Added to Step 9.2 |
