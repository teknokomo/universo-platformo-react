# Plan: Nested Hubs + Hub-Scoped Linking + Runtime Menu Hierarchy

> Date: 2026-03-05  
> Mode: PLAN (analysis + architecture, no implementation)  
> Complexity: Level 4 (backend + frontend + types + runtime app + publication pipeline)  
> Scope: Metahubs designer, settings, publication/runtime menu behavior, safe data model evolution

---

## Overview

Implement multi-level hub nesting and consistent hub-scoped entity management (hubs, catalogs, sets, enumerations), including:

- parent-child hub hierarchy,
- hub tab in create/edit/copy dialogs,
- hub-internal tabs order (`Hubs`, `Catalogs`, `Sets`, `Enumerations`),
- safe create warnings when the entity is detached from the current hub context,
- split `Create / Add` actions for linking existing entities,
- menu widget support for hub-bound hierarchical rendering in runtime applications,
- explicit decision for application schema generation: **stop creating `hub_*` physical tables** (use snapshot metadata instead).

This plan is optimized for a fresh database baseline (no legacy compatibility path), per requirement.

---

## Inputs Validated During Analysis

### Codebase findings (additional audit)

1. Hub dialogs currently do not expose `Hubs` tab in all required modes:
   - `packages/metahubs-frontend/base/src/domains/hubs/ui/HubActions.tsx`
2. Hub-scoped child pages currently miss `Hubs` tab and have inconsistent tab sets/order:
   - `CatalogList.tsx`, `SetList.tsx`, `EnumerationList.tsx`
3. Create-from-inside-hub behavior currently silently redirects when `hubIds[0]` differs from current hub instead of warning.
4. Backend hub-scoped upsert for catalogs/sets/enumerations forces current hub association (merge logic), which conflicts with new detach behavior.
5. Settings UI tabs omit `sets` although types registry already includes `sets` tab.
6. `useEntityPermissions` entity union omits `'sets'`, while `SetList` uses it.
7. Menu widget type/runtime supports only `catalog | catalogs_all | link`; no hub binding kind yet.
8. Publication snapshot includes hub entities with `tableName: hub_*`; schema generator currently creates physical tables for hubs.
9. Routing/breadcrumbs have no dedicated `hub/:hubId/hubs` route path.

### Context7 (current docs) used

- `/tanstack/query`: optimistic update rollback (`onMutate` snapshot, `onError` rollback, `onSettled` invalidate).
- `/mui/material-ui`: split button pattern via `ButtonGroup` + `Menu`; confirmation dialog accessibility (`aria-labelledby`, `aria-describedby`).
- `/websites/postgresql_current`: recursive CTE + `CYCLE` for hierarchy cycle detection; self-referential hierarchy constraints.

### Supabase UP-test checks

Project: `osnvhnawsmyfduygsajj` (`UP-test`)

- Active metahub branch schema present: `mhb_019cbe29368c7ea6aae275531fde729f_b1`
- `_mhb_objects` currently contains only `catalog` in sampled schema (no hubs seeded yet).
- `_mhb_settings` has no `hubs.%` values yet in sampled schema.
- No app runtime schemas with `hub_*` tables currently in UP-test sample.
- `ltree` extension is available but not installed; optional path acceleration remains a future optimization, not required now.

---

## Architecture Decisions (Recommended)

1. **Hub hierarchy storage (design-time):**
   - Store parent link in hub object config: `config.parentHubId: string | null`.
   - Keep one-parent model (tree), unlimited depth.
   - Keep all relations in `_mhb_objects` for consistency with existing object model and to avoid introducing extra relation table now.

2. **Cycle safety:**
   - Validate parent changes in backend transaction using recursive CTE (`CYCLE`) against current branch schema.
   - Reject self-parent and all cyclic updates.

3. **Hub-scoped create/edit semantics:**
   - Default auto-link to current hub on open/create.
   - Allow user to detach or switch parent hub.
   - If save result is detached from current hub context, require explicit confirmation modal before final submit.

4. **Runtime app data model decision:**
   - **Do not create physical `hub_*` tables in app schema.**
   - Use publication snapshot metadata for hub tree and menu resolution.
   - Rationale: hubs are structural metadata, not runtime row datasets; this avoids empty tables and schema noise.

5. **No legacy support path:**
   - No fallback conversion for previous DB state.
   - Keep structure/template version unchanged, but update baseline schema/table generation path for fresh DBs.

6. **Runtime metadata invariant (critical):**
   - Keep `_app_objects.table_name` non-null for all entities (including `hub`) to respect current schema constraints.
   - Skip physical `hub_*` table creation only; do not break metadata contracts used by sync/runtime code.

7. **Hierarchy deletion policy (must be explicit):**
   - Deterministic default policy: block parent hub deletion while child hubs exist.
   - Provide explicit UX guidance to unlink/reassign child hubs first.
   - Do not allow silent orphaning of hierarchy nodes.

8. **Security parity for new endpoints:**
   - Any new hub hierarchy / attach-existing routes must follow existing `ensureMetahubAccess` guard policy.
   - Reuse request-scoped manager/query-runner patterns to preserve RLS context consistency.

---

## Affected Areas

### Backend

- `packages/metahubs-backend/base/src/domains/hubs/routes/hubsRoutes.ts`
- `packages/metahubs-backend/base/src/domains/catalogs/routes/catalogsRoutes.ts`
- `packages/metahubs-backend/base/src/domains/sets/routes/setsRoutes.ts`
- `packages/metahubs-backend/base/src/domains/enumerations/routes/enumerationsRoutes.ts`
- `packages/metahubs-backend/base/src/domains/settings/routes/settingsRoutes.ts`
- `packages/metahubs-backend/base/src/domains/branches/services/MetahubBranchesService.ts`
- `packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts`

### Frontend (metahubs)

- `packages/metahubs-frontend/base/src/domains/hubs/ui/HubList.tsx`
- `packages/metahubs-frontend/base/src/domains/hubs/ui/HubActions.tsx`
- `packages/metahubs-frontend/base/src/domains/catalogs/ui/CatalogList.tsx`
- `packages/metahubs-frontend/base/src/domains/sets/ui/SetList.tsx`
- `packages/metahubs-frontend/base/src/domains/enumerations/ui/EnumerationList.tsx`
- `packages/metahubs-frontend/base/src/domains/settings/ui/SettingsPage.tsx`
- `packages/metahubs-frontend/base/src/domains/settings/hooks/useEntityPermissions.ts`
- `packages/metahubs-frontend/base/src/domains/layouts/ui/MenuWidgetEditorDialog.tsx`

### Shared types / UI / i18n

- `packages/universo-types/base/src/common/metahubs.ts`
- `packages/universo-template-mui/base/src/routes/MainRoutesMUI.tsx`
- `packages/universo-template-mui/base/src/components/dashboard/NavbarBreadcrumbs.tsx`
- `packages/universo-i18n` (new shared keys if commonized)
- metahubs frontend locale bundles (EN/RU)

### Runtime app (published applications)

- `packages/applications-backend/base/src/routes/applicationsRoutes.ts`
- `packages/apps-template-mui/src/api/api.ts`
- `packages/apps-template-mui/src/hooks/useCrudDashboard.ts`
- `packages/apps-template-mui/src/dashboard/Dashboard.tsx`
- `packages/apps-template-mui/src/dashboard/components/MenuContent.tsx`

### Schema DDL

- `packages/schema-ddl/base/src/SchemaGenerator.ts`
- (possibly) `packages/schema-ddl/base/src/snapshot.ts` or helpers if needed for kind filtering consistency

### Tests

- backend route tests for hubs/catalogs/sets/enumerations/settings/publication/runtime
- frontend component tests for dialogs/tabs/warnings/menu widget mapping

---

## Plan Steps (Detailed Checklist)

### Phase 0: Contract freeze and safety envelope

- [ ] Lock API/UI contract for hierarchy and confirmation behavior before coding.
- [ ] Define single source-of-truth payload shape for hub relations in all entity forms.
- [ ] Define explicit non-goals (no legacy migration path, no schema/template version bump).

### Phase 1: Extend shared types and setting registry

- [ ] Add new hub settings keys in `METAHUB_SETTINGS_REGISTRY`:
  - `hubs.allowNesting` (default `true`)
  - `hubs.resetNestingOnce` (default `false`, one-shot behavior)
  - `hubs.allowAttachExistingEntities` (default `true`)
- [ ] Extend menu item kinds with hub-aware type(s), e.g. `hub` and/or `hub_tree`.
- [ ] Update type unions used in frontend/runtime parsers.
- [ ] Ensure settings tab exposure includes `sets` in `SettingsPage`.

### Phase 2: Backend hub hierarchy primitives

- [ ] Add parent link support for hubs via `config.parentHubId` in create/update/copy logic.
- [ ] Implement cycle-safe parent validation helper in hubs domain service/route layer.
- [ ] Add endpoint(s) or filter mode to fetch hub tree / direct children for current hub context.
- [ ] Implement parent deletion guard: return blocking response when child hubs exist.
- [ ] Add query/index strategy for hierarchy reads:
  - optimized lookup by `kind='hub'` and `config.parentHubId`,
  - deterministic sibling order (`sortOrder`, then stable tie-breaker by `id`).
- [ ] Ensure parent link is excluded/reset according to copy rules when nesting disabled.
- [ ] Enforce `hubs.allowNesting` rules:
  - create: hide `Hubs` tab for hub dialog when disabled,
  - copy: hide `Hubs` tab and never copy parent link when disabled,
  - edit (hub already linked): only unlink is allowed when disabled.

### Phase 3: Backend scoped upsert behavior harmonization

- [ ] Refactor hub-scoped upsert in catalogs/sets/enumerations:
  - stop unconditional auto-merge of current `hubId` at save-time,
  - keep default auto-link only at form initialization/client side,
  - validate `isRequiredHub`/`isSingleHub` with final submitted `hubIds`.
- [ ] Return structured response flag for detached-from-context cases (optional optimization), or keep client-side pre-submit check.

### Phase 4: Settings behavior and one-shot nesting reset

- [ ] Implement one-shot `hubs.resetNestingOnce` executor on settings save:
  - if enabled, clear all `parentHubId` links transactionally,
  - reset flag automatically after successful execution.
- [ ] Show/hide this setting based on conditions:
  - show while `hubs.allowNesting = false` OR nested links still exist,
  - hide only after one-shot was consumed and visibility predicate becomes false.
- [ ] Ensure validation blocks conflicting updates in one request.

### Phase 5: Frontend dialog consistency (`Hubs` tab everywhere)

- [ ] Add `Hubs` tab to Hub create/edit/copy dialogs with same UX conventions as other entities.
- [ ] Ensure `Hubs` tab appears in create/edit/copy for catalogs/sets/enumerations in all contexts.
- [ ] Add compact action button in hubs panel for “re-link current hub” (shown only when current context hub is absent from selection).
- [ ] Keep auto-link on new entity open, but allow detach/switch.

### Phase 6: Confirm-before-create when detached from current hub

- [ ] Implement shared confirm helper for create/edit/copy save handlers.
- [ ] Trigger modal when saving from hub-scoped context and resulting `hubIds` exclude current hub.
- [ ] Provide localized warning text with entity name/type and hub name.
- [ ] Buttons: `Cancel` (back to dialog), `Create/Save` (proceed).

### Phase 7: Hub-internal navigation and tabs order

- [ ] Add route: `/metahub/:metahubId/hub/:hubId/hubs`.
- [ ] Add first tab `Hubs` inside hub-scoped pages.
- [ ] In hub-scoped `Hubs` tab, create-new-hub flow must preselect current hub as parent by default.
- [ ] Normalize tab order everywhere to:
  - `Hubs`, `Catalogs`, `Sets`, `Enumerations`.
- [ ] Update breadcrumbs/menu config for the new route.

### Phase 8: “Create / Add existing” split action

- [ ] Implement split action UI (MUI pattern) in hub-scoped lists:
  - primary `Create`, secondary dropdown `Add`.
- [ ] Build `Add existing` flow by composing already available shared pieces first:
  - `EntityFormDialog` + `EntitySelectionPanel` (+ thin wrappers like `HubSelectionPanel` style),
  - only extract a new shared wrapper if duplication remains significant after composition.
- [ ] Reuse existing list/query logic with entity-kind-specific adapters.
- [ ] Add attach endpoints (or reuse upsert patch) to link selected existing entities to current hub.
- [ ] Gate feature by `hubs.allowAttachExistingEntities`.
- [ ] Keep behavior symmetric across `Hubs`, `Catalogs`, `Sets`, `Enumerations` tabs (same UX contract and warning policy).

### Phase 9: Menu widget hub binding + runtime hierarchy rendering

- [ ] Extend menu widget item model/editor with hub-bound mode:
  - select hub root,
  - render descendants according to hub tree,
  - include linked entities in hierarchy-aware order.
- [ ] Extend publication snapshot serialization with required hub relation metadata.
- [ ] Extend applications runtime response parser/validator for new menu item kind(s).
- [ ] Extend apps-template-mui menu mapping/render logic for hub-based navigation.

### Phase 10: Publication/runtime schema strategy (remove `hub_*` tables)

- [ ] Update schema generation to skip physical tables for `hub` kind (same as `set` and `enumeration`).
- [ ] Verify runtime routes no longer assume hub tables exist.
- [ ] Keep hub metadata in `_app_objects` + snapshot for navigation/menu only.
- [ ] Preserve `_app_objects.table_name` and snapshot `tableName` contracts for hub rows (string values remain required by current schemas).
- [ ] Update tests that currently assert hub table generation.

### Phase 11: Branch copy, clone, and sanitization correctness

- [ ] Update branch prune/sanitize logic for `parentHubId` handling.
- [ ] Ensure copy options and disabled nesting rules produce valid tree state.
- [ ] Ensure no dangling `parentHubId` after selective copy operations.

### Phase 12: i18n, QA matrix, and verification

- [ ] Add EN/RU keys for all new labels, warnings, dialogs, menu kinds, settings.
- [ ] Prefer shared keys in `packages/universo-i18n` for cross-module reusable actions/messages; keep feature-specific keys in metahubs namespace.
- [ ] Add targeted unit/integration tests for:
  - cycle detection,
  - parent hub deletion policy,
  - detached save warning,
  - split-button add flow,
  - one-shot nesting reset,
  - runtime menu mapping for hub hierarchy,
  - access guard coverage for every newly added route (401/403 paths included).
- [ ] Run package-scoped lint/test/build for touched packages.
- [ ] Keep dependency footprint unchanged unless strictly necessary (no new UI/data libraries for this scope).

### Phase 13: Requirement traceability gate (must pass before IMPLEMENT sign-off)

- [ ] Validate each initial requirement `1..10` against implemented artifacts (routes, dialogs, settings, runtime).
- [ ] Mark each requirement as `done/partial` with concrete evidence links.
- [ ] Block merge if any requirement remains partial without explicit product approval.

---

## Safe Code Examples (Reference Patterns)

### 1) Backend: cycle-safe parent assignment (transaction + CTE)

```ts
// Pseudocode-level example for hubs route/service
await knex.transaction(async (trx) => {
  // lock candidate child row
  const child = await trx.withSchema(schema).from('_mhb_objects')
    .where({ id: hubId, kind: 'hub' })
    .forUpdate()
    .first()

  if (!child) throw new Error('Hub not found')
  if (parentHubId === hubId) throw new Error('Hub cannot be parent of itself')

  if (parentHubId) {
    const parent = await trx.withSchema(schema).from('_mhb_objects')
      .where({ id: parentHubId, kind: 'hub' })
      .forUpdate()
      .first()
    if (!parent) throw new Error('Parent hub not found')

    // detect cycle: parent cannot be a descendant of child
    const cycleRows = await trx.raw(
      `
      WITH RECURSIVE tree(id, parent_id) AS (
        SELECT id, (config->>'parentHubId')::uuid
        FROM ??._mhb_objects
        WHERE kind='hub' AND id = ?
        UNION ALL
        SELECT o.id, (o.config->>'parentHubId')::uuid
        FROM ??._mhb_objects o
        JOIN tree t ON o.id = t.parent_id
        WHERE o.kind='hub'
      )
      SELECT 1 FROM tree WHERE id = ? LIMIT 1
      `,
      [schema, parentHubId, schema, hubId]
    )

    if (cycleRows.rows.length > 0) {
      throw new Error('Hub hierarchy cycle detected')
    }
  }

  await trx.withSchema(schema).from('_mhb_objects')
    .where({ id: hubId, kind: 'hub' })
    .update({
      config: trx.raw(`jsonb_set(COALESCE(config,'{}'::jsonb), '{parentHubId}', to_jsonb(?::uuid), true)`, [parentHubId]),
      _upl_updated_at: new Date(),
      _upl_updated_by: userId,
      _upl_version: trx.raw('_upl_version + 1')
    })
})
```

Safety properties:

- transaction-scoped locking,
- self-parent guard,
- cycle guard,
- optimistic version increment and audit fields.

### 2) Frontend: confirm detached save in hub-scoped context

```tsx
const shouldWarnDetached = isHubScoped && currentHubId && !finalHubIds.includes(currentHubId)

if (shouldWarnDetached) {
  const ok = await confirm({
    title: t('hubs.detachedConfirm.title'),
    description: t('hubs.detachedConfirm.description', {
      entityType: t('catalogs.entityNameSingular'),
      hubName: currentHubName
    }),
    confirmButtonName: t('common:actions.create'),
    cancelButtonName: t('common:actions.cancel')
  })

  if (!ok) return
}

await mutateAsync(payload)
```

Safety properties:

- no silent navigation surprise,
- explicit user confirmation,
- consistent behavior across create/edit/copy.

### 3) MUI split action (`Create` + `Add`)

```tsx
<ButtonGroup variant="contained" aria-label={t('common:actions.create')}>
  <Button onClick={onCreateClick} startIcon={<AddRoundedIcon />}>{t('common:actions.create')}</Button>
  <Button
    size="small"
    aria-controls={menuOpen ? 'create-add-menu' : undefined}
    aria-expanded={menuOpen ? 'true' : undefined}
    aria-haspopup="menu"
    onClick={openMenu}
  >
    <ArrowDropDownIcon />
  </Button>
</ButtonGroup>
<Menu id="create-add-menu" anchorEl={anchorEl} open={menuOpen} onClose={closeMenu}>
  <MenuItem onClick={onAddExistingClick}>{t('common:actions.add')}</MenuItem>
</Menu>
```

Safety properties:

- accessible menu semantics,
- clear separation of create vs attach flows.

### 4) TanStack Query optimistic attach with rollback

```ts
const mutation = useMutation({
  mutationFn: attachEntityToHub,
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: listKey(vars) })
    const previous = queryClient.getQueryData(listKey(vars))
    queryClient.setQueryData(listKey(vars), optimisticAttach(previous, vars.entityId))
    return { previous }
  },
  onError: (_err, vars, ctx) => {
    queryClient.setQueryData(listKey(vars), ctx?.previous)
  },
  onSettled: (_data, _error, vars) => {
    queryClient.invalidateQueries({ queryKey: listKey(vars) })
  }
})
```

Safety properties:

- no stale overwrite race,
- deterministic rollback,
- eventual consistency via invalidation.

---

## Potential Challenges

1. **Tree integrity under concurrent edits**
   - Risk: race between two parent changes creates transient cycle.
   - Mitigation: transaction + row locking + final cycle check before commit.

2. **Hub-scoped create behavior drift across 3 domains**
   - Risk: catalogs/sets/enumerations diverge again.
   - Mitigation: extract shared hub-association helper and shared detached-confirm utility.

3. **Settings interaction complexity**
   - Risk: one-shot reset applied repeatedly or hidden prematurely.
   - Mitigation: deterministic visibility predicate + single transactional executor.

4. **Runtime menu expansion cost**
   - Risk: repeated hierarchical expansion on each request.
   - Mitigation: build compact in-memory tree map from snapshot/runtime payload once per request.

5. **Route + breadcrumbs mismatch**
   - Risk: new `hub/:hubId/hubs` route added without breadcrumb/menu updates.
   - Mitigation: include route/breadcrumb checks in test checklist.

6. **Schema-ddl behavior changes**
   - Risk: existing tests hardcoded to expect hub table creation fail.
   - Mitigation: update schema-ddl tests and runtime assumptions in one change set.

7. **Parent deletion ambiguity**
   - Risk: inconsistent child handling creates data drift or UX confusion.
   - Mitigation: codify one policy and test it across backend + UI flows.

8. **Hierarchy query cost growth**
   - Risk: repeated tree expansion under larger hub counts.
   - Mitigation: indexed parent lookup + bounded per-request tree build with stable ordering.

---

## Design Notes (Level 4)

1. **Dialog consistency first:**
   - prioritize a single reusable relation-tab contract across all entity dialogs to avoid repetitive bugs.

2. **Server authority for hierarchy validity:**
   - UI may pre-check, but backend remains authoritative for cycle/self-link constraints.

3. **Menu widget evolution path:**
   - introduce hub-bound item kind in additive way (no breaking removal of existing kinds).

4. **Avoid premature graph persistence in app schema:**
   - keep hub hierarchy in snapshot metadata until runtime mutation use-cases appear.

5. **Shared package strategy alignment:**
   - place shared types in `@universo/types` and reusable logic/helpers in `@universo/utils` where appropriate.

---

## Dependencies / Coordination

1. `@universo/types` changes must land before frontend/backend runtime parsers compile.
2. `applications-backend` and `apps-template-mui` must be updated together for new menu item kinds.
3. `schema-ddl` skip-hub-table change must be synchronized with publication/runtime tests.
4. i18n keys should be added with EN/RU parity in same PR slice to avoid UI key leakage.
5. If shared dialog component is extracted to `@universo/template-mui`, publish/build order in monorepo must follow dependency graph.

---

## Verification Plan

- Backend:
  - hierarchy create/update/copy constraints,
  - hub-scoped upsert detach behavior,
  - settings one-shot reset,
  - publication snapshot correctness.
- Frontend:
  - tabs order and route transitions,
  - detached confirm UX,
  - split create/add actions,
  - relink-current-hub helper button visibility logic.
- Runtime:
  - menu rendering for hub-bound item kinds,
  - no dependency on `hub_*` tables,
  - active selection behavior remains stable.
- Build/lint/tests (package-scoped first, then aggregate as needed).

---

## Requirement Traceability (QA)

1. Nested hub hierarchy: covered (Phase 2 + Phase 9).
2. `Hubs` tab in create/edit/copy hub dialogs: covered (Phase 5, clarified in Phase 2 settings constraints).
3. Inside hub, first tab `Hubs` + create child hub by default: covered (Phase 7 explicit preselected parent).
4. Inside hub, sets visibility + tab order `Hubs/Catalogs/Sets/Enumerations`: covered (Phase 7 + Phase 1 settings tab consistency).
5. Warn on detached create/edit/copy from current hub context: covered (Phase 6).
6. `Hubs` tab must always exist in child entity edit/copy dialogs in hub context: covered (Phase 5 + Phase 6).
7. Fast re-link button for current hub when detached: covered (Phase 5).
8. Split `Create/Add` and add-existing flow via MUI in all child tabs: covered (Phase 8, now constrained to reuse existing shared UI primitives).
9. Menu widget hub binding + hierarchy + decision on `hub_*` tables: covered (Phase 9 + Phase 10 + runtime metadata invariant).
10. New settings behavior (`allowNesting`, one-shot reset, allowAttachExistingEntities`) + defaults/visibility: covered (Phase 1 + Phase 2 + Phase 4, visibility clarified).

Global constraints:

- No legacy compatibility path: covered.
- Do not bump metahub schema/template versions: covered.

Additional quality constraints:

- Reuse existing shared UI patterns/components first (avoid unnecessary new interfaces/components): covered.
- Preserve security/RLS guard parity on new routes: covered.
- Preserve runtime metadata contracts while removing physical `hub_*` tables: covered.

---

## Internet Sources (for architecture choices)

- TanStack Query optimistic updates guide:
  - https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
- MUI split button pattern:
  - https://mui.com/material-ui/react-button-group/
- MUI dialog confirmation guidance:
  - https://mui.com/material-ui/react-dialog/
- PostgreSQL recursive CTE and cycle detection:
  - https://www.postgresql.org/docs/current/queries-with.html
- PostgreSQL self-referential foreign keys:
  - https://www.postgresql.org/docs/current/ddl-constraints.html
