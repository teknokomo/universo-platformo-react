import axios from 'axios'

/**
 * Standardized API error structure
 */
export interface ApiError {
    message: string
    code?: string
    status?: number
}

/**
 * Extracts error information from various error types
 * @param error - Unknown error object (axios, Error, or other)
 * @returns Normalized ApiError object
 *
 * @example
 * ```typescript
 * try {
 *   await api.createMember(data)
 * } catch (error) {
 *   const apiError = extractAxiosError(error)
 *   console.error(apiError.message, apiError.status)
 * }
 * ```
 */
export function extractAxiosError(error: unknown): ApiError {
    if (axios.isAxiosError(error)) {
        const payload = error.response?.data as
            | {
                  error?: unknown
                  message?: unknown
                  code?: unknown
                  detail?: unknown
              }
            | undefined
        const nestedError = payload?.error
        const message =
            typeof nestedError === 'string'
                ? nestedError
                : typeof payload?.message === 'string'
                ? payload.message
                : typeof payload?.detail === 'string'
                ? payload.detail
                : error.message
        const code =
            typeof payload?.code === 'string'
                ? payload.code
                : nestedError && typeof nestedError === 'object' && 'code' in nestedError && typeof nestedError.code === 'string'
                ? nestedError.code
                : undefined
        return {
            message,
            code,
            status: error.response?.status
        }
    }

    if (error instanceof Error) {
        return { message: error.message }
    }

    return { message: 'Unknown error occurred' }
}

/**
 * Checks if error is an AxiosError with optional specific error code
 * @param error - Unknown error object
 * @param code - Optional error code to match (e.g., 'METAVERSE_MEMBER_EXISTS')
 * @returns True if error is AxiosError and matches code (if provided)
 *
 * @example
 * ```typescript
 * if (isApiError(error, 'USER_NOT_FOUND')) {
 *   console.error('User not found')
 * }
 * ```
 */
export function isApiError(error: unknown, code?: string): boolean {
    if (!axios.isAxiosError(error)) return false
    if (!code) return true
    return error.response?.data?.code === code
}

/**
 * Checks if error has specific HTTP status code
 * @param error - Unknown error object
 * @param status - HTTP status code to match (e.g., 404, 409)
 * @returns True if error is AxiosError with matching status code
 *
 * @example
 * ```typescript
 * if (isHttpStatus(error, 404)) {
 *   console.error('Resource not found')
 * }
 * ```
 */
export function isHttpStatus(error: unknown, status: number): boolean {
    return axios.isAxiosError(error) && error.response?.status === status
}
