# Metahub Ordering, DnD, and Table-Limit Hardening Plan - 2026-03-05

## Overview
Implement a consistent ordering and table-view drag-and-drop model across metahub entities (hubs, catalogs, sets, enumerations, elements), add configurable max child-attribute limits for TABLE attributes, and remove unused dependency debt without preserving legacy compatibility paths.

This plan assumes a fresh database baseline (no legacy migration compatibility constraints), UUID v7, immediate i18n coverage, and shared contracts via `@universo/types` / `@universo/utils`.

## Affected Areas
- Backend routes/services:
  - `packages/metahubs-backend/base/src/domains/elements/routes/elementsRoutes.ts`
  - `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubElementsService.ts`
  - `packages/metahubs-backend/base/src/domains/hubs/routes/hubsRoutes.ts`
  - `packages/metahubs-backend/base/src/domains/catalogs/routes/catalogsRoutes.ts`
  - `packages/metahubs-backend/base/src/domains/sets/routes/setsRoutes.ts`
  - `packages/metahubs-backend/base/src/domains/enumerations/routes/enumerationsRoutes.ts`
  - `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubObjectsService.ts`
  - `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubAttributesService.ts`
- Frontend domains/UI:
  - `packages/metahubs-frontend/base/src/domains/elements/{api,hooks,ui}`
  - `packages/metahubs-frontend/base/src/domains/hubs/{api,hooks,ui}`
  - `packages/metahubs-frontend/base/src/domains/catalogs/{api,hooks,ui}`
  - `packages/metahubs-frontend/base/src/domains/sets/{api,hooks,ui}`
  - `packages/metahubs-frontend/base/src/domains/enumerations/{api,hooks,ui}`
  - `packages/metahubs-frontend/base/src/domains/attributes/ui/{AttributeFormFields.tsx,AttributeList.tsx,ChildAttributeList.tsx}`
  - `packages/universo-template-mui/base/src/components/table/FlowListTable.tsx`
- Shared types/contracts:
  - `packages/universo-types/base/src/common/metahubs.ts`
- i18n:
  - `packages/metahubs-frontend/base/src/i18n/locales/en/metahubs.json`
  - `packages/metahubs-frontend/base/src/i18n/locales/ru/metahubs.json`
  - If reused globally: `packages/universo-i18n/*`
- Workspace dependency management:
  - `pnpm-workspace.yaml`
  - `packages/metahubs-frontend/base/package.json`
  - `packages/applications-frontend/base/package.json`

## Additional Findings From Deep Analysis
- `MetahubElementsService.create()` currently defaults `sort_order` to `0` instead of append-to-end.
- Table-view DnD is implemented for attributes / enum values / constants, but not for hubs/catalogs/sets/enumerations/elements.
- `MetahubAttributesService` hardcodes `Maximum 20 child attributes per TABLE` (not configurable per TABLE attribute metadata).
- `MetahubAttributesService._validateCrossListTransfer()` updates `codename_localized` as a physical column, but `_mhb_attributes` stores it inside `presentation` JSONB.
- Copy paths for hub/catalog/set/enumeration frequently preserve source `sortOrder`, risking duplicate orders.
- Catalog/set/enumeration list endpoints do in-memory sorting/pagination after loading full lists.
- `flowise-react-json-view` appears unused in source imports and exists only as devDependency.
- `FlowListTable` keeps sortable header labels visible even when `sortableRows` mode is enabled; this can create misleading UI state if not explicitly disabled in list configs.

## Plan Steps

### Phase 1: Ordering Domain Foundation (Backend)
- [ ] Add a shared reorder utility/service for `_mhb_objects` by `kind` (`hub|catalog|set|enumeration`) using transaction + row locking semantics.
- [ ] Add reorder API endpoints for object-level entities required by table DnD:
  - `PATCH .../:collection/reorder` (`entityId`, `newSortOrder`, optional `expectedVersion`)
  - Keep `move up/down` for object-level entities optional and out of current mandatory scope.
- [ ] Add element move/reorder endpoints in `elementsRoutes` with same contract style as enum values/constants.
- [ ] Update `MetahubElementsService`:
  - compute append sort order (`MAX(sort_order)+1`) on create when sort not provided,
  - add `moveElement` and `reorderElement`,
  - normalize sequential order after delete/cross moves.
- [ ] Ensure object-level reorder endpoints work consistently for both hub-scoped and metahub-scoped table pages (single source of truth by metahub/object kind).
- [ ] Ensure all reorder operations are transaction-safe and deterministic under concurrency.

### Phase 2: Ordering Consistency Fixes (Backend)
- [ ] Fix `codename_localized` write path in attribute auto-rename to update `presentation` JSONB instead of nonexistent physical column.
- [ ] Standardize copy behavior for object-level entities:
  - default copied object append-to-end sort order,
  - optional explicit `sortOrder` supported only when intentionally requested.
- [ ] Keep soft-delete behavior and version increments consistent with existing optimistic-lock patterns.

### Phase 3: Per-TABLE Attribute Child Limit (Required by Technical Task)
- [ ] Extend `AttributeValidationRules` with a TABLE-specific field:
  - key: `validationRules.maxChildAttributes`
  - type: `number | null`
  - semantics: maximum allowed child attributes for this specific TABLE attribute.
- [ ] Add this field to TABLE type settings UI in `AttributeFormFields` next to `minRows/maxRows` (same form section, same UX pattern).
- [ ] Add frontend + backend validation contract for this field:
  - integer-only,
  - `null`/empty means no limit,
  - lower bound `>= 1`.
- [ ] In backend child-attribute create and cross-list transfer validation:
  - load target TABLE parent's `validation_rules.maxChildAttributes`,
  - reject create/transfer when target child count reaches the configured max.
- [ ] Return structured limit errors for UI (`code`, `limit`, `scope`) without legacy string-based fallback.

### Phase 4: Table-View DnD Expansion (Frontend)
- [ ] Implement table-view DnD for:
  - hubs,
  - catalogs,
  - sets,
  - enumerations,
  - elements.
- [ ] Preserve existing `FlowListTable` component and current visual style.
- [ ] Keep card view unchanged (no DnD).
- [ ] For elements table:
  - add clear order column (`#`) derived from `sortOrder`,
  - enable move buttons + drag reorder parity with attributes.
- [ ] For hubs/catalogs/sets/enumerations table DnD:
  - do not add new reusable UI components,
  - wire DnD directly via existing `FlowListTable` sortable API and existing list page patterns.
- [ ] Disable misleading table header sorting interactions for pages operating in `sortableRows` mode (ordering must be controlled only by `sortOrder` + DnD).
- [ ] Reuse existing optimistic-update mutation style (same as constants/enum-values) and unify query invalidation paths.

### Phase 5: TABLE Child-Limit UX Hardening (Frontend)
- [ ] Add TABLE setting field in attribute type settings UI for max child attributes (with i18n labels/help).
- [ ] In child attribute list:
  - disable `Create` button when max reached,
  - block cross-list drop when target list at max,
  - show invalid drop target as red dashed border,
  - keep valid drop target style unchanged.
- [ ] Use code-based error mapping only (no legacy regex fallback path).

### Phase 6: Remove Unused Dependency
- [ ] Confirm no runtime/test/build references to `flowise-react-json-view`.
- [ ] Remove it from package-level devDependencies and workspace catalog version map.
- [ ] Run lockfile refresh and scoped builds to ensure no hidden transitive assumptions.

### Phase 7: Performance and Contract Hardening (Post-MVP / Out of Current Scope)
- [ ] Move list sorting/pagination (catalogs/sets/enumerations) to DB-level where possible.
- [ ] Keep response DTOs stable while reducing in-memory sort/load overhead.
- [ ] Add explicit tie-breaker ordering (`sortOrder`, then `id`) for deterministic output.

### Phase 8: Tests and Verification
- [ ] Backend tests:
  - add `elementsRoutes.test.ts` for move/reorder,
  - extend hubs/catalogs/sets/enumerations route tests for new reorder APIs,
  - add attribute validation tests for TABLE `validation_rules.maxChildAttributes`,
  - add regression test for `presentation.codename` update path.
- [ ] Frontend tests:
  - DnD reorder behavior for each new list in table view,
  - no-DnD behavior retained in card view,
  - sortable header controls not used as active ordering controls in `sortableRows` pages,
  - disabled `Create` + blocked drop when child max reached,
  - invalid drop target style assertion.
- [ ] Quality gates (scoped first, then workspace if requested):
  - `pnpm --filter @universo/metahubs-backend lint`
  - `pnpm --filter @universo/metahubs-backend test -- <touched-tests>`
  - `pnpm --filter @universo/metahubs-backend build`
  - `pnpm --filter @universo/metahubs-frontend lint -- <touched-files>`
  - `pnpm --filter @universo/metahubs-frontend test -- <touched-tests>`
  - `pnpm --filter @universo/metahubs-frontend build`
  - `pnpm --filter @universo/types build` (if shared contracts changed)

## Potential Challenges
- Concurrency collisions in reorder operations under `READ COMMITTED`.
- Maintaining UX parity across hub-scoped and metahub-scoped list modes.
- Cross-list DnD with target-capacity constraints (must reject before mutation call).
- Avoiding stale query cache states when multiple list keys represent the same logical entities.
- Preventing accidental behavior drift while removing legacy compatibility code.

## Design Notes
- Keep domain behavior centralized:
  - one reorder primitive for `_mhb_objects` kinds,
  - one reorder primitive for `_mhb_elements`,
  - shared mutation patterns in frontend hooks.
- No legacy compatibility retention:
  - remove old payload aliases,
  - remove deprecated fallback flows where touched.
- i18n-first implementation:
  - all new labels/errors/tooltips in RU/EN immediately,
  - no hardcoded UI text.
- UI/API minimalism:
  - do not introduce new reusable UI components for this scope,
  - do not introduce new shared table interfaces unless impossible with existing `FlowListTable` capabilities,
  - implement by analogy with existing attributes / enumeration values / constants flows.
- Shared package usage:
  - `@universo/types` for new validation-rule/contracts updates,
  - `@universo/utils` for reusable helpers,
  - `@universo/template-mui` for table behavior extension,
  - keep published-app constraints compatible with `packages/apps-template-mui`.

## Dependencies and Coordination
- `@universo/types` update must land before backend/frontend `AttributeValidationRules.maxChildAttributes` usage.
- Backend reorder endpoints should land before frontend DnD wiring.
- Prefer implementing red invalid-drop visualization in existing wrapper/container styles first; only extend `FlowListTable` API if wrapper styling is demonstrably insufficient.
- If global i18n key policy requires centralization, mirror keys in `packages/universo-i18n` and keep package-level namespace registration aligned.

## Definition of Done
- [ ] Elements support ordered display index, move up/down actions, and table drag reorder.
- [ ] Hubs/catalogs/sets/enumerations/elements support table drag reorder with unified UX and existing table component.
- [ ] Card views remain without drag behavior.
- [ ] TABLE attribute supports per-attribute `maxChildAttributes`; child create and cross-list drops are blocked at limit; invalid drop state is visually explicit.
- [ ] No legacy fallback paths added; no unnecessary new interfaces/components introduced.
- [ ] `flowise-react-json-view` removed if unused across source/tests/build.

## Safe Code Examples

### 1) Transaction-safe reorder for `_mhb_objects` (kind-scoped)
```ts
// Service-level function, called by routes for hubs/catalogs/sets/enumerations.
async function reorderObjectKind(
  schemaName: string,
  kind: 'hub' | 'catalog' | 'set' | 'enumeration',
  objectId: string,
  newSortOrder: number,
  trx: Knex.Transaction
): Promise<void> {
  // Lock active rows in deterministic order to avoid write skew.
  const rows = await trx
    .withSchema(schemaName)
    .from('_mhb_objects')
    .where({ kind, _upl_deleted: false, _mhb_deleted: false })
    .orderByRaw("COALESCE((config->>'sortOrder')::int, 0) asc")
    .orderBy('id', 'asc')
    .forUpdate()
    .select('id', 'config')

  const ordered = rows
    .map((row) => ({
      id: String(row.id),
      sortOrder: Number((row.config as Record<string, unknown>)?.sortOrder ?? 0)
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))

  const from = ordered.findIndex((row) => row.id === objectId)
  if (from < 0) throw new Error(`${kind} not found`)

  const to = Math.max(0, Math.min(newSortOrder - 1, ordered.length - 1))
  const [moved] = ordered.splice(from, 1)
  ordered.splice(to, 0, moved)

  for (let i = 0; i < ordered.length; i += 1) {
    const row = ordered[i]
    await trx
      .withSchema(schemaName)
      .from('_mhb_objects')
      .where({ id: row.id })
      .update({
        config: trx.raw("jsonb_set(coalesce(config,'{}'::jsonb), '{sortOrder}', to_jsonb(?::int), true)", [i + 1]),
        _upl_updated_at: new Date(),
        _upl_version: trx.raw('_upl_version + 1')
      })
  }
}
```

### 2) React Query optimistic reorder with rollback
```ts
export function useReorderHub() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ metahubId, hubId, newSortOrder }: { metahubId: string; hubId: string; newSortOrder: number }) =>
      hubsApi.reorderHub(metahubId, hubId, newSortOrder).then((r) => r.data),

    onMutate: async (vars) => {
      const key = metahubsQueryKeys.hubs(vars.metahubId)
      await queryClient.cancelQueries({ queryKey: key })
      const snapshot = queryClient.getQueriesData({ queryKey: key })

      queryClient.setQueriesData<{ items?: Array<{ id: string; sortOrder: number }> }>({ queryKey: key }, (old) => {
        if (!old?.items) return old
        const items = [...old.items].sort((a, b) => a.sortOrder - b.sortOrder)
        const from = items.findIndex((x) => x.id === vars.hubId)
        if (from < 0) return old
        const to = Math.max(0, Math.min(vars.newSortOrder - 1, items.length - 1))
        const [moved] = items.splice(from, 1)
        items.splice(to, 0, moved)
        return { ...old, items: items.map((x, i) => ({ ...x, sortOrder: i + 1 })) }
      })

      return { snapshot }
    },

    onError: (_error, _vars, ctx) => {
      ctx?.snapshot?.forEach(([k, data]) => queryClient.setQueryData(k, data))
    },

    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(vars.metahubId) })
      queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(vars.metahubId) })
    }
  })
}
```

### 3) Target-capacity guard for child attribute drops
```ts
const canAcceptDrop = useMemo(() => {
  if (!isDropTarget) return true
  if (tableMaxChildAttributes == null) return true
  const incomingCount = pendingTransfer?.toContainerId === containerId ? 1 : 0
  return childAttributes.length + incomingCount <= tableMaxChildAttributes
}, [isDropTarget, tableMaxChildAttributes, pendingTransfer, containerId, childAttributes.length])

<Box
  sx={{
    border: isDropTarget ? '2px dashed' : 'none',
    borderColor: isDropTarget ? (canAcceptDrop ? 'primary.main' : 'error.main') : 'transparent',
    borderRadius: 1
  }}
>
  <FlowListTable
    // Existing props preserved
    isDropTarget={isDropTarget && canAcceptDrop}
  />
</Box>

<Button
  onClick={() => setDialogOpen(true)}
  disabled={tableMaxChildAttributes != null && childAttributes.length >= tableMaxChildAttributes}
>
  {t('common:create')}
</Button>
```

## Requirement Traceability
- Requirement 1 (ordered ID + move + DnD for catalog elements):
  - Covered by Phase 1 and Phase 4 (elements `sortOrder`, move endpoints, table DnD, visible `#` order column).
- Requirement 2 (table DnD for hubs/catalogs/sets/enumerations/elements, keep table component, no card DnD):
  - Covered by Phase 1 and Phase 4, plus UI/API minimalism constraints in Design Notes.
- Requirement 3 (`flowise-react-json-view` cleanup):
  - Covered by Phase 6 with dependency usage verification and safe removal.
- Requirement 4 (TABLE attribute setting for max child attributes + disable create + block drops + red dashed invalid target):
  - Covered by Phase 3 and Phase 5.
- No legacy code retention:
  - Enforced in Design Notes and Phase 5 (code-based errors only; no legacy fallback path).

## External References Used
- dnd-kit docs and guides:
  - https://docs.dndkit.com/
  - https://github.com/clauderic/dnd-kit/blob/main/apps/docs/react/guides/sortable-state-management.mdx
  - https://github.com/clauderic/dnd-kit/blob/main/apps/docs/react/guides/multiple-sortable-lists.mdx
- TanStack Query optimistic updates:
  - https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
- PostgreSQL locking/isolation/update references:
  - https://www.postgresql.org/docs/current/sql-select.html
  - https://www.postgresql.org/docs/current/sql-update.html
  - https://www.postgresql.org/docs/current/transaction-iso.html
  - https://www.postgresql.org/docs/current/applevel-consistency.html

## Supabase Validation Snapshot (UP-test)
- Project: `UP-test` (`osnvhnawsmyfduygsajj`), status `ACTIVE_HEALTHY`.
- Active metahub schema observed: `mhb_019cbb2fc2097954b1d87cb060ed9f9d_b1`.
- `_mhb_attributes` has no physical `codename_localized` column (codename localization is in `presentation` JSONB).
- `_mhb_settings` currently has no child-attribute limit key, which is expected because the limit is planned as TABLE-attribute validation metadata (`_mhb_attributes.validation_rules`), not a global metahub setting.
