# System Fields Implementation Plan v3

## Summary of Changes from v2

1. **No new package** - All utilities go into existing `packages/universo-utils`
2. **Middleware clarified** - Using service-layer pattern, not Express middleware
3. **RLS policies added** - Full SQL examples for all three levels

---

## 1. Package Structure

### 1.1 New Files in `packages/universo-utils/base/src/database/`

```
database/
├── index.ts                    # Updated exports
├── escaping.ts                 # Existing
├── manager.ts                  # Existing
├── systemFields.ts             # NEW: Field definitions & constants
├── softDelete.ts               # NEW: Soft delete helpers
└── optimisticLock.ts           # NEW: Version check helpers
```

### 1.2 Why `universo-utils` Instead of New Package

- Already contains `database/` module with related utilities
- Already imported by both `metahubs-backend` and `applications-backend`
- Follows existing codebase patterns
- No additional workspace configuration needed

---

## 2. System Fields Specification

### 2.1 Platform Level (`_upl_*`) - All Tables

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `_upl_created_at` | `TIMESTAMPTZ` | `now()` | Creation timestamp |
| `_upl_created_by` | `UUID` | - | Creator user ID |
| `_upl_updated_at` | `TIMESTAMPTZ` | `now()` | Last update timestamp |
| `_upl_updated_by` | `UUID` | - | Last updater user ID |
| `_upl_version` | `INTEGER` | `1` | Optimistic locking counter |
| `_upl_archived` | `BOOLEAN` | `false` | Cold storage flag |
| `_upl_archived_at` | `TIMESTAMPTZ` | - | When archived |
| `_upl_archived_by` | `UUID` | - | Who archived |
| `_upl_deleted` | `BOOLEAN` | `false` | Platform-level soft delete |
| `_upl_deleted_at` | `TIMESTAMPTZ` | - | When deleted |
| `_upl_deleted_by` | `UUID` | - | Who deleted |
| `_upl_purge_after` | `TIMESTAMPTZ` | - | Scheduled physical deletion |
| `_upl_locked` | `BOOLEAN` | `false` | Record lock flag |
| `_upl_locked_at` | `TIMESTAMPTZ` | - | When locked |
| `_upl_locked_by` | `UUID` | - | Who locked |
| `_upl_locked_reason` | `TEXT` | - | Lock reason |

### 2.2 Metahub Level (`_mhb_*`) - Dynamic Tables in `mhb_*` Schemas

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `_mhb_published` | `BOOLEAN` | `true` | Published/draft status |
| `_mhb_published_at` | `TIMESTAMPTZ` | - | When published |
| `_mhb_published_by` | `UUID` | - | Who published |
| `_mhb_archived` | `BOOLEAN` | `false` | Metahub-level archive |
| `_mhb_archived_at` | `TIMESTAMPTZ` | - | When archived |
| `_mhb_archived_by` | `UUID` | - | Who archived |
| `_mhb_deleted` | `BOOLEAN` | `false` | Metahub-level trash |
| `_mhb_deleted_at` | `TIMESTAMPTZ` | - | When deleted |
| `_mhb_deleted_by` | `UUID` | - | Who deleted |
| `_mhb_order` | `INTEGER` | `0` | Sort order |
| `_mhb_readonly` | `BOOLEAN` | `false` | Write protection |

### 2.3 Application Level (`_app_*`) - Dynamic Tables in `app_*` Schemas

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `_app_published` | `BOOLEAN` | `true` | Published/draft status |
| `_app_published_at` | `TIMESTAMPTZ` | - | When published |
| `_app_published_by` | `UUID` | - | Who published |
| `_app_archived` | `BOOLEAN` | `false` | App-level archive |
| `_app_archived_at` | `TIMESTAMPTZ` | - | When archived |
| `_app_archived_by` | `UUID` | - | Who archived |
| `_app_deleted` | `BOOLEAN` | `false` | App-level trash |
| `_app_deleted_at` | `TIMESTAMPTZ` | - | When deleted |
| `_app_deleted_by` | `UUID` | - | Who deleted |
| `_app_owner_id` | `UUID` | - | Record owner for RLS |
| `_app_access_level` | `VARCHAR(20)` | `'private'` | Access level |

---

## 3. User ID Population Strategy

### 3.1 Approach: Service-Layer Pattern (NOT Middleware)

The codebase already uses explicit `userId` passing through the service layer:

```typescript
// In routes - userId is extracted from auth token
const userId = resolveUserId(req)

// Passed explicitly to services
await objectsService.createCatalog(metahubId, input, userId)
await objectsService.delete(metahubId, catalogId, userId)
```

**Why NOT Express Middleware:**
- TypeORM entities don't have access to request context
- Knex queries are built in services, not middleware
- Explicit passing is more testable and traceable
- Current codebase already follows this pattern

### 3.2 Helper Functions for Consistent Field Population

```typescript
// packages/universo-utils/base/src/database/systemFields.ts

export interface AuditContext {
    userId?: string
    now?: Date
}

/**
 * Returns object with audit fields for INSERT operations
 */
export function getCreateAuditFields(ctx: AuditContext = {}) {
    const now = ctx.now ?? new Date()
    return {
        _upl_created_at: now,
        _upl_created_by: ctx.userId ?? null,
        _upl_updated_at: now,
        _upl_updated_by: ctx.userId ?? null,
        _upl_version: 1
    }
}

/**
 * Returns object with audit fields for UPDATE operations
 */
export function getUpdateAuditFields(ctx: AuditContext = {}) {
    return {
        _upl_updated_at: ctx.now ?? new Date(),
        _upl_updated_by: ctx.userId ?? null
    }
}
```

---

## 4. RLS Policies

### 4.1 Platform-Level Policies (Static Tables)

```sql
-- metahubs.metahubs table
-- Policy: Hide platform-deleted records from all except platform admins
CREATE POLICY "metahubs_hide_deleted" ON metahubs.metahubs
    FOR SELECT
    USING (
        _upl_deleted = false
        OR auth.jwt() ->> 'role' = 'platform_admin'
    );

-- Policy: Prevent modification of locked records
CREATE POLICY "metahubs_prevent_locked_update" ON metahubs.metahubs
    FOR UPDATE
    USING (
        _upl_locked = false
        OR auth.jwt() ->> 'role' = 'platform_admin'
    );
```

### 4.2 Metahub-Level Policies (Dynamic mhb_* Schemas)

```sql
-- Template for _mhb_objects table in each metahub schema
-- Applied via MetahubSchemaService when creating schema

CREATE POLICY "mhb_objects_visibility" ON "${schemaName}"._mhb_objects
    FOR SELECT
    USING (
        -- Platform admins see everything
        (auth.jwt() ->> 'role' = 'platform_admin')
        OR (
            -- Non-admins: hide platform-deleted
            _upl_deleted = false
            AND (
                -- Metahub admins see metahub-deleted (trash)
                (auth.jwt() ->> 'role' = 'metahub_admin')
                OR _mhb_deleted = false
            )
        )
    );

CREATE POLICY "mhb_objects_modification" ON "${schemaName}"._mhb_objects
    FOR UPDATE
    USING (
        _upl_locked = false
        AND _mhb_readonly = false
    );
```

### 4.3 Application-Level Policies (Dynamic app_* Schemas)

```sql
-- Template for application data tables
-- Applied via SchemaGenerator when creating app tables

CREATE POLICY "app_data_owner_access" ON "${schemaName}"."${tableName}"
    FOR SELECT
    USING (
        -- Platform admins see everything
        (auth.jwt() ->> 'role' = 'platform_admin')
        OR (
            _upl_deleted = false
            AND (
                -- App admins see app-deleted (trash)
                (auth.jwt() ->> 'role' = 'app_admin')
                OR _app_deleted = false
            )
            AND (
                -- Access level check
                _app_access_level = 'public'
                OR _app_owner_id = auth.uid()
                OR (
                    _app_access_level = 'team'
                    AND _app_owner_id IN (
                        SELECT user_id FROM applications.applications_users
                        WHERE application_id = current_setting('app.current_application_id')::uuid
                    )
                )
            )
        )
    );

CREATE POLICY "app_data_owner_modify" ON "${schemaName}"."${tableName}"
    FOR UPDATE
    USING (
        _upl_locked = false
        AND (
            _app_owner_id = auth.uid()
            OR auth.jwt() ->> 'role' IN ('platform_admin', 'app_admin')
        )
    );
```

---

## 5. Implementation Phases

### Phase 1: Utilities in `universo-utils`

**Files to create:**
- `packages/universo-utils/base/src/database/systemFields.ts`
- `packages/universo-utils/base/src/database/softDelete.ts`

**Files to update:**
- `packages/universo-utils/base/src/database/index.ts`
- `packages/universo-utils/base/src/index.ts`

### Phase 2: Static Table Migrations

**Files to update (full rewrite):**
- `packages/metahubs-backend/base/src/database/migrations/postgres/1766351182000-CreateMetahubsSchema.ts`
- `packages/applications-backend/base/src/database/migrations/postgres/1800000000000-CreateApplicationsSchema.ts`

### Phase 3: TypeORM Entities

**Files to update (9 entities):**
- `packages/metahubs-backend/base/src/database/entities/Metahub.ts`
- `packages/metahubs-backend/base/src/database/entities/MetahubBranch.ts`
- `packages/metahubs-backend/base/src/database/entities/MetahubUser.ts`
- `packages/metahubs-backend/base/src/database/entities/Publication.ts`
- `packages/metahubs-backend/base/src/database/entities/PublicationVersion.ts`
- `packages/applications-backend/base/src/database/entities/Application.ts`
- `packages/applications-backend/base/src/database/entities/Connector.ts`
- `packages/applications-backend/base/src/database/entities/ConnectorPublication.ts`
- `packages/applications-backend/base/src/database/entities/ApplicationUser.ts`

### Phase 4: Dynamic Schema Services

**Files to update:**
- `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubSchemaService.ts`
  - Add `_upl_*` and `_mhb_*` fields to `_mhb_objects`, `_mhb_attributes`, `_mhb_elements`
  - Add RLS policies creation

- `packages/schema-ddl/base/src/SchemaGenerator.ts`
  - Add `_upl_*` and `_app_*` fields to generated tables
  - Add RLS policies creation

### Phase 5: Services and Query Helpers

**Files to update:**
- `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubObjectsService.ts`
- `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubAttributesService.ts`
- `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubElementsService.ts`
- `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubHubsService.ts`
- `packages/metahubs-backend/base/src/utils/queryHelpers.ts`
- `packages/applications-backend/base/src/utils/queryHelpers.ts`

### Phase 6: API Routes

**Files to update (add trash/restore endpoints if not present):**
- `packages/metahubs-backend/base/src/domains/catalogs/routes/catalogsRoutes.ts` ✓ (already has trash endpoints)
- `packages/metahubs-backend/base/src/domains/hubs/routes/hubsRoutes.ts`
- `packages/metahubs-backend/base/src/domains/elements/routes/elementsRoutes.ts`
- `packages/metahubs-backend/base/src/domains/attributes/routes/attributesRoutes.ts`

---

## 6. Code Examples

### 6.1 systemFields.ts

```typescript
// packages/universo-utils/base/src/database/systemFields.ts

/**
 * Platform-level system field names
 */
export const UPL_FIELDS = {
    CREATED_AT: '_upl_created_at',
    CREATED_BY: '_upl_created_by',
    UPDATED_AT: '_upl_updated_at',
    UPDATED_BY: '_upl_updated_by',
    VERSION: '_upl_version',
    ARCHIVED: '_upl_archived',
    ARCHIVED_AT: '_upl_archived_at',
    ARCHIVED_BY: '_upl_archived_by',
    DELETED: '_upl_deleted',
    DELETED_AT: '_upl_deleted_at',
    DELETED_BY: '_upl_deleted_by',
    PURGE_AFTER: '_upl_purge_after',
    LOCKED: '_upl_locked',
    LOCKED_AT: '_upl_locked_at',
    LOCKED_BY: '_upl_locked_by',
    LOCKED_REASON: '_upl_locked_reason'
} as const

/**
 * Metahub-level system field names
 */
export const MHB_FIELDS = {
    PUBLISHED: '_mhb_published',
    PUBLISHED_AT: '_mhb_published_at',
    PUBLISHED_BY: '_mhb_published_by',
    ARCHIVED: '_mhb_archived',
    ARCHIVED_AT: '_mhb_archived_at',
    ARCHIVED_BY: '_mhb_archived_by',
    DELETED: '_mhb_deleted',
    DELETED_AT: '_mhb_deleted_at',
    DELETED_BY: '_mhb_deleted_by',
    ORDER: '_mhb_order',
    READONLY: '_mhb_readonly'
} as const

/**
 * Application-level system field names
 */
export const APP_FIELDS = {
    PUBLISHED: '_app_published',
    PUBLISHED_AT: '_app_published_at',
    PUBLISHED_BY: '_app_published_by',
    ARCHIVED: '_app_archived',
    ARCHIVED_AT: '_app_archived_at',
    ARCHIVED_BY: '_app_archived_by',
    DELETED: '_app_deleted',
    DELETED_AT: '_app_deleted_at',
    DELETED_BY: '_app_deleted_by',
    OWNER_ID: '_app_owner_id',
    ACCESS_LEVEL: '_app_access_level'
} as const

export type AccessLevel = 'private' | 'team' | 'public'

export interface AuditContext {
    userId?: string
    now?: Date
}

/**
 * Returns platform-level audit fields for INSERT operations
 */
export function getUplCreateFields(ctx: AuditContext = {}) {
    const now = ctx.now ?? new Date()
    return {
        [UPL_FIELDS.CREATED_AT]: now,
        [UPL_FIELDS.CREATED_BY]: ctx.userId ?? null,
        [UPL_FIELDS.UPDATED_AT]: now,
        [UPL_FIELDS.UPDATED_BY]: ctx.userId ?? null,
        [UPL_FIELDS.VERSION]: 1,
        [UPL_FIELDS.ARCHIVED]: false,
        [UPL_FIELDS.DELETED]: false,
        [UPL_FIELDS.LOCKED]: false
    }
}

/**
 * Returns platform-level audit fields for UPDATE operations
 */
export function getUplUpdateFields(ctx: AuditContext = {}) {
    return {
        [UPL_FIELDS.UPDATED_AT]: ctx.now ?? new Date(),
        [UPL_FIELDS.UPDATED_BY]: ctx.userId ?? null
    }
}

/**
 * Returns metahub-level default fields for INSERT operations
 */
export function getMhbCreateFields() {
    return {
        [MHB_FIELDS.PUBLISHED]: true,
        [MHB_FIELDS.ARCHIVED]: false,
        [MHB_FIELDS.DELETED]: false,
        [MHB_FIELDS.ORDER]: 0,
        [MHB_FIELDS.READONLY]: false
    }
}

/**
 * Returns application-level default fields for INSERT operations
 */
export function getAppCreateFields(ownerId?: string) {
    return {
        [APP_FIELDS.PUBLISHED]: true,
        [APP_FIELDS.ARCHIVED]: false,
        [APP_FIELDS.DELETED]: false,
        [APP_FIELDS.OWNER_ID]: ownerId ?? null,
        [APP_FIELDS.ACCESS_LEVEL]: 'private' as AccessLevel
    }
}
```

### 6.2 softDelete.ts

```typescript
// packages/universo-utils/base/src/database/softDelete.ts

import type { Knex } from 'knex'
import { UPL_FIELDS, MHB_FIELDS, APP_FIELDS, type AuditContext } from './systemFields'

export type DeleteLevel = 'upl' | 'mhb' | 'app'

export interface SoftDeleteOptions {
    includeAppDeleted?: boolean
    includeMhbDeleted?: boolean
    includeUplDeleted?: boolean
    onlyAppDeleted?: boolean
    onlyMhbDeleted?: boolean
    onlyUplDeleted?: boolean
}

const LEVEL_PREFIXES = {
    upl: UPL_FIELDS,
    mhb: MHB_FIELDS,
    app: APP_FIELDS
} as const

/**
 * Applies soft delete filters to a Knex query builder
 */
export function applySoftDeleteFilter<T extends Knex.QueryBuilder>(
    query: T,
    options: SoftDeleteOptions = {}
): T {
    const {
        includeAppDeleted = false,
        includeMhbDeleted = false,
        includeUplDeleted = false,
        onlyAppDeleted = false,
        onlyMhbDeleted = false,
        onlyUplDeleted = false
    } = options

    // "Only" filters for trash views
    if (onlyAppDeleted) {
        return query.where(APP_FIELDS.DELETED, true) as T
    }
    if (onlyMhbDeleted) {
        return query
            .where(MHB_FIELDS.DELETED, true)
            .where(APP_FIELDS.DELETED, false) as T
    }
    if (onlyUplDeleted) {
        return query
            .where(UPL_FIELDS.DELETED, true)
            .where(MHB_FIELDS.DELETED, false) as T
    }

    // Exclusion filters (default)
    if (!includeUplDeleted) {
        query = query.where(UPL_FIELDS.DELETED, false) as T
    }
    if (!includeMhbDeleted) {
        query = query.where(MHB_FIELDS.DELETED, false) as T
    }
    if (!includeAppDeleted) {
        query = query.where(APP_FIELDS.DELETED, false) as T
    }

    return query
}

/**
 * Performs soft delete at specified level
 */
export async function softDelete(
    knex: Knex,
    schemaName: string,
    tableName: string,
    id: string,
    ctx: AuditContext,
    level: DeleteLevel = 'app'
): Promise<number> {
    const fields = LEVEL_PREFIXES[level]
    const now = new Date()

    const update: Record<string, unknown> = {
        [fields.DELETED]: true,
        [fields.DELETED_AT]: now,
        [fields.DELETED_BY]: ctx.userId ?? null,
        [UPL_FIELDS.UPDATED_AT]: now,
        [UPL_FIELDS.UPDATED_BY]: ctx.userId ?? null
    }

    // Set purge date for platform-level deletion
    if (level === 'upl') {
        update[UPL_FIELDS.PURGE_AFTER] = knex.raw("now() + interval '365 days'")
    }

    return knex
        .withSchema(schemaName)
        .from(tableName)
        .where({ id })
        .where(fields.DELETED, false)
        .update(update)
}

/**
 * Restores a soft-deleted record
 */
export async function restoreDeleted(
    knex: Knex,
    schemaName: string,
    tableName: string,
    id: string,
    ctx: AuditContext,
    level: DeleteLevel = 'app'
): Promise<number> {
    const fields = LEVEL_PREFIXES[level]
    const now = new Date()

    const update: Record<string, unknown> = {
        [fields.DELETED]: false,
        [fields.DELETED_AT]: null,
        [fields.DELETED_BY]: null,
        [UPL_FIELDS.UPDATED_AT]: now,
        [UPL_FIELDS.UPDATED_BY]: ctx.userId ?? null
    }

    if (level === 'upl') {
        update[UPL_FIELDS.PURGE_AFTER] = null
    }

    return knex
        .withSchema(schemaName)
        .from(tableName)
        .where({ id })
        .where(fields.DELETED, true)
        .update(update)
}
```

### 6.3 Updated Migration Example

```typescript
// packages/metahubs-backend/base/src/database/migrations/postgres/1766351182000-CreateMetahubsSchema.ts

await queryRunner.query(`
    CREATE TABLE metahubs.metahubs (
        id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
        name JSONB NOT NULL DEFAULT '{}',
        description JSONB DEFAULT '{}',
        codename VARCHAR(100) NOT NULL,
        slug VARCHAR(100),
        default_branch_id UUID,
        last_branch_number INT NOT NULL DEFAULT 0,
        is_public BOOLEAN NOT NULL DEFAULT false,

        -- Platform-level system fields (_upl_*)
        _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        _upl_created_by UUID,
        _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        _upl_updated_by UUID,
        _upl_version INTEGER NOT NULL DEFAULT 1,

        _upl_archived BOOLEAN NOT NULL DEFAULT false,
        _upl_archived_at TIMESTAMPTZ,
        _upl_archived_by UUID,

        _upl_deleted BOOLEAN NOT NULL DEFAULT false,
        _upl_deleted_at TIMESTAMPTZ,
        _upl_deleted_by UUID,
        _upl_purge_after TIMESTAMPTZ,

        _upl_locked BOOLEAN NOT NULL DEFAULT false,
        _upl_locked_at TIMESTAMPTZ,
        _upl_locked_by UUID,
        _upl_locked_reason TEXT
    )
`)

-- Partial unique indexes (exclude deleted)
await queryRunner.query(`
    CREATE UNIQUE INDEX idx_metahubs_codename_active
    ON metahubs.metahubs (codename)
    WHERE _upl_deleted = false
`)
```

---

## 7. Implementation Checklist

### Phase 1: Utilities (universo-utils)
- [ ] 1.1 Create `systemFields.ts` with constants and helpers
- [ ] 1.2 Create `softDelete.ts` with query helpers
- [ ] 1.3 Update `database/index.ts` exports
- [ ] 1.4 Update main `index.ts` exports
- [ ] 1.5 Run `pnpm --filter @universo/utils build`

### Phase 2: Migrations
- [ ] 2.1 Rewrite `1766351182000-CreateMetahubsSchema.ts` with `_upl_*` fields
- [ ] 2.2 Rewrite `1800000000000-CreateApplicationsSchema.ts` with `_upl_*` fields
- [ ] 2.3 Add partial unique indexes
- [ ] 2.4 Add RLS policies

### Phase 3: TypeORM Entities
- [ ] 3.1 Update Metahub.ts
- [ ] 3.2 Update MetahubBranch.ts
- [ ] 3.3 Update MetahubUser.ts
- [ ] 3.4 Update Publication.ts
- [ ] 3.5 Update PublicationVersion.ts
- [ ] 3.6 Update Application.ts
- [ ] 3.7 Update Connector.ts
- [ ] 3.8 Update ConnectorPublication.ts
- [ ] 3.9 Update ApplicationUser.ts

### Phase 4: Dynamic Schema Services
- [ ] 4.1 Update MetahubSchemaService.initSystemTables() with `_upl_*` + `_mhb_*`
- [ ] 4.2 Update SchemaGenerator for app tables with `_upl_*` + `_app_*`
- [ ] 4.3 Add RLS policy creation in schema services

### Phase 5: Services
- [ ] 5.1 Update MetahubObjectsService (use new field names)
- [ ] 5.2 Update MetahubAttributesService
- [ ] 5.3 Update MetahubElementsService
- [ ] 5.4 Update MetahubHubsService
- [ ] 5.5 Update queryHelpers.ts (both packages)

### Phase 6: Routes
- [ ] 6.1 Verify catalogsRoutes.ts trash endpoints work with new fields
- [ ] 6.2 Add trash endpoints to hubsRoutes.ts
- [ ] 6.3 Add trash endpoints to elementsRoutes.ts
- [ ] 6.4 Add trash endpoints to attributesRoutes.ts

### Phase 7: Build & Test
- [ ] 7.1 Run full `pnpm build`
- [ ] 7.2 Recreate test database
- [ ] 7.3 Verify migrations apply correctly
- [ ] 7.4 Test CRUD operations
- [ ] 7.5 Test soft delete cascade
- [ ] 7.6 Test restore functionality

---

## 8. Notes

### 8.1 Database Recreation Required

Since we're modifying initial migrations, the test database must be dropped and recreated:

```bash
# Drop and recreate via Supabase CLI or direct SQL
DROP SCHEMA metahubs CASCADE;
DROP SCHEMA applications CASCADE;
# Then run migrations
```

### 8.2 No Breaking API Changes

The API response format remains the same - only internal field names change. Frontend code should not need updates unless it directly references database column names.

### 8.3 Internationalization

All user-facing error messages in routes already use the existing pattern. No new i18n keys are required for this implementation.
