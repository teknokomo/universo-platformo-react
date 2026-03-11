import { calculateMigrationChecksum, createMigrationRunId } from '../checksum'
import type { PlatformMigrationFile } from '../types'

const createMigration = (overrides: Partial<PlatformMigrationFile> = {}): PlatformMigrationFile => ({
    id: 'CreateMetahubsSchema1766351182000',
    version: '1766351182000',
    scope: {
        kind: 'platform_schema',
        key: 'metahubs'
    },
    sourceKind: 'file',
    transactionMode: 'single',
    lockMode: 'transaction_advisory',
    summary: 'Create metahubs schema',
    up: async () => Promise.resolve(),
    ...overrides
})

describe('calculateMigrationChecksum', () => {
    it('uses stable metadata instead of function source text', () => {
        const checksumA = calculateMigrationChecksum(
            createMigration({
                up: async () => Promise.resolve()
            })
        )
        const checksumB = calculateMigrationChecksum(
            createMigration({
                up: async () => {
                    return Promise.resolve()
                }
            })
        )

        expect(checksumA).toBe(checksumB)
    })

    it('changes when explicit checksumSource changes', () => {
        const checksumA = calculateMigrationChecksum(
            createMigration({
                checksumSource: 'v1'
            })
        )
        const checksumB = calculateMigrationChecksum(
            createMigration({
                checksumSource: 'v2'
            })
        )

        expect(checksumA).not.toBe(checksumB)
    })
})

describe('createMigrationRunId', () => {
    it('returns a UUID v7 identifier', () => {
        const runId = createMigrationRunId()

        expect(runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })
})
