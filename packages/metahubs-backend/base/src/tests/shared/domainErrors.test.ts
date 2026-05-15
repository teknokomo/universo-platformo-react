import {
    MetahubDomainError,
    MetahubMigrationRequiredError,
    MetahubPoolExhaustedError,
    MetahubSchemaLockTimeoutError,
    MetahubMigrationApplyLockTimeoutError
} from '../../domains/shared/domainErrors'

describe('MetahubDomainError', () => {
    it('stores statusCode, code, and message', () => {
        const err = new MetahubDomainError({
            message: 'Something went wrong',
            statusCode: 400,
            code: 'VALIDATION_ERROR'
        })

        expect(err.message).toBe('Something went wrong')
        expect(err.statusCode).toBe(400)
        expect(err.code).toBe('VALIDATION_ERROR')
        expect(err.name).toBe('MetahubDomainError')
        expect(err).toBeInstanceOf(Error)
    })

    it('stores optional details', () => {
        const err = new MetahubDomainError({
            message: 'Not found',
            statusCode: 404,
            code: 'NOT_FOUND',
            details: { entity: 'object', id: '123' }
        })

        expect(err.details).toEqual({ entity: 'object', id: '123' })
    })

    it('omits details when not provided', () => {
        const err = new MetahubDomainError({
            message: 'Conflict',
            statusCode: 409,
            code: 'CONFLICT'
        })

        expect(err.details).toBeUndefined()
    })
})

describe('MetahubMigrationRequiredError', () => {
    it('sets statusCode 428 and code MIGRATION_REQUIRED', () => {
        const err = new MetahubMigrationRequiredError('Schema migration needed')

        expect(err.statusCode).toBe(428)
        expect(err.code).toBe('MIGRATION_REQUIRED')
        expect(err.message).toBe('Schema migration needed')
        expect(err.name).toBe('MetahubMigrationRequiredError')
        expect(err).toBeInstanceOf(MetahubDomainError)
    })

    it('accepts optional details', () => {
        const err = new MetahubMigrationRequiredError('Migrate', { currentVersion: 3, targetVersion: 5 })

        expect(err.details).toEqual({ currentVersion: 3, targetVersion: 5 })
    })
})

describe('MetahubPoolExhaustedError', () => {
    it('sets statusCode 503 and code CONNECTION_POOL_EXHAUSTED', () => {
        const err = new MetahubPoolExhaustedError('Pool exhausted')

        expect(err.statusCode).toBe(503)
        expect(err.code).toBe('CONNECTION_POOL_EXHAUSTED')
        expect(err.name).toBe('MetahubPoolExhaustedError')
        expect(err).toBeInstanceOf(MetahubDomainError)
    })
})

describe('MetahubSchemaLockTimeoutError', () => {
    it('sets statusCode 503 and code SCHEMA_LOCK_TIMEOUT', () => {
        const err = new MetahubSchemaLockTimeoutError('Lock timeout')

        expect(err.statusCode).toBe(503)
        expect(err.code).toBe('SCHEMA_LOCK_TIMEOUT')
        expect(err.name).toBe('MetahubSchemaLockTimeoutError')
        expect(err).toBeInstanceOf(MetahubDomainError)
    })
})

describe('MetahubMigrationApplyLockTimeoutError', () => {
    it('sets statusCode 409 and code MIGRATION_APPLY_LOCK_TIMEOUT', () => {
        const err = new MetahubMigrationApplyLockTimeoutError('Migration lock timeout')

        expect(err.statusCode).toBe(409)
        expect(err.code).toBe('MIGRATION_APPLY_LOCK_TIMEOUT')
        expect(err.name).toBe('MetahubMigrationApplyLockTimeoutError')
        expect(err).toBeInstanceOf(MetahubDomainError)
    })
})
