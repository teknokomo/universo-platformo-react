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
        return {
            message: error.response?.data?.error || error.message,
            code: error.response?.data?.code,
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
