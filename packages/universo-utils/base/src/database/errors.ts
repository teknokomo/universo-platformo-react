/**
 * Checks whether the given error matches a DB connect timeout reported by pg/pg-pool.
 * Used for deterministic 503 mapping in API layers.
 */
export const isDatabaseConnectTimeoutError = (error: unknown): error is Error => {
    if (!(error instanceof Error)) return false
    const message = error.message.toLowerCase()
    return message.includes('timeout exceeded when trying to connect') || message.includes('connection terminated unexpectedly')
}
