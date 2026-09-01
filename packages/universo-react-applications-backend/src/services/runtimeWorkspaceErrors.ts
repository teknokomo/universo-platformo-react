export const WORKSPACE_SEED_RESET_ERROR_CODES = {
    workspaceNotFound: 'WORKSPACE_NOT_FOUND',
    resetFailed: 'WORKSPACE_SEED_RESET_FAILED'
} as const

export type WorkspaceSeedResetErrorCode = (typeof WORKSPACE_SEED_RESET_ERROR_CODES)[keyof typeof WORKSPACE_SEED_RESET_ERROR_CODES]

/**
 * Domain error for the explicit workspace seed reset command.
 *
 * Keeping this error separate from generic database errors lets the HTTP
 * controller expose a stable, user-safe response without turning an outage or
 * an RLS failure into a misleading conflict response.
 */
export class WorkspaceSeedResetError extends Error {
    readonly code: WorkspaceSeedResetErrorCode
    readonly cause?: unknown

    constructor(code: WorkspaceSeedResetErrorCode, message: string, cause?: unknown) {
        super(message)
        this.name = 'WorkspaceSeedResetError'
        this.code = code
        this.cause = cause
    }
}
