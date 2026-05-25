// Universo Platformo | Utils package entrypoint
// Namespaced exports for tree-shaking friendly consumption

export * as validation from './validation'
export * as delta from './delta'
export * as serialization from './serialization'
export * as math from './math'
export * as updl from './updl'
export * as publish from './publish'
export * as env from './env'
export * as uuid from './uuid'
export * as localizedContent from './vlc'
export * as routes from './routes'
export * as auth from './auth'
export * as database from './database'
export * as optimistic from './optimistic'

// Rate limiting utilities (server-side only)
// Note: Import from '@universo/utils/rate-limiting' for direct access
export * as rateLimiting from './rate-limiting'

// Snapshot archive utilities (server-side only — uses node:crypto)
export { computeSnapshotHash, buildSnapshotEnvelope, validateSnapshotEnvelope } from './snapshot/snapshotArchive'

// Export all net utilities including Node.js-only ensurePortAvailable
// Browser builds use index.browser.ts which stubs ensurePortAvailable
import { createTimeSyncEstimator } from './net/timeSync'
import { updateSeqState, reconcileAck } from './net/sequencing'
import { ensurePortAvailable } from './net/ensurePortAvailable'

export const net = {
    createTimeSyncEstimator,
    updateSeqState,
    reconcileAck,
    ensurePortAvailable
}
export { createTimeSyncEstimator, updateSeqState, reconcileAck, ensurePortAvailable }
export { resolveRateLimitKey } from './rate-limiting'

// Direct exports for commonly used classes
export { UPDLProcessor } from './updl/UPDLProcessor'

// Direct exports for commonly used environment utilities
export { getApiBaseURL, getUIBaseURL, getEnv, isDevelopment, isProduction, parsePositiveInt, parseNonNegativeInt } from './env'
export {
    isAdminPanelEnabled,
    isGlobalRolesEnabled,
    isSuperuserEnabled,
    isGlobalAdminEnabled,
    getAdminConfig,
    getGlobalMigrationObjectConfig,
    isGlobalMigrationObjectEnabled,
    type AdminConfig
} from './env'

// Date formatting utilities (UI-only)
export { formatDate, formatRange } from './ui-utils/formatDate'

// API error handling utilities
export * from './api/error-handlers'
export { extractPaginationMeta, type PaginationMeta } from './api/pagination'
export { fetchAllPaginatedItems, type FetchPageFn, type FetchAllPaginatedOptions } from './api/fetchAllPaginatedItems'
export { SAFE_MENU_HREF_RE, isSafeMenuHref, sanitizeMenuHref } from './validation/menuHref'

// Public routes utilities
export {
    API_WHITELIST_URLS,
    PUBLIC_UI_ROUTES,
    isPublicRoute,
    isWhitelistedApiPath,
    type ApiWhitelistUrl,
    type PublicUiRoute
} from './routes'

// Localized Content utilities
export {
    createLocalizedContent,
    createCodenameVLC,
    updateLocalizedContentLocale,
    resolveLocalizedContent,
    getLocalizedContentLocales,
    filterLocalizedContent,
    isLocalizedContent,
    buildVLC,
    ensureVLC,
    ensureCodenameVLC,
    // Getter utilities for frontend/backend
    getVLCString,
    getVLCPrimaryString,
    getCodenamePrimary,
    getVLCStringWithFallback,
    getSimpleLocalizedValue,
    normalizeLocale
} from './vlc'

// Database utilities
export {
    createDbExecutor,
    createDbSession,
    buildSetLocalStatementTimeoutSql,
    escapeLikeWildcards,
    formatStatementTimeoutLiteral,
    lookupUserEmail,
    isDatabaseConnectTimeoutError,
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
} from './database'

// System fields utilities for three-level architecture
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
    getUplUnlockFields,
    getObjectSystemComponents,
    getObjectSystemComponent,
    getObjectSystemComponentSeedInputs,
    buildObjectSystemComponentSeedRecord,
    getObjectSystemComponentSeedRecords,
    getReservedObjectSystemFieldCodenames,
    getDefaultObjectSystemFieldStates,
    validateObjectSystemFieldToggleSet,
    deriveApplicationLifecycleContract,
    derivePlatformSystemFieldsContract,
    normalizeApplicationLifecycleContract,
    resolveApplicationLifecycleContractFromConfig,
    resolvePlatformSystemFieldsContractFromConfig,
    type DeleteLevel,
    type SoftDeleteOptions,
    type UplSoftDeleteOptions,
    type MhbSoftDeleteOptions,
    type ObjectSystemFieldToggleValidationResult,
    type ObjectSystemComponentSeedInput,
    type ObjectSystemComponentSeedRecord,
    type PlatformSystemFieldFamilyContract,
    type PlatformSystemFieldsContract,
    getUplDeleteConditions,
    getMhbDeleteConditions,
    getAppDeleteConditions,
    getDeleteFieldsByLevel,
    getRestoreFieldsByLevel,
    getDeletedFieldName,
    activeAppRowCondition,
    softDeleteSetClause
} from './database'

// Auth feature toggles utilities
export { getAuthFeatureConfig, isRegistrationEnabled, isLoginEnabled, isEmailConfirmationRequired, type AuthFeatureConfig } from './auth'

// Error classes for common error handling patterns
export { OptimisticLockError, type ConflictInfo, isOptimisticLockConflict, extractConflictInfo, hasAxiosResponse } from './errors'

// UUID utilities
export { generateUuidV7, isValidUuid } from './uuid'

// Number validation utilities for precision/scale constraints
export {
    normalizeApplicationCopyOptions,
    normalizeComponentCopyOptions,
    normalizeBranchCopyOptions,
    normalizeRecordCopyOptions,
    normalizeTreeEntityCopyOptions,
    normalizeObjectCollectionCopyOptions,
    normalizeValueGroupCopyOptions,
    normalizeOptionListCopyOptions,
    normalizeLayoutCopyOptions,
    normalizeFixedValueCopyOptions
} from './validation/copyOptions'

export {
    extractObjectCollectionLayoutBehaviorConfig,
    normalizeObjectCollectionRuntimeViewConfig,
    resolveObjectCollectionLayoutBehaviorConfig,
    sanitizeObjectCollectionRuntimeViewConfig,
    setObjectCollectionLayoutBehaviorConfig,
    resolveObjectCollectionRuntimeDashboardLayoutConfig
} from './validation/objectCollectionRuntimeConfig'
export { normalizeDashboardLayoutConfig } from './validation/dashboardLayout'

export {
    validateNumber,
    validateNumberOrThrow,
    getMaxValueForPrecision,
    toNumberRules,
    NUMBER_DEFAULTS,
    type NumberValidationResult,
    type NumberValidationRules
} from './validation/numberValidation'

// Table constraint text builder
export {
    buildTableConstraintText,
    type TranslateFn,
    type TableConstraintParams,
    type TableConstraintResult
} from './validation/tableConstraints'

export {
    WorkspacePolicyError,
    parseWorkspaceModePolicy,
    resolveWorkspaceModeDecision,
    assertPublicationWorkspacePolicyTransition,
    type ResolveWorkspaceModeInput,
    type PublicationWorkspacePolicyTransitionInput
} from './validation/workspacePolicy'

// Optimistic update utilities (pure TypeScript, no React deps)
export {
    isPendingEntity,
    getPendingAction,
    isPendingInteractionBlocked,
    shouldShowPendingFeedback,
    makePendingMarkers,
    revealPendingFeedback,
    getNextOptimisticSortOrder,
    stripPendingMarkers
} from './optimistic'
export type { PendingAction, PendingMarkers, MaybePending, SortOrderLike } from './optimistic'

// Optimistic CRUD cache helpers for React Query consumers
export {
    generateOptimisticId,
    applyOptimisticCreate,
    applyOptimisticUpdate,
    applyOptimisticDelete,
    rollbackOptimisticSnapshots,
    cleanupBreadcrumbCache,
    revealPendingEntityFeedback,
    getNextOptimisticSortOrderFromQueries,
    safeInvalidateQueries,
    safeInvalidateQueriesInactive,
    confirmOptimisticUpdate,
    confirmOptimisticCreate
} from './optimisticCrud'
export type {
    ListCache,
    RowsListCache,
    OptimisticSnapshot,
    OptimisticCreateContext,
    OptimisticUpdateContext,
    OptimisticDeleteContext,
    ApplyOptimisticCreateOptions,
    ApplyOptimisticUpdateOptions,
    ApplyOptimisticDeleteOptions,
    RevealPendingEntityFeedbackOptions,
    ConfirmOptimisticCreateOptions,
    ConfirmOptimisticUpdateOptions
} from './optimisticCrud'
