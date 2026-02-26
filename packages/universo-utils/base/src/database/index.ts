/**
 * Database utilities for safe query construction and system fields management
 */

export { escapeLikeWildcards } from './escaping'
export { getRequestManager, type RequestWithDbContext } from './manager'
export {
    isDatabaseConnectTimeoutError,
    getDbErrorCode,
    getDbErrorConstraint,
    getDbErrorDetail,
    isUniqueViolation,
    isSlugUniqueViolation
} from './errors'

// System fields constants and helpers
export {
    UPL_FIELDS,
    MHB_FIELDS,
    APP_FIELDS,
    type AccessLevel,
    type AuditContext,
    getUplCreateFields,
    getUplUpdateFields,
    getMhbCreateFields,
    getAppCreateFields,
    getUplDeleteFields,
    getMhbDeleteFields,
    getAppDeleteFields,
    getUplRestoreFields,
    getMhbRestoreFields,
    getAppRestoreFields,
    getUplArchiveFields,
    getUplLockFields,
    getUplUnlockFields
} from './systemFields'

// Soft delete utilities
export {
    type DeleteLevel,
    type SoftDeleteOptions,
    type UplSoftDeleteOptions,
    type MhbSoftDeleteOptions,
    getUplDeleteConditions,
    getMhbDeleteConditions,
    getAppDeleteConditions,
    getDeleteFieldsByLevel,
    getRestoreFieldsByLevel,
    getDeletedFieldName
} from './softDelete'

// User lookup utilities
export { lookupUserEmail } from './userLookup'
