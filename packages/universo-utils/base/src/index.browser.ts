// Browser-friendly entrypoint for @universo/utils
// Exposes the same public surface as the Node build while stubbing Node-only helpers.

export * as validation from './validation'
export * as delta from './delta'
export * as serialization from './serialization'
export * as math from './math'
export * as updl from './updl'
export * as publish from './publish'
export * as env from './env/index.browser'
export * as uuid from './uuid'
export * as localizedContent from './vlc'
export * as routes from './routes'
export { UPDLProcessor } from './updl/UPDLProcessor'
export { getApiBaseURL, getUIBaseURL, getEnv, isDevelopment, isProduction, parsePositiveInt, parseNonNegativeInt } from './env/index.browser'

// Date formatting utilities (UI-only)
export { formatDate, formatRange } from './ui-utils/formatDate'

// API error handling utilities
export * as api from './api/error-handlers'
export * from './api/error-handlers'
export { extractPaginationMeta, type PaginationMeta as UtilsPaginationMeta } from './api/pagination'
export { fetchAllPaginatedItems, type FetchPageFn, type FetchAllPaginatedOptions } from './api/fetchAllPaginatedItems'

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
    getVLCString,
    getVLCPrimaryString,
    getCodenamePrimary,
    getVLCStringWithFallback,
    getSimpleLocalizedValue,
    normalizeLocale
} from './vlc'

// Number validation utilities for precision/scale constraints
export {
    normalizeApplicationCopyOptions,
    normalizeAttributeCopyOptions,
    normalizeBranchCopyOptions,
    normalizeElementCopyOptions,
    normalizeHubCopyOptions,
    normalizeCatalogCopyOptions,
    normalizeSetCopyOptions,
    normalizeEnumerationCopyOptions,
    normalizeLayoutCopyOptions,
    normalizeConstantCopyOptions
} from './validation/copyOptions'

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

// Catalog system field helpers (browser-safe)
export {
    getCatalogSystemFieldDefinitions,
    getCatalogSystemFieldDefinition,
    getCatalogSystemFieldSeedInputs,
    buildCatalogSystemAttributeSeedRecord,
    getCatalogSystemAttributeSeedRecords,
    getReservedCatalogSystemFieldCodenames,
    getDefaultCatalogSystemFieldStates,
    validateCatalogSystemFieldToggleSet,
    deriveApplicationLifecycleContract,
    derivePlatformSystemFieldsContract,
    normalizeApplicationLifecycleContract,
    resolveApplicationLifecycleContractFromConfig,
    resolvePlatformSystemFieldsContractFromConfig
} from './database/catalogSystemFields'
export type {
    CatalogSystemFieldToggleValidationResult,
    CatalogSystemAttributeSeedInput,
    CatalogSystemAttributeSeedRecord,
    PlatformSystemFieldFamilyContract,
    PlatformSystemFieldsContract
} from './database/catalogSystemFields'

// Optimistic locking error utilities
export { OptimisticLockError, type ConflictInfo } from './errors/OptimisticLockError'
export { isOptimisticLockConflict, extractConflictInfo, hasAxiosResponse } from './errors/conflictDetection'

// UUID utilities (browser-safe)
export { generateUuidV7, isValidUuid } from './uuid'

// Explicit imports to avoid pulling in Node "net" dependency when bundling for the browser.
import { createTimeSyncEstimator } from './net/timeSync'
import { updateSeqState, reconcileAck } from './net/sequencing'

// Provide a no-op stub for ensurePortAvailable so that consumers receive a clear runtime error
// if they accidentally call it in browser environments. We intentionally avoid importing the
// Node-based implementation to keep the bundle tree-shakeable and free of Node built-ins.
async function ensurePortAvailable(): Promise<never> {
    throw new Error('ensurePortAvailable is not available in browser environments')
}

export const net = {
    createTimeSyncEstimator,
    updateSeqState,
    reconcileAck,
    ensurePortAvailable
}

export { createTimeSyncEstimator, updateSeqState, reconcileAck }

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
