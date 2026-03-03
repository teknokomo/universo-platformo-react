# Drag-and-Drop for Attributes & Enumeration Values

> **Date**: 2026-03-03  
> **Complexity**: Level 4 (Major/Complex)  
> **Status**: PLAN — awaiting review

---

## Overview

Implement drag-and-drop (DnD) reordering for:

1. **Root attributes** within their list (single-list sortable)
2. **Child attributes** within a TABLE attribute (single-list sortable)
3. **Cross-list attribute transfer** — move attributes between root ↔ child and between different child lists (multi-container DnD)
4. **Enumeration values** within their list (single-list sortable)

DnD must complement the existing move-up/move-down actions (not replace them). Two metahub settings control cross-list permissions (both enabled by default). DnD within a single list is always available — there are no settings to disable it.

**Dialog flow** for cross-list transfer:
- **Display attribute** → info dialog (OK only) explaining the user must first reassign display attribute
- **TABLE attribute to child list** → info dialog (OK only) explaining TABLE can only exist at root
- **Codename conflict** → 409 from backend → ConfirmDialog ("Move" / "Cancel") offering auto-rename → retry with `autoRenameCodename: true`
- **No conflict** → transfer proceeds immediately (no generic confirmation dialog)

---

## Design Decisions

### DD-1: Why Dedicated DnD Table Components (not modifying FlowListTable)

`FlowListTable` renders `<StyledTableRow>` directly inside its `.map()` loop. `@dnd-kit/sortable`'s `useSortable` hook must be called inside a component that owns the `<tr>` ref. Options:

| Option | Pros | Cons |
|--------|------|------|
| A. Modify FlowListTable | Shared reusable | Couples shared component to @dnd-kit; complex API surface; breaks SRP |
| B. `renderRow` callback in FlowListTable | Minimal change | Can't inject ref/style into already-rendered JSX; useSortable needs a component boundary |
| **C. Dedicated DnD table components** | Full control; follows CanvasTabs pattern; no shared-component coupling | Some rendering duplication |

**Decision: Option C** — create `SortableAttributeTable` and `SortableEnumerationValueTable` in `metahubs-frontend`. This mirrors how `CanvasTabs.jsx` in `spaces-frontend` builds its own DnD-integrated component rather than adapting a generic one.

### DD-2: Single DndContext for Cross-Container DnD

For moving attributes between root and child lists (or between two child lists), a **single `DndContext`** must wrap the entire attribute area (root table + all expanded child tables). Each list has its own `SortableContext`. Event handlers (`onDragOver`, `onDragEnd`) detect cross-container movement and apply validation.

### DD-3: Backend Reorder API

Current `moveAttribute` API uses `{ direction: 'up' | 'down' }` which only swaps neighbors — unusable for arbitrary DnD reordering. New endpoint:

```
PATCH /metahub/:m/catalog/:c/attributes/reorder
Body: { attributeId: string, newSortOrder: number, newParentAttributeId?: string | null, autoRenameCodename?: boolean }
```

- `newParentAttributeId` absent/unchanged → same-list reorder  
- `newParentAttributeId` changed → cross-list transfer (includes validation + optional auto-rename)  
- Backend normalizes all sibling sort_orders after the operation  

### DD-4: Optimistic Updates with Revert-on-Error

Follow the **CanvasTabs pattern**: optimistic local state → API call → revert on error → invalidate on success.

For paginated lists (root attributes): DnD only reorders within the visible page. The `newSortOrder` is computed from the item's new index on the current page.

### DD-5: Pagination Constraint

Root attributes use `usePaginated`. DnD only reorders items **within the visible page**. Cross-page reordering is not supported via DnD; users should use move-up/move-down for that. We'll optionally default to loading all items when the list is small enough (< 100).

---

## Affected Areas

### Packages to Modify

| Package | Scope |
|---------|-------|
| `metahubs-frontend` | New DnD components, hooks, API functions; modify AttributeList, ChildAttributeList, EnumerationValueList |
| `metahubs-backend` | New reorder/transfer endpoints and service methods |
| `universo-types` | 2 new settings in `METAHUB_SETTINGS_REGISTRY` (cross-list permissions, default `true`) |
| `universo-template-mui` | (1) Fix FlowListTable `key={index}` → `key={row.id}`; (2) Export `StyledTableCell`/`StyledTableRow` from shared file (QA-F10); (3) Add `hideCancelButton?: boolean` to `ConfirmPayload` interface and handle in `ConfirmDialog` (QA-F4) |

### Key Files

**Frontend (metahubs-frontend)**:
- `src/domains/attributes/ui/AttributeList.tsx` — wrap with DndContext, replace FlowListTable with DnD table
- `src/domains/attributes/ui/ChildAttributeList.tsx` — same
- `src/domains/enumerations/ui/EnumerationValueList.tsx` — same
- **NEW** `src/domains/attributes/ui/dnd/` — DnD components and hooks
- **NEW** `src/domains/enumerations/ui/dnd/` — DnD components and hooks
- `src/domains/attributes/api/attributes.ts` — new `reorderAttribute` API function
- `src/domains/attributes/hooks/mutations.ts` — new `useReorderAttribute` mutation
- `src/domains/enumerations/api/` — new `reorderEnumerationValue` API function
- `src/domains/enumerations/hooks/` — new `useReorderEnumerationValue` mutation

**Backend (metahubs-backend)**:
- `src/domains/attributes/routes/attributesRoutes.ts` — new PATCH reorder endpoint
- `src/domains/metahubs/services/MetahubAttributesService.ts` — new `reorderAttribute()` method
- `src/domains/metahubs/services/MetahubEnumerationValuesService.ts` — new `reorderValue()` method

**Shared types (universo-types)**:
- `src/common/metahubs.ts` — 2 new settings entries

---

## Plan Steps

### Phase 1: Bug Fix — FlowListTable Key

> Independent prerequisite to prevent React reconciliation issues during DnD.

- [ ] **Step 1.1**: Change `key={index}` → `key={row.id}` in `FlowListTable.tsx` row rendering

```tsx
// BEFORE (line 339, FlowListTable.tsx)
{(sortedData || []).filter(activeFilter).map((row, index) => {
    // ...
    return (
        <React.Fragment key={index}>

// AFTER
{(sortedData || []).filter(activeFilter).map((row, index) => {
    // ...
    return (
        <React.Fragment key={row.id}>
```

> **QA-F15**: Verify that `FlowListTableData` interface always has `id: string`. Check all usages of `<FlowListTable>` across the project to confirm that `data` items always have `.id` populated. If not, use `row.id ?? index` as fallback.

- [ ] **Step 1.2** (QA-F10): Export `StyledTableCell` and `StyledTableRow` from `@universo/template-mui`

Currently these are defined inside `FlowListTable.tsx`. Export them from a shared file so DnD components can reuse them:
```typescript
// packages/universo-template-mui/base/src/components/table/TableStyles.ts
export { StyledTableCell, StyledTableRow } from './FlowListTable'
// Also re-export from the package index
```

- [ ] **Step 1.3** (QA-F4): Add `hideCancelButton` to `ConfirmPayload` and handle in `ConfirmDialog`

```typescript
// packages/universo-template-mui/base/src/store/actions.ts
// Add to ConfirmPayload interface:
export interface ConfirmPayload {
    title?: string
    description: string
    confirmButtonName?: string
    cancelButtonName?: string
    customBtnId?: string
    hideCancelButton?: boolean  // QA-F4: for info-only dialogs (display attribute block, TABLE block)
}
```

In `ConfirmDialog.tsx`, conditionally hide the Cancel button:
```tsx
{!confirmState?.hideCancelButton && (
    <StyledButton variant="outlined" onClick={onCancel}>
        {confirmState?.cancelButtonName || t('common:confirm.cancelButtonText')}
    </StyledButton>
)}
```

---

### Phase 2: New Metahub Settings

- [ ] **Step 2.1**: Add settings to `METAHUB_SETTINGS_REGISTRY` in `universo-types`

```typescript
// packages/universo-types/base/src/common/metahubs.ts
// Add after catalogs.allowElementDelete (sortOrder 9):

{
    key: 'catalogs.allowAttributeMoveBetweenRootAndChildren',
    tab: 'catalogs',
    valueType: 'boolean',
    defaultValue: true,     // QA-F1: ТЗ says "по умолчанию включено"
    sortOrder: 10
},
{
    key: 'catalogs.allowAttributeMoveBetweenChildLists',
    tab: 'catalogs',
    valueType: 'boolean',
    defaultValue: true,     // QA-F1: ТЗ says "по умолчанию включено"
    sortOrder: 11
},
```

> **QA-F2 Note**: Settings `catalogs.allowAttributeDragReorder` and `enumerations.allowValueDragReorder` were removed — they are NOT in the ТЗ. DnD reordering within a single list is always available; only cross-list transfer has settings.

- [ ] **Step 2.2**: Add i18n keys for new settings (EN + RU) in `metahubs-frontend`

```json
// EN (only 2 settings per ТЗ)
{
    "settings.catalogs.allowAttributeMoveBetweenRootAndChildren": "Allow attributes to move between root and table columns",
    "settings.catalogs.allowAttributeMoveBetweenRootAndChildren.description": "When enabled, attributes can be dragged between the root list and TABLE attribute child lists",
    "settings.catalogs.allowAttributeMoveBetweenChildLists": "Allow attributes to move between different table column lists",
    "settings.catalogs.allowAttributeMoveBetweenChildLists.description": "When enabled, child attributes can be dragged between different TABLE attribute child lists"
}
```

```json
// RU (only 2 settings per ТЗ)
{
    "settings.catalogs.allowAttributeMoveBetweenRootAndChildren": "Разрешить перемещение атрибутов между корневым списком и колонками таблиц",
    "settings.catalogs.allowAttributeMoveBetweenRootAndChildren.description": "Позволяет перетаскивать атрибуты между корневым списком и списками дочерних атрибутов TABLE",
    "settings.catalogs.allowAttributeMoveBetweenChildLists": "Разрешить перемещение атрибутов между разными списками колонок таблиц",
    "settings.catalogs.allowAttributeMoveBetweenChildLists.description": "Позволяет перетаскивать дочерние атрибуты между списками разных TABLE-атрибутов"
}
```

---

### Phase 3: Backend — Reorder Endpoint for Attributes

- [ ] **Step 3.1**: Add Zod schema and route for reorder

```typescript
// attributesRoutes.ts — new endpoint
const reorderAttributeSchema = z.object({
    attributeId: z.string().uuid(),
    newSortOrder: z.number().int().min(1),
    // If provided and differs from current → cross-list transfer
    newParentAttributeId: z.string().uuid().nullable().optional(),
    // QA-F3: When true, auto-rename codename on conflict using buildCodenameAttempt()
    autoRenameCodename: z.boolean().optional()
})

// PATCH /metahub/:m/catalog/:c/attributes/reorder
router.patch(
    '/metahub/:metahubId/catalog/:catalogId/attributes/reorder',
    authenticateToken,
    async (req, res) => {
        const { metahubId, catalogId } = req.params
        const parsed = reorderAttributeSchema.safeParse(req.body)
        if (!parsed.success) return res.status(400).json({ message: parsed.error.message })

        const { attributeId, newSortOrder, newParentAttributeId, autoRenameCodename } = parsed.data
        const userId = req.user?.id

        try {
            const result = await attributesService.reorderAttribute(
                metahubId, catalogId, attributeId,
                newSortOrder, newParentAttributeId, autoRenameCodename, userId
            )
            return res.json(result)
        } catch (err: any) {
            if (err.message?.includes('CODENAME_CONFLICT')) {
                // QA-F3: Return 409 with conflict details so frontend can offer auto-rename
                return res.status(409).json({
                    message: err.message,
                    code: 'CODENAME_CONFLICT',
                    codename: err.codename // the conflicting codename
                })
            }
            if (err.message?.includes('DISPLAY_ATTRIBUTE_TRANSFER_BLOCKED')) {
                return res.status(422).json({ message: err.message, code: 'DISPLAY_ATTRIBUTE_TRANSFER_BLOCKED' })
            }
            if (err.message?.includes('TRANSFER_NOT_ALLOWED')) {
                return res.status(403).json({ message: err.message, code: 'TRANSFER_NOT_ALLOWED' })
            }
            throw err
        }
    }
)
```

- [ ] **Step 3.2**: Implement `reorderAttribute()` in `MetahubAttributesService`

```typescript
// MetahubAttributesService.ts
async reorderAttribute(
    metahubId: string,
    objectId: string,
    attributeId: string,
    newSortOrder: number,
    newParentAttributeId?: string | null,
    autoRenameCodename?: boolean,   // QA-F3: auto-rename on codename conflict
    userId?: string
): Promise<Attribute> {
    const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

    return this.knex.transaction(async (trx) => {
        // 1. Fetch current attribute
        const current = await trx.withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ id: attributeId })
            .first()
        if (!current) throw new Error('Attribute not found')

        const currentParent: string | null = current.parent_attribute_id ?? null
        const targetParent: string | null =
            newParentAttributeId !== undefined ? newParentAttributeId : currentParent

        const isCrossList = targetParent !== currentParent

        if (isCrossList) {
            // ── Cross-list transfer validation ──
            await this._validateCrossListTransfer(
                trx, schemaName, metahubId, objectId,
                current, targetParent, autoRenameCodename, userId
            )

            // Move: update parent_attribute_id
            await trx.withSchema(schemaName)
                .from('_mhb_attributes')
                .where({ id: attributeId })
                .update({ parent_attribute_id: targetParent })

            // Normalize source list (close gap)
            await this._ensureSequentialSortOrder(
                metahubId, objectId, trx, userId, currentParent
            )
        }

        // 2. Ensure sequential order in target list
        await this._ensureSequentialSortOrder(
            metahubId, objectId, trx, userId, targetParent
        )

        // 3. Re-fetch to get current sort_order after normalization
        const refreshed = await trx.withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ id: attributeId })
            .first()

        const oldOrder = refreshed.sort_order
        const clampedNew = Math.max(1, newSortOrder)

        if (oldOrder !== clampedNew) {
            // Shift siblings to make room
            if (clampedNew < oldOrder) {
                // Moving up: shift items [clampedNew, oldOrder) down by 1
                await trx.withSchema(schemaName)
                    .from('_mhb_attributes')
                    .where({ object_id: objectId })
                    .where(targetParent
                        ? { parent_attribute_id: targetParent }
                        : trx.raw('parent_attribute_id IS NULL'))
                    .where('sort_order', '>=', clampedNew)
                    .where('sort_order', '<', oldOrder)
                    .whereNot({ id: attributeId })
                    .increment('sort_order', 1)
            } else {
                // Moving down: shift items (oldOrder, clampedNew] up by 1
                await trx.withSchema(schemaName)
                    .from('_mhb_attributes')
                    .where({ object_id: objectId })
                    .where(targetParent
                        ? { parent_attribute_id: targetParent }
                        : trx.raw('parent_attribute_id IS NULL'))
                    .where('sort_order', '>', oldOrder)
                    .where('sort_order', '<=', clampedNew)
                    .whereNot({ id: attributeId })
                    .decrement('sort_order', 1)
            }

            // Set the target sort_order
            await trx.withSchema(schemaName)
                .from('_mhb_attributes')
                .where({ id: attributeId })
                .update({ sort_order: clampedNew })
        }

        // 4. Final normalization pass
        await this._ensureSequentialSortOrder(
            metahubId, objectId, trx, userId, targetParent
        )

        // 5. Return updated attribute
        const [updated] = await trx.withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ id: attributeId })
            .returning('*')
        return this.mapRowToAttribute(updated)
    })
}

private async _validateCrossListTransfer(
    trx: any,
    schemaName: string,
    metahubId: string,
    objectId: string,
    attribute: any,
    targetParentId: string | null,
    autoRenameCodename?: boolean,   // QA-F3
    userId?: string
): Promise<void> {
    // 1. Display attribute cannot be moved to child level
    if (attribute.is_display_attribute && targetParentId !== null) {
        throw new Error(
            'DISPLAY_ATTRIBUTE_TRANSFER_BLOCKED: Display attribute cannot be moved. Assign another attribute as the display attribute first.'
        )
    }

    // 2. TABLE attributes can only exist at root level (QA-F11)
    if (attribute.data_type === 'TABLE' && targetParentId !== null) {
        throw new Error(
            'TRANSFER_NOT_ALLOWED: TABLE attributes can only exist at the root level'
        )
    }

    // 3. If target is a child list, verify parent is TABLE type
    if (targetParentId !== null) {
        const parentAttr = await trx.withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ id: targetParentId })
            .first()
        if (!parentAttr || parentAttr.data_type !== 'TABLE') {
            throw new Error('TRANSFER_NOT_ALLOWED: Target parent is not a TABLE attribute')
        }
        // Check data type is allowed in TABLE children
        const TABLE_CHILD_DATA_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON']
        if (!TABLE_CHILD_DATA_TYPES.includes(attribute.data_type)) {
            throw new Error(
                `TRANSFER_NOT_ALLOWED: ${attribute.data_type} attributes are not allowed in TABLE children`
            )
        }
    }

    // 4. Codename uniqueness in target scope
    // QA-F3: Reuses buildCodenameAttempt() and retry loop from copy endpoint
    const settings = await this.settingsService.getSettingsMap(metahubId, userId)
    const codenameScope = settings['catalogs.attributeCodenameScope'] ?? 'per-level'

    const hasConflict = async (codename: string): Promise<boolean> => {
        let query = trx.withSchema(schemaName)
            .from('_mhb_attributes')
            .where({ object_id: objectId, codename })
            .whereNot({ id: attribute.id })

        if (codenameScope === 'global') {
            // Global: unique across all attributes in catalog
        } else {
            // Per-level: unique among siblings
            if (targetParentId) {
                query = query.where({ parent_attribute_id: targetParentId })
            } else {
                query = query.whereNull('parent_attribute_id')
            }
        }
        return !!(await query.first())
    }

    if (await hasConflict(attribute.codename)) {
        if (!autoRenameCodename) {
            // No auto-rename — throw conflict so frontend can show dialog
            const error: any = new Error(
                `CODENAME_CONFLICT: Codename "${attribute.codename}" already exists in the target scope`
            )
            error.codename = attribute.codename
            throw error
        }

        // QA-F3: Auto-rename using buildCodenameAttempt() retry loop
        // (same pattern as copy endpoint in attributesRoutes.ts)
        const codenameStyle = extractCodenameStyle(attribute.codename)
        let renamed = false
        for (let attempt = 2; attempt <= 20 && !renamed; attempt++) {
            const candidate = buildCodenameAttempt(attribute.codename, attempt, codenameStyle)
            if (!(await hasConflict(candidate))) {
                await trx.withSchema(schemaName)
                    .from('_mhb_attributes')
                    .where({ id: attribute.id })
                    .update({ codename: candidate })
                renamed = true
            }
        }
        if (!renamed) {
            throw new Error('CODENAME_CONFLICT: Could not generate unique codename after 20 attempts')
        }
    }
}
```

- [ ] **Step 3.3**: Add hub-scoped route variant

The existing routes support both hub-scoped (`/metahub/:m/hub/:h/catalog/:c/...`) and direct (`/metahub/:m/catalog/:c/...`) paths. The reorder endpoint needs both variants, following the same pattern as `moveAttribute`.

---

### Phase 4: Backend — Reorder Endpoint for Enumeration Values

- [ ] **Step 4.1**: Add route and service method

```typescript
// enumerationRoutes.ts — new endpoint
const reorderValueSchema = z.object({
    valueId: z.string().uuid(),
    newSortOrder: z.number().int().min(1)
})

// PATCH /metahub/:m/enumeration/:e/values/reorder
```

```typescript
// MetahubEnumerationValuesService.ts
async reorderValue(
    metahubId: string,
    objectId: string,
    valueId: string,
    newSortOrder: number,
    userId?: string
): Promise<EnumerationValue> {
    const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

    return this.knex.transaction(async (trx) => {
        // 1. Ensure sequential order
        await this._ensureSequentialSortOrder(metahubId, objectId, trx, userId)

        // 2. Fetch current value
        const current = await trx.withSchema(schemaName)
            .from('_mhb_values')
            .where({ id: valueId })
            .first()
        if (!current) throw new Error('Enumeration value not found')

        const oldOrder = current.sort_order
        const clampedNew = Math.max(1, newSortOrder)

        if (oldOrder !== clampedNew) {
            if (clampedNew < oldOrder) {
                await trx.withSchema(schemaName)
                    .from('_mhb_values')
                    .where({ object_id: objectId })
                    .where('sort_order', '>=', clampedNew)
                    .where('sort_order', '<', oldOrder)
                    .whereNot({ id: valueId })
                    .increment('sort_order', 1)
            } else {
                await trx.withSchema(schemaName)
                    .from('_mhb_values')
                    .where({ object_id: objectId })
                    .where('sort_order', '>', oldOrder)
                    .where('sort_order', '<=', clampedNew)
                    .whereNot({ id: valueId })
                    .decrement('sort_order', 1)
            }

            await trx.withSchema(schemaName)
                .from('_mhb_values')
                .where({ id: valueId })
                .update({ sort_order: clampedNew })
        }

        // Final normalization
        await this._ensureSequentialSortOrder(metahubId, objectId, trx, userId)

        const [updated] = await trx.withSchema(schemaName)
            .from('_mhb_values')
            .where({ id: valueId })
            .returning('*')
        return this.mapRowToValue(updated)
    })
}
```

---

### Phase 5: Frontend — DnD Dependencies & Shared Utilities

- [ ] **Step 5.1**: Add `@dnd-kit` to `metahubs-frontend/package.json`

```json
{
    "dependencies": {
        "@dnd-kit/core": "catalog:",
        "@dnd-kit/sortable": "catalog:",
        "@dnd-kit/utilities": "catalog:"
    }
}
```

Versions are already in `pnpm-workspace.yaml` catalog:
- `@dnd-kit/core`: ^6.3.1
- `@dnd-kit/sortable`: ^8.0.0
- `@dnd-kit/utilities`: ^3.2.2

- [ ] **Step 5.2**: Create `src/domains/attributes/api/attributes.ts` — add API function

```typescript
// Add to attributes.ts:

/**
 * Reorder an attribute (with optional cross-list transfer).
 * @param newParentAttributeId - undefined = same list, null = root, string = child of that parent
 * @param autoRenameCodename - QA-F3: if true, auto-rename codename on conflict
 */
export const reorderAttribute = (
    metahubId: string,
    catalogId: string,
    attributeId: string,
    newSortOrder: number,
    newParentAttributeId?: string | null,
    autoRenameCodename?: boolean
) =>
    apiClient.patch<Attribute>(
        `/metahub/${metahubId}/catalog/${catalogId}/attributes/reorder`,
        {
            attributeId,
            newSortOrder,
            ...(newParentAttributeId !== undefined && { newParentAttributeId }),
            ...(autoRenameCodename && { autoRenameCodename })
        }
    )

// Hub-scoped variant:
export const reorderAttributeViaHub = (
    metahubId: string,
    hubId: string,
    catalogId: string,
    attributeId: string,
    newSortOrder: number,
    newParentAttributeId?: string | null,
    autoRenameCodename?: boolean
) =>
    apiClient.patch<Attribute>(
        `/metahub/${metahubId}/hub/${hubId}/catalog/${catalogId}/attributes/reorder`,
        {
            attributeId,
            newSortOrder,
            ...(newParentAttributeId !== undefined && { newParentAttributeId }),
            ...(autoRenameCodename && { autoRenameCodename })
        }
    )
```

- [ ] **Step 5.3**: Create `useReorderAttribute` mutation hook

```typescript
// mutations.ts — new mutation
interface ReorderAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
    newSortOrder: number
    newParentAttributeId?: string | null
    autoRenameCodename?: boolean   // QA-F3
}

export function useReorderAttribute() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            metahubId, hubId, catalogId,
            attributeId, newSortOrder, newParentAttributeId,
            autoRenameCodename
        }: ReorderAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.reorderAttributeViaHub(
                    metahubId, hubId, catalogId,
                    attributeId, newSortOrder, newParentAttributeId,
                    autoRenameCodename
                )
                return response.data
            }
            const response = await attributesApi.reorderAttribute(
                metahubId, catalogId,
                attributeId, newSortOrder, newParentAttributeId,
                autoRenameCodename
            )
            return response.data
        },
        onSuccess: (_data, variables) => {
            // Invalidate all relevant queries
            if (variables.hubId) {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.attributes(
                        variables.metahubId, variables.hubId, variables.catalogId
                    )
                })
            } else {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.attributesDirect(
                        variables.metahubId, variables.catalogId
                    )
                })
            }
            // Also invalidate child queries for cross-list moves
            queryClient.invalidateQueries({
                queryKey: ['metahubs', 'childAttributes', variables.metahubId, variables.catalogId]
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.catalogDetail(
                    variables.metahubId, variables.catalogId
                )
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId)
            })
        }
        // QA-F8: NO onError here — error handling is done in the calling component
        // so it can distinguish CODENAME_CONFLICT (409) and offer auto-rename dialog
    })
}
```

---

### Phase 6: Frontend — DnD Components for Attributes

Create a `dnd/` sub-folder inside `src/domains/attributes/ui/`.

- [ ] **Step 6.1**: Create `SortableAttributeRow` component

```tsx
// src/domains/attributes/ui/dnd/SortableAttributeRow.tsx
import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
// QA-F10: Reuse shared styled components instead of duplicating
import { StyledTableCell, StyledTableRow } from '@universo/template-mui'

interface SortableAttributeRowProps {
    id: string
    disabled?: boolean
    children: React.ReactNode
    /** Hide bottom border when expansion content follows */
    hasExpansion?: boolean
}

export const SortableAttributeRow: React.FC<SortableAttributeRowProps> = ({
    id,
    disabled = false,
    children,
    hasExpansion = false
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id, disabled })

    const style: React.CSSProperties = {
        // QA-F6: Use CSS.Translate (not CSS.Transform) to avoid scale issues on <tr>
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: disabled ? 'default' : 'grab',
        position: 'relative',
        zIndex: isDragging ? 1 : 'auto'
    }

    return (
        <StyledTableRow
            ref={setNodeRef}
            style={style}
            sx={hasExpansion ? { '& td, & th': { borderBottom: 0 } } : undefined}
            {...attributes}
        >
            {/* Drag handle column */}
            <StyledTableCell
                align="center"
                sx={{ width: 40, px: 0.5, cursor: disabled ? 'default' : 'grab' }}
                {...listeners}
            >
                <DragIndicatorIcon
                    fontSize="small"
                    sx={{
                        color: disabled ? 'action.disabled' : 'action.active',
                        '&:hover': disabled ? {} : { color: 'primary.main' }
                    }}
                />
            </StyledTableCell>
            {children}
        </StyledTableRow>
    )
}
```

- [ ] **Step 6.2**: Create `DragOverlayRow` component

```tsx
// src/domains/attributes/ui/dnd/DragOverlayRow.tsx
import React from 'react'
import { Paper, Typography, Chip, Stack } from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import type { AttributeDisplay } from '../../../../types'

interface DragOverlayRowProps {
    attribute: AttributeDisplay
}

export const DragOverlayRow: React.FC<DragOverlayRowProps> = ({ attribute }) => {
    return (
        <Paper
            elevation={8}
            sx={{
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minWidth: 300,
                maxWidth: 500,
                borderLeft: '3px solid',
                borderColor: 'primary.main',
                opacity: 0.95
            }}
        >
            <DragIndicatorIcon fontSize="small" sx={{ color: 'primary.main' }} />
            <Typography variant="body2" fontWeight={500} noWrap>
                {attribute.name || attribute.codename}
            </Typography>
            <Chip
                label={attribute.dataType}
                size="small"
                sx={{ ml: 'auto' }}
            />
        </Paper>
    )
}
```

- [ ] **Step 6.3**: Create `useAttributeDnd` hook

```tsx
// src/domains/attributes/ui/dnd/useAttributeDnd.ts
import { useState, useCallback, useRef } from 'react'
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { Attribute, AttributeDisplay } from '../../../../types'

interface ContainerInfo {
    id: string                    // 'root' | `child-${parentId}`
    parentAttributeId: string | null
    items: Attribute[]
}

interface UseAttributeDndOptions {
    containers: ContainerInfo[]
    allowCrossListRootChildren: boolean
    allowCrossListBetweenChildren: boolean
    onReorder: (
        attributeId: string,
        newSortOrder: number,
        newParentAttributeId?: string | null
    ) => Promise<void>
    onValidateTransfer?: (
        attribute: Attribute,
        targetParentId: string | null
    ) => Promise<boolean>
}

export function useAttributeDnd({
    containers,
    allowCrossListRootChildren,
    allowCrossListBetweenChildren,
    onReorder,
    onValidateTransfer
}: UseAttributeDndOptions) {
    const [activeId, setActiveId] = useState<string | null>(null)
    const [overId, setOverId] = useState<string | null>(null)

    // Track optimistic container state for cross-container moves
    const [optimisticContainers, setOptimisticContainers] =
        useState<Map<string, string[]> | null>(null)

    const findContainer = useCallback(
        (itemId: string): ContainerInfo | undefined => {
            return containers.find((c) =>
                c.items.some((item) => item.id === itemId)
            )
        },
        [containers]
    )

    const findAttribute = useCallback(
        (itemId: string): Attribute | undefined => {
            for (const c of containers) {
                const found = c.items.find((item) => item.id === itemId)
                if (found) return found
            }
            return undefined
        },
        [containers]
    )

    const isCrossListAllowed = useCallback(
        (sourceContainer: ContainerInfo, targetContainer: ContainerInfo): boolean => {
            if (sourceContainer.id === targetContainer.id) return true

            const sourceIsRoot = sourceContainer.parentAttributeId === null
            const targetIsRoot = targetContainer.parentAttributeId === null

            if (sourceIsRoot || targetIsRoot) {
                return allowCrossListRootChildren
            }
            return allowCrossListBetweenChildren
        },
        [allowCrossListRootChildren, allowCrossListBetweenChildren]
    )

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveId(String(event.active.id))
    }, [])

    const handleDragOver = useCallback(
        (event: DragOverEvent) => {
            // For cross-container visual feedback
            const { active, over } = event
            if (!over) return

            const activeContainer = findContainer(String(active.id))
            const overContainer =
                findContainer(String(over.id)) ||
                containers.find((c) => c.id === String(over.id))

            if (!activeContainer || !overContainer) return
            if (activeContainer.id === overContainer.id) return

            // Check if cross-list is allowed
            if (!isCrossListAllowed(activeContainer, overContainer)) return

            setOverId(String(over.id))
        },
        [containers, findContainer, isCrossListAllowed]
    )

    const handleDragEnd = useCallback(
        async (event: DragEndEvent) => {
            const { active, over } = event
            setActiveId(null)
            setOverId(null)
            setOptimisticContainers(null)

            if (!over) return

            const activeContainer = findContainer(String(active.id))
            const overContainer =
                findContainer(String(over.id)) ||
                containers.find((c) => c.id === String(over.id))

            if (!activeContainer || !overContainer) return

            const attribute = findAttribute(String(active.id))
            if (!attribute) return

            if (activeContainer.id === overContainer.id) {
                // Same-list reorder
                const items = activeContainer.items
                const oldIndex = items.findIndex((i) => i.id === String(active.id))
                const overItem = items.findIndex((i) => i.id === String(over.id))

                if (oldIndex === -1 || overItem === -1 || oldIndex === overItem) return

                const newSortOrder = items[overItem].sortOrder ?? (overItem + 1)

                await onReorder(String(active.id), newSortOrder)
            } else {
                // Cross-list transfer
                if (!isCrossListAllowed(activeContainer, overContainer)) return

                // Validate transfer
                if (onValidateTransfer) {
                    const allowed = await onValidateTransfer(
                        attribute,
                        overContainer.parentAttributeId
                    )
                    if (!allowed) return
                }

                // Calculate new sort_order in target container
                const targetItems = overContainer.items
                const overIndex = targetItems.findIndex(
                    (i) => i.id === String(over.id)
                )
                const newSortOrder =
                    overIndex >= 0
                        ? (targetItems[overIndex].sortOrder ?? overIndex + 1)
                        : targetItems.length + 1

                await onReorder(
                    String(active.id),
                    newSortOrder,
                    overContainer.parentAttributeId
                )
            }
        },
        [
            containers,
            findContainer,
            findAttribute,
            isCrossListAllowed,
            onReorder,
            onValidateTransfer
        ]
    )

    const handleDragCancel = useCallback(() => {
        setActiveId(null)
        setOverId(null)
        setOptimisticContainers(null)
    }, [])

    const activeAttribute = activeId ? findAttribute(activeId) : undefined

    return {
        activeId,
        activeAttribute,
        overId,
        optimisticContainers,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel
    }
}
```

- [ ] **Step 6.4**: Create `AttributeDndProvider` wrapper

```tsx
// src/domains/attributes/ui/dnd/AttributeDndProvider.tsx
import React, { useMemo } from 'react'
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    useSensors,
    useSensor,
    closestCenter,
    MeasuringStrategy
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useAttributeDnd } from './useAttributeDnd'
import { DragOverlayRow } from './DragOverlayRow'
import type { Attribute } from '../../../../types'
// QA-F12: toAttributeDisplay exists at src/types.ts (line 681); import path ../../../../types is correct for src/domains/attributes/ui/dnd/
import { toAttributeDisplay } from '../../../../types'

interface AttributeDndProviderProps {
    children: React.ReactNode
    containers: Array<{
        id: string
        parentAttributeId: string | null
        items: Attribute[]
    }>
    allowCrossListRootChildren: boolean
    allowCrossListBetweenChildren: boolean
    onReorder: (
        attributeId: string,
        newSortOrder: number,
        newParentAttributeId?: string | null
    ) => Promise<void>
    onValidateTransfer?: (
        attribute: Attribute,
        targetParentId: string | null
    ) => Promise<boolean>
    uiLocale: string
    // QA-F2: No 'disabled' prop — DnD is always enabled per ТЗ
}

export const AttributeDndProvider: React.FC<AttributeDndProviderProps> = ({
    children,
    containers,
    allowCrossListRootChildren,
    allowCrossListBetweenChildren,
    onReorder,
    onValidateTransfer,
    uiLocale
}) => {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 } // Prevent accidental drags
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    )

    const {
        activeAttribute,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel
    } = useAttributeDnd({
        containers,
        allowCrossListRootChildren,
        allowCrossListBetweenChildren,
        onReorder,
        onValidateTransfer
    })

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            // QA-F7: Prevent validateDOMNesting warnings for <div> inside <table>
            accessibility={{ container: document.body }}
            measuring={{
                droppable: { strategy: MeasuringStrategy.Always }
            }}
        >
            {children}
            <DragOverlay dropAnimation={null}>
                {activeAttribute ? (
                    <DragOverlayRow
                        attribute={toAttributeDisplay(activeAttribute, uiLocale)}
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}
```

- [ ] **Step 6.5**: Create `SortableAttributeTableBody` component

This component replaces the direct use of `FlowListTable` in AttributeList when DnD is enabled. It renders the same column structure but each row is wrapped with `SortableAttributeRow`.

```tsx
// src/domains/attributes/ui/dnd/SortableAttributeTableBody.tsx
import React from 'react'
import {
    SortableContext,
    verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { Table, TableBody, TableHead, TableRow, TableCell } from '@mui/material'
import { SortableAttributeRow } from './SortableAttributeRow'
import type { AttributeDisplay, Attribute } from '../../../../types'
import type { TableColumn } from '@universo/template-mui'

interface SortableAttributeTableBodyProps {
    containerId: string
    items: Attribute[]
    displayItems: AttributeDisplay[]
    columns: TableColumn<AttributeDisplay>[]
    renderActions?: (row: AttributeDisplay) => React.ReactNode
    renderRowExpansion?: (row: AttributeDisplay, index: number) => React.ReactNode | null
    disabled?: boolean
}

export const SortableAttributeTableBody: React.FC<
    SortableAttributeTableBodyProps
> = ({
    containerId,
    items,
    displayItems,
    columns,
    renderActions,
    renderRowExpansion,
    disabled = false
}) => {
    const { setNodeRef } = useDroppable({ id: containerId })
    const itemIds = items.map((item) => item.id)

    return (
        <SortableContext
            items={itemIds}
            strategy={verticalListSortingStrategy}
        >
            <TableBody ref={setNodeRef}>
                {displayItems.map((row, index) => {
                    const expansionContent = renderRowExpansion
                        ? renderRowExpansion(row, index)
                        : null

                    return (
                        <React.Fragment key={row.id}>
                            <SortableAttributeRow
                                id={row.id}
                                disabled={disabled}
                                hasExpansion={Boolean(expansionContent)}
                            >
                                {columns.map((col) => (
                                    <TableCell
                                        key={col.id}
                                        align={col.align || 'left'}
                                    >
                                        {col.render?.(row, index)}
                                    </TableCell>
                                ))}
                                {renderActions && (
                                    <TableCell align="center">
                                        {renderActions(row)}
                                    </TableCell>
                                )}
                            </SortableAttributeRow>
                            {expansionContent && (
                                <TableRow>
                                    <TableCell
                                        colSpan={
                                            columns.length +
                                            (renderActions ? 1 : 0) +
                                            1 /* drag handle column */
                                        }
                                        sx={{ py: 0, px: 0 }}
                                    >
                                        {expansionContent}
                                    </TableCell>
                                </TableRow>
                            )}
                        </React.Fragment>
                    )
                })}
            </TableBody>
        </SortableContext>
    )
}
```

- [ ] **Step 6.6**: Create DnD index barrel file

```typescript
// src/domains/attributes/ui/dnd/index.ts
export { SortableAttributeRow } from './SortableAttributeRow'
export { DragOverlayRow } from './DragOverlayRow'
export { useAttributeDnd } from './useAttributeDnd'
export { AttributeDndProvider } from './AttributeDndProvider'
export { SortableAttributeTableBody } from './SortableAttributeTableBody'
```

---

### Phase 7: Frontend — Integrate DnD in AttributeList

- [ ] **Step 7.1**: Wrap AttributeList with `AttributeDndProvider`

In `AttributeList.tsx`:

1. Read new settings:
```typescript
// QA-F2: Only 2 settings per ТЗ (no allowDragReorder — DnD is always on)
const allowCrossListRootChildren = useSettingValue<boolean>('catalogs.allowAttributeMoveBetweenRootAndChildren') ?? true
const allowCrossListBetweenChildren = useSettingValue<boolean>('catalogs.allowAttributeMoveBetweenChildLists') ?? true
```

2. Build container list from root attributes + expanded child attributes:
```typescript
const dndContainers = useMemo(() => {
    const containers = [{
        id: 'root',
        parentAttributeId: null,
        items: attributes
    }]
    // Child containers added by ChildAttributeList via context
    return containers
}, [attributes])
```

3. Wrap the table area with `AttributeDndProvider`:
```tsx
{/* QA-F2: DnD is always enabled (no disabled prop) */}
<AttributeDndProvider
    containers={dndContainers}
    allowCrossListRootChildren={allowCrossListRootChildren}
    allowCrossListBetweenChildren={allowCrossListBetweenChildren}
    onReorder={handleReorder}
    onValidateTransfer={handleValidateTransfer}
    uiLocale={i18n.language}
>
    {/* Root attribute table using SortableAttributeTableBody */}
    {/* ... */}
</AttributeDndProvider>
```

4. Replace `<FlowListTable>` with MUI Table + `<SortableAttributeTableBody>` (DnD is always on, no fallback needed):

```tsx
{/* QA-F2: No conditional fallback to FlowListTable — DnD table is always used */}
<Table>
    <TableHead>{/* same columns as before + drag handle column */}</TableHead>
    <SortableAttributeTableBody
        containerId="root"
        items={attributes}
        displayItems={attributes.map(getAttributeTableData)}
        columns={attributeColumns}
        renderActions={renderActions}
        renderRowExpansion={renderRowExpansion}
    />
</Table>
```

- [ ] **Step 7.2**: Implement optimistic reorder handler

```typescript
const reorderMutation = useReorderAttribute()
const { confirm } = useConfirm()   // QA-F3: for codename conflict dialog

const handleReorder = useCallback(
    async (
        attributeId: string,
        newSortOrder: number,
        newParentAttributeId?: string | null
    ) => {
        if (!metahubId || !catalogId) return

        try {
            await reorderMutation.mutateAsync({
                metahubId,
                hubId: effectiveHubId,
                catalogId,
                attributeId,
                newSortOrder,
                newParentAttributeId
            })
        } catch (error: unknown) {
            // QA-F3: Handle CODENAME_CONFLICT (409) — offer auto-rename
            if (error instanceof Error && (error as any).response?.status === 409) {
                const conflictCodename = (error as any).response?.data?.codename
                const shouldAutoRename = await confirm({
                    title: t('attributes.dnd.codenameConflictTitle', 'Codename conflict'),
                    description: t(
                        'attributes.dnd.codenameConflictDescription',
                        'An attribute with codename "{{codename}}" already exists in the target list. Move with automatic codename rename?',
                        { codename: conflictCodename }
                    ),
                    confirmButtonName: t('attributes.dnd.confirmMove', 'Move'),
                    cancelButtonName: t('common:confirm.cancelButtonText', 'Cancel')
                })
                if (shouldAutoRename) {
                    try {
                        await reorderMutation.mutateAsync({
                            metahubId,
                            hubId: effectiveHubId,
                            catalogId,
                            attributeId,
                            newSortOrder,
                            newParentAttributeId,
                            autoRenameCodename: true
                        })
                    } catch (retryError: unknown) {
                        const msg = retryError instanceof Error ? retryError.message
                            : t('attributes.reorderError', 'Failed to reorder attribute')
                        enqueueSnackbar(msg, { variant: 'error' })
                    }
                }
                return
            }
            // Other errors — show generic snackbar
            const message = error instanceof Error ? error.message
                : t('attributes.reorderError', 'Failed to reorder attribute')
            enqueueSnackbar(message, { variant: 'error' })
        }
    },
    [metahubId, catalogId, effectiveHubId, reorderMutation, confirm, enqueueSnackbar, t]
)
```

- [ ] **Step 7.3**: Implement cross-list transfer validation (pre-drag checks)

```typescript
// QA-F4+F5: Only two specialized dialogs, no generic confirmation for cross-list moves
const handleValidateTransfer = useCallback(
    async (attribute: Attribute, targetParentId: string | null): Promise<boolean> => {
        // 1. QA-F4: Display attribute → show info dialog with OK button only
        if (attribute.isDisplayAttribute && targetParentId !== null) {
            await confirm({
                title: t('attributes.dnd.displayAttributeBlockedTitle', 'Cannot move display attribute'),
                description: t(
                    'attributes.dnd.displayAttributeBlockedDescription',
                    'This attribute is the display attribute for its list. Assign another attribute as the display attribute first, then try again.'
                ),
                confirmButtonName: t('common:ok', 'OK'),
                hideCancelButton: true   // QA-F4: only OK, no Cancel
            })
            return false
        }

        // 2. TABLE attributes can only exist at root level
        if (attribute.dataType === 'TABLE' && targetParentId !== null) {
            await confirm({
                title: t('attributes.dnd.tableCannotMoveTitle', 'Cannot move TABLE attribute'),
                description: t(
                    'attributes.dnd.tableCannotMoveDescription',
                    'TABLE attributes can only exist at the root level.'
                ),
                confirmButtonName: t('common:ok', 'OK'),
                hideCancelButton: true
            })
            return false
        }

        // QA-F5: No generic confirmation dialog — cross-list moves proceed immediately.
        // Codename conflicts are handled after the API call in handleReorder (F3).
        return true
    },
    [confirm, t]
)
```

---

### Phase 8: Frontend — Integrate DnD in ChildAttributeList

- [ ] **Step 8.1**: Similar pattern to AttributeList

ChildAttributeList registers itself as a DnD container via the parent's `AttributeDndProvider` context. Each child list gets its own `SortableContext` with `containerId = child-{parentAttributeId}`.

The `ChildAttributeList` component will:
1. Render its own `SortableAttributeTableBody` with `containerId={`child-${parentAttributeId}`}`
2. Report its items to the parent DnD context (for cross-container awareness)

Implementation detail: Use a shared React context (`AttributeDndContainerRegistry`) where child lists register/unregister their items. The parent `AttributeDndProvider` reads from this registry.

```tsx
// src/domains/attributes/ui/dnd/AttributeDndContainerRegistry.tsx
// QA-F9: Simplified — plain React Context + useState instead of useSyncExternalStore overhead
import React, { createContext, useContext, useCallback, useState } from 'react'
import type { Attribute } from '../../../../types'

interface ContainerEntry {
    id: string
    parentAttributeId: string | null
    items: Attribute[]
}

interface ContainerRegistryValue {
    containers: ContainerEntry[]
    register: (entry: ContainerEntry) => void
    unregister: (id: string) => void
}

const AttributeDndContainerRegistryContext = createContext<ContainerRegistryValue | null>(null)

export const AttributeDndContainerRegistryProvider: React.FC<{
    children: React.ReactNode
}> = ({ children }) => {
    const [containers, setContainers] = useState<ContainerEntry[]>([])

    const register = useCallback((entry: ContainerEntry) => {
        setContainers((prev) => {
            const filtered = prev.filter((c) => c.id !== entry.id)
            return [...filtered, entry]
        })
    }, [])

    const unregister = useCallback((id: string) => {
        setContainers((prev) => prev.filter((c) => c.id !== id))
    }, [])

    return (
        <AttributeDndContainerRegistryContext.Provider
            value={{ containers, register, unregister }}
        >
            {children}
        </AttributeDndContainerRegistryContext.Provider>
    )
}

export function useContainerRegistry() {
    const ctx = useContext(AttributeDndContainerRegistryContext)
    if (!ctx) throw new Error('useContainerRegistry must be inside AttributeDndContainerRegistryProvider')
    return ctx
}

export function useRegisteredContainers(): ContainerEntry[] {
    const { containers } = useContainerRegistry()
    return containers
}
```

---

### Phase 9: Frontend — DnD for Enumeration Values

- [ ] **Step 9.1**: Create simpler DnD components for enumeration values

Since enumeration values are a simple flat list with no cross-container logic, the implementation is straightforward:

```tsx
// src/domains/enumerations/ui/dnd/SortableValueRow.tsx
// Same pattern as SortableAttributeRow — wraps <StyledTableRow> with useSortable
// Uses CSS.Translate.toString(transform) for <tr> safety (QA-F6)
// Imports StyledTableCell, StyledTableRow from @universo/template-mui (QA-F10)
// Includes DragIndicatorIcon handle column
```

```tsx
// src/domains/enumerations/ui/dnd/DragOverlayValueRow.tsx
// Lightweight Paper overlay showing value name + codename during drag
// Similar minimal style as DragOverlayRow for attributes
```

```tsx
// src/domains/enumerations/ui/dnd/SortableEnumerationValueTable.tsx
// Wraps the values table body with SortableContext + DndContext
// Single-container only (no cross-container for enum values)
// Contains DndContext with accessibility={{ container: document.body }} (QA-F7)
// Contains DragOverlay with DragOverlayValueRow
// Sensors: PointerSensor { distance: 8 } + KeyboardSensor
```

- [ ] **Step 9.2**: Add API function and mutation

```typescript
// src/domains/enumerations/api/enumerationValues.ts — add:
export const reorderEnumerationValue = (
    metahubId: string,
    enumerationId: string,
    valueId: string,
    newSortOrder: number
) =>
    apiClient.patch<EnumerationValue>(
        `/metahub/${metahubId}/enumeration/${enumerationId}/values/reorder`,
        { valueId, newSortOrder }
    )
```

```typescript
// src/domains/enumerations/hooks/mutations.ts — add:
interface ReorderEnumerationValueParams {
    metahubId: string
    hubId?: string
    enumerationId: string
    valueId: string
    newSortOrder: number
}

export function useReorderEnumerationValue() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ metahubId, enumerationId, valueId, newSortOrder }: ReorderEnumerationValueParams) => {
            const response = await enumerationValuesApi.reorderEnumerationValue(
                metahubId, enumerationId, valueId, newSortOrder
            )
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.enumerationValues(variables.metahubId, variables.enumerationId)
            })
        }
    })
}
```

- [ ] **Step 9.3**: Integrate in `EnumerationValueList.tsx`

DnD is always enabled for enumeration values (no setting to disable it):

```tsx
// In EnumerationValueList.tsx:
const reorderMutation = useReorderEnumerationValue()

const handleReorder = useCallback(async (valueId: string, newSortOrder: number) => {
    if (!metahubId || !enumerationId) return
    try {
        await reorderMutation.mutateAsync({
            metahubId, enumerationId, valueId, newSortOrder
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t('enumerationValues.reorderError')
        enqueueSnackbar(message, { variant: 'error' })
    }
}, [metahubId, enumerationId, reorderMutation, enqueueSnackbar, t])

// Replace FlowListTable with SortableEnumerationValueTable
// Always on, no conditional rendering
```

---

### Phase 10: i18n Keys

- [ ] **Step 10.1**: Add all DnD-related i18n keys

```json
// EN additions
{
    "attributes.reorderSuccess": "Attribute order updated",
    "attributes.reorderError": "Failed to reorder attribute",
    "attributes.dnd.dragHandle": "Drag to reorder",

    "attributes.dnd.codenameConflictTitle": "Codename conflict",
    "attributes.dnd.codenameConflictDescription": "An attribute with codename \"{{codename}}\" already exists in the target list. Move with automatic codename rename?",
    "attributes.dnd.confirmMove": "Move",

    "attributes.dnd.displayAttributeBlockedTitle": "Cannot move display attribute",
    "attributes.dnd.displayAttributeBlockedDescription": "This attribute is the display attribute for its list. Assign another attribute as the display attribute first, then try again.",
    "attributes.dnd.tableCannotMoveTitle": "Cannot move TABLE attribute",
    "attributes.dnd.tableCannotMoveDescription": "TABLE attributes can only exist at the root level.",

    "attributes.dnd.transferBlocked": "This attribute cannot be moved to the selected list",

    "enumerationValues.reorderSuccess": "Value order updated",
    "enumerationValues.reorderError": "Failed to reorder value",
    "enumerationValues.dnd.dragHandle": "Drag to reorder"
}
```

```json
// RU additions
{
    "attributes.reorderSuccess": "Порядок атрибутов обновлён",
    "attributes.reorderError": "Не удалось изменить порядок атрибута",
    "attributes.dnd.dragHandle": "Перетащите для изменения порядка",

    "attributes.dnd.codenameConflictTitle": "Конфликт кодового имени",
    "attributes.dnd.codenameConflictDescription": "Атрибут с кодовым именем «{{codename}}» уже существует в целевом списке. Переместить с автоматическим переименованием?",
    "attributes.dnd.confirmMove": "Переместить",

    "attributes.dnd.displayAttributeBlockedTitle": "Нельзя переместить атрибут отображения",
    "attributes.dnd.displayAttributeBlockedDescription": "Этот атрибут является атрибутом отображения для своего списка. Сначала назначьте другой атрибут в качестве атрибута отображения, затем повторите попытку.",
    "attributes.dnd.tableCannotMoveTitle": "Нельзя переместить TABLE-атрибут",
    "attributes.dnd.tableCannotMoveDescription": "TABLE-атрибуты могут существовать только на корневом уровне.",

    "attributes.dnd.transferBlocked": "Этот атрибут нельзя переместить в выбранный список",

    "enumerationValues.reorderSuccess": "Порядок значений обновлён",
    "enumerationValues.reorderError": "Не удалось изменить порядок значения",
    "enumerationValues.dnd.dragHandle": "Перетащите для изменения порядка"
}
```

> **Note**: Keys `confirmTransferTitle`, `confirmTransferDescription`, `displayAttributeCannotMove`, `tableCannotNest` removed — replaced by the more specific dialog keys above (QA-F4/F5).

---

### Phase 11: Tests

- [ ] **Step 11.1**: Backend tests for reorder endpoints
  - Same-list reorder (move attribute from position 3 to position 1)
  - Cross-list transfer (root → child, child → root, child → child)
  - Codename conflict validation (per-level and global scope)
  - Display attribute transfer block
  - TABLE nesting block
  - Concurrent reorder safety (sequential sort_order normalization)

- [ ] **Step 11.2**: Frontend tests for DnD hooks
  - `useAttributeDnd` — same-list reorder events
  - `useAttributeDnd` — cross-list events with validation
  - Container registry — register/unregister lifecycle

- [ ] **Step 11.3**: Lint verification
  - `pnpm --filter @universo/metahubs-frontend lint`
  - `pnpm --filter @universo/metahubs-backend lint`

- [ ] **Step 11.4**: Full workspace build
  - `pnpm build`

---

## Potential Challenges

### C-1: FlowListTable Replacement Scope

Replacing `FlowListTable` with a DnD-aware table might regress features like sorting, loading skeletons, and row expansion. **Mitigation**: DnD is always enabled (no fallback to FlowListTable per QA-F2). Replicate only the column rendering in the DnD table — sorting/filtering is not used in attribute lists (they're sorted by `sortOrder` server-side). Loading skeletons and empty states should be handled before the DnD table renders.

### C-2: Pagination + DnD

Root attributes use `usePaginated`. DnD within a page works, but the `newSortOrder` must be computed correctly relative to the page offset. **Mitigation**: Compute `newSortOrder` as `pageOffset + dropIndex + 1` or use the `sortOrder` value of the item at the drop position. Backend handles the rest.

### C-3: Cross-Container DnD Complexity

@dnd-kit's multi-container requires `onDragOver` to detect cross-container movement and update state accordingly. If two containers are far apart on screen, visual feedback during drag can be confusing. **Mitigation**: Use `DragOverlay` for a floating preview, highlight valid drop targets, and show a warning indicator when hovering over disallowed containers.

### C-4: Codename Uniqueness on Cross-List Transfer

When moving an attribute to a new scope, its codename may conflict with existing attributes. **Mitigation**: Backend validates codename uniqueness and returns 409 CODENAME_CONFLICT with the conflicting codename. Frontend catches the 409, shows a ConfirmDialog offering auto-rename. On confirmation, retries with `autoRenameCodename: true`, and the backend uses `buildCodenameAttempt()` (up to 20 attempts) to generate a unique codename. No client-side pre-check needed.

### C-5: Child List Registration Lifecycle

ChildAttributeList mounts only when the TABLE row is expanded. When collapsed, it unmounts and unregisters from the DnD context. If a drag starts targeting a collapsed child list, it won't be available. **Mitigation**: Cross-container DnD only works with expanded (visible) child lists. Non-expanded lists are not valid drop targets.

### C-6: `useSortable` on `<tr>` Elements

Applying CSS transforms to `<tr>` elements can cause visual glitches in some browsers (table layout constraints). **Mitigation**: Use `CSS.Translate.toString()` (not `CSS.Transform.toString()`) from @dnd-kit/utilities — this avoids the `scale(1, 1)` that breaks table row width. Also add `accessibility={{ container: document.body }}` to DndContext to prevent validateDOMNesting warnings from the overlay `<div>` inside `<table>`.

---

## Implementation Order (Recommended)

```
Phase 1 → Phase 2 → Phase 3 → Phase 5 → Phase 6 → Phase 7 → Phase 11a (attribute tests)
                     Phase 4 → Phase 9 → Phase 11b (enum tests)
Phase 8 (cross-container) depends on Phase 7 completion  
Phase 10 (i18n) can be done in parallel throughout
Phase 11.3–11.4 (lint + build) at the end
```

**Milestone 1** (MVP): Single-list DnD for root attributes (Phases 1–3, 5–7 basics, 10 partial, 11 partial)
**Milestone 2**: Single-list DnD for child attributes + enumeration values (Phases 4, 8 partial, 9)
**Milestone 3**: Cross-container DnD for attributes (Phase 8 full, container registry)
**Milestone 4**: Final QA, full tests, lint, build (Phase 11)

---

## Dependencies

| Dependency | Type | Notes |
|-----------|------|-------|
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | npm (workspace catalog) | Already in workspace for spaces-frontend |
| `universo-types` settings update | Cross-package | Must be built before metahubs-frontend |
| `universo-template-mui` updates | Cross-package | `hideCancelButton` in ConfirmPayload + StyledTable exports; must be built before metahubs-frontend |
| Backend reorder endpoints | Backend deployment | Must be deployed before frontend can use new APIs |
| `FlowListTable` key fix | Shared component | Should be done first as independent improvement |

---

## Appendix: Reference Implementations

### CanvasTabs.jsx (@dnd-kit in this project)

Location: `packages/spaces-frontend/base/src/components/CanvasTabs.jsx`

Key patterns to follow:
- `PointerSensor` with `distance: 8` activation constraint
- `KeyboardSensor` for accessibility
- Optimistic state (`optimisticCanvases` / `pendingReorder`)
- `DragOverlay` with `dropAnimation={null}` for instant visual
- Revert-on-error with `enqueueSnackbar`

### Current moveAttribute API

Location: `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubAttributesService.ts`

Key patterns:
- `_ensureSequentialSortOrder()` — normalizes gaps before any reorder
- Transaction wrapping for atomic operations
- Parent scope filtering (`parent_attribute_id IS NULL` vs specific parent)

### ConfirmDialog / useConfirm

Location: `packages/universo-template-mui/base/src/components/dialogs/ConfirmDialog.tsx`

Usage pattern:
```typescript
const { confirm } = useConfirm()
const result = await confirm({ title, description, confirmButtonName })
if (result) { /* proceed */ }
```
