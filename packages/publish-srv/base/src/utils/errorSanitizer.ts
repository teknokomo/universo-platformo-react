// Error sanitizer for safe client responses (MVP)

export function sanitizeError(error: unknown, isProduction = process.env.NODE_ENV === 'production'): string {
    if (!isProduction) {
        return error instanceof Error ? error.message : 'Unknown error'
    }

    const safeMessages = [
        'Validation failed',
        'Resource not found',
        'Access denied',
        'Invalid request',
        'Too many requests, please try again later.'
    ]

    const message = error instanceof Error ? error.message : 'Internal server error'
    const isSafe = safeMessages.some((m) => message.includes(m))
    return isSafe ? message : 'Internal server error'
}
