export type MetahubErrorCode = 'MIGRATION_REQUIRED' | 'CONNECTION_POOL_EXHAUSTED' | 'SCHEMA_LOCK_TIMEOUT' | 'MIGRATION_APPLY_LOCK_TIMEOUT'

export interface MetahubDomainErrorPayload {
    message: string
    statusCode: number
    code: MetahubErrorCode
    details?: Record<string, unknown>
}

export class MetahubDomainError extends Error {
    public readonly statusCode: number
    public readonly code: MetahubErrorCode
    public readonly details?: Record<string, unknown>

    constructor(payload: MetahubDomainErrorPayload) {
        super(payload.message)
        this.name = 'MetahubDomainError'
        this.statusCode = payload.statusCode
        this.code = payload.code
        this.details = payload.details
    }
}

export class MetahubMigrationRequiredError extends MetahubDomainError {
    constructor(message: string, details?: Record<string, unknown>) {
        super({
            message,
            statusCode: 428,
            code: 'MIGRATION_REQUIRED',
            details
        })
        this.name = 'MetahubMigrationRequiredError'
    }
}

export class MetahubPoolExhaustedError extends MetahubDomainError {
    constructor(message: string, details?: Record<string, unknown>) {
        super({
            message,
            statusCode: 503,
            code: 'CONNECTION_POOL_EXHAUSTED',
            details
        })
        this.name = 'MetahubPoolExhaustedError'
    }
}

export class MetahubSchemaLockTimeoutError extends MetahubDomainError {
    constructor(message: string, details?: Record<string, unknown>) {
        super({
            message,
            statusCode: 503,
            code: 'SCHEMA_LOCK_TIMEOUT',
            details
        })
        this.name = 'MetahubSchemaLockTimeoutError'
    }
}

export class MetahubMigrationApplyLockTimeoutError extends MetahubDomainError {
    constructor(message: string, details?: Record<string, unknown>) {
        super({
            message,
            statusCode: 409,
            code: 'MIGRATION_APPLY_LOCK_TIMEOUT',
            details
        })
        this.name = 'MetahubMigrationApplyLockTimeoutError'
    }
}

export const isMetahubDomainError = (error: unknown): error is MetahubDomainError => {
    return (
        error instanceof MetahubDomainError ||
        (error instanceof Error &&
            typeof (error as { statusCode?: unknown }).statusCode === 'number' &&
            typeof (error as { code?: unknown }).code === 'string')
    )
}

export const isKnexPoolTimeoutError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error)
    return (
        message.includes('Knex: Timeout acquiring a connection') ||
        message.includes('Timeout acquiring a connection') ||
        message.toLowerCase().includes('timeout exceeded when trying to connect')
    )
}
