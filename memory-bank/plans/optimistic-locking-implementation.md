# Optimistic Locking Implementation Plan

## Problem Statement

The `_upl_version` field in Metahub dynamic schemas (`_mhb_objects`, `_mhb_attributes`, `_mhb_elements`) is never incremented during updates. All services use raw Knex queries instead of TypeORM entities, so there's no automatic version management.

**Current behavior:**
- `_upl_version` is always `1` even after multiple updates
- No conflict detection when multiple users edit the same entity
- Users can unknowingly overwrite each other's changes

**Expected behavior:**
- `_upl_version` increments on every save
- Before saving, the system checks if the version matches
- If version mismatch detected, user sees a conflict resolution dialog

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Edit Dialog                                                         │
│  ┌─────────────────┐    ┌──────────────────────────────────────┐   │
│  │ Form State      │    │ ConflictResolutionDialog             │   │
│  │ - data          │    │ - Shows who updated and when         │   │
│  │ - _uplVersion   │◄───│ - "Overwrite" or "Reload" options    │   │
│  └─────────────────┘    └──────────────────────────────────────┘   │
│         │                          ▲                                 │
│         ▼                          │ 409 Conflict                    │
│  ┌─────────────────┐               │                                 │
│  │ API Request     │───────────────┤                                 │
│  │ PATCH /entity   │               │                                 │
│  │ + _uplVersion   │               │                                 │
│  └─────────────────┘               │                                 │
├─────────────────────────────────────────────────────────────────────┤
│                         BACKEND                                      │
├─────────────────────────────────────────────────────────────────────┤
│  Route Handler                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. Validate input (Zod schema with _uplVersion)             │   │
│  │ 2. Call service.update() with expectedVersion               │   │
│  │ 3. Handle OptimisticLockError → 409 Conflict response       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│         │                                                            │
│         ▼                                                            │
│  Service Layer (MetahubObjectsService, etc.)                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. Start transaction                                        │   │
│  │ 2. SELECT ... WHERE id = ? FOR UPDATE                       │   │
│  │ 3. Check _upl_version == expectedVersion                    │   │
│  │ 4. If mismatch → throw OptimisticLockError with conflict info│   │
│  │ 5. UPDATE ... SET _upl_version = _upl_version + 1           │   │
│  │ 6. RETURNING * (includes new version)                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Backend - Core Optimistic Locking Logic

#### Step 1.1: Create OptimisticLockError in universo-utils

**File:** `packages/universo-utils/base/src/errors/OptimisticLockError.ts`

```typescript
export interface ConflictInfo {
    entityId: string
    entityType: 'catalog' | 'hub' | 'attribute' | 'element'
    expectedVersion: number
    actualVersion: number
    updatedAt: Date
    updatedBy: string | null
}

export class OptimisticLockError extends Error {
    public readonly code = 'OPTIMISTIC_LOCK_CONFLICT'
    public readonly conflict: ConflictInfo

    constructor(conflict: ConflictInfo) {
        super(`Conflict: entity was modified by another user`)
        this.name = 'OptimisticLockError'
        this.conflict = conflict
    }
}
```

**File:** `packages/universo-utils/base/src/errors/index.ts`
```typescript
export * from './OptimisticLockError'
```

**File:** `packages/universo-utils/base/src/index.ts`
```typescript
export * from './errors'
```

#### Step 1.2: Create Version-Aware Update Helper

**File:** `packages/metahubs-backend/base/src/utils/optimisticLock.ts`

```typescript
import type { Knex } from 'knex'
import { OptimisticLockError, ConflictInfo } from '@universo/utils'

export interface VersionedUpdateOptions {
    knex: Knex
    schemaName: string
    tableName: string
    entityId: string
    entityType: ConflictInfo['entityType']
    expectedVersion: number
    updateData: Record<string, unknown>
}

/**
 * Performs a version-checked update with optimistic locking.
 *
 * 1. Acquires row-level lock (FOR UPDATE)
 * 2. Checks version matches expected
 * 3. Increments version and applies update
 * 4. Returns updated row or throws OptimisticLockError
 */
export async function updateWithVersionCheck(
    options: VersionedUpdateOptions
): Promise<Record<string, unknown>> {
    const { knex, schemaName, tableName, entityId, entityType, expectedVersion, updateData } = options

    return knex.transaction(async (trx) => {
        // 1. Lock row and fetch current state
        const current = await trx
            .withSchema(schemaName)
            .from(tableName)
            .where({ id: entityId })
            .forUpdate()
            .first()

        if (!current) {
            throw new Error(`${entityType} not found`)
        }

        const actualVersion = current._upl_version as number

        // 2. Check version
        if (actualVersion !== expectedVersion) {
            const conflict: ConflictInfo = {
                entityId,
                entityType,
                expectedVersion,
                actualVersion,
                updatedAt: current._upl_updated_at,
                updatedBy: current._upl_updated_by
            }
            throw new OptimisticLockError(conflict)
        }

        // 3. Apply update with version increment
        const [updated] = await trx
            .withSchema(schemaName)
            .from(tableName)
            .where({ id: entityId })
            .update({
                ...updateData,
                _upl_version: actualVersion + 1
            })
            .returning('*')

        return updated
    })
}

/**
 * Simple version increment without check (for internal operations).
 */
export async function incrementVersion(
    knex: Knex,
    schemaName: string,
    tableName: string,
    entityId: string,
    updateData: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const [updated] = await knex
        .withSchema(schemaName)
        .from(tableName)
        .where({ id: entityId })
        .update({
            ...updateData,
            _upl_version: knex.raw('_upl_version + 1')
        })
        .returning('*')

    return updated
}
```

#### Step 1.3: Update MetahubObjectsService (Catalogs)

**File:** `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubObjectsService.ts`

Changes:
1. Add `_uplVersion` to response mapping
2. Add `expectedVersion` parameter to `updateCatalog`
3. Use `updateWithVersionCheck` for version-checked updates
4. Use `incrementVersion` for internal operations (like setting table_name)

```typescript
// Add to imports
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'

// Update mapRowToResponse (add to all mapping methods)
private mapObjectToResponse(row: any) {
    return {
        id: row.id,
        codename: row.codename,
        tableName: row.table_name,
        presentation: row.presentation,
        config: row.config,
        _uplVersion: row._upl_version,  // ADD THIS
        _uplCreatedAt: row._upl_created_at,
        _uplCreatedBy: row._upl_created_by,
        _uplUpdatedAt: row._upl_updated_at,
        _uplUpdatedBy: row._upl_updated_by
    }
}

// Update updateCatalog signature
async updateCatalog(metahubId: string, id: string, input: {
    codename?: string
    name?: any
    description?: any
    config?: any
    updatedBy?: string | null
    expectedVersion?: number  // ADD THIS - optional for backwards compatibility
}, userId?: string) {
    const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

    // Build update data (existing logic)
    const updateData: any = {
        _upl_updated_at: new Date(),
        _upl_updated_by: input.updatedBy ?? null
    }
    // ... rest of existing field updates ...

    // If expectedVersion provided, use version-checked update
    if (input.expectedVersion !== undefined) {
        const updated = await updateWithVersionCheck({
            knex: this.knex,
            schemaName,
            tableName: '_mhb_objects',
            entityId: id,
            entityType: 'catalog',
            expectedVersion: input.expectedVersion,
            updateData
        })
        return this.mapObjectToResponse(updated)
    }

    // Fallback: increment version without check (backwards compat)
    const updated = await incrementVersion(
        this.knex,
        schemaName,
        '_mhb_objects',
        id,
        updateData
    )
    return this.mapObjectToResponse(updated)
}
```

#### Step 1.4: Update MetahubAttributesService

Similar changes to MetahubObjectsService:
1. Add `_uplVersion` to response mapping in `mapRowToAttribute`
2. Add `expectedVersion` parameter to `update` method
3. Use version-checked update when version provided

#### Step 1.5: Update MetahubElementsService

Similar changes:
1. Add `_uplVersion` to response mapping in `mapRowToElement`
2. Add `expectedVersion` parameter to `update` method
3. Use version-checked update when version provided

#### Step 1.6: Update MetahubHubsService

Similar changes:
1. Add `_uplVersion` to response mapping in `mapHubFromObject`
2. Add `expectedVersion` parameter to `update` method
3. Use version-checked update when version provided

### Phase 2: Backend - Route Updates

#### Step 2.1: Update Route Handlers to Accept Version

**Files to update:**
- `packages/metahubs-backend/base/src/domains/catalogs/routes/catalogsRoutes.ts`
- `packages/metahubs-backend/base/src/domains/attributes/routes/attributesRoutes.ts`
- `packages/metahubs-backend/base/src/domains/elements/routes/elementsRoutes.ts`
- `packages/metahubs-backend/base/src/domains/hubs/routes/hubsRoutes.ts`

**Pattern for each PATCH/PUT route:**

```typescript
// Update Zod schema to include version
const updateSchema = z.object({
    // ... existing fields ...
    _uplVersion: z.number().int().positive().optional()
})

// In route handler
const { _uplVersion, ...updateData } = parsed.data

try {
    const result = await service.update(metahubId, entityId, {
        ...updateData,
        expectedVersion: _uplVersion,
        updatedBy: userId
    }, userId)
    return res.json(result)
} catch (error) {
    if (error instanceof OptimisticLockError) {
        return res.status(409).json({
            error: 'Conflict',
            code: 'OPTIMISTIC_LOCK_CONFLICT',
            conflict: error.conflict
        })
    }
    throw error
}
```

#### Step 2.2: Add User Info Resolution for Conflict Response

When returning conflict info, resolve `updatedBy` UUID to user details:

```typescript
// In route handler, before returning 409
if (error instanceof OptimisticLockError) {
    let updatedByInfo = null
    if (error.conflict.updatedBy) {
        const authUserRepo = ds.getRepository(AuthUser)
        const profileRepo = ds.getRepository(Profile)
        const [user, profile] = await Promise.all([
            authUserRepo.findOne({ where: { id: error.conflict.updatedBy } }),
            profileRepo.findOne({ where: { user_id: error.conflict.updatedBy } })
        ])
        updatedByInfo = {
            id: error.conflict.updatedBy,
            email: user?.email ?? null,
            nickname: profile?.nickname ?? null
        }
    }

    return res.status(409).json({
        error: 'Conflict',
        code: 'OPTIMISTIC_LOCK_CONFLICT',
        conflict: {
            ...error.conflict,
            updatedByInfo
        }
    })
}
```

### Phase 3: Frontend - API Updates

#### Step 3.1: Update API Response Types

**File:** `packages/metahubs-frontend/base/src/types/index.ts` (or appropriate location)

```typescript
export interface CatalogResponse {
    id: string
    codename: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
    _uplVersion: number
    _uplCreatedAt: string
    _uplUpdatedAt: string
    // ... other fields
}

export interface ConflictInfo {
    entityId: string
    entityType: 'catalog' | 'hub' | 'attribute' | 'element'
    expectedVersion: number
    actualVersion: number
    updatedAt: string
    updatedByInfo: {
        id: string
        email: string | null
        nickname: string | null
    } | null
}

export interface ConflictResponse {
    error: 'Conflict'
    code: 'OPTIMISTIC_LOCK_CONFLICT'
    conflict: ConflictInfo
}
```

#### Step 3.2: Update API Client Methods

**Pattern for update methods:**

```typescript
export async function updateCatalog(
    metahubId: string,
    catalogId: string,
    data: UpdateCatalogInput & { _uplVersion?: number }
): Promise<CatalogResponse> {
    const response = await apiClient.patch(
        `/metahubs/${metahubId}/catalogs/${catalogId}`,
        data
    )

    if (response.status === 409) {
        const conflict = response.data as ConflictResponse
        throw new OptimisticLockError(conflict.conflict)
    }

    return response.data
}
```

### Phase 4: Frontend - Conflict Resolution Dialog

#### Step 4.1: Create Shared ConflictResolutionDialog Component

**File:** `packages/universo-template-mui/base/src/components/dialogs/ConflictResolutionDialog.tsx`

```tsx
import React from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Alert,
    Stack
} from '@mui/material'
import { WarningAmber } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import type { ConflictInfo } from '@universo/types'

export interface ConflictResolutionDialogProps {
    open: boolean
    conflict: ConflictInfo | null
    entityLabel: string  // e.g., "Catalog", "Hub", "Attribute"
    onOverwrite: () => void
    onReload: () => void
    onCancel: () => void
    isLoading?: boolean
}

export function ConflictResolutionDialog({
    open,
    conflict,
    entityLabel,
    onOverwrite,
    onReload,
    onCancel,
    isLoading = false
}: ConflictResolutionDialogProps) {
    const { t } = useTranslation()

    if (!conflict) return null

    const updatedByDisplay = conflict.updatedByInfo?.nickname
        || conflict.updatedByInfo?.email
        || conflict.updatedByInfo?.id
        || t('common.unknownUser')

    const updatedAtFormatted = new Date(conflict.updatedAt).toLocaleString()

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            maxWidth="sm"
            fullWidth
            aria-labelledby="conflict-dialog-title"
        >
            <DialogTitle id="conflict-dialog-title">
                <Stack direction="row" alignItems="center" spacing={1}>
                    <WarningAmber color="warning" />
                    <Typography variant="h6">
                        {t('common.conflict.title')}
                    </Typography>
                </Stack>
            </DialogTitle>

            <DialogContent>
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {t('common.conflict.description', { entityLabel })}
                </Alert>

                <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        {t('common.conflict.modifiedBy')}:
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                        {updatedByDisplay}
                    </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        {t('common.conflict.modifiedAt')}:
                    </Typography>
                    <Typography variant="body1">
                        {updatedAtFormatted}
                    </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        {t('common.conflict.versionInfo')}:
                    </Typography>
                    <Typography variant="body1">
                        {t('common.conflict.versionMismatch', {
                            expected: conflict.expectedVersion,
                            actual: conflict.actualVersion
                        })}
                    </Typography>
                </Box>

                <Typography variant="body2" sx={{ mt: 2 }}>
                    {t('common.conflict.chooseAction')}
                </Typography>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button
                    onClick={onCancel}
                    disabled={isLoading}
                >
                    {t('common.cancel')}
                </Button>
                <Button
                    onClick={onReload}
                    variant="outlined"
                    disabled={isLoading}
                >
                    {t('common.conflict.reloadData')}
                </Button>
                <Button
                    onClick={onOverwrite}
                    variant="contained"
                    color="warning"
                    disabled={isLoading}
                >
                    {t('common.conflict.overwriteAnyway')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}
```

#### Step 4.2: Add i18n Keys

**File:** `packages/universo-i18n/base/src/locales/en/common.json`

```json
{
    "conflict": {
        "title": "Edit Conflict Detected",
        "description": "This {{entityLabel}} has been modified by another user since you started editing.",
        "modifiedBy": "Modified by",
        "modifiedAt": "Modified at",
        "versionInfo": "Version information",
        "versionMismatch": "Your version: {{expected}}, Current version: {{actual}}",
        "chooseAction": "What would you like to do?",
        "reloadData": "Reload Latest",
        "overwriteAnyway": "Overwrite Changes"
    },
    "unknownUser": "Unknown user"
}
```

**File:** `packages/universo-i18n/base/src/locales/ru/common.json`

```json
{
    "conflict": {
        "title": "Обнаружен конфликт редактирования",
        "description": "{{entityLabel}} был изменён другим пользователем после того, как вы начали редактирование.",
        "modifiedBy": "Изменено пользователем",
        "modifiedAt": "Время изменения",
        "versionInfo": "Информация о версии",
        "versionMismatch": "Ваша версия: {{expected}}, Текущая версия: {{actual}}",
        "chooseAction": "Что вы хотите сделать?",
        "reloadData": "Загрузить актуальную версию",
        "overwriteAnyway": "Перезаписать изменения"
    },
    "unknownUser": "Неизвестный пользователь"
}
```

### Phase 5: Frontend - Integration with Edit Dialogs

#### Step 5.1: Create useOptimisticLock Hook

**File:** `packages/metahubs-frontend/base/src/hooks/useOptimisticLock.ts`

```typescript
import { useState, useCallback } from 'react'
import type { ConflictInfo } from '@universo/types'

interface UseOptimisticLockOptions<T> {
    onUpdate: (data: T & { _uplVersion: number }) => Promise<void>
    onRefresh: () => Promise<void>
}

export function useOptimisticLock<T>({ onUpdate, onRefresh }: UseOptimisticLockOptions<T>) {
    const [conflict, setConflict] = useState<ConflictInfo | null>(null)
    const [pendingData, setPendingData] = useState<T | null>(null)
    const [isResolving, setIsResolving] = useState(false)

    const handleUpdate = useCallback(async (data: T, version: number) => {
        try {
            await onUpdate({ ...data, _uplVersion: version })
            return true
        } catch (error: any) {
            if (error.code === 'OPTIMISTIC_LOCK_CONFLICT') {
                setConflict(error.conflict)
                setPendingData(data)
                return false
            }
            throw error
        }
    }, [onUpdate])

    const handleOverwrite = useCallback(async () => {
        if (!pendingData || !conflict) return

        setIsResolving(true)
        try {
            // Retry with current version (force overwrite)
            await onUpdate({
                ...pendingData,
                _uplVersion: conflict.actualVersion
            })
            setConflict(null)
            setPendingData(null)
        } finally {
            setIsResolving(false)
        }
    }, [pendingData, conflict, onUpdate])

    const handleReload = useCallback(async () => {
        setIsResolving(true)
        try {
            await onRefresh()
            setConflict(null)
            setPendingData(null)
        } finally {
            setIsResolving(false)
        }
    }, [onRefresh])

    const handleCancel = useCallback(() => {
        setConflict(null)
        setPendingData(null)
    }, [])

    return {
        conflict,
        isResolving,
        handleUpdate,
        handleOverwrite,
        handleReload,
        handleCancel
    }
}
```

#### Step 5.2: Update Edit Dialogs (Example: CatalogEditDialog)

**Pattern to apply to all edit dialogs:**

```tsx
import { ConflictResolutionDialog } from '@universo/template-mui'
import { useOptimisticLock } from '../hooks/useOptimisticLock'

function CatalogEditDialog({ catalogId, metahubId, open, onClose }) {
    const { t } = useTranslation()
    const queryClient = useQueryClient()

    // Fetch catalog with version
    const { data: catalog, refetch } = useQuery({
        queryKey: ['catalog', catalogId],
        queryFn: () => fetchCatalog(metahubId, catalogId),
        enabled: open && !!catalogId
    })

    // Track current version in form state
    const [formData, setFormData] = useState<CatalogFormData | null>(null)
    const [currentVersion, setCurrentVersion] = useState<number>(1)

    // Initialize form when catalog loads
    useEffect(() => {
        if (catalog) {
            setFormData(mapCatalogToFormData(catalog))
            setCurrentVersion(catalog._uplVersion)
        }
    }, [catalog])

    // Optimistic lock handling
    const {
        conflict,
        isResolving,
        handleUpdate,
        handleOverwrite,
        handleReload,
        handleCancel
    } = useOptimisticLock({
        onUpdate: async (data) => {
            await updateCatalog(metahubId, catalogId, data)
            queryClient.invalidateQueries(['catalogs', metahubId])
            onClose()
        },
        onRefresh: async () => {
            const fresh = await refetch()
            if (fresh.data) {
                setFormData(mapCatalogToFormData(fresh.data))
                setCurrentVersion(fresh.data._uplVersion)
            }
        }
    })

    const handleSave = async () => {
        if (!formData) return
        await handleUpdate(formData, currentVersion)
    }

    return (
        <>
            <Dialog open={open} onClose={onClose}>
                {/* ... existing dialog content ... */}
                <DialogActions>
                    <Button onClick={onClose}>{t('common.cancel')}</Button>
                    <Button onClick={handleSave} variant="contained">
                        {t('common.save')}
                    </Button>
                </DialogActions>
            </Dialog>

            <ConflictResolutionDialog
                open={!!conflict}
                conflict={conflict}
                entityLabel={t('metahubs.catalog')}
                onOverwrite={handleOverwrite}
                onReload={handleReload}
                onCancel={handleCancel}
                isLoading={isResolving}
            />
        </>
    )
}
```

### Phase 6: Testing

#### Step 6.1: Backend Unit Tests

Test cases:
1. Version increments on every update
2. OptimisticLockError thrown when version mismatch
3. Conflict info contains correct user details
4. Force overwrite works with current version

#### Step 6.2: Frontend Integration Tests

Test cases:
1. Version sent with update requests
2. Conflict dialog shown on 409 response
3. Overwrite retries with current version
4. Reload fetches fresh data

### Implementation Order

1. **Phase 1** (Backend Core) - 2-3 hours
   - Create OptimisticLockError in universo-utils
   - Create optimisticLock.ts helper
   - Update all 4 services

2. **Phase 2** (Backend Routes) - 1-2 hours
   - Update route handlers to accept version
   - Add 409 conflict response handling

3. **Phase 3** (Frontend API) - 1 hour
   - Update response types
   - Update API client methods

4. **Phase 4** (Frontend Dialog) - 2 hours
   - Create ConflictResolutionDialog
   - Add i18n keys (EN + RU)

5. **Phase 5** (Frontend Integration) - 3-4 hours
   - Create useOptimisticLock hook
   - Update all edit dialogs (Catalog, Hub, Attribute, Element)

6. **Phase 6** (Testing) - 2 hours
   - Backend unit tests
   - Manual integration testing

**Total estimated effort: 11-14 hours**

## Files to Create

| File | Purpose |
|------|---------|
| `packages/universo-utils/base/src/errors/OptimisticLockError.ts` | Error class for conflicts |
| `packages/metahubs-backend/base/src/utils/optimisticLock.ts` | Version check helper |
| `packages/universo-template-mui/base/src/components/dialogs/ConflictResolutionDialog.tsx` | Conflict dialog |
| `packages/metahubs-frontend/base/src/hooks/useOptimisticLock.ts` | React hook for conflict handling |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/universo-utils/base/src/index.ts` | Export errors |
| `packages/universo-i18n/base/src/locales/en/common.json` | Add conflict keys |
| `packages/universo-i18n/base/src/locales/ru/common.json` | Add conflict keys (RU) |
| `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubObjectsService.ts` | Add version handling |
| `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubAttributesService.ts` | Add version handling |
| `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubElementsService.ts` | Add version handling |
| `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubHubsService.ts` | Add version handling |
| `packages/metahubs-backend/base/src/domains/catalogs/routes/catalogsRoutes.ts` | Accept version, return 409 |
| `packages/metahubs-backend/base/src/domains/attributes/routes/attributesRoutes.ts` | Accept version, return 409 |
| `packages/metahubs-backend/base/src/domains/elements/routes/elementsRoutes.ts` | Accept version, return 409 |
| `packages/metahubs-backend/base/src/domains/hubs/routes/hubsRoutes.ts` | Accept version, return 409 |
| All frontend edit dialogs | Integrate conflict resolution |

## Security Considerations

1. **Row-level locking**: Using `FOR UPDATE` prevents race conditions at DB level
2. **User validation**: Only the actual `updatedBy` user ID is stored, resolved to user info only in response
3. **No sensitive data leak**: Conflict response only includes email/nickname, not passwords or tokens

## Backwards Compatibility

- `expectedVersion` parameter is optional in all update methods
- If not provided, version is incremented without check
- Existing API calls continue to work
- Frontend can be updated gradually

---

**Plan Status**: Ready for Review
**Complexity Level**: 3 (Medium-High)
**Recommended Next Step**: IMPLEMENT mode after approval
