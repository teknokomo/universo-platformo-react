# Optimistic Locking Frontend Rollout Plan

## Overview

Полное внедрение UI интеграции оптимистической блокировки во все сущности Metahubs и Applications. Backend уже полностью реализован для всех 9 сущностей. Требуется добавить ConflictResolutionDialog во все UI компоненты редактирования.

## Current Implementation Status

### Backend (100% Complete) ✅
| Entity | expectedVersion | Version Check | Email Lookup | 409 Response |
|--------|----------------|---------------|--------------|--------------|
| Metahub | ✅ | ✅ | ✅ | ✅ |
| Branch | ✅ | ✅ | ✅ | ✅ |
| Publication | ✅ | ✅ | ✅ | ✅ |
| Hub | ✅ | ✅ | ✅ | ✅ |
| Catalog | ✅ | ✅ | ✅ | ✅ |
| Attribute | ✅ | ✅ | ✅ | ✅ |
| Element | ✅ | ✅ | ✅ | ✅ |
| Application | ✅ | ✅ | ✅ | ✅ |
| Connector | ✅ | ✅ | ✅ | ✅ |

### Frontend UI Integration Status
| Entity | Component | ConflictDialog | expectedVersion | 409 Handling | Status |
|--------|-----------|----------------|-----------------|--------------|--------|
| Metahub | MetahubList.tsx | ✅ | ✅ | ✅ | COMPLETE |
| Catalog | CatalogList.tsx | ✅ | ✅ | ✅ | COMPLETE |
| Branch | BranchList.tsx | ❌ | ❌ | ❌ | NONE |
| Publication | PublicationList.tsx | ❌ | ❌ | ❌ | NONE |
| Publication | VersionsPanel.tsx | ❌ | ❌ | ❌ | NONE |
| Hub | HubList.tsx | ❌ | ❌ | ❌ | NONE |
| Attribute | AttributeList.tsx | ❌ | ❌ | ❌ | NONE |
| Element | ElementList.tsx | ❌ | ❌ | ❌ | NONE |
| Application | ApplicationList.tsx | ❌ | ❌ | ❌ | NONE |
| Connector | ConnectorBoard.tsx | N/A | N/A | N/A | READ-ONLY |

## Affected Files

### Metahubs Frontend (6 files)
- `packages/metahubs-frontend/base/src/domains/branches/ui/BranchList.tsx`
- `packages/metahubs-frontend/base/src/domains/publications/ui/PublicationList.tsx`
- `packages/metahubs-frontend/base/src/domains/publications/ui/VersionsPanel.tsx`
- `packages/metahubs-frontend/base/src/domains/hubs/ui/HubList.tsx`
- `packages/metahubs-frontend/base/src/domains/attributes/ui/AttributeList.tsx`
- `packages/metahubs-frontend/base/src/domains/elements/ui/ElementList.tsx`

### Applications Frontend (1 file)
- `packages/applications-frontend/base/src/pages/ApplicationList.tsx`

### Shared Utilities (move to universo-utils)
- Current: `packages/metahubs-frontend/base/src/utils/conflictDetection.ts`
- Target: `packages/universo-utils/base/src/errors/conflictDetection.ts`

## Plan Steps

### Phase 1: Centralize Conflict Detection Utilities

- [ ] **1.1** Move `conflictDetection.ts` to `@universo/utils`
  - Create `packages/universo-utils/base/src/errors/conflictDetection.ts`
  - Add `updatedByEmail` to `extractConflictInfo()` return type
  - Export from `packages/universo-utils/base/src/errors/index.ts`
  - Export from main `packages/universo-utils/base/src/index.ts`

- [ ] **1.2** Update CatalogList.tsx import
  - Change from local utils to `@universo/utils`

- [ ] **1.3** Build and verify `@universo/utils`

### Phase 2: Create Reusable Hook (Optional Enhancement)

- [ ] **2.1** Create `useOptimisticLockHandler` hook
  - File: `packages/universo-template-mui/base/src/hooks/useOptimisticLockHandler.ts`
  - Encapsulates conflictState, error detection, dialog rendering
  - Reduces boilerplate in each component

### Phase 3: Metahubs UI Components

For each component, apply the standard pattern:

#### Pattern to Apply:
```typescript
// 1. Imports
import { ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import { isOptimisticLockConflict, extractConflictInfo } from '@universo/utils'
import type { ConflictInfo } from '@universo/utils'

// 2. State (inside component)
const [conflictState, setConflictState] = useState<{
    open: boolean
    conflict: ConflictInfo | null
    pendingUpdate: { id: string; patch: PayloadType } | null
}>({ open: false, conflict: null, pendingUpdate: null })

// 3. In update handler - get expectedVersion from entity map
const entity = entityMap.get(id)
const expectedVersion = entity?.version

// 4. In mutation call - pass expectedVersion
await updateMutation.mutateAsync({ id, data: patch, expectedVersion })

// 5. In catch block - detect conflict
catch (error: unknown) {
    if (isOptimisticLockConflict(error)) {
        const conflict = extractConflictInfo(error)
        if (conflict) {
            setConflictState({ open: true, conflict, pendingUpdate: { id, patch } })
            return
        }
    }
    throw error
}

// 6. Render dialog
<ConflictResolutionDialog
    open={conflictState.open}
    conflict={conflictState.conflict}
    onCancel={() => {
        setConflictState({ open: false, conflict: null, pendingUpdate: null })
        queryClient.invalidateQueries({ queryKey: [...] })
    }}
    onOverwrite={async () => {
        if (conflictState.pendingUpdate) {
            const { id, patch } = conflictState.pendingUpdate
            await updateMutation.mutateAsync({ id, data: patch }) // No expectedVersion = force
            setConflictState({ open: false, conflict: null, pendingUpdate: null })
        }
    }}
    isLoading={updateMutation.isPending}
/>
```

- [ ] **3.1** BranchList.tsx - Add conflict handling
- [ ] **3.2** PublicationList.tsx - Add conflict handling
- [ ] **3.3** VersionsPanel.tsx - Add conflict handling (if has update)
- [ ] **3.4** HubList.tsx - Add conflict handling
- [ ] **3.5** AttributeList.tsx - Add conflict handling
- [ ] **3.6** ElementList.tsx - Add conflict handling

### Phase 4: Applications UI Components

- [ ] **4.1** ApplicationList.tsx - Add conflict handling
  - Import ConflictResolutionDialog
  - Add conflictState
  - Pass expectedVersion to updateApplication mutation
  - Handle 409 with dialog

### Phase 5: Mutation Hooks Updates

Update mutation hooks to properly pass expectedVersion:

- [ ] **5.1** `branches/hooks/mutations.ts` - Add expectedVersion to UpdateBranchParams
- [ ] **5.2** `publications/hooks/mutations.ts` - Add expectedVersion to UpdatePublicationParams
- [ ] **5.3** `hubs/hooks/mutations.ts` - Add expectedVersion to UpdateHubParams
- [ ] **5.4** `attributes/hooks/mutations.ts` - Add expectedVersion to UpdateAttributeParams
- [ ] **5.5** `elements/hooks/mutations.ts` - Add expectedVersion to UpdateElementParams
- [ ] **5.6** Applications mutations (if separate file exists)

### Phase 6: Build & Verification

- [ ] **6.1** Build `@universo/utils`
- [ ] **6.2** Build `@universo/template-mui`
- [ ] **6.3** Build `@universo/metahubs-frontend`
- [ ] **6.4** Build `@universo/applications-frontend`
- [ ] **6.5** Full workspace build verification

### Phase 7: Documentation

- [ ] **7.1** Update memory-bank/progress.md
- [ ] **7.2** Update memory-bank/systemPatterns.md with frontend pattern

## Design Notes

### ConflictResolutionDialog Props
```typescript
interface ConflictResolutionDialogProps {
    open: boolean
    conflict: ConflictInfo | null
    onOverwrite: () => void
    onCancel: () => void
    isLoading?: boolean
}
```

### ConflictInfo Type (from @universo/utils)
```typescript
interface ConflictInfo {
    entityId: string
    entityType: 'metahub' | 'branch' | 'publication' | 'hub' | 'catalog' | 'attribute' | 'element' | 'application' | 'connector'
    expectedVersion: number
    actualVersion: number
    updatedAt: Date
    updatedBy: string | null
    updatedByEmail?: string | null
}
```

## Potential Challenges

1. **Entity Map Access**: Each component stores entities differently (array vs Map). Need to find entity by ID to get current version.

2. **Mutation Structure**: Some mutations may not have separate params interface. Need to add `expectedVersion` to each.

3. **Dialog Rendering Location**: Dialog should be at component root level, not inside loops or conditionals.

4. **Query Invalidation**: On cancel, need to refresh data to get latest version.

5. **Loading State**: Dialog should show loading spinner during overwrite operation.

## Dependencies

- `@universo/utils` - ConflictInfo type, conflict detection utilities
- `@universo/template-mui` - ConflictResolutionDialog component
- TanStack Query - mutation hooks, query invalidation

## Estimated Scope

- **Phase 1**: 3 files, ~1 hour
- **Phase 2**: 1 file (optional), ~30 min
- **Phase 3**: 6 files, ~2 hours
- **Phase 4**: 1 file, ~30 min
- **Phase 5**: 6 files, ~1 hour
- **Phase 6**: Verification, ~30 min
- **Phase 7**: Documentation, ~15 min

**Total**: ~6-7 hours of focused implementation

## Complexity Level: 3 (Moderate)

Repetitive pattern application across multiple components with consistent structure.
