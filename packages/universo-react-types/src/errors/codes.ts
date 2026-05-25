export const UpErrorCode = {
    INTENT_INVALID: 'INTENT_INVALID',
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    RATE_LIMITED: 'RATE_LIMITED',
    NOT_FOUND: 'NOT_FOUND',
    INVALID_STATE: 'INVALID_STATE',
    CONFLICT: 'CONFLICT',
    PERMISSION_DENIED: 'PERMISSION_DENIED'
} as const
export type UpErrorCodeT = (typeof UpErrorCode)[keyof typeof UpErrorCode]

export interface UpError {
    code: UpErrorCodeT
    message?: string
    details?: unknown
}
