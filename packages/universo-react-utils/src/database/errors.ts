/**
 * Checks whether the given error matches a DB connect timeout reported by pg/pg-pool.
 * Used for deterministic 503 mapping in API layers.
 */
export const isDatabaseConnectTimeoutError = (error: unknown): error is Error => {
    if (!(error instanceof Error)) return false
    const message = error.message.toLowerCase()
    return message.includes('timeout exceeded when trying to connect') || message.includes('connection terminated unexpectedly')
}

type DbDriverErrorLike = {
    code?: unknown
    constraint?: unknown
    detail?: unknown
}

type DbErrorLike = {
    code?: unknown
    constraint?: unknown
    detail?: unknown
    driverError?: DbDriverErrorLike
}

const asString = (value: unknown): string | undefined => (typeof value === 'string' && value.length > 0 ? value : undefined)

export const getDbErrorCode = (error: unknown): string | undefined => {
    if (!error || typeof error !== 'object') return undefined
    const dbError = error as DbErrorLike
    return asString(dbError.code) ?? asString(dbError.driverError?.code)
}

export const getDbErrorConstraint = (error: unknown): string | undefined => {
    if (!error || typeof error !== 'object') return undefined
    const dbError = error as DbErrorLike
    return asString(dbError.constraint) ?? asString(dbError.driverError?.constraint)
}

export const getDbErrorDetail = (error: unknown): string | undefined => {
    if (!error || typeof error !== 'object') return undefined
    const dbError = error as DbErrorLike
    return asString(dbError.detail) ?? asString(dbError.driverError?.detail)
}

export const isUniqueViolation = (error: unknown): boolean => getDbErrorCode(error) === '23505'

export const isSlugUniqueViolation = (error: unknown): boolean => {
    if (!isUniqueViolation(error)) return false
    const constraint = (getDbErrorConstraint(error) ?? '').toLowerCase()
    const detail = (getDbErrorDetail(error) ?? '').toLowerCase()
    return constraint.includes('slug') || detail.includes('(slug)')
}
