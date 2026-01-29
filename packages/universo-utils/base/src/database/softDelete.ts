/**
 * Soft delete utilities for three-level deletion cascade.
 *
 * Deletion cascade flow:
 * 1. User deletes → _app_deleted = true (Application trash)
 * 2. App admin empties trash → _mhb_deleted = true (Metahub trash)
 * 3. Metahub admin empties trash → _upl_deleted = true (Platform trash)
 * 4. Scheduled job after _upl_purge_after → Physical deletion
 */

import {
    UPL_FIELDS,
    MHB_FIELDS,
    APP_FIELDS,
    getMhbDeleteFields,
    getMhbRestoreFields,
    getUplDeleteFields,
    getUplRestoreFields,
    getAppDeleteFields,
    getAppRestoreFields,
    type AuditContext
} from './systemFields'

export type DeleteLevel = 'upl' | 'mhb' | 'app'

export interface SoftDeleteOptions {
    /** Include application-level deleted records */
    includeAppDeleted?: boolean
    /** Include metahub-level deleted records */
    includeMhbDeleted?: boolean
    /** Include platform-level deleted records */
    includeUplDeleted?: boolean
    /** Only return application-level deleted records (app trash view) */
    onlyAppDeleted?: boolean
    /** Only return metahub-level deleted records (metahub trash view) */
    onlyMhbDeleted?: boolean
    /** Only return platform-level deleted records (platform trash view) */
    onlyUplDeleted?: boolean
}

/**
 * Options for platform-level only tables (static TypeORM entities)
 */
export interface UplSoftDeleteOptions {
    /** Include platform-level deleted records */
    includeDeleted?: boolean
    /** Only return platform-level deleted records */
    onlyDeleted?: boolean
}

/**
 * Options for metahub-level tables (_mhb_objects, _mhb_attributes, etc.)
 */
export interface MhbSoftDeleteOptions {
    /** Include platform-level deleted records */
    includeUplDeleted?: boolean
    /** Include metahub-level deleted records */
    includeMhbDeleted?: boolean
    /** Only return metahub-level deleted records (trash view) */
    onlyMhbDeleted?: boolean
    /** Only return platform-level deleted records */
    onlyUplDeleted?: boolean
}

/**
 * Builds WHERE conditions for platform-level soft delete filter.
 * Use with static TypeORM entities (metahubs, applications, etc.)
 */
export function getUplDeleteConditions(options: UplSoftDeleteOptions = {}): Record<string, boolean> {
    const { includeDeleted = false, onlyDeleted = false } = options

    if (onlyDeleted) {
        return { [UPL_FIELDS.DELETED]: true }
    }
    if (!includeDeleted) {
        return { [UPL_FIELDS.DELETED]: false }
    }
    return {}
}

/**
 * Builds WHERE conditions for metahub-level soft delete filter.
 * Use with dynamic metahub tables (_mhb_objects, _mhb_attributes, _mhb_elements)
 */
export function getMhbDeleteConditions(options: MhbSoftDeleteOptions = {}): Record<string, boolean> {
    const {
        includeUplDeleted = false,
        includeMhbDeleted = false,
        onlyMhbDeleted = false,
        onlyUplDeleted = false
    } = options

    const conditions: Record<string, boolean> = {}

    // "Only" filters for trash views
    if (onlyMhbDeleted) {
        conditions[MHB_FIELDS.DELETED] = true
        conditions[UPL_FIELDS.DELETED] = false
        return conditions
    }
    if (onlyUplDeleted) {
        conditions[UPL_FIELDS.DELETED] = true
        return conditions
    }

    // Exclusion filters (default behavior)
    if (!includeUplDeleted) {
        conditions[UPL_FIELDS.DELETED] = false
    }
    if (!includeMhbDeleted) {
        conditions[MHB_FIELDS.DELETED] = false
    }

    return conditions
}

/**
 * Builds WHERE conditions for application-level soft delete filter.
 * Use with dynamic application tables
 */
export function getAppDeleteConditions(options: SoftDeleteOptions = {}): Record<string, boolean> {
    const {
        includeAppDeleted = false,
        includeMhbDeleted = false,
        includeUplDeleted = false,
        onlyAppDeleted = false,
        onlyMhbDeleted = false,
        onlyUplDeleted = false
    } = options

    const conditions: Record<string, boolean> = {}

    // "Only" filters for trash views
    if (onlyAppDeleted) {
        conditions[APP_FIELDS.DELETED] = true
        return conditions
    }
    if (onlyMhbDeleted) {
        conditions[MHB_FIELDS.DELETED] = true
        conditions[APP_FIELDS.DELETED] = false
        return conditions
    }
    if (onlyUplDeleted) {
        conditions[UPL_FIELDS.DELETED] = true
        conditions[MHB_FIELDS.DELETED] = false
        return conditions
    }

    // Exclusion filters (default behavior)
    if (!includeUplDeleted) {
        conditions[UPL_FIELDS.DELETED] = false
    }
    if (!includeMhbDeleted) {
        conditions[MHB_FIELDS.DELETED] = false
    }
    if (!includeAppDeleted) {
        conditions[APP_FIELDS.DELETED] = false
    }

    return conditions
}

/**
 * Gets the appropriate delete fields based on level
 */
export function getDeleteFieldsByLevel(level: DeleteLevel, ctx: AuditContext = {}): Record<string, unknown> {
    switch (level) {
        case 'upl':
            return getUplDeleteFields(ctx)
        case 'mhb':
            return getMhbDeleteFields(ctx)
        case 'app':
            return getAppDeleteFields(ctx)
    }
}

/**
 * Gets the appropriate restore fields based on level
 */
export function getRestoreFieldsByLevel(level: DeleteLevel, ctx: AuditContext = {}): Record<string, unknown> {
    switch (level) {
        case 'upl':
            return getUplRestoreFields(ctx)
        case 'mhb':
            return getMhbRestoreFields(ctx)
        case 'app':
            return getAppRestoreFields(ctx)
    }
}

/**
 * Gets the deleted field name for a specific level
 */
export function getDeletedFieldName(level: DeleteLevel): string {
    switch (level) {
        case 'upl':
            return UPL_FIELDS.DELETED
        case 'mhb':
            return MHB_FIELDS.DELETED
        case 'app':
            return APP_FIELDS.DELETED
    }
}
