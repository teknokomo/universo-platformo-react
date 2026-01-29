# Optimistic Locking Rollout Plan

## Overview

Распространение паттерна оптимистической блокировки (Optimistic Locking) на все сущности в Metahubs и Applications доменах. Паттерн уже полностью реализован для Metahub сущности и требует расширения на остальные.

## Current Implementation Status

### Backend - Version Check Logic

| Entity | Version Check | Email Lookup | Status |
|--------|--------------|--------------|--------|
| Metahub | ✅ | ✅ | COMPLETE |
| Branch | ✅ | ❌ | PARTIAL |
| Publication | ✅ | ❌ | PARTIAL |
| Hub | ✅ | ❌ | PARTIAL |
| Catalog | ✅ | ❌ | PARTIAL |
| Attribute | ✅ | ❌ | PARTIAL |
| Element | ✅ | ❌ | PARTIAL |
| Connector | ✅ | ❌ | PARTIAL |
| Application | ❌ | ❌ | MISSING |

### Frontend - expectedVersion & ConflictDialog

| Entity | API expectedVersion | Mutation expectedVersion | ConflictDialog | Status |
|--------|---------------------|-------------------------|----------------|--------|
| Metahub | ✅ | ✅ | ✅ | COMPLETE |
| Branch | ❌ | ❌ | ❌ | MISSING |
| Publication | ❌ | ❌ | ❌ | MISSING |
| Hub | ❌ | ❌ | ❌ | MISSING |
| Catalog | ❌ | ❌ | ❌ | MISSING |
| Attribute | ✅ | ❌ | ❌ | PARTIAL |
| Element | ✅ | ❌ | ❌ | PARTIAL |
| Connector | ❌ | ❌ | ❌ | MISSING |
| Application | ❌ | ❌ | ❌ | MISSING |

## Affected Areas

### Backend Files
- `packages/metahubs-backend/base/src/domains/branches/routes/branchesRoutes.ts`
- `packages/metahubs-backend/base/src/domains/publications/routes/publicationsRoutes.ts`
- `packages/metahubs-backend/base/src/domains/hubs/routes/hubsRoutes.ts`
- `packages/metahubs-backend/base/src/domains/catalogs/routes/catalogsRoutes.ts`
- `packages/metahubs-backend/base/src/domains/attributes/routes/attributesRoutes.ts`
- `packages/metahubs-backend/base/src/domains/elements/routes/elementsRoutes.ts`
- `packages/applications-backend/base/src/routes/applicationsRoutes.ts`
- `packages/applications-backend/base/src/routes/connectorsRoutes.ts`

### Frontend Files
- `packages/metahubs-frontend/base/src/domains/branches/hooks/mutations.ts`
- `packages/metahubs-frontend/base/src/domains/branches/api/branches.ts`
- `packages/metahubs-frontend/base/src/domains/publications/hooks/mutations.ts`
- `packages/metahubs-frontend/base/src/domains/publications/api/publications.ts`
- `packages/metahubs-frontend/base/src/domains/hubs/hooks/mutations.ts`
- `packages/metahubs-frontend/base/src/domains/hubs/api/hubs.ts`
- `packages/metahubs-frontend/base/src/domains/catalogs/hooks/mutations.ts`
- `packages/metahubs-frontend/base/src/domains/catalogs/api/catalogs.ts`
- `packages/metahubs-frontend/base/src/domains/attributes/hooks/mutations.ts`
- `packages/metahubs-frontend/base/src/domains/elements/hooks/mutations.ts`
- `packages/applications-frontend/base/src/api/applications.ts`
- `packages/applications-frontend/base/src/api/connectors.ts`
- Various UI List/Edit components

## Plan Steps

### Phase 1: Backend Email Lookup Enhancement (7 entities)

Add email lookup to all entities that already have version check but missing email in conflict response.

- [ ] **1.1** Branch - Add email lookup in `branchesRoutes.ts` PATCH handler
- [ ] **1.2** Publication - Add email lookup in `publicationsRoutes.ts` PATCH handler
- [ ] **1.3** Hub - Add email lookup in `hubsRoutes.ts` PATCH handler (via OptimisticLockError enhancement)
- [ ] **1.4** Catalog - Add email lookup in `catalogsRoutes.ts` PATCH handlers (2 routes)
- [ ] **1.5** Attribute - Add email lookup in `attributesRoutes.ts` PATCH handler
- [ ] **1.6** Element - Add email lookup in `elementsRoutes.ts` PATCH handler
- [ ] **1.7** Connector - Add email lookup in `connectorsRoutes.ts` PATCH handler

**Pattern to follow (from metahubsRoutes.ts):**
```typescript
// After catching OptimisticLockError or version mismatch:
let updatedByEmail: string | null = null
if (entity._uplUpdatedBy) {
    try {
        const authUserResult = await ds.query(
            'SELECT email FROM auth.users WHERE id = $1',
            [entity._uplUpdatedBy]
        )
        if (authUserResult?.[0]?.email) {
            updatedByEmail = authUserResult[0].email
        }
    } catch {
        // Ignore errors fetching email
    }
}

return res.status(409).json({
    error: 'Conflict: entity was modified by another user',
    code: 'OPTIMISTIC_LOCK_CONFLICT',
    conflict: {
        entityId,
        entityType: 'hub', // or appropriate type
        expectedVersion,
        actualVersion: currentVersion,
        updatedAt: entity._uplUpdatedAt,
        updatedBy: entity._uplUpdatedBy ?? null,
        updatedByEmail
    }
})
```

### Phase 2: Backend Application Implementation

- [ ] **2.1** Add `expectedVersion` to Application update Zod schema
- [ ] **2.2** Add version check logic before save
- [ ] **2.3** Add email lookup for conflict response
- [ ] **2.4** Return 409 with full ConflictInfo

### Phase 3: Frontend API Layer Updates

Update API functions to include expectedVersion parameter.

- [ ] **3.1** `branches/api/branches.ts` - Add expectedVersion to updateBranch
- [ ] **3.2** `publications/api/publications.ts` - Add expectedVersion to updatePublication
- [ ] **3.3** `hubs/api/hubs.ts` - Add expectedVersion to updateHub
- [ ] **3.4** `catalogs/api/catalogs.ts` - Add expectedVersion to updateCatalog, updateCatalogAtMetahub
- [ ] **3.5** `applications-frontend/api/applications.ts` - Add expectedVersion to updateApplication
- [ ] **3.6** `applications-frontend/api/connectors.ts` - Add expectedVersion to updateConnector

### Phase 4: Frontend Mutation Hooks Updates

Update mutation hooks to accept and pass expectedVersion.

- [ ] **4.1** `branches/hooks/mutations.ts` - Update useUpdateBranch with expectedVersion
- [ ] **4.2** `publications/hooks/mutations.ts` - Update useUpdatePublication with expectedVersion
- [ ] **4.3** `hubs/hooks/mutations.ts` - Update useUpdateHub with expectedVersion
- [ ] **4.4** `catalogs/hooks/mutations.ts` - Update useUpdateCatalog, useUpdateCatalogAtMetahub with expectedVersion
- [ ] **4.5** `attributes/hooks/mutations.ts` - Update useUpdateAttribute with expectedVersion
- [ ] **4.6** `elements/hooks/mutations.ts` - Update useUpdateElement with expectedVersion
- [ ] **4.7** `applications-frontend` - Create/update mutations with expectedVersion

### Phase 5: Frontend UI Integration

Add ConflictResolutionDialog and 409 handling to edit components.

**For each entity, the pattern is:**
1. Import ConflictResolutionDialog from @universo/template-mui
2. Add conflictState useState
3. Wrap update call in try/catch checking for 409 + OPTIMISTIC_LOCK_CONFLICT
4. Show dialog on conflict
5. Handle overwrite (force update without version) and cancel

- [ ] **5.1** BranchList/BranchEditDialog - Add conflict dialog
- [ ] **5.2** PublicationList/VersionsPanel - Add conflict dialog
- [ ] **5.3** HubList/HubEditDialog - Add conflict dialog
- [ ] **5.4** CatalogList/CatalogEditDialog - Add conflict dialog
- [ ] **5.5** AttributeList/AttributeEditDialog - Add conflict dialog
- [ ] **5.6** ElementList/ElementEditDialog - Add conflict dialog
- [ ] **5.7** ApplicationList/ApplicationEditDialog - Add conflict dialog
- [ ] **5.8** ConnectorBoard/ConnectorEditDialog - Add conflict dialog

### Phase 6: Build & Verification

- [ ] **6.1** Run `pnpm --filter @universo/metahubs-backend build`
- [ ] **6.2** Run `pnpm --filter @universo/applications-backend build`
- [ ] **6.3** Run `pnpm --filter @universo/metahubs-frontend build`
- [ ] **6.4** Run `pnpm --filter @universo/applications-frontend build`
- [ ] **6.5** Run `pnpm --filter @universo/template-mui build`
- [ ] **6.6** Full workspace build verification

### Phase 7: Documentation

- [ ] **7.1** Update memory-bank/progress.md with implementation summary
- [ ] **7.2** Update memory-bank/systemPatterns.md with optimistic locking pattern
- [ ] **7.3** Update memory-bank/tasks.md - mark completed

## Potential Challenges

1. **OptimisticLockError class** - Currently used in some routes. Need to enhance it to include email lookup or handle email lookup at route level.

2. **Multiple update routes per entity** - Catalog has 2 PATCH routes (with/without hubId). Both need updating.

3. **Attribute/Element direct routes** - These have hub-less variants that also need updating.

4. **UI component architecture** - Some entities use BaseEntityMenu with actions, others use direct dialogs. Pattern may vary.

5. **Entity map access** - Need access to entity version from UI list data to pass expectedVersion.

## Design Notes

The ConflictResolutionDialog already exists and works. UI integration follows the MetahubList pattern:

```typescript
// State for conflict resolution
const [conflictState, setConflictState] = useState<{
    open: boolean
    conflict: ConflictInfo | null
    pendingUpdate: { id: string; patch: PayloadType } | null
}>({ open: false, conflict: null, pendingUpdate: null })

// In update handler:
try {
    await updateMutation.mutateAsync({ id, data: patch, expectedVersion })
} catch (error: any) {
    if (error?.response?.status === 409 && error?.response?.data?.code === 'OPTIMISTIC_LOCK_CONFLICT') {
        const conflict = error.response.data.conflict as ConflictInfo
        setConflictState({ open: true, conflict, pendingUpdate: { id, patch } })
        return
    }
    throw error
}

// Dialog component:
<ConflictResolutionDialog
    open={conflictState.open}
    conflict={conflictState.conflict}
    onCancel={() => {
        setConflictState({ open: false, conflict: null, pendingUpdate: null })
        queryClient.invalidateQueries({ queryKey: queryKeys.lists() })
    }}
    onOverwrite={async () => {
        if (conflictState.pendingUpdate) {
            const { id, patch } = conflictState.pendingUpdate
            await updateMutation.mutateAsync({ id, data: patch }) // No expectedVersion = force
            setConflictState({ open: false, conflict: null, pendingUpdate: null })
        }
    }}
/>
```

## Dependencies

- ConflictInfo type from @universo/utils
- ConflictResolutionDialog from @universo/template-mui
- i18n keys for conflict dialog already exist in common namespace

## Estimated Scope

- **Backend changes**: 9 route files, ~20 code blocks
- **Frontend API**: 6 API files, ~10 function signatures
- **Frontend mutations**: 7 mutation files, ~10 hooks
- **Frontend UI**: 8 components, significant integration work
- **Complexity Level**: 3 (moderate, repetitive pattern application)
