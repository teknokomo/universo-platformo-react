const MAX_STATEMENT_TIMEOUT_MS = 300_000

const assertStatementTimeoutMs = (timeoutMs: number): number => {
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_STATEMENT_TIMEOUT_MS) {
        throw new Error(`Invalid statement_timeout value: must be a positive integer <= ${MAX_STATEMENT_TIMEOUT_MS}ms`)
    }

    return timeoutMs
}

export const formatStatementTimeoutLiteral = (timeoutMs: number): string => `${assertStatementTimeoutMs(timeoutMs)}ms`

export const buildSetLocalStatementTimeoutSql = (timeoutMs: number): string =>
    `SET LOCAL statement_timeout TO '${formatStatementTimeoutLiteral(timeoutMs)}'`
