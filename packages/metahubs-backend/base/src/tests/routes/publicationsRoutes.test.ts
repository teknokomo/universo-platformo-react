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

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
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
    KnexClient: {
        getInstance: jest.fn(() => ({}))
    },
    uuidToLockKey: jest.fn((value: string) => value),
    acquireAdvisoryLock: jest.fn(async () => true),
    releaseAdvisoryLock: jest.fn(async () => undefined)
}))

jest.mock('../../domains/applications/routes/applicationSyncRoutes', () => ({
    __esModule: true,
    runPublishedApplicationRuntimeSync: (...args: unknown[]) => mockRunPublishedApplicationRuntimeSync(...args)
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

type MockTx = {
    query: jest.Mock
    transaction: jest.Mock
    isReleased: jest.Mock
}

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
        app.use('/', createPublicationsRoutes(ensureAuth, () => mockExec as any, mockRateLimiter, mockRateLimiter))
        app.use(createResponseErrorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        transactionExecutors = []

        mockExec = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('COUNT(*)::int AS count FROM metahubs.publications')) {
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
        mockSoftDelete.mockResolvedValue(true)
    })

    it('returns 500 and compensates publication metadata when schema generation fails during publication creation', async () => {
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
            appSchemaName: 'app_publication_1'
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

        expect(response.body).toEqual({ error: 'Failed to create publication schema: ddl exploded' })
        expect(mockSoftDelete).toHaveBeenNthCalledWith(1, transactionExecutors[1], 'metahubs', 'publications_versions', 'version-1', 'user-1')
        expect(mockSoftDelete).toHaveBeenNthCalledWith(2, transactionExecutors[1], 'metahubs', 'publications', 'publication-1', 'user-1')
        expect(transactionExecutors[1].query.mock.calls[0][0]).toContain('DROP SCHEMA IF EXISTS "app_publication_1" CASCADE')
        expect(transactionExecutors[1].query.mock.calls[1][0]).toContain('UPDATE applications.connectors')
        expect(transactionExecutors[1].query.mock.calls[3][0]).toContain('UPDATE applications.applications')
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
            appSchemaName: 'app_publication_1'
        })

        const app = buildApp()
        const response = await request(app)
            .post('/metahub/metahub-1/publication/publication-1/applications')
            .send({
                name: { en: 'Application' },
                createApplicationSchema: true
            })
            .expect(500)

        expect(response.body).toEqual({ error: 'Failed to create linked application schema: ddl exploded' })
        expect(transactionExecutors[1].query.mock.calls[0][0]).toContain('DROP SCHEMA IF EXISTS "app_publication_1" CASCADE')
        expect(transactionExecutors[1].query.mock.calls[1][0]).toContain('UPDATE applications.connectors')
        expect(transactionExecutors[1].query.mock.calls[3][0]).toContain('UPDATE applications.applications')
        expect(mockSoftDelete).not.toHaveBeenCalled()
    })
})