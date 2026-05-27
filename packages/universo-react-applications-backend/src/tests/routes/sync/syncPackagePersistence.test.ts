const mockExec = {
    query: jest.fn(async () => [])
}

const mockTransaction = jest.fn(async (callback: (trx: unknown) => Promise<void>) => callback({}))
const mockEnsureSystemTables = jest.fn(async () => undefined)
const TEST_SCHEMA = 'app_018f8a787b8f7c1da111222233334444'

jest.mock('@universo-react/database', () => ({
    __esModule: true,
    createKnexExecutor: () => mockExec,
    qSchemaTable: jest.requireActual('@universo-react/database').qSchemaTable
}))

jest.mock('../../../ddl', () => ({
    __esModule: true,
    getApplicationSyncKnex: () => ({ transaction: mockTransaction }),
    getApplicationSyncDdlServices: () => ({
        generator: { ensureSystemTables: mockEnsureSystemTables }
    })
}))

import { hasPublishedPackagesChanges, persistPublishedPackages } from '../../../routes/sync/syncPackagePersistence'
import type { PublishedApplicationSnapshot } from '../../../services/applicationSyncContracts'

const packageSource = {
    kind: 'workspace' as const,
    packageName: '@universo-react/colyseus-server',
    importName: '@universo-react/colyseus-server',
    upstreamPackageName: '@colyseus/core',
    upstreamVersion: '0.17.43',
    runtimeTargets: ['server' as const]
}

const snapshotWithPackages = (overrides?: Partial<PublishedApplicationSnapshot>): PublishedApplicationSnapshot =>
    ({
        packages: [
            {
                packageName: '@universo-react/colyseus-server',
                version: '0.1.0',
                source: packageSource,
                isActive: true
            }
        ],
        ...overrides
    } as PublishedApplicationSnapshot)

describe('syncPackagePersistence', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockTransaction.mockImplementation(async (callback: (trx: unknown) => Promise<void>) => callback({}))
        mockEnsureSystemTables.mockResolvedValue(undefined)
    })

    it('validates snapshot packages against the registry before persisting runtime rows', async () => {
        mockExec.query
            .mockResolvedValueOnce([
                {
                    package_name: '@universo-react/colyseus-server',
                    version: '0.1.0',
                    source: packageSource
                }
            ])
            .mockResolvedValueOnce([{ exists: true }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ package_name: '@universo-react/colyseus-server' }])
            .mockResolvedValueOnce([])

        await persistPublishedPackages({
            schemaName: TEST_SCHEMA,
            snapshot: snapshotWithPackages(),
            userId: 'user-1'
        })

        expect(mockExec.query).toHaveBeenNthCalledWith(1, expect.stringContaining('"metahubs"."obj_packages"'), [
            ['@universo-react/colyseus-server']
        ])
        expect(mockExec.query).toHaveBeenNthCalledWith(4, expect.stringContaining(`INSERT INTO "${TEST_SCHEMA}"."_app_packages"`), [
            '@universo-react/colyseus-server',
            '0.1.0',
            JSON.stringify(packageSource),
            true,
            expect.any(Date),
            'user-1'
        ])
    })

    it('rejects unregistered and duplicate package entries from snapshots', async () => {
        mockExec.query.mockResolvedValueOnce([])

        await expect(
            hasPublishedPackagesChanges({
                schemaName: TEST_SCHEMA,
                snapshot: snapshotWithPackages()
            })
        ).rejects.toThrow('is not registered')

        await expect(
            hasPublishedPackagesChanges({
                schemaName: TEST_SCHEMA,
                snapshot: snapshotWithPackages({
                    packages: [
                        {
                            packageName: '@universo-react/colyseus-server',
                            version: '0.1.0',
                            source: packageSource,
                            isActive: true
                        },
                        {
                            packageName: '@universo-react/colyseus-server',
                            version: '0.1.1',
                            source: packageSource,
                            isActive: true
                        }
                    ]
                } as Partial<PublishedApplicationSnapshot>)
            })
        ).rejects.toThrow('duplicate package')
    })
})
