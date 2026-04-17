/**
 * Database utilities for safe query construction and system fields management
 */

export { escapeLikeWildcards } from './escaping'
export { buildSetLocalStatementTimeoutSql, formatStatementTimeoutLiteral } from './statementTimeout'
export { queryMany, queryOne, queryOneOrThrow, executeCount, NotFoundError } from './query'
export { withAdvisoryLock, tryWithAdvisoryLock } from './locks'
export { withTransaction } from './transactions'
export {
    createDbSession,
    createDbExecutor,
    createRequestDbContext,
    getRequestDbContext,
    getRequestDbExecutor,
    getRequestDbSession,
    type CreateDbExecutorOptions,
    type CreateDbSessionOptions,
    type DbExecutor,
    type DbSession,
    type RequestDbContext,
    type RequestWithDbContext,
    type SqlQueryable
} from './manager'
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

export {
    getCatalogSystemFieldDefinitions,
    getCatalogSystemFieldDefinition,
    getCatalogSystemFieldSeedInputs,
    buildCatalogSystemFieldDefinitionSeedRecord,
    getCatalogSystemFieldDefinitionSeedRecords,
    getReservedCatalogSystemFieldCodenames,
    getDefaultCatalogSystemFieldStates,
    validateCatalogSystemFieldToggleSet,
    deriveApplicationLifecycleContract,
    derivePlatformSystemFieldsContract,
    normalizeApplicationLifecycleContract,
    resolveApplicationLifecycleContractFromConfig,
    resolvePlatformSystemFieldsContractFromConfig,
    type CatalogSystemFieldToggleValidationResult,
    type CatalogSystemFieldDefinitionSeedInput,
    type CatalogSystemFieldDefinitionSeedRecord,
    type PlatformSystemFieldFamilyContract,
    type PlatformSystemFieldsContract
} from './catalogSystemFields'

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
    getDeletedFieldName,
    activeAppRowCondition,
    softDeleteSetClause
} from './softDelete'

// User lookup utilities
export { lookupUserEmail } from './userLookup'
