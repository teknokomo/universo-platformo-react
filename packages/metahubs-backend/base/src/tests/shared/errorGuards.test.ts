const mockSyncMetahubSchema = jest.fn()

jest.mock('../../domains/metahubs/services/schemaSync', () => ({
    __esModule: true,
    syncMetahubSchema: (...args) => mockSyncMetahubSchema(...args)
}))

import { isSchemaSyncFailure, syncMetahubSchemaOrThrow, isUniqueViolation } from '../../domains/shared/errorGuards'
import { MetahubSchemaSyncError } from '../../domains/shared/domainErrors'

// ─── isSchemaSyncFailure ───

describe('isSchemaSyncFailure', () => {
    it('returns true for object with code SCHEMA_SYNC_FAILED', () => {
        expect(isSchemaSyncFailure({ code: 'SCHEMA_SYNC_FAILED', operation: 'update', cause: null })).toBe(true)
    })

    it('returns false for other objects', () => {
        expect(isSchemaSyncFailure({ code: 'OTHER' })).toBe(false)
    })

    it('returns false for null / non-objects', () => {
        expect(isSchemaSyncFailure(null)).toBe(false)
        expect(isSchemaSyncFailure('string')).toBe(false)
    })
})

// ─── syncMetahubSchemaOrThrow ───

describe('syncMetahubSchemaOrThrow', () => {
    beforeEach(() => jest.clearAllMocks())

    it('resolves when syncMetahubSchema succeeds', async () => {
        mockSyncMetahubSchema.mockResolvedValue(undefined)
        await expect(syncMetahubSchemaOrThrow('mh-1', {} as never, 'user-1', 'create')).resolves.toBeUndefined()
        expect(mockSyncMetahubSchema).toHaveBeenCalledWith('mh-1', expect.anything(), 'user-1')
    })

    it('throws MetahubSchemaSyncError when syncMetahubSchema fails', async () => {
        mockSyncMetahubSchema.mockRejectedValue(new Error('sync boom'))
        await expect(syncMetahubSchemaOrThrow('mh-1', {} as never, 'user-1', 'update')).rejects.toThrow(MetahubSchemaSyncError)
    })
})

// ─── isUniqueViolation ───

describe('isUniqueViolation', () => {
    it('returns true for PostgreSQL code 23505', () => {
        expect(isUniqueViolation({ code: '23505' })).toBe(true)
    })

    it('returns true for "duplicate key value" in message', () => {
        expect(isUniqueViolation({ message: 'ERROR: duplicate key value violates unique constraint' })).toBe(true)
    })

    it('returns false for non-matching objects', () => {
        expect(isUniqueViolation({ code: '42000' })).toBe(false)
        expect(isUniqueViolation({ message: 'Something else' })).toBe(false)
    })

    it('returns false for null / non-objects', () => {
        expect(isUniqueViolation(null)).toBe(false)
        expect(isUniqueViolation(undefined)).toBe(false)
    })
})
