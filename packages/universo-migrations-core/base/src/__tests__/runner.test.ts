import type { Knex } from 'knex'
import { calculateMigrationChecksum } from '../checksum'
import { runPlatformMigrations } from '../runner'
import type { MigrationCatalogRecord, MigrationCatalogRepository, PlatformMigrationFile } from '../types'

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
    up: async () => Promise.resolve(),
    ...overrides
})

const createCatalog = (latest: MigrationCatalogRecord | null = null): jest.Mocked<MigrationCatalogRepository> => ({
    ensureStorage: jest.fn().mockResolvedValue(undefined),
    findLatest: jest.fn().mockResolvedValue(latest),
    beginRun: jest.fn().mockImplementation(async ({ migration, checksum, summary, meta, status }) => ({
        id: 'run-1',
        scopeKind: migration.scope.kind,
        scopeKey: migration.scope.key,
        sourceKind: migration.sourceKind ?? 'file',
        migrationName: migration.id,
        migrationVersion: migration.version,
        checksum,
        transactionMode: migration.transactionMode ?? 'single',
        lockMode: migration.lockMode ?? 'transaction_advisory',
        status: status ?? 'planned',
        summary: summary ?? null,
        meta: meta ?? null,
        snapshotBefore: null,
        snapshotAfter: null,
        plan: null,
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    })),
    completeRun: jest.fn().mockResolvedValue(undefined)
})

type BoundQueryCall = {
    sql: string
    bindings?: readonly unknown[]
    connection: unknown
}

const defaultBoundQueryResult = (sql: string): unknown => {
    if (sql.includes('pg_try_advisory_xact_lock')) {
        return { rows: [{ acquired: true }] }
    }
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return undefined
    }

    return undefined
}

const createConnectionAwareKnex = (
    resolveBoundQuery: (sql: string, bindings?: readonly unknown[], connection?: unknown) => unknown = defaultBoundQueryResult
) => {
    const connection = { tag: 'session-connection' }
    const boundQueryCalls: BoundQueryCall[] = []
    const raw = jest.fn((sql: string, bindings?: readonly unknown[]) => ({
        connection: jest.fn(async (targetConnection: unknown) => {
            boundQueryCalls.push({
                sql,
                bindings,
                connection: targetConnection
            })
            return resolveBoundQuery(sql, bindings, targetConnection)
        })
    }))
    const trx = {
        raw: jest.fn().mockResolvedValue(undefined)
    }
    const knex = {
        transaction: jest.fn(async (callback: (trxArg: typeof trx) => Promise<void>) => callback(trx)),
        raw,
        client: {
            acquireConnection: jest.fn().mockResolvedValue(connection),
            releaseConnection: jest.fn().mockResolvedValue(undefined),
            destroyRawConnection: jest.fn().mockResolvedValue(undefined)
        }
    }

    return {
        knex: knex as unknown as Knex,
        trx,
        raw,
        boundQueryCalls,
        connection,
        client: knex.client
    }
}

describe('runPlatformMigrations', () => {
    it('applies pending migrations under a coordination lock and records completion', async () => {
        const catalog = createCatalog()
        const { knex, trx, raw } = createConnectionAwareKnex()
        const up = jest.fn().mockResolvedValue(undefined)

        const result = await runPlatformMigrations({
            knex,
            migrations: [createMigration({ up })],
            catalog
        })

        expect(result.applied).toEqual(['CreateMetahubsSchema1766351182000'])
        expect(result.skipped).toEqual([])
        expect(catalog.ensureStorage).toHaveBeenCalledTimes(1)
        expect(catalog.beginRun).toHaveBeenCalledTimes(1)
        expect(catalog.completeRun).toHaveBeenCalledWith('run-1', { status: 'applied' })
        expect(trx.raw).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), expect.any(Array))
        expect(raw).toHaveBeenCalledWith(expect.stringContaining('pg_try_advisory_xact_lock'), expect.any(Array))
        expect(catalog.findLatest.mock.invocationCallOrder[0]).toBeGreaterThan(raw.mock.invocationCallOrder[0] ?? 0)
        expect(up).toHaveBeenCalledTimes(1)
    })

    it('skips already applied migrations with matching checksum', async () => {
        const migration = createMigration()
        const catalog = createCatalog({
            id: 'existing-run',
            scopeKind: migration.scope.kind,
            scopeKey: migration.scope.key,
            sourceKind: 'file',
            migrationName: migration.id,
            migrationVersion: migration.version,
            checksum: calculateMigrationChecksum(migration),
            transactionMode: 'single',
            lockMode: 'transaction_advisory',
            status: 'applied',
            summary: null,
            meta: null,
            snapshotBefore: null,
            snapshotAfter: null,
            plan: null,
            error: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })
        const { knex } = createConnectionAwareKnex()

        const result = await runPlatformMigrations({
            knex,
            migrations: [migration],
            catalog
        })

        expect(result.applied).toEqual([])
        expect(result.skipped).toEqual(['CreateMetahubsSchema1766351182000'])
        expect(result.planned).toEqual([
            expect.objectContaining({
                id: 'CreateMetahubsSchema1766351182000',
                action: 'skip'
            })
        ])
        expect(catalog.beginRun).not.toHaveBeenCalled()
    })

    it('fails on checksum drift', async () => {
        const migration = createMigration()
        const catalog = createCatalog({
            id: 'existing-run',
            scopeKind: migration.scope.kind,
            scopeKey: migration.scope.key,
            sourceKind: 'file',
            migrationName: migration.id,
            migrationVersion: migration.version,
            checksum: 'outdated-checksum',
            transactionMode: 'single',
            lockMode: 'transaction_advisory',
            status: 'applied',
            summary: null,
            meta: null,
            snapshotBefore: null,
            snapshotAfter: null,
            plan: null,
            error: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })
        const { knex } = createConnectionAwareKnex()

        await expect(
            runPlatformMigrations({
                knex,
                migrations: [migration],
                catalog
            })
        ).rejects.toThrow('Migration drift detected')

        expect(catalog.beginRun).not.toHaveBeenCalled()
    })

    it('returns a non-mutating apply plan in dry-run mode', async () => {
        const catalog = createCatalog()
        catalog.isStorageReady = jest.fn().mockResolvedValue(true)
        const { knex } = createConnectionAwareKnex()
        const up = jest.fn().mockResolvedValue(undefined)

        const result = await runPlatformMigrations({
            knex,
            migrations: [createMigration({ up })],
            catalog,
            dryRun: true
        })

        expect(result.dryRun).toBe(true)
        expect(result.applied).toEqual([])
        expect(result.planned).toEqual([
            expect.objectContaining({
                id: 'CreateMetahubsSchema1766351182000',
                action: 'apply'
            })
        ])
        expect(catalog.ensureStorage).not.toHaveBeenCalled()
        expect(catalog.beginRun).not.toHaveBeenCalled()
        expect(up).not.toHaveBeenCalled()
    })

    it('reports drift without throwing in dry-run mode', async () => {
        const migration = createMigration()
        const catalog = createCatalog({
            id: 'existing-run',
            scopeKind: migration.scope.kind,
            scopeKey: migration.scope.key,
            sourceKind: 'file',
            migrationName: migration.id,
            migrationVersion: migration.version,
            checksum: 'outdated-checksum',
            transactionMode: 'single',
            lockMode: 'transaction_advisory',
            status: 'applied',
            summary: null,
            meta: null,
            snapshotBefore: null,
            snapshotAfter: null,
            plan: null,
            error: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })
        catalog.isStorageReady = jest.fn().mockResolvedValue(true)
        const { knex } = createConnectionAwareKnex()

        const result = await runPlatformMigrations({
            knex,
            migrations: [migration],
            catalog,
            dryRun: true
        })

        expect(result.drifted).toEqual(['CreateMetahubsSchema1766351182000'])
        expect(result.planned).toEqual([
            expect.objectContaining({
                id: 'CreateMetahubsSchema1766351182000',
                action: 'drift'
            })
        ])
    })

    it('marks destructive migrations as blocked in dry-run mode', async () => {
        const catalog = createCatalog()
        catalog.isStorageReady = jest.fn().mockResolvedValue(true)
        const { knex } = createConnectionAwareKnex()

        const result = await runPlatformMigrations({
            knex,
            migrations: [createMigration({ id: 'DangerousMigration1', version: '1', isDestructive: true })],
            catalog,
            dryRun: true
        })

        expect(result.blocked).toEqual(['DangerousMigration1'])
        expect(result.planned).toEqual([
            expect.objectContaining({
                id: 'DangerousMigration1',
                action: 'blocked'
            })
        ])
    })

    it('uses dedicated session advisory locks for session-scoped migrations', async () => {
        const catalog = createCatalog()
        const { knex, boundQueryCalls, client, connection } = createConnectionAwareKnex()
        const up = jest.fn().mockResolvedValue(undefined)

        await runPlatformMigrations({
            knex,
            migrations: [
                createMigration({
                    id: 'SessionLockMigration1800000000003',
                    version: '1800000000003',
                    lockMode: 'session_advisory',
                    up
                })
            ],
            catalog
        })

        // Session lock now uses BEGIN + pg_try_advisory_xact_lock + COMMIT pattern
        expect(boundQueryCalls.filter((entry) => entry.sql === 'BEGIN')).toHaveLength(2)
        expect(boundQueryCalls.filter((entry) => entry.sql.includes('pg_try_advisory_xact_lock'))).toHaveLength(2)
        expect(boundQueryCalls.filter((entry) => entry.sql === 'COMMIT')).toHaveLength(2)
        expect(boundQueryCalls.every((entry) => entry.connection === connection)).toBe(true)
        expect(client.acquireConnection).toHaveBeenCalledTimes(2)
        expect(client.releaseConnection).toHaveBeenCalledTimes(2)
        expect(up).toHaveBeenCalledTimes(1)
    })

    it('rolls back and releases connection on migration error with session lock', async () => {
        const catalog = createCatalog()
        const { knex, boundQueryCalls, client } = createConnectionAwareKnex((sql) => {
            if (sql.includes('pg_try_advisory_xact_lock')) {
                return { rows: [{ acquired: true }] }
            }
            return undefined
        })

        await expect(
            runPlatformMigrations({
                knex,
                migrations: [
                    createMigration({
                        lockMode: 'session_advisory',
                        up: jest.fn().mockRejectedValue(new Error('boom'))
                    })
                ],
                catalog
            })
        ).rejects.toThrow('boom')

        expect(catalog.completeRun).toHaveBeenCalledWith(
            'run-1',
            expect.objectContaining({
                status: 'failed',
                error: expect.objectContaining({
                    message: 'boom'
                })
            })
        )
        // Transaction-level lock: ROLLBACK releases the lock, then connection is released
        // Two session locks: outer coordination lock + inner session_advisory lock
        expect(boundQueryCalls.some((entry) => entry.sql === 'ROLLBACK')).toBe(true)
        expect(client.releaseConnection).toHaveBeenCalledTimes(2)
    })
})
