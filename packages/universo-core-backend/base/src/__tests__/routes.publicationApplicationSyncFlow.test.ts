import express from 'express'
import { buildRegisteredSystemAppSchemaGenerationPlan } from '@universo/migrations-platform'

const request = require('supertest') as typeof import('supertest')

const runtimeSources = new Map<string, Record<string, unknown>>()
const publicationByApplicationId = new Map<string, string>()
const mockExecutor = { query: jest.fn() }

jest.mock('../utils/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn()
    }
}))

jest.mock('@universo/auth-backend', () => {
    const ensureAuth = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        ;(req as express.Request & { user?: { id: string } }).user = { id: 'user-1' }
        next()
    }
    const ensureAuthWithRls = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        ;(req as express.Request & { user?: { id: string }; rlsWrapped?: boolean }).user = { id: 'user-1' }
        ;(req as express.Request & { rlsWrapped?: boolean }).rlsWrapped = true
        next()
    }

    return {
        __esModule: true,
        ensureAuth,
        ensureAuthWithRls,
        createEnsureAuthWithRls: jest.fn(() => ensureAuthWithRls),
        createPermissionService: jest.fn(() => ({}))
    }
})

jest.mock('@universo/database', () => ({
    __esModule: true,
    getKnex: jest.fn(() => ({})),
    getPoolExecutor: jest.fn(() => mockExecutor),
    createKnexExecutor: jest.fn(() => mockExecutor)
}))

jest.mock('@universo/utils', () => {
    class MockOptimisticLockError extends Error {
        code = 'OPTIMISTIC_LOCK_CONFLICT'
        conflict?: unknown

        constructor(message = 'Conflict', conflict?: unknown) {
            super(message)
            this.name = 'OptimisticLockError'
            this.conflict = conflict
        }
    }

    return {
        __esModule: true,
        OptimisticLockError: MockOptimisticLockError,
        lookupUserEmail: jest.fn(async () => null),
        isDatabaseConnectTimeoutError: jest.fn(() => false),
        getRequestDbExecutor: jest.fn((_req, executor) => executor)
    }
})

jest.mock('@universo/metahubs-backend', () => {
    const expressModule = require('express') as typeof import('express')
    const loadPublishedPublicationRuntimeSource = jest.fn(async (_executor, publicationId: string) => {
        return runtimeSources.get(publicationId) ?? null
    })

    return {
        __esModule: true,
        initializeRateLimiters: jest.fn(),
        createPublicMetahubsServiceRoutes: jest.fn(() => expressModule.Router()),
        loadPublishedPublicationRuntimeSource,
        createMetahubsServiceRoutes: jest.fn(() => {
            const router = expressModule.Router()

            router.post('/metahub/:metahubId/publications', (_req, res) => {
                const publicationId = 'publication-1'
                const publicationVersionId = 'publication-version-1'
                const applicationId = 'application-1'

                publicationByApplicationId.set(applicationId, publicationId)
                runtimeSources.set(publicationId, {
                    publicationId,
                    publicationVersionId,
                    snapshotHash: 'snapshot-hash',
                    snapshot: { entities: {} },
                    entities: [
                        {
                            id: 'entity-1',
                            kind: 'catalog',
                            codename: 'products',
                            tableName: 'cat_products',
                            fields: []
                        }
                    ],
                    publicationSnapshot: { entities: {} }
                })

                res.status(201).json({
                    id: publicationId,
                    activeVersionId: publicationVersionId,
                    applicationId,
                    autoCreateApplication: true
                })
            })

            return router
        })
    }
})

jest.mock('@universo/applications-backend', () => {
    const expressModule = require('express') as typeof import('express')

    return {
        __esModule: true,
        initializeRateLimiters: jest.fn(),
        createApplicationsServiceRoutes: jest.fn(
            (
                _ensureAuth,
                getDbExecutor: () => unknown,
                loadPublishedPublicationRuntimeSource: (executor: unknown, publicationId: string) => Promise<Record<string, unknown> | null>
            ) => {
                const router = expressModule.Router()

                router.post(
                    '/application/:applicationId/sync',
                    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
                        try {
                            const publicationId = publicationByApplicationId.get(req.params.applicationId)
                            if (!publicationId) {
                                res.status(400).json({ error: 'Publication sync context unavailable' })
                                return
                            }

                            const runtimeSource = await loadPublishedPublicationRuntimeSource(getDbExecutor(), publicationId)
                            if (!runtimeSource) {
                                res.status(400).json({ error: 'Publication sync context unavailable' })
                                return
                            }

                            res.status(200).json({
                                status: 'synced',
                                publicationId: runtimeSource.publicationId,
                                publicationVersionId: runtimeSource.publicationVersionId,
                                entityCount: Array.isArray(runtimeSource.entities) ? runtimeSource.entities.length : 0
                            })
                        } catch (error) {
                            next(error)
                        }
                    }
                )

                return router
            }
        )
    }
})

jest.mock('@universo/start-backend', () => {
    const expressModule = require('express') as typeof import('express')

    return {
        __esModule: true,
        createStartServiceRoutes: jest.fn(() => expressModule.Router())
    }
})

jest.mock('@universo/admin-backend', () => {
    const expressModule = require('express') as typeof import('express')
    const emptyRouter = () => expressModule.Router()

    return {
        __esModule: true,
        createGlobalAccessService: jest.fn(() => ({})),
        createDashboardRoutes: jest.fn(emptyRouter),
        createGlobalUsersRoutes: jest.fn(emptyRouter),
        createInstancesRoutes: jest.fn(emptyRouter),
        createRolesRoutes: jest.fn(emptyRouter),
        createLocalesRoutes: jest.fn(emptyRouter),
        createPublicLocalesRoutes: jest.fn(emptyRouter),
        createAdminSettingsRoutes: jest.fn(emptyRouter)
    }
})

jest.mock('@universo/profile-backend', () => {
    const expressModule = require('express') as typeof import('express')

    return {
        __esModule: true,
        createProfileRoutes: jest.fn(() => expressModule.Router())
    }
})

import router from '../routes'

describe('core route composition publication -> application sync flow', () => {
    beforeEach(() => {
        runtimeSources.clear()
        publicationByApplicationId.clear()
        mockExecutor.query.mockReset()
        jest.clearAllMocks()
    })

    it('routes publication bootstrap into application sync through the shared runtime-source seam', async () => {
        const app = express()
        app.use(express.json())
        app.use('/', router)

        const publicationResponse = await request(app)
            .post('/metahub/metahub-1/publications')
            .send({
                name: { en: 'Publication' },
                autoCreateApplication: true,
                createApplicationSchema: true
            })
            .expect(201)

        expect(publicationResponse.body).toEqual({
            id: 'publication-1',
            activeVersionId: 'publication-version-1',
            applicationId: 'application-1',
            autoCreateApplication: true
        })

        const syncResponse = await request(app).post('/application/application-1/sync').send({ confirmDestructive: false }).expect(200)

        expect(syncResponse.body).toEqual({
            status: 'synced',
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1',
            entityCount: 1
        })

        const metahubsModule = jest.requireMock('@universo/metahubs-backend') as {
            loadPublishedPublicationRuntimeSource: jest.Mock
            createMetahubsServiceRoutes: jest.Mock
        }
        const applicationsModule = jest.requireMock('@universo/applications-backend') as {
            createApplicationsServiceRoutes: jest.Mock
        }

        expect(metahubsModule.createMetahubsServiceRoutes).toHaveBeenCalledTimes(1)
        expect(applicationsModule.createApplicationsServiceRoutes).toHaveBeenCalledTimes(1)
        const authModule = jest.requireMock('@universo/auth-backend') as {
            ensureAuth: express.RequestHandler
            ensureAuthWithRls: express.RequestHandler
            createEnsureAuthWithRls: jest.Mock
        }
        expect(applicationsModule.createApplicationsServiceRoutes.mock.calls[0][0]).toBe(authModule.ensureAuthWithRls)
        expect(applicationsModule.createApplicationsServiceRoutes.mock.calls[0][3]).toMatchObject({
            syncEnsureAuth: authModule.ensureAuth
        })
        expect(metahubsModule.loadPublishedPublicationRuntimeSource).toHaveBeenCalledWith(mockExecutor, 'publication-1')
    })

    it('keeps the fixed fresh-bootstrap contract aligned with the publication-to-application runtime flow', () => {
        const fixedPlans = [
            buildRegisteredSystemAppSchemaGenerationPlan('admin'),
            buildRegisteredSystemAppSchemaGenerationPlan('profiles'),
            buildRegisteredSystemAppSchemaGenerationPlan('metahubs'),
            buildRegisteredSystemAppSchemaGenerationPlan('applications')
        ]

        expect(
            fixedPlans.map((plan) => ({
                definitionKey: plan.definitionKey,
                schemaName: plan.schemaName,
                storageModel: plan.storageModel
            }))
        ).toEqual([
            { definitionKey: 'admin', schemaName: 'admin', storageModel: 'application_like' },
            { definitionKey: 'profiles', schemaName: 'profiles', storageModel: 'application_like' },
            { definitionKey: 'metahubs', schemaName: 'metahubs', storageModel: 'application_like' },
            { definitionKey: 'applications', schemaName: 'applications', storageModel: 'application_like' }
        ])

        for (const plan of fixedPlans) {
            expect(plan.businessTables.length).toBeGreaterThan(0)
            expect(plan.businessTables.every((table) => /^(cat|doc|rel|cfg)_/.test(table.tableName))).toBe(true)
        }

        expect(buildRegisteredSystemAppSchemaGenerationPlan('applications').businessTables.map((table) => table.tableName)).toEqual(
            expect.arrayContaining(['cat_applications', 'cat_connectors', 'rel_connector_publications', 'rel_application_users'])
        )
        expect(buildRegisteredSystemAppSchemaGenerationPlan('metahubs').businessTables.map((table) => table.tableName)).toEqual(
            expect.arrayContaining(['cat_metahubs', 'doc_publications'])
        )
    })
})
