import { validatePlatformMigrations } from '../validate'
import type { PlatformMigrationFile } from '../types'

const createMigration = (overrides: Partial<PlatformMigrationFile> = {}): PlatformMigrationFile => ({
    id: 'CreateMetahubsSchema1766351182000',
    version: '1766351182000',
    scope: {
        kind: 'platform_schema',
        key: 'metahubs'
    },
    sourceKind: 'file',
    up: async () => Promise.resolve(),
    ...overrides
})

describe('validatePlatformMigrations', () => {
    it('reports duplicate ids and versions', () => {
        const result = validatePlatformMigrations([
            createMigration(),
            createMigration({
                id: 'CreateApplicationsSchema1800000000000',
                version: '1766351182000',
                scope: { kind: 'platform_schema', key: 'applications' }
            }),
            createMigration()
        ])

        expect(result.ok).toBe(false)
        expect(result.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ message: 'Duplicate migration id detected' }),
                expect.objectContaining({ message: expect.stringContaining('duplicated by') })
            ])
        )
    })

    it('rejects transaction advisory locks without a transaction', () => {
        const result = validatePlatformMigrations([
            createMigration({
                id: 'UnsafeMigration1800000000001',
                version: '1800000000001',
                transactionMode: 'none',
                lockMode: 'transaction_advisory'
            })
        ])

        expect(result.ok).toBe(false)
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                level: 'error',
                message: 'transactionMode="none" cannot be combined with lockMode="transaction_advisory"'
            })
        )
    })

    it('warns when destructive migrations omit explicit review', () => {
        const result = validatePlatformMigrations([
            createMigration({
                id: 'DropLegacyIndex1800000000002',
                version: '1800000000002',
                isDestructive: true
            })
        ])

        expect(result.ok).toBe(true)
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                level: 'warning',
                message: 'Destructive migration should declare requiresReview=true'
            })
        )
    })

    it('accepts synthetic cross-schema platform scope keys', () => {
        const result = validatePlatformMigrations([
            createMigration({
                id: 'OptimizeRlsPolicies1800000000200',
                version: '1800000000200',
                scope: { kind: 'platform_schema', key: 'cross_schema' }
            })
        ])

        expect(result.ok).toBe(true)
        expect(result.issues).toEqual([])
    })
})
