export type MetahubErrorCode =
    | 'MIGRATION_REQUIRED'
    | 'CONNECTION_POOL_EXHAUSTED'
    | 'SCHEMA_LOCK_TIMEOUT'
    | 'MIGRATION_APPLY_LOCK_TIMEOUT'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'LIMIT_REACHED'
    | 'SCHEMA_SYNC_FAILED'
    | 'VALIDATION_ERROR'
    | 'COPY_CLEANUP_FAILED'
    | 'COPY_COMPONENTS_FAILED'
    | 'PUBLICATION_COMPENSATION_FAILED'
    | 'APPLICATION_COMPENSATION_FAILED'
    | 'TRANSFER_NOT_ALLOWED'
    | 'CODENAME_CONFLICT'
    | 'TABLE_CHILD_LIMIT_REACHED'
    | 'TABLE_COMPONENT_LIMIT_REACHED'
    | 'TABLE_DISPLAY_COMPONENT_FORBIDDEN'
    | 'SYSTEM_COMPONENT_PROTECTED'
    | 'DISPLAY_COMPONENT_TRANSFER_BLOCKED'
    | 'BRANCH_CREATION_IN_PROGRESS'
    | 'BRANCH_DELETION_IN_PROGRESS'
    | 'BRANCH_CODENAME_EXISTS'
    | 'DEFAULT_BRANCH_UNDELETABLE'
    | 'BRANCH_CREATION_FAILED'
    | 'BRANCH_CLEANUP_FAILED'

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

export class MetahubNotFoundError extends MetahubDomainError {
    constructor(entity: string, id?: string) {
        super({
            message: `${entity} not found`,
            statusCode: 404,
            code: 'NOT_FOUND',
            details: { entity, ...(id != null ? { id } : {}) }
        })
        this.name = 'MetahubNotFoundError'
    }
}

export class MetahubConflictError extends MetahubDomainError {
    constructor(message: string, details?: Record<string, unknown>) {
        super({ message, statusCode: 409, code: 'CONFLICT', details })
        this.name = 'MetahubConflictError'
    }
}

export class MetahubLimitReachedError extends MetahubDomainError {
    constructor(entity: string, limit: number, details?: Record<string, unknown>) {
        super({
            message: `${entity} limit reached`,
            statusCode: 409,
            code: 'LIMIT_REACHED',
            details: { entity, limit, ...details }
        })
        this.name = 'MetahubLimitReachedError'
    }
}

export class MetahubSchemaSyncError extends MetahubDomainError {
    public readonly operation: string
    public declare readonly cause?: unknown

    constructor(operation: string, cause?: unknown) {
        super({
            message: 'Schema sync failed',
            statusCode: 500,
            code: 'SCHEMA_SYNC_FAILED',
            details: { operation }
        })
        this.name = 'MetahubSchemaSyncError'
        this.operation = operation
        if (cause) this.cause = cause
    }
}

export class MetahubValidationError extends MetahubDomainError {
    constructor(message: string, details?: Record<string, unknown>) {
        super({ message, statusCode: 400, code: 'VALIDATION_ERROR', details })
        this.name = 'MetahubValidationError'
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
