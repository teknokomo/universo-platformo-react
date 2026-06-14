export {
    hashToPositiveInt,
    createPlayCanvasEditorNumericIds,
    createPlayCanvasEditorNumericAssetId,
    buildBasePath,
    toWsUrl,
    createPlayCanvasEditorFullBootEndpointDescriptor,
    buildDefaultEditorSchema,
    createDefaultRealtimeSceneSettings,
    createDefaultProjectSettingsDocument,
    normalizeArtifactBaseUrl,
    getLocalizedName,
    createPlayCanvasEditorFullBootConfig,
    createPlayCanvasEditorCompatibilityConfig
} from './config/index.js'

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
    PLAYCANVAS_EDITOR_COMPATIBILITY_TOKEN_HEADER,
    resolveCompatibilityToken,
    timingSafeEqualString,
    resolveTokenSecret,
    encodeTokenPart,
    decodeTokenPart,
    signTokenPart,
    createPlayCanvasEditorCompatibilityTokenService,
    validateCompatibilityToken,
    validateFullBootClaims
} from './tokens/index.js'

export {
    validateParams,
    sendInvalid,
    sendUnauthorized,
    createCloudOnlyNoOp,
    createPlayCanvasEditorCompatibilityRoutes
} from './routes/index.js'

export {
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
    isAllowedShareDbDocument,
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
    PlayCanvasEditorRealtimeDocumentPort,
    PlayCanvasEditorRealtimeRuntimeDeps,
    PlayCanvasEditorRealtimeRuntimeHandle,
    RealtimeCollection,
    RealtimeSurface,
    ShareDbDocumentMetadata
} from './realtime/index.js'
