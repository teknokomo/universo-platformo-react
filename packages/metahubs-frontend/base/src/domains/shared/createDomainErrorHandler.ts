type ErrorCodeHandler = (data: Record<string, unknown>, t: TFunction) => string

type TFunction = (key: string, defaultValueOrOptions?: string | Record<string, unknown>, options?: Record<string, unknown>) => string

type EnqueueSnackbar = (message: string, options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' }) => void

interface ApiErrorResponse {
    code?: string
    message?: string
    error?: string
    [key: string]: unknown
}

type DomainMutationError = Error & {
    response?: {
        status?: number
        data?: ApiErrorResponse
    }
}

/**
 * Creates a domain error handler that maps backend error codes
 * to i18n-translated snackbar messages.
 * Eliminates repetitive if/else chains in mutation onError callbacks.
 *
 * @example
 * ```ts
 * const handleAttributeError = createDomainErrorHandler({
 *   ATTRIBUTE_LIMIT_REACHED: (data, t) => t('fieldDefinitions.limitReached', { limit: data.limit ?? '—' }),
 *   TABLE_CHILD_LIMIT_REACHED: (data, t) => t('fieldDefinitions.tableValidation.maxChildAttributes', { max: data.maxChildAttributes ?? '—' }),
 * })
 *
 * // In mutation onError:
 * onError: (error) => {
 *   rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
 *   handleAttributeError(error, t, enqueueSnackbar, 'fieldDefinitions.createError')
 * }
 * ```
 */
export function createDomainErrorHandler(errorCodeMap: Record<string, ErrorCodeHandler>) {
    return (error: DomainMutationError, t: TFunction, enqueueSnackbar: EnqueueSnackbar, fallbackKey: string): void => {
        const responseData = error?.response?.data
        const errorCode = responseData?.code

        if (errorCode && errorCodeMap[errorCode]) {
            enqueueSnackbar(errorCodeMap[errorCode](responseData as Record<string, unknown>, t), { variant: 'warning' })
            return
        }

        const backendMessage = responseData?.message || responseData?.error
        enqueueSnackbar((typeof backendMessage === 'string' ? backendMessage : undefined) || error.message || t(fallbackKey), {
            variant: 'error'
        })
    }
}

export type { DomainMutationError, ApiErrorResponse, ErrorCodeHandler }
