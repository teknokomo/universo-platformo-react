# Metahub Entity Copy Plan (Hubs, Catalogs, Enumerations, Layouts)

Date: 2026-02-26  
Mode: PLAN (no implementation)  
Complexity: Level 3 (Significant)

## 1. Overview

Implement copy flows for four metahub entity domains with UX and behavior aligned to existing copy features (metahubs, applications, branches):

1. Hub copy with relation selection options.
2. Catalog copy with attributes/elements options.
3. Enumeration copy with values option.
4. Layout copy with widgets option.

Primary goals:
- Reuse existing UI/CRUD patterns (no unnecessary new framework abstractions).
- Keep copy operations transaction-safe and deterministic.
- Avoid dangling references and invalid state combinations.
- Keep all copy dialogs i18n-ready from day one.
- Preserve existing copy UX contract: copied names get localized `(copy)/(копия)` suffix and codename gets a conflict-safe copy variant.

## 2. Confirmed Baseline (Code + Data)

### 2.1 Frontend baseline

- `HubActions.tsx`, `CatalogActions.tsx`, `EnumerationActions.tsx` currently expose only `edit` and `delete` actions.
- Hub/Catalog/Enumeration lists use `BaseEntityMenu` and action descriptors.
- `LayoutList.tsx` uses a custom MUI `Menu` (not `BaseEntityMenu`) and currently has no copy action.
- Existing copy UX patterns are already implemented in:
  - metahubs copy (`MetahubActions.tsx`),
  - applications copy (`ApplicationActions.tsx`),
  - branches copy with parent/child options (`BranchActions.tsx` + shared branch copy helpers).

### 2.2 Backend baseline

- No copy endpoints currently exist in:
  - `hubsRoutes.ts`,
  - `catalogsRoutes.ts`,
  - `enumerationsRoutes.ts`,
  - `layoutsRoutes.ts`.
- Branch schema stores design-time entities in:
  - `_mhb_objects` (kinds: `hub`, `catalog`, `enumeration`),
  - `_mhb_attributes`, `_mhb_elements`, `_mhb_values`,
  - `_mhb_layouts`, `_mhb_widgets`, `_mhb_migrations`, `_mhb_settings`.
- Catalog/enumeration hub links are stored in `_mhb_objects.config.hubs`.

### 2.3 Context7 checks (up-to-date docs)

- TanStack Query v5: recommended invalidation from mutation `onSuccess`, including async invalidation and `Promise.all` for related keys.
- Zod: recommended dependent-field validation through `superRefine` with explicit issue `path`.

### 2.4 Supabase `UP-test` checks

- Project confirmed: `UP-test` (`osnvhnawsmyfduygsajj`).
- Metahub branch schemas contain the expected `_mhb_*` system tables required for selective copy logic.
- IDs for `_mhb_objects`, `_mhb_attributes`, `_mhb_elements`, `_mhb_values`, `_mhb_layouts`, `_mhb_widgets` are DB-generated with `uuid_generate_v7()`.
- FK cascade model confirms safe graph cloning/deletion boundaries:
  - `_mhb_attributes.object_id -> _mhb_objects.id (CASCADE)`,
  - `_mhb_attributes.parent_attribute_id -> _mhb_attributes.id (CASCADE)`,
  - `_mhb_elements.object_id -> _mhb_objects.id (CASCADE)`,
  - `_mhb_widgets.layout_id -> _mhb_layouts.id (CASCADE)`.

## 3. Architecture Decisions

### 3.1 Reuse-first strategy

Do not introduce new generic UI framework layers for this feature.

- Hubs/Catalogs/Enumerations:
  - extend existing action descriptors (`id: 'copy'`) used by `BaseEntityMenu`.
- Layouts:
  - extend existing `LayoutList` custom menu and dialog flow.

### 3.2 Shared copy option contracts

Extend shared contracts in existing common layers (instead of ad-hoc per-domain state only):

- `@universo/types` (`common/copyOptions.ts`):
  - add `HubCopyOptions`, `CatalogCopyOptions`, `EnumerationCopyOptions`, `LayoutCopyOptions`.
- `@universo/utils` (`validation/copyOptions.ts`):
  - add `normalizeHubCopyOptions`, `normalizeCatalogCopyOptions`, `normalizeEnumerationCopyOptions`, `normalizeLayoutCopyOptions`.

### 3.3 Safety-first backend behavior

- All copy operations run in DB transactions.
- All IDs remain DB-generated (UUID v7 default in DB); no manual non-v7 ID generation in routes.
- All codename uniqueness handled race-safe (check + unique-violation fallback).
- All option dependencies enforced both in UI and backend validation.

### 3.4 Canonical route strategy (anti-duplication)

Current catalogs/enumerations routes already include both metahub-level and hub-scoped endpoints.  
For copy endpoints:
- implement one canonical copy handler per entity kind,
- bind aliases only if needed for backward compatibility,
- keep copy logic in service/helper layer (no duplicated per-route business logic blocks).

## 4. Functional Scope and Option Rules

## 4.1 Hub Copy

Dialog: `Copying Hub` + tabs `General` and `Options`.

Options:
- `copyAllRelations` (default: `true`) — parent option.
- `copyCatalogRelations` (default: `true`).
- `copyEnumerationRelations` (default: `true`).

Normalization rules (same semantics as branch full copy):
- `copyAllRelations=true` => all child options become `true`.
- Explicit parent-off with no child overrides => all child options become `false`.
- If any child is `false`, `copyAllRelations` becomes `false`.

Copy semantics:
- Hub entity itself is always copied.
- Optional relation copy updates `config.hubs` links of catalog/enumeration objects that reference source hub.
- If relation expansion violates single-hub constraints (`isSingleHub=true` target object), copy fails fast with explicit 400 error code (no partial mutation).

## 4.2 Catalog Copy

Dialog: `Copying Catalog` + tabs `General` and `Options`.

Options:
- `copyAttributes` (default: `true`).
- `copyElements` (default: `true`).

Safety dependency:
- `copyElements` requires `copyAttributes=true`.
- UI: disable `copyElements` when `copyAttributes=false`.
- Backend: enforce by schema (`superRefine`).

## 4.3 Enumeration Copy

Dialog: `Copying Enumeration` + tabs `General` and `Options`.

Options:
- `copyValues` (default: `true`).

## 4.4 Layout Copy

Dialog: `Copying Layout` + tabs `General` and `Options`.

Options:
- `copyWidgets` (default: `true`).

Proposed behavior when `copyWidgets=false`:
- Create layout from source metadata, keep `isDefault=false`.
- Keep standard default widget initialization for new layouts (existing service behavior).

## 4.5 Shared copy UX contract (all 4 entities)

- Menu placement: `Copy` action is located directly below `Edit`:
  - Hubs/Catalogs/Enumerations via `BaseEntityMenu` order,
  - Layouts via manual `MenuItem` placement in `LayoutList`.
- Dialog structure: `General` + `Options` tabs using existing `EntityFormDialog`.
- Initial copy values:
  - for every existing localized name value add locale-aware suffix (`ru -> (копия)`, other locales -> `(copy)`),
  - if no localized name content exists, create fallback localized copy name for current UI locale,
  - codename initialized to copy candidate and resolved conflict-safe on backend.

## 5. Detailed Plan Steps

## Phase A — Shared contracts and normalization

- [ ] A1. Extend `packages/universo-types/base/src/common/copyOptions.ts` with new option interfaces and defaults:
  - `DEFAULT_HUB_COPY_OPTIONS`
  - `DEFAULT_CATALOG_COPY_OPTIONS`
  - `DEFAULT_ENUMERATION_COPY_OPTIONS`
  - `DEFAULT_LAYOUT_COPY_OPTIONS`
- [ ] A2. Add corresponding normalization helpers in `packages/universo-utils/base/src/validation/copyOptions.ts`.
- [ ] A3. Export new helpers from `validation/index.ts` and package root exports where needed.

## Phase B — Backend copy endpoints and service logic

- [ ] B1. Add hub copy route in `hubsRoutes.ts`:
  - `POST /metahub/:metahubId/hub/:hubId/copy`
  - zod schema + normalized options.
- [ ] B2. Add catalog copy route in `catalogsRoutes.ts`:
  - canonical endpoint: `POST /metahub/:metahubId/catalog/:catalogId/copy`
  - option schema with dependency check.
- [ ] B3. Add enumeration copy route in `enumerationsRoutes.ts`:
  - canonical endpoint: `POST /metahub/:metahubId/enumeration/:enumerationId/copy`.
- [ ] B4. Add layout copy route in `layoutsRoutes.ts`:
  - `POST /metahub/:metahubId/layout/:layoutId/copy`.
- [ ] B5. Add internal helper functions for copy name/codename candidate generation and deterministic conflict handling.
- [ ] B6. Ensure route responses follow existing entity response shape (id, codename/name, version, timestamps) to keep frontend adapters simple.
- [ ] B7. Keep one canonical handler per copy endpoint and avoid duplicating copy business logic across hub-scoped vs metahub-scoped route variants.

## Phase C — Backend copy algorithms

- [ ] C1. Hub copy algorithm:
  - clone source hub metadata into a new hub object.
  - apply relation-copy options by updating `config.hubs` in relevant object kinds.
  - reject invalid relation expansion when target object is in strict single-hub mode (explicit 400 code).
- [ ] C2. Catalog copy algorithm:
  - clone catalog object metadata/config and hub links.
  - clone attributes when enabled:
    - preserve sort order and configs,
    - preserve parent-child TABLE attribute hierarchy via old->new attribute ID map,
    - remap self-references (`target_object_id == sourceCatalogId`) to new catalog ID.
  - clone elements when enabled (after attributes).
- [ ] C3. Enumeration copy algorithm:
  - clone enumeration object metadata/config and hub links.
  - clone `_mhb_values` rows when enabled, preserving order and default flag semantics.
- [ ] C4. Layout copy algorithm:
  - create new layout metadata (`isDefault=false`), copy localized fields.
  - if `copyWidgets=true`, replace defaults with source widgets preserving zone/order/config/active state.

## Phase D — Frontend API and mutations

- [ ] D1. Add API wrappers:
  - `hubs/api/hubs.ts` -> `copyHub`
  - `catalogs/api/catalogs.ts` -> `copyCatalog`
  - `enumerations/api/enumerations.ts` -> `copyEnumeration`
  - `layouts/api/layouts.ts` -> `copyLayout`
- [ ] D2. Add copy mutations in hooks:
  - `useCopyHub`, `useCopyCatalog`, `useCopyEnumeration`, `useCopyLayout`.
- [ ] D3. Invalidation strategy:
  - invalidate list and detail groups using query key factories (`metahubsQueryKeys.*`) and async invalidation for multi-key updates.

## Phase E — Frontend dialogs and menus

- [ ] E1. Hub actions:
  - add `copy` descriptor below `edit` in action order.
  - dialog tabs: `General` + `Options`.
- [ ] E2. Catalog actions:
  - add `copy` descriptor below `edit`.
  - options tab with `copyAttributes` + `copyElements`.
- [ ] E3. Enumeration actions:
  - add `copy` descriptor below `edit`.
  - options tab with `copyValues`.
- [ ] E4. Layout list menu:
  - add `Copy` menu item below `Edit` in custom MUI menu.
  - add copy dialog with tabs and options.
- [ ] E5. Preserve consistent spacing/layout in copy dialogs by matching existing edit-dialog field stack patterns.
- [ ] E6. Reuse existing copy initialization pattern from metahub/application/branch actions for localized name suffixes and codename autofill, without introducing new standalone UI components.

## Phase F — i18n

- [ ] F1. Add RU/EN keys in `metahubs.json` for:
  - new `copyTitle`, `copy.action`, `copy.actionLoading` where missing,
  - `copy.generalTab`, `copy.optionsTab`,
  - per-entity option labels and helper hints,
  - dependency/validation messages.
- [ ] F2. Keep key naming consistent with existing namespaces (`hubs.copy.*`, `catalogs.copy.*`, `enumerations.copy.*`, `layouts.copy.*`).

## Phase G — Tests and quality gate

- [ ] G1. Frontend tests:
  - extend action factory coverage to assert copy descriptor presence for hub/catalog/enumeration.
  - add option normalization + payload forwarding tests (pattern from branch copy tests).
  - add layout menu copy action/dialog test.
- [ ] G2. Backend route tests:
  - add copy route tests for all 4 entities (happy path + invalid options + unique conflicts).
- [ ] G3. Backend service tests:
  - catalog attribute remap (parent + self-ref),
  - hub relation copy constraints.
- [ ] G4. Run targeted lint/tests:
  - `pnpm --filter @universo/metahubs-frontend lint`
  - `pnpm --filter @universo/metahubs-backend lint`
  - targeted test commands for changed packages.

## 6. Safe Code Patterns (Reference)

### 6.1 Option normalization with parent/child semantics

```ts
export const normalizeHubCopyOptions = (input?: Partial<HubCopyOptions> | null): HubCopyOptions => {
  const merged: HubCopyOptions = {
    copyAllRelations: input?.copyAllRelations ?? true,
    copyCatalogRelations: input?.copyCatalogRelations ?? true,
    copyEnumerationRelations: input?.copyEnumerationRelations ?? true,
  }

  if (merged.copyAllRelations) {
    return {
      copyAllRelations: true,
      copyCatalogRelations: true,
      copyEnumerationRelations: true,
    }
  }

  const hasExplicitChildValues =
    input?.copyCatalogRelations !== undefined || input?.copyEnumerationRelations !== undefined

  if (input?.copyAllRelations === false && !hasExplicitChildValues) {
    return {
      copyAllRelations: false,
      copyCatalogRelations: false,
      copyEnumerationRelations: false,
    }
  }

  return {
    ...merged,
    copyAllRelations: Boolean(merged.copyCatalogRelations && merged.copyEnumerationRelations),
  }
}
```

### 6.2 Zod dependency guard for catalog copy

```ts
const catalogCopyOptionsSchema = z
  .object({
    copyAttributes: z.boolean().optional(),
    copyElements: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const options = normalizeCatalogCopyOptions(value)
    if (!options.copyAttributes && options.copyElements) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['copyElements'],
        message: 'copyElements requires copyAttributes=true',
      })
    }
  })
```

### 6.3 Race-safe codename retry in copy transaction

```ts
for (let attempt = 1; attempt <= 1000; attempt += 1) {
  const codename = buildCopyCodenameCandidate(baseCodename, attempt)
  try {
    return await ds.transaction(async (tx) => {
      return await createCopiedEntity(tx, { codename })
    })
  } catch (error) {
    if (!database.isUniqueViolation(error)) throw error
    const constraint = database.getDbErrorConstraint(error) ?? ''
    if (!constraint.includes('codename')) throw error
  }
}
throw new Error('Unable to generate unique codename for copied entity')
```

### 6.4 TanStack Query v5 multi-key invalidation

```ts
onSuccess: async (_data, vars) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(vars.metahubId) }),
    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(vars.metahubId) }),
  ])
}
```

## 7. Risks and Mitigations

- Risk: relation copy for hub conflicts with single-hub constraints.
  - Mitigation: explicit backend validation + deterministic 400 error code; no silent partial relation mutation.

- Risk: catalog copy without proper attribute remapping can break TABLE hierarchy and self references.
  - Mitigation: explicit old->new attribute map and self-target remap rules.

- Risk: copy endpoints can race on codename uniqueness.
  - Mitigation: retry loop with unique-violation detection inside transaction.

- Risk: UI drift (new custom dialogs unlike existing pattern).
  - Mitigation: reuse `EntityFormDialog`, action descriptors, and existing list menu patterns.

## 8. Milestones

- Milestone 1: Shared copy contracts + normalizers merged.
- Milestone 2: Backend copy endpoints for all 4 entities merged with tests.
- Milestone 3: Frontend copy dialogs/menu actions merged with i18n.
- Milestone 4: Lint/tests green for touched packages and QA-ready branch.

## 9. Open Decisions for Approval

1. For hub relation copy with `isSingleHub=true` linked objects:
   - proposed: fail fast with explicit 400 code (safe, deterministic).
2. For layout copy when `copyWidgets=false`:
   - proposed: keep standard default widgets (not empty layout).
3. For catalog options dependency:
   - proposed: enforce `copyElements => copyAttributes` in UI and backend.

## 10. Requirement Coverage Matrix (Original Task)

1. Hub copy:
   - `Copy` action below `Edit`: covered in Phase E1 + section 4.5.
   - Copy dialog with `Options` tab: covered in section 4.1 + Phase E1.
   - `Copy all relations` parent option + child options (`catalog`, `enumeration`) with parent/child synchronization: covered in section 4.1 + section 6.1 pattern.
2. Catalog copy:
   - `Copy` action below `Edit`: covered in Phase E2.
   - Copy dialog with `Options` tab: covered in section 4.2 + Phase E2.
   - Default-enabled options `copyAttributes`, `copyElements`: covered in section 4.2.
3. Enumeration copy:
   - `Copy` action below `Edit`: covered in Phase E3.
   - Copy dialog with `Options` tab: covered in section 4.3 + Phase E3.
   - Default-enabled option `copyValues`: covered in section 4.3.
4. Layout copy:
   - `Copy` action below `Edit` in existing custom menu: covered in section 4.5 + Phase E4.
   - Copy dialog with `Options` tab: covered in section 4.4 + Phase E4.
   - Default-enabled option `copyWidgets`: covered in section 4.4.
5. Non-legacy and fresh-test-db orientation:
   - plan does not rely on legacy-preservation strategy; focuses on canonical handlers, shared contracts, and deterministic copy logic.
