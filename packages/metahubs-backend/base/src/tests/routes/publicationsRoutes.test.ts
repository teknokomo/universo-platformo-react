import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

const mockEnsureMetahubAccess = jest.fn()
const mockFindMetahubById = jest.fn()
const mockFindBranchByIdAndMetahub = jest.fn()
const mockFindPublicationById = jest.fn()
const mockFindPublicationVersionById = jest.fn()
const mockFindTemplateVersionById = jest.fn()
const mockCreatePublication = jest.fn()
const mockCreatePublicationVersion = jest.fn()
const mockSoftDelete = jest.fn()
const mockCreateLinkedApplication = jest.fn()
const mockGenerateFullSchema = jest.fn()
const mockRunPublishedApplicationRuntimeSync = jest.fn()
const mockPersistApplicationSchemaSyncState = jest.fn()
const mockSerializeMetahub = jest.fn()
const mockDeserializeSnapshot = jest.fn()
const mockCalculateHash = jest.fn()
const mockEnsureSchema = jest.fn()
const mockEnrichDefinitionsWithSetConstants = jest.fn()
const mockApplyRlsContext = jest.fn()

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args),
    createEnsureMetahubRouteAccess: () => async (req: any, res: any, metahubId: string, permission?: string) => {
        const user = (req as any).user
        const userId = user?.id ?? user?.sub ?? user?.user_id ?? user?.userId
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return null
        }
        await mockEnsureMetahubAccess({}, userId, metahubId, permission)
        return userId
    }
}))

jest.mock('../../persistence', () => ({
    __esModule: true,
    findMetahubById: (...args: unknown[]) => mockFindMetahubById(...args),
    findBranchByIdAndMetahub: (...args: unknown[]) => mockFindBranchByIdAndMetahub(...args),
    findPublicationById: (...args: unknown[]) => mockFindPublicationById(...args),
    findPublicationVersionById: (...args: unknown[]) => mockFindPublicationVersionById(...args),
    findTemplateVersionById: (...args: unknown[]) => mockFindTemplateVersionById(...args),
    listPublicationsByMetahub: jest.fn(async () => []),
    listPublicationVersions: jest.fn(async () => []),
    createPublication: (...args: unknown[]) => mockCreatePublication(...args),
    updatePublication: jest.fn(),
    createPublicationVersion: (...args: unknown[]) => mockCreatePublicationVersion(...args),
    deactivatePublicationVersions: jest.fn(),
    activatePublicationVersion: jest.fn(),
    notifyLinkedAppsUpdateAvailable: jest.fn(),
    resetLinkedAppsToSynced: jest.fn(),
    softDelete: (...args: unknown[]) => mockSoftDelete(...args)
}))

jest.mock('../../domains/publications/helpers/createLinkedApplication', () => ({
    __esModule: true,
    createLinkedApplication: (...args: unknown[]) => mockCreateLinkedApplication(...args)
}))

jest.mock('@universo/database', () => ({
    __esModule: true,
    getKnex: jest.fn(() => ({})),
    getPoolExecutor: jest.fn(() => ({
        query: jest.fn(async () => [])
    })),
    createKnexExecutor: jest.fn((knex: unknown) => knex),
    qSchema: jest.requireActual('@universo/database').qSchema,
    qTable: jest.requireActual('@universo/database').qTable,
    qSchemaTable: jest.requireActual('@universo/database').qSchemaTable,
    qColumn: jest.requireActual('@universo/database').qColumn
}))

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    getDDLServices: () => ({
        generator: {
            generateFullSchema: (...args: unknown[]) => mockGenerateFullSchema(...args),
            generateSnapshot: jest.fn(() => ({ entities: [] }))
        },
        migrationManager: {}
    }),
    generateSchemaName: jest.fn((id: string) => `mhb_${id}`),
    isValidSchemaName: jest.fn(() => true),
    uuidToLockKey: jest.fn((value: string) => value),
    acquirePoolAdvisoryLock: jest.fn(async () => true),
    releasePoolAdvisoryLock: jest.fn(async () => undefined)
}))

jest.mock('@universo/applications-backend', () => ({
    __esModule: true,
    runPublishedApplicationRuntimeSync: (...args: unknown[]) => mockRunPublishedApplicationRuntimeSync(...args)
}))

jest.mock('@universo/auth-backend', () => ({
    __esModule: true,
    applyRlsContext: (...args: unknown[]) => mockApplyRlsContext(...args)
}))

jest.mock('../../domains/applications/services/ApplicationSchemaStateStore', () => ({
    __esModule: true,
    persistApplicationSchemaSyncState: (...args: unknown[]) => mockPersistApplicationSchemaSyncState(...args)
}))

jest.mock('../../domains/publications/services/SnapshotSerializer', () => ({
    __esModule: true,
    SnapshotSerializer: jest.fn().mockImplementation(() => ({
        serializeMetahub: (...args: unknown[]) => mockSerializeMetahub(...args),
        deserializeSnapshot: (...args: unknown[]) => mockDeserializeSnapshot(...args),
        calculateHash: (...args: unknown[]) => mockCalculateHash(...args)
    }))
}))

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({
        ensureSchema: (...args: unknown[]) => mockEnsureSchema(...args)
    }))
}))

jest.mock('../../domains/metahubs/services/MetahubObjectsService', () => ({
    __esModule: true,
    MetahubObjectsService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/metahubs/services/MetahubAttributesService', () => ({
    __esModule: true,
    MetahubAttributesService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/metahubs/services/MetahubElementsService', () => ({
    __esModule: true,
    MetahubElementsService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/metahubs/services/MetahubHubsService', () => ({
    __esModule: true,
    MetahubHubsService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/metahubs/services/MetahubEnumerationValuesService', () => ({
    __esModule: true,
    MetahubEnumerationValuesService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/metahubs/services/MetahubConstantsService', () => ({
    __esModule: true,
    MetahubConstantsService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/shared/setConstantRefs', () => ({
    __esModule: true,
    enrichDefinitionsWithSetConstants: (...args: unknown[]) => mockEnrichDefinitionsWithSetConstants(...args)
}))

import { createPublicationsRoutes } from '../../domains/publications/routes/publicationsRoutes'
import { ApplicationSchemaStatus } from '@universo/types'
import { TARGET_APP_STRUCTURE_VERSION } from '../../domains/applications/constants'

type MockTx = {
    query: jest.Mock
    transaction: jest.Mock
    isReleased: jest.Mock
}

const TEST_APP_SCHEMA_NAME = 'app_019ccefc2f7b7b3682f485cdb1312268'

const createResponseErrorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: err.message })
}

const createMockTransaction = (): MockTx => {
    const tx: MockTx = {
        query: jest.fn(async () => []),
        transaction: jest.fn(async (callback: (nested: MockTx) => Promise<unknown>) => callback(createMockTransaction())),
        isReleased: jest.fn(() => false)
    }
    return tx
}

describe('Publications Routes', () => {
    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as Request & { user?: { id: string } }).user = { id: 'user-1' }
        req.headers.authorization = 'Bearer test-access-token'
        next()
    }

    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    let transactionExecutors: MockTx[]
    let mockExec: {
        query: jest.Mock
        transaction: jest.Mock
        isReleased: jest.Mock
    }

    const buildApp = () => {
        const app = express()
        app.use(express.json())
        app.use(
            '/',
            createPublicationsRoutes(ensureAuth, () => mockExec as any, mockRateLimiter, mockRateLimiter)
        )
        app.use(createResponseErrorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        transactionExecutors = []

        mockExec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('COUNT(*)::int AS count FROM metahubs.doc_publications')) {
                    return [{ count: 0 }]
                }
                return []
            }),
            transaction: jest.fn(async (callback: (tx: MockTx) => Promise<unknown>) => {
                const tx = createMockTransaction()
                transactionExecutors.push(tx)
                return callback(tx)
            }),
            isReleased: jest.fn(() => false)
        }

        mockEnsureMetahubAccess.mockResolvedValue(undefined)
        mockFindMetahubById.mockResolvedValue({
            id: 'metahub-1',
            defaultBranchId: 'branch-1',
            name: { en: 'Metahub' },
            description: { en: 'Metahub description' },
            templateVersionId: null
        })
        mockFindBranchByIdAndMetahub.mockResolvedValue({ id: 'branch-1', structureVersion: 1 })
        mockFindTemplateVersionById.mockResolvedValue(null)
        mockSerializeMetahub.mockResolvedValue({ entities: [], layouts: [], layoutZoneWidgets: [] })
        mockCalculateHash.mockReturnValue('snapshot-hash')
        mockDeserializeSnapshot.mockReturnValue([])
        mockEnsureSchema.mockRejectedValue(new Error('skip layouts in test'))
        mockEnrichDefinitionsWithSetConstants.mockImplementation((definitions: unknown) => definitions)
        mockGenerateFullSchema.mockRejectedValue(new Error('ddl exploded'))
        mockRunPublishedApplicationRuntimeSync.mockResolvedValue({ seedWarnings: [] })
        mockPersistApplicationSchemaSyncState.mockResolvedValue(undefined)
        mockApplyRlsContext.mockResolvedValue(undefined)
        mockSoftDelete.mockResolvedValue(true)
    })

    it('returns 500 and compensates publication metadata when schema generation fails during publication creation', async () => {
        mockExec.transaction.mockImplementation(async (callback: (tx: MockTx) => Promise<unknown>) => {
            const tx = createMockTransaction()
            tx.query.mockImplementation(async (sql: string, params?: unknown[]) => {
                if (typeof sql !== 'string') {
                    return []
                }

                if (sql.includes('UPDATE metahubs.doc_publication_versions')) {
                    return [{ id: params?.[0] as string }]
                }

                if (sql.includes('UPDATE metahubs.doc_publications')) {
                    return [{ id: params?.[0] as string }]
                }

                return []
            })
            transactionExecutors.push(tx)
            return callback(tx)
        })

        mockCreatePublication.mockResolvedValue({
            id: 'publication-1',
            name: { en: 'Publication' },
            description: null,
            schemaName: 'mhb_publication-1',
            schemaStatus: 'draft',
            schemaError: null,
            schemaSyncedAt: null,
            accessMode: 'private',
            autoCreateApplication: true,
            activeVersionId: null,
            _uplVersion: 1,
            _uplCreatedAt: new Date(),
            _uplUpdatedAt: new Date()
        })
        mockCreatePublicationVersion.mockResolvedValue({ id: 'version-1', snapshotHash: 'snapshot-hash' })
        mockCreateLinkedApplication.mockResolvedValue({
            application: {
                id: 'application-1',
                name: { en: 'Application' },
                description: null,
                slug: 'application-1',
                schemaStatus: 'draft'
            },
            connector: { id: 'connector-1' },
            appSchemaName: TEST_APP_SCHEMA_NAME
        })

        const app = buildApp()
        const response = await request(app)
            .post('/metahub/metahub-1/publications')
            .send({
                name: { en: 'Publication' },
                autoCreateApplication: true,
                createApplicationSchema: true
            })
            .expect(500)

        expect(response.body).toMatchObject({
            error: 'Schema sync failed'
        })
        const compensationSql = transactionExecutors[1].query.mock.calls.map(([sql]) => String(sql))

        expect(compensationSql).toEqual(
            expect.arrayContaining([
                expect.stringContaining(`DROP SCHEMA IF EXISTS "${TEST_APP_SCHEMA_NAME}" CASCADE`),
                expect.stringContaining('UPDATE applications.cat_connectors'),
                expect.stringContaining('UPDATE applications.rel_connector_publications'),
                expect.stringContaining('UPDATE applications.rel_application_users'),
                expect.stringContaining('UPDATE applications.cat_applications'),
                expect.stringContaining('UPDATE metahubs.doc_publication_versions'),
                expect.stringContaining('UPDATE metahubs.doc_publications')
            ])
        )
        expect(compensationSql.join('\n')).toContain('active_version_id = NULL')
        expect(compensationSql.join('\n')).toContain('_upl_version = COALESCE(cp._upl_version, 1) + 1')
    })

    it('enforces the single-publication limit using only active publications', async () => {
        mockExec.query.mockImplementation(async (sql: string) => {
            if (sql.includes('COUNT(*)::int AS count') && sql.includes('COALESCE(_upl_deleted, false) = false')) {
                return [{ count: 1 }]
            }
            return []
        })

        const app = buildApp()
        const response = await request(app)
            .post('/metahub/metahub-1/publications')
            .send({
                name: { en: 'Publication' },
                autoCreateApplication: false,
                createApplicationSchema: false
            })
            .expect(400)

        expect(response.body).toMatchObject({
            error: 'Single publication limit reached'
        })
        expect(mockCreatePublication).not.toHaveBeenCalled()
    })

    it('runs published application runtime sync and persists synced state after successful schema generation', async () => {
        const persistedSnapshot = { entities: [], version: 1 }
        const ddlTransaction = createMockTransaction()

        mockCreatePublication.mockResolvedValue({
            id: 'publication-1',
            name: { en: 'Publication' },
            description: null,
            schemaName: 'mhb_publication-1',
            schemaStatus: 'draft',
            schemaError: null,
            schemaSyncedAt: null,
            accessMode: 'private',
            autoCreateApplication: true,
            activeVersionId: null,
            _uplVersion: 1,
            _uplCreatedAt: new Date(),
            _uplUpdatedAt: new Date()
        })
        mockCreatePublicationVersion.mockResolvedValue({ id: 'version-1', snapshotHash: 'snapshot-hash' })
        mockCreateLinkedApplication.mockResolvedValue({
            application: {
                id: 'application-1',
                name: { en: 'Application' },
                description: null,
                slug: 'application-1',
                schemaStatus: 'draft'
            },
            connector: { id: 'connector-1' },
            appSchemaName: TEST_APP_SCHEMA_NAME
        })
        mockGenerateFullSchema.mockImplementation(async (_schemaName: string, _definitions: unknown, options?: any) => {
            await options.afterMigrationRecorded({
                trx: ddlTransaction,
                schemaName: TEST_APP_SCHEMA_NAME,
                snapshotBefore: null,
                snapshotAfter: persistedSnapshot,
                diff: {
                    hasChanges: true,
                    additive: [],
                    destructive: [],
                    summary: 'Initial schema creation with 0 table(s)'
                },
                migrationName: 'initial_schema_from_publication',
                migrationId: 'migration-1'
            })

            return {
                success: true,
                schemaName: TEST_APP_SCHEMA_NAME,
                tablesCreated: [],
                errors: []
            }
        })

        const app = buildApp()
        const response = await request(app)
            .post('/metahub/metahub-1/publications')
            .send({
                name: { en: 'Publication' },
                autoCreateApplication: true,
                createApplicationSchema: true,
                applicationIsPublic: true,
                applicationWorkspacesEnabled: false
            })
            .expect(201)

        expect(response.body).toEqual(
            expect.objectContaining({
                id: 'publication-1',
                activeVersionId: 'version-1',
                autoCreateApplication: true
            })
        )
        expect(mockGenerateFullSchema).toHaveBeenCalledWith(
            TEST_APP_SCHEMA_NAME,
            [],
            expect.objectContaining({
                recordMigration: true,
                migrationDescription: 'initial_schema_from_publication',
                migrationManager: {},
                migrationMeta: {
                    publicationSnapshotHash: 'snapshot-hash',
                    publicationId: 'publication-1',
                    publicationVersionId: 'version-1'
                },
                publicationSnapshot: expect.objectContaining({
                    entities: [],
                    layouts: [],
                    layoutZoneWidgets: [],
                    defaultLayoutId: null,
                    layoutConfig: {}
                }),
                userId: 'user-1',
                afterMigrationRecorded: expect.any(Function)
            })
        )
        expect(mockCreateLinkedApplication).toHaveBeenCalledWith(
            expect.objectContaining({
                publicationId: 'publication-1',
                isPublic: true,
                workspacesEnabled: false,
                userId: 'user-1'
            })
        )
        expect(mockRunPublishedApplicationRuntimeSync).toHaveBeenCalledWith(
            expect.objectContaining({
                trx: ddlTransaction,
                schemaName: TEST_APP_SCHEMA_NAME,
                snapshot: expect.objectContaining({
                    entities: [],
                    layouts: [],
                    layoutZoneWidgets: [],
                    defaultLayoutId: null,
                    layoutConfig: {}
                }),
                entities: [],
                migrationId: 'migration-1',
                userId: 'user-1'
            })
        )
        expect(mockApplyRlsContext).toHaveBeenCalledTimes(2)
        expect(mockApplyRlsContext.mock.calls[0]?.[1]).toBe('test-access-token')
        expect(mockApplyRlsContext.mock.calls[1]?.[1]).toBe('test-access-token')
        expect(mockApplyRlsContext.mock.invocationCallOrder[0]).toBeLessThan(mockCreatePublication.mock.invocationCallOrder[0])
        expect(mockApplyRlsContext.mock.invocationCallOrder[1]).toBeLessThan(
            mockPersistApplicationSchemaSyncState.mock.invocationCallOrder[0]
        )
        expect(mockPersistApplicationSchemaSyncState).toHaveBeenCalledWith(
            ddlTransaction,
            expect.objectContaining({
                applicationId: 'application-1',
                schemaStatus: ApplicationSchemaStatus.SYNCED,
                schemaError: null,
                schemaSnapshot: persistedSnapshot,
                lastSyncedPublicationVersionId: 'version-1',
                appStructureVersion: TARGET_APP_STRUCTURE_VERSION,
                userId: 'user-1'
            })
        )
        expect(mockSoftDelete).not.toHaveBeenCalled()
    })

    it('returns 500 and compensates a linked application when schema generation fails', async () => {
        mockFindPublicationById.mockResolvedValue({
            id: 'publication-1',
            metahubId: 'metahub-1',
            name: { en: 'Publication' },
            description: null,
            activeVersionId: 'version-1'
        })
        mockFindPublicationVersionById.mockResolvedValue({
            id: 'version-1',
            branchId: 'branch-1',
            snapshotHash: 'snapshot-hash',
            snapshotJson: { entities: [] }
        })
        mockCreateLinkedApplication.mockResolvedValue({
            application: {
                id: 'application-1',
                name: { en: 'Application' },
                description: null,
                slug: 'application-1'
            },
            connector: { id: 'connector-1' },
            appSchemaName: TEST_APP_SCHEMA_NAME
        })

        const app = buildApp()
        const response = await request(app)
            .post('/metahub/metahub-1/publication/publication-1/applications')
            .send({
                name: { en: 'Application' },
                createApplicationSchema: true,
                isPublic: true,
                workspacesEnabled: false
            })
            .expect(500)

        expect(response.body).toMatchObject({
            error: 'Schema sync failed'
        })
        expect(mockCreateLinkedApplication).toHaveBeenCalledWith(
            expect.objectContaining({
                publicationId: 'publication-1',
                isPublic: true,
                workspacesEnabled: false,
                userId: 'user-1'
            })
        )
        const compensationSql = transactionExecutors[1].query.mock.calls.map(([sql]) => String(sql))

        expect(compensationSql).toEqual(
            expect.arrayContaining([
                expect.stringContaining(`DROP SCHEMA IF EXISTS "${TEST_APP_SCHEMA_NAME}" CASCADE`),
                expect.stringContaining('UPDATE applications.cat_connectors'),
                expect.stringContaining('UPDATE applications.rel_connector_publications'),
                expect.stringContaining('UPDATE applications.rel_application_users'),
                expect.stringContaining('UPDATE applications.cat_applications')
            ])
        )
        expect(mockApplyRlsContext).toHaveBeenCalledTimes(2)
        expect(mockSoftDelete).not.toHaveBeenCalled()
    })

    it('cascades soft-delete to publication versions when deleting a publication', async () => {
        mockFindPublicationById.mockResolvedValue({
            id: 'publication-1',
            metahubId: 'metahub-1',
            schemaName: null,
            name: { en: 'Publication' },
            description: null
        })

        const tx = createMockTransaction()
        tx.query.mockImplementation(async (sql: string) => {
            if (typeof sql === 'string' && sql.includes('FOR UPDATE') && sql.includes('cat_metahubs')) {
                return [{ id: 'metahub-1' }]
            }
            if (typeof sql === 'string' && sql.includes('FOR UPDATE') && sql.includes('doc_publications')) {
                return [{ id: 'publication-1', schemaName: null }]
            }
            return []
        })

        mockExec.transaction.mockImplementation(async (cb: (t: MockTx) => Promise<unknown>) => {
            return cb(tx)
        })

        const app = buildApp()
        await request(app).delete('/metahub/metahub-1/publication/publication-1?confirm=true').expect(200)

        // Verify cascade soft-delete of publication versions
        const versionsCascadeSql = tx.query.mock.calls.find(
            ([sql]: [string]) => typeof sql === 'string' && sql.includes('UPDATE metahubs.doc_publication_versions')
        )
        expect(versionsCascadeSql).toBeDefined()
        const sql = String(versionsCascadeSql![0])
        expect(sql).toContain('_upl_deleted = true')
        expect(sql).toContain('_app_deleted = true')
        expect(sql).toContain('publication_id = $1')
        expect(sql).toContain('_upl_deleted = false AND _app_deleted = false')

        // Verify parent publication soft-delete follows
        expect(mockSoftDelete).toHaveBeenCalledWith(tx, 'metahubs', 'doc_publications', 'publication-1', 'user-1')
    })
})
