/**
 * System fields constants and helper functions for the three-level architecture.
 *
 * Platform level (_upl_*): Global administrators, audit trails, physical deletion scheduling
 * Metahub level (_mhb_*): Configuration developers, design-time operations
 * Application level (_app_*): End users, runtime operations
 */

/**
 * Platform-level system field names (_upl_*)
 * Present on ALL tables across the platform
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
 * Metahub-level system field names (_mhb_*)
 * Present on dynamic tables in mhb_* schemas
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
 * Application-level system field names (_app_*)
 * Present on dynamic tables in app_* schemas
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
export function getUplCreateFields(ctx: AuditContext = {}): Record<string, unknown> {
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
export function getUplUpdateFields(ctx: AuditContext = {}): Record<string, unknown> {
    return {
        [UPL_FIELDS.UPDATED_AT]: ctx.now ?? new Date(),
        [UPL_FIELDS.UPDATED_BY]: ctx.userId ?? null
    }
}

/**
 * Returns metahub-level default fields for INSERT operations
 */
export function getMhbCreateFields(): Record<string, unknown> {
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
export function getAppCreateFields(ownerId?: string): Record<string, unknown> {
    return {
        [APP_FIELDS.PUBLISHED]: true,
        [APP_FIELDS.ARCHIVED]: false,
        [APP_FIELDS.DELETED]: false,
        [APP_FIELDS.OWNER_ID]: ownerId ?? null,
        [APP_FIELDS.ACCESS_LEVEL]: 'private' as AccessLevel
    }
}

/**
 * Returns fields for platform-level soft delete
 */
export function getUplDeleteFields(ctx: AuditContext = {}): Record<string, unknown> {
    const now = ctx.now ?? new Date()
    return {
        [UPL_FIELDS.DELETED]: true,
        [UPL_FIELDS.DELETED_AT]: now,
        [UPL_FIELDS.DELETED_BY]: ctx.userId ?? null,
        [UPL_FIELDS.UPDATED_AT]: now,
        [UPL_FIELDS.UPDATED_BY]: ctx.userId ?? null
    }
}

/**
 * Returns fields for metahub-level soft delete
 */
export function getMhbDeleteFields(ctx: AuditContext = {}): Record<string, unknown> {
    const now = ctx.now ?? new Date()
    return {
        [MHB_FIELDS.DELETED]: true,
        [MHB_FIELDS.DELETED_AT]: now,
        [MHB_FIELDS.DELETED_BY]: ctx.userId ?? null,
        [UPL_FIELDS.UPDATED_AT]: now,
        [UPL_FIELDS.UPDATED_BY]: ctx.userId ?? null
    }
}

/**
 * Returns fields for application-level soft delete
 */
export function getAppDeleteFields(ctx: AuditContext = {}): Record<string, unknown> {
    const now = ctx.now ?? new Date()
    return {
        [APP_FIELDS.DELETED]: true,
        [APP_FIELDS.DELETED_AT]: now,
        [APP_FIELDS.DELETED_BY]: ctx.userId ?? null,
        [UPL_FIELDS.UPDATED_AT]: now,
        [UPL_FIELDS.UPDATED_BY]: ctx.userId ?? null
    }
}

/**
 * Returns fields for restoring from platform-level soft delete
 */
export function getUplRestoreFields(ctx: AuditContext = {}): Record<string, unknown> {
    const now = ctx.now ?? new Date()
    return {
        [UPL_FIELDS.DELETED]: false,
        [UPL_FIELDS.DELETED_AT]: null,
        [UPL_FIELDS.DELETED_BY]: null,
        [UPL_FIELDS.PURGE_AFTER]: null,
        [UPL_FIELDS.UPDATED_AT]: now,
        [UPL_FIELDS.UPDATED_BY]: ctx.userId ?? null
    }
}

/**
 * Returns fields for restoring from metahub-level soft delete
 */
export function getMhbRestoreFields(ctx: AuditContext = {}): Record<string, unknown> {
    const now = ctx.now ?? new Date()
    return {
        [MHB_FIELDS.DELETED]: false,
        [MHB_FIELDS.DELETED_AT]: null,
        [MHB_FIELDS.DELETED_BY]: null,
        [UPL_FIELDS.UPDATED_AT]: now,
        [UPL_FIELDS.UPDATED_BY]: ctx.userId ?? null
    }
}

/**
 * Returns fields for restoring from application-level soft delete
 */
export function getAppRestoreFields(ctx: AuditContext = {}): Record<string, unknown> {
    const now = ctx.now ?? new Date()
    return {
        [APP_FIELDS.DELETED]: false,
        [APP_FIELDS.DELETED_AT]: null,
        [APP_FIELDS.DELETED_BY]: null,
        [UPL_FIELDS.UPDATED_AT]: now,
        [UPL_FIELDS.UPDATED_BY]: ctx.userId ?? null
    }
}

/**
 * Returns fields for archiving at platform level
 */
export function getUplArchiveFields(ctx: AuditContext = {}): Record<string, unknown> {
    const now = ctx.now ?? new Date()
    return {
        [UPL_FIELDS.ARCHIVED]: true,
        [UPL_FIELDS.ARCHIVED_AT]: now,
        [UPL_FIELDS.ARCHIVED_BY]: ctx.userId ?? null,
        [UPL_FIELDS.UPDATED_AT]: now,
        [UPL_FIELDS.UPDATED_BY]: ctx.userId ?? null
    }
}

/**
 * Returns fields for locking a record
 */
export function getUplLockFields(ctx: AuditContext = {}, reason?: string): Record<string, unknown> {
    const now = ctx.now ?? new Date()
    return {
        [UPL_FIELDS.LOCKED]: true,
        [UPL_FIELDS.LOCKED_AT]: now,
        [UPL_FIELDS.LOCKED_BY]: ctx.userId ?? null,
        [UPL_FIELDS.LOCKED_REASON]: reason ?? null,
        [UPL_FIELDS.UPDATED_AT]: now,
        [UPL_FIELDS.UPDATED_BY]: ctx.userId ?? null
    }
}

/**
 * Returns fields for unlocking a record
 */
export function getUplUnlockFields(ctx: AuditContext = {}): Record<string, unknown> {
    const now = ctx.now ?? new Date()
    return {
        [UPL_FIELDS.LOCKED]: false,
        [UPL_FIELDS.LOCKED_AT]: null,
        [UPL_FIELDS.LOCKED_BY]: null,
        [UPL_FIELDS.LOCKED_REASON]: null,
        [UPL_FIELDS.UPDATED_AT]: now,
        [UPL_FIELDS.UPDATED_BY]: ctx.userId ?? null
    }
}
