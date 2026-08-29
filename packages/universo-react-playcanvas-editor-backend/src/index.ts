export {
    hashToPositiveInt,
    createPlayCanvasEditorNumericIds,
    createPlayCanvasEditorNumericAssetId,
    deriveUniqueNumericIds,
    deriveUniqueNumericAssetIds,
    buildBasePath,
    toWsUrl,
    createPlayCanvasEditorFullBootEndpointDescriptor,
    SCHEMA_CATALOG_VERSION,
    buildEditorSchemaCatalog,
    createDefaultRealtimeSceneSettings,
    createDefaultProjectSettingsDocument,
    normalizeArtifactBaseUrl,
    getLocalizedName,
    createPlayCanvasEditorFullBootConfig,
    createPlayCanvasEditorCompatibilityConfig
} from './config/index.js'

export type { PlayCanvasEditorNumericIdAssignmentInput, PlayCanvasEditorNumericAssetIdInput } from './config/index.js'

export {
    parseSafeHttpOrigin,
    resolveRequestOrigin,
    resolvePlatformApiOrigin,
    normalizeOrigin,
    resolveLoopbackSiblingOrigin,
    addSafeOrigin,
    addConfiguredArtifactOrigins,
    resolveAllowedArtifactOrigins,
    resolveAllowedFullBootArtifactOrigins,
    isAllowedArtifactOrigin,
    isAllowedFullBootArtifactOrigin
} from './middleware/index.js'

export {
    PLAYCANVAS_EDITOR_MAX_DOCUMENT_ID,
    parseCanonicalPlayCanvasEditorDocumentId,
    PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_HEADER,
    resolveCompatibilityToken,
    timingSafeEqualString,
    resolveTokenSecret,
    encodeTokenPart,
    decodeTokenPart,
    signTokenPart,
    createCompatibilityCsrfToken,
    validateCompatibilityCsrfToken,
    createPlayCanvasEditorCompatibilityTokenService,
    validateCompatibilityToken,
    validateFullBootClaims
} from './tokens/index.js'

export {
    createEditorCompatibilityWriteGuard,
    parseEditorAssetUpload,
    normalizeEditorAssetCreateFields,
    normalizeEditorAssetUpdateFields,
    validateParams,
    sendInvalid,
    sendUnauthorized,
    createCloudOnlyNoOp,
    createPlayCanvasEditorCompatibilityRoutes
} from './routes/index.js'

export {
    MAX_REALTIME_MESSAGE_BYTES,
    parseJsonMessage,
    isPingMessage,
    parseRealtimeAuthMessage,
    escapeRegExp,
    normalizeUpgradeBasePath,
    parseUpgradePath,
    closeUnauthorized,
    closeInternalError,
    closePolicyViolation,
    isSocketOpen,
    writeUpgradeTooManyRequests,
    writeUpgradeForbidden,
    isSameHostOrLoopbackSiblingUpgradeOrigin,
    isFullBootUpgradeOriginAllowed,
    getUpgradeRemoteAddress,
    isPlayCanvasRealtimeControlFrame,
    createShareDbWebSocket,
    authorizeFullBootClaims,
    revalidateFullBootClaims,
    asRecordData,
    isJson0ListOperation,
    ensureArrayPathForJson0ListOperation,
    repairSnapshotForJson0ListOperations,
    shareDbPersistedMetadata,
    shareDbPersistQueues,
    shareDbSeedWriteKeys,
    shareDbAllowedDocumentKeys,
    getShareDbPersistedMetadata,
    getShareDbPersistQueues,
    getShareDbSeedWriteKeys,
    getShareDbAllowedDocumentKeys,
    createAllowedShareDbDocumentKeys,
    addAllowedShareDbDocumentKeys,
    isAllowedShareDbDocument,
    grantRealtimeAssetDocuments,
    revokeRealtimeAssetDocuments,
    extendRealtimeAssetAllowList,
    registerRealtimeAssetDocumentSeeder,
    getGrantedRealtimeAssetDocumentIds,
    captureRealtimeAssetDocumentGrantVersions,
    diffRealtimeAssetDocumentIds,
    MAX_REALTIME_ASSET_RECONCILIATION_DOCUMENTS,
    PLAYCANVAS_EDITOR_REALTIME_ASSET_RECONCILIATION_INTERVAL_MS,
    REALTIME_ASSET_DOCUMENT_TOMBSTONE_TTL_MS,
    MAX_REALTIME_ASSET_DOCUMENT_TOMBSTONES_PER_SCOPE,
    isRealtimeAssetDocumentGranted,
    isRealtimeAssetDocumentRevoked,
    sendMessengerEvent,
    createDefaultRealtimeDocument,
    seedShareDbDocument,
    persistShareDbSnapshot,
    queueShareDbSnapshotPersistence,
    isRecoverableShareDbPersistenceConflict,
    createRealtimeScopeKey,
    createScopedShareDbBackend,
    handleRealtimeSocket,
    handleMessengerSocket,
    handleRelaySocket,
    isPlayCanvasEditorFullBootUpgradeRequest,
    assertPlayCanvasEditorRealtimeWorkerTopology,
    attachPlayCanvasEditorFullBootRuntime,
    attachPlayCanvasEditorCompatibilityRuntime
} from './realtime/index.js'

export type {
    PlayCanvasEditorCompatibilityContext,
    PlayCanvasEditorCompatibilityHandler,
    PlayCanvasEditorCompatibilityProjectPort,
    PlayCanvasEditorCompatibilityRouteDeps
} from './routes/index.js'

export type { PlayCanvasEditorCompatibilityTokenService } from './tokens/index.js'

export type {
    PlayCanvasEditorRealtimeDocument,
    PlayCanvasEditorRealtimeAssetDocument,
    PlayCanvasEditorRealtimeDocumentPort,
    PlayCanvasEditorRealtimeRuntimeDeps,
    PlayCanvasEditorRealtimeRuntimeHandle,
    RealtimeCollection,
    RealtimeSurface,
    ShareDbDocumentMetadata,
    ScopedShareDbBackendOptions,
    RealtimeAssetDocumentGrantOptions
} from './realtime/index.js'

export {
    claimPipelineReplay,
    completePipelineReplay,
    createPipelineReplayFingerprint,
    clearPipelineReplayRegistry,
    getPipelineReplayRegistrySize
} from './realtime/pipelineReplay.js'

export type { PipelineReplayDecision, PipelineReplayResult } from './realtime/pipelineReplay.js'
