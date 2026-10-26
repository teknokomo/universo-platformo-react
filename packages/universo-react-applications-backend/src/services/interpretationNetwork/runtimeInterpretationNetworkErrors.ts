export const interpretationNetworkCommandErrorCodes = {
    featureNotReady: 'INTERPRETATION_NETWORK_FEATURE_NOT_READY',
    commandNotImplemented: 'INTERPRETATION_NETWORK_COMMAND_NOT_IMPLEMENTED',
    invalidBody: 'INTERPRETATION_NETWORK_INVALID_BODY',
    invalidParams: 'INTERPRETATION_NETWORK_INVALID_PARAMS',
    duplicateSystemStructure: 'INTERPRETATION_NETWORK_DUPLICATE_SYSTEM_STRUCTURE',
    malformedSystemStructure: 'INTERPRETATION_NETWORK_MALFORMED_SYSTEM_STRUCTURE',
    unsupportedMode: 'INTERPRETATION_NETWORK_UNSUPPORTED_STRUCTURE_MODE',
    sourceNotFound: 'INTERPRETATION_NETWORK_SOURCE_NOT_FOUND',
    templateNotFound: 'INTERPRETATION_NETWORK_TEMPLATE_NOT_FOUND',
    versionConflict: 'INTERPRETATION_NETWORK_VERSION_CONFLICT',
    invalidMatrix: 'INTERPRETATION_NETWORK_INVALID_MATRIX',
    missingMetadata: 'INTERPRETATION_NETWORK_MISSING_METADATA',
    nonSystemStructuresExist: 'INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST',
    invalidMaterial: 'INTERPRETATION_NETWORK_INVALID_MATERIAL',
    invalidCell: 'INTERPRETATION_NETWORK_INVALID_CELL',
    permissionDenied: 'INTERPRETATION_NETWORK_PERMISSION_DENIED',
    rowNotFound: 'INTERPRETATION_NETWORK_ROW_NOT_FOUND'
} as const

/** Stable domain error translated by Interpretation Network controllers. */
export class InterpretationNetworkCommandError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: string,
        message: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message)
        this.name = 'InterpretationNetworkCommandError'
    }
}
