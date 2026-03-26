jest.mock('@universo/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

const mockCloneSchemaWithExecutor = jest.fn(async () => undefined)
const mockGenerateSchemaName = jest.fn((id: string) => `app_${id.replace(/-/g, '')}`)
const mockIsValidSchemaName = jest.fn(() => true)

jest.mock('@universo/schema-ddl', () => ({
    __esModule: true,
    cloneSchemaWithExecutor: (...args: unknown[]) => mockCloneSchemaWithExecutor(...args),
    generateSchemaName: (...args: unknown[]) => mockGenerateSchemaName(...(args as [string])),
    isValidSchemaName: (...args: unknown[]) => mockIsValidSchemaName(...(args as [string]))
}))

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { getGlobalRoleCodename, hasSubjectPermission, isSuperuser } from '@universo/admin-backend'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')
import { createMockDbExecutor, createMockDataStore } from '../utils/dbMocks'
import { createApplicationsRoutes } from '../../routes/applicationsRoutes'

describe('Applications Routes', () => {
    interface TestDataSource {
        query: jest.Mock
        transaction: jest.Mock
        manager: {
            query: jest.Mock
        }
    }

    const normalizeMembershipRow = (membership: Record<string, unknown> | null) =>
        membership
            ? {
                  ...membership,
                  id: membership.id ?? 'membership-id',
                  userId: membership.userId ?? membership.user_id ?? null,
                  applicationId: membership.applicationId ?? membership.application_id ?? null,
                  _uplCreatedAt: membership._uplCreatedAt ?? new Date()
              }
            : null

    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as Request & { user?: { id: string } }).user = { id: 'test-user-id' }
        next()
    }

    // Mock rate limiters (no-op middleware for tests)
    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    // Error handler middleware for http-errors compatibility
    const errorHandler = (err: Error & { statusCode?: number; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
        if (res.headersSent) {
            return _next(err)
        }
        const statusCode = err.statusCode || err.status || 500
        const message = err.message || 'Internal Server Error'
        res.status(statusCode).json({ error: message })
    }

    // Helper to build Express app with error handler
    const buildApp = (dataSource: TestDataSource) => {
        const app = express()
        app.use(express.json())
        app.use(
            '/applications',
            createApplicationsRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
        )
        app.use(errorHandler)
        return app
    }

    const buildDataSource = () => {
        const applicationRepo = createMockDataStore()
        const applicationUserRepo = createMockDataStore()

        const { executor, txExecutor } = createMockDbExecutor()

        // Expose manager-like structure so existing test assertions on
        // dataSource.manager.query keep working with zero body changes.
        const dataSource = Object.assign(executor, {
            manager: { query: txExecutor.query }
        })

        ;(executor.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('FROM applications.rel_application_users')) {
                const membership = normalizeMembershipRow(
                    await applicationUserRepo.findOne({
                        where: {
                            applicationId: params?.[0],
                            userId: params?.[1]
                        }
                    })
                )
                return membership ? [membership] : []
            }

            if (sql.includes('schema_name AS "schemaName"') && sql.includes('FROM applications.cat_applications')) {
                const application = await applicationRepo.findOne({
                    where: {
                        id: params?.[0]
                    }
                })

                return application
                    ? [
                          {
                              id: application.id,
                              schemaName: (application as Record<string, unknown>).schemaName ?? null
                          }
                      ]
                    : []
            }

            return txExecutor.query(sql, params)
        })

        return {
            dataSource,
            applicationRepo,
            applicationUserRepo
        }
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockCloneSchemaWithExecutor.mockClear()
        mockGenerateSchemaName.mockClear()
        mockIsValidSchemaName.mockClear()
        mockIsValidSchemaName.mockReturnValue(true)
        ;(isSuperuser as jest.Mock).mockResolvedValue(false)
        ;(getGlobalRoleCodename as jest.Mock).mockResolvedValue(null)
        ;(hasSubjectPermission as jest.Mock).mockResolvedValue(false)
    })

    describe('GET /applications', () => {
        it('should return empty array for user with no applications', async () => {
            const { dataSource } = buildDataSource()
            ;(dataSource.query as jest.Mock).mockResolvedValue([])

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications').expect(200)

            expect(response.body).toMatchObject({
                items: [],
                total: 0,
                limit: 100,
                offset: 0
            })
        })

        it('should return applications with counts for authenticated user', async () => {
            const { dataSource } = buildDataSource()
            ;(dataSource.query as jest.Mock).mockResolvedValue([
                {
                    id: 'application-1',
                    name: 'Test Application',
                    description: 'Test Description',
                    slug: 'test-app',
                    isPublic: false,
                    schemaName: 'app_123',
                    schemaStatus: 'draft',
                    schemaSyncedAt: null,
                    schemaError: null,
                    version: 2,
                    createdAt: new Date('2025-01-01'),
                    updatedAt: new Date('2025-01-02'),
                    updatedBy: 'test-user-id',
                    connectorsCount: 2,
                    membersCount: 3,
                    membershipRole: 'owner',
                    windowTotal: '1'
                }
            ])

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications').expect(200)

            expect(response.body.items).toHaveLength(1)
            expect(response.body.items[0]).toMatchObject({
                id: 'application-1',
                name: 'Test Application',
                description: 'Test Description',
                connectorsCount: 2,
                membersCount: 3
            })
        })

        it('should support pagination parameters', async () => {
            const { dataSource } = buildDataSource()
            ;(dataSource.query as jest.Mock).mockResolvedValue([])

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications').query({ limit: 10, offset: 20 }).expect(200)

            expect(response.body).toMatchObject({
                items: [],
                total: 0,
                limit: 10,
                offset: 20
            })
        })

        it('should support search parameter', async () => {
            const { dataSource } = buildDataSource()
            ;(dataSource.query as jest.Mock).mockResolvedValue([])

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications').query({ search: 'test' }).expect(200)

            expect((dataSource.query as jest.Mock).mock.calls[0][0]).toContain('ILIKE')
            expect((dataSource.query as jest.Mock).mock.calls[0][1]).toContain('%test%')
            expect(response.body).toMatchObject({ items: [], total: 0 })
        })

        it('should keep public applications joinable for ordinary read-only users', async () => {
            const { dataSource } = buildDataSource()
            ;(hasSubjectPermission as jest.Mock).mockImplementation(async (_executor, _userId, subject: string, action = 'read') => {
                return subject === 'applications' && action === 'read'
            })
            ;(getGlobalRoleCodename as jest.Mock).mockResolvedValue('User')
            ;(dataSource.query as jest.Mock).mockResolvedValue([
                {
                    id: 'application-public',
                    name: 'Public Application',
                    description: 'Joinable application',
                    slug: 'public-application',
                    isPublic: true,
                    workspacesEnabled: true,
                    schemaName: 'app_public',
                    schemaStatus: 'synced',
                    schemaSyncedAt: null,
                    schemaError: null,
                    version: 1,
                    createdAt: new Date('2025-01-01'),
                    updatedAt: new Date('2025-01-02'),
                    updatedBy: 'owner-id',
                    connectorsCount: 1,
                    membersCount: 1,
                    membershipRole: null,
                    windowTotal: '1'
                }
            ])

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications').expect(200)

            expect(response.body.items[0]).toMatchObject({
                id: 'application-public',
                role: null,
                accessType: 'public',
                canJoin: true,
                canLeave: false,
                permissions: expect.objectContaining({ manageApplication: false })
            })
        })
    })

    describe('GET /applications/:applicationId/runtime', () => {
        it('allows joined members to load runtime data', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334470'
            const runtimeCatalogId = '018f8a78-7b8f-7c1d-a111-222233334471'
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                workspacesEnabled: false
            })

            applicationUserRepo.findOne.mockResolvedValue({
                applicationId: runtimeApplicationId,
                userId: 'test-user-id',
                role: 'member'
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeCatalogId,
                            codename: 'orders',
                            table_name: 'orders',
                            presentation: null,
                            config: null
                        }
                    ]
                }

                if (sql.includes('FROM "app_runtime_test"._app_attributes')) {
                    return []
                }

                if (sql.includes('COUNT(*)::int AS total')) {
                    return [{ total: 0 }]
                }

                if (sql.includes('SELECT id') && sql.includes('FROM "app_runtime_test"."orders"')) {
                    return []
                }

                if (sql.includes('FROM information_schema.tables')) {
                    return [{ layoutsExists: false, widgetsExists: false }]
                }

                return []
            })

            const app = buildApp(dataSource)

            const response = await request(app).get(`/applications/${runtimeApplicationId}/runtime`).expect(200)

            expect(response.body.catalog).toMatchObject({
                id: runtimeCatalogId,
                codename: 'orders'
            })
        })
    })

    describe('POST /applications', () => {
        it('should create a new application', async () => {
            const { dataSource } = buildDataSource()
            ;(dataSource.query as jest.Mock).mockResolvedValueOnce([])
            ;(dataSource.manager.query as jest.Mock)
                .mockResolvedValueOnce([{ id: 'new-application-id' }])
                .mockResolvedValueOnce([
                    {
                        id: 'new-application-id',
                        name: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'New Application' } }
                        },
                        description: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Description' } }
                        },
                        slug: 'new-application',
                        isPublic: false,
                        schemaName: 'app_newapplicationid',
                        schemaStatus: 'draft',
                        schemaSyncedAt: null,
                        schemaError: null,
                        version: 1,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        updatedBy: 'test-user-id'
                    }
                ])
                .mockResolvedValueOnce([])

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications')
                .send({
                    name: 'New Application',
                    description: 'Description',
                    slug: 'new-application'
                })
                .expect(201)

            expect(response.body).toMatchObject({
                id: 'new-application-id',
                name: {
                    _primary: 'en'
                }
            })
        })

        it('should reject invalid request body', async () => {
            const { dataSource } = buildDataSource()

            const app = buildApp(dataSource)

            const response = await request(app).post('/applications').send({ description: 'Missing name' }).expect(400)

            expect(response.body.error).toBeDefined()
        })

        it('should reject duplicate slug', async () => {
            const { dataSource } = buildDataSource()
            ;(dataSource.query as jest.Mock).mockResolvedValue([{ id: 'existing', slug: 'taken-slug' }])

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications')
                .send({
                    name: 'New Application',
                    slug: 'taken-slug'
                })
                .expect(409)

            expect(response.body.error).toContain('slug')
        })

        it('should allow public application without workspaces when explicitly requested', async () => {
            const { dataSource } = buildDataSource()
            ;(dataSource.query as jest.Mock).mockResolvedValueOnce([])
            ;(dataSource.manager.query as jest.Mock)
                .mockResolvedValueOnce([{ id: 'public-application-id' }])
                .mockResolvedValueOnce([
                    {
                        id: 'public-application-id',
                        name: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Public Application' } }
                        },
                        description: null,
                        slug: null,
                        isPublic: true,
                        workspacesEnabled: false,
                        schemaName: 'app_publicapplicationid',
                        schemaStatus: 'draft',
                        schemaSyncedAt: null,
                        schemaError: null,
                        version: 1,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        updatedBy: 'test-user-id'
                    }
                ])
                .mockResolvedValueOnce([])
            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications')
                .send({
                    name: 'Public Application',
                    isPublic: true,
                    workspacesEnabled: false
                })
                .expect(201)

            expect(response.body).toMatchObject({
                isPublic: true,
                workspacesEnabled: false
            })
        })
    })

    describe('POST /applications/:applicationId/copy', () => {
        const buildCopiedApplicationRow = (id: string, overrides: Record<string, unknown> = {}) => ({
            id,
            name: {
                _schema: 'v1',
                _primary: 'en',
                locales: { en: { content: 'Source App (copy)' } }
            },
            description: null,
            slug: 'source-app-copy',
            isPublic: false,
            workspacesEnabled: false,
            schemaName: `app_${id.replace(/-/g, '')}`,
            schemaStatus: 'draft',
            schemaSyncedAt: null,
            schemaError: null,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            updatedBy: 'test-user-id',
            ...overrides
        })

        const configureCopyQueries = (
            dataSource: TestDataSource,
            options: {
                sourceApplication: Record<string, unknown>
                slugChecks?: Record<string, Record<string, unknown> | null>
                generatedId: string
                copiedApplication?: Record<string, unknown>
            }
        ) => {
            const slugChecks = options.slugChecks ?? {}
            const copiedApplication = options.copiedApplication ?? buildCopiedApplicationRow(options.generatedId)

            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM applications.rel_application_users')) {
                    return [
                        {
                            id: 'membership-id',
                            userId: 'test-user-id',
                            applicationId: params?.[0],
                            role: 'owner',
                            _uplCreatedAt: new Date()
                        }
                    ]
                }

                if (sql.includes('SELECT') && sql.includes('FROM applications.cat_applications a') && sql.includes('schema_snapshot')) {
                    return [{ workspacesEnabled: false, ...options.sourceApplication }]
                }

                if (sql.includes('SELECT id, slug') && sql.includes('FROM applications.cat_applications')) {
                    const slug = params?.[0] as string
                    const result = slugChecks[slug]
                    return result ? [result] : []
                }

                if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                    return [{ id: options.generatedId }]
                }

                return []
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('INSERT INTO applications.cat_applications (')) {
                    return [copiedApplication]
                }
                return []
            })
        }

        it('should copy application with connectors and access (excluding requester duplicate role)', async () => {
            const { dataSource } = buildDataSource()

            const sourceApplication = {
                id: 'application-1',
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: { en: { content: 'Source App' }, ru: { content: 'Исходное приложение' } }
                },
                description: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: { en: { content: 'Source desc' } }
                },
                slug: 'source-app',
                isPublic: false,
                schemaName: 'app_source001',
                schemaStatus: 'synced',
                schemaSyncedAt: null,
                schemaError: null,
                schemaSnapshot: null,
                _uplVersion: 1,
                _uplCreatedAt: new Date(),
                _uplUpdatedAt: new Date()
            }

            configureCopyQueries(dataSource, {
                sourceApplication,
                generatedId: '018f8a78-7b8f-7c1d-a111-222233334444',
                slugChecks: {
                    'source-app-copy': null
                },
                copiedApplication: buildCopiedApplicationRow('018f8a78-7b8f-7c1d-a111-222233334444', {
                    slug: 'source-app-copy',
                    schemaStatus: 'outdated'
                })
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications/application-1/copy')
                .send({
                    name: { en: 'Source App (copy)' },
                    copyConnector: true,
                    createSchema: false,
                    copyAccess: true
                })
                .expect(201)

            expect(response.body.id).toBe('018f8a78-7b8f-7c1d-a111-222233334444')
            expect(mockGenerateSchemaName).toHaveBeenCalledWith('018f8a78-7b8f-7c1d-a111-222233334444')
            expect(mockCloneSchemaWithExecutor).not.toHaveBeenCalled()
            expect(
                (dataSource.manager.query as jest.Mock).mock.calls.some(([sql]: [string]) =>
                    sql.includes('INSERT INTO applications.rel_application_users')
                )
            ).toBe(true)
            expect(
                (dataSource.manager.query as jest.Mock).mock.calls.some(([sql]: [string]) =>
                    sql.includes('INSERT INTO applications.cat_connectors (')
                )
            ).toBe(true)
            expect(
                (dataSource.manager.query as jest.Mock).mock.calls.some(([sql]: [string]) =>
                    sql.includes('INSERT INTO applications.rel_connector_publications')
                )
            ).toBe(true)
        })

        it('should copy without connectors when copyConnector is false', async () => {
            const { dataSource } = buildDataSource()

            configureCopyQueries(dataSource, {
                sourceApplication: {
                    id: 'application-1',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Source App' } }
                    },
                    description: null,
                    slug: 'source-app',
                    isPublic: false,
                    schemaName: 'app_source001',
                    schemaStatus: 'synced',
                    schemaSyncedAt: new Date(),
                    schemaError: null,
                    schemaSnapshot: { entities: {} },
                    appStructureVersion: 1,
                    _uplVersion: 1,
                    _uplCreatedAt: new Date(),
                    _uplUpdatedAt: new Date()
                },
                generatedId: '018f8a78-7b8f-7c1d-a111-222233334445',
                slugChecks: {
                    'source-app-copy': null
                },
                copiedApplication: buildCopiedApplicationRow('018f8a78-7b8f-7c1d-a111-222233334445', {
                    slug: 'source-app-copy',
                    schemaStatus: 'draft'
                })
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications/application-1/copy')
                .send({
                    name: { en: 'Source App (copy)' },
                    copyConnector: false,
                    createSchema: false,
                    copyAccess: false
                })
                .expect(201)

            expect(response.body.id).toBe('018f8a78-7b8f-7c1d-a111-222233334445')
            const insertApplicationCall = (dataSource.manager.query as jest.Mock).mock.calls.find(([sql]: [string]) =>
                sql.includes('INSERT INTO applications.cat_applications (')
            )
            expect(insertApplicationCall?.[1]).toContain('draft')
            expect(
                (dataSource.manager.query as jest.Mock).mock.calls.some(([sql]: [string]) =>
                    sql.includes('INSERT INTO applications.cat_connectors (')
                )
            ).toBe(false)
        })

        it('should auto-resolve slug collisions for repeated copies when slug is not provided explicitly', async () => {
            const { dataSource } = buildDataSource()

            configureCopyQueries(dataSource, {
                sourceApplication: {
                    id: 'application-1',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Source App' } }
                    },
                    description: null,
                    slug: 'source-app',
                    isPublic: false,
                    schemaName: 'app_source001',
                    schemaStatus: 'synced',
                    _uplVersion: 1,
                    _uplCreatedAt: new Date(),
                    _uplUpdatedAt: new Date()
                },
                generatedId: '018f8a78-7b8f-7c1d-a111-222233334447',
                slugChecks: {
                    'source-app-copy': { id: 'existing-copy-1', slug: 'source-app-copy' },
                    'source-app-copy-2': null
                },
                copiedApplication: buildCopiedApplicationRow('018f8a78-7b8f-7c1d-a111-222233334447', {
                    slug: 'source-app-copy-2'
                })
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications/application-1/copy')
                .send({
                    name: { en: 'Source App (copy)' },
                    copyConnector: false,
                    createSchema: false,
                    copyAccess: false
                })
                .expect(201)

            expect(response.body.id).toBe('018f8a78-7b8f-7c1d-a111-222233334447')
            const insertApplicationCall = (dataSource.manager.query as jest.Mock).mock.calls.find(([sql]: [string]) =>
                sql.includes('INSERT INTO applications.cat_applications (')
            )
            expect(insertApplicationCall?.[1]?.[3]).toBe('source-app-copy-2')
        })

        it('should retry with next generated slug when insert fails with concurrent slug conflict', async () => {
            const { dataSource } = buildDataSource()

            const slugRaceError = Object.assign(new Error('duplicate key value violates unique constraint "applications_slug_key"'), {
                code: '23505',
                constraint: 'applications_slug_key'
            })

            configureCopyQueries(dataSource, {
                sourceApplication: {
                    id: 'application-1',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Source App' } }
                    },
                    description: null,
                    slug: 'source-app',
                    isPublic: false,
                    schemaName: 'app_source001',
                    schemaStatus: 'synced',
                    _uplVersion: 1,
                    _uplCreatedAt: new Date(),
                    _uplUpdatedAt: new Date()
                },
                generatedId: '018f8a78-7b8f-7c1d-a111-222233334448',
                slugChecks: {
                    'source-app-copy': null,
                    'source-app-copy-2': null
                },
                copiedApplication: buildCopiedApplicationRow('018f8a78-7b8f-7c1d-a111-222233334448', {
                    slug: 'source-app-copy-2'
                })
            })
            ;(dataSource.manager.query as jest.Mock)
                .mockImplementationOnce(async (sql: string) => {
                    if (sql.includes('INSERT INTO applications.cat_applications (')) {
                        throw slugRaceError
                    }
                    return []
                })
                .mockImplementation(async (sql: string) => {
                    if (sql.includes('INSERT INTO applications.cat_applications (')) {
                        return [
                            buildCopiedApplicationRow('018f8a78-7b8f-7c1d-a111-222233334448', {
                                slug: 'source-app-copy-2'
                            })
                        ]
                    }
                    return []
                })

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications/application-1/copy')
                .send({
                    name: { en: 'Source App (copy)' },
                    copyConnector: false,
                    createSchema: false,
                    copyAccess: false
                })
                .expect(201)

            expect(response.body.id).toBe('018f8a78-7b8f-7c1d-a111-222233334448')
            const insertCalls = (dataSource.manager.query as jest.Mock).mock.calls.filter(([sql]: [string]) =>
                sql.includes('INSERT INTO applications.cat_applications (')
            )
            expect(insertCalls).toHaveLength(2)
            expect(insertCalls[0][1][3]).toBe('source-app-copy')
            expect(insertCalls[1][1][3]).toBe('source-app-copy-2')
        })

        it('should ignore legacy createSchema flag and still copy without connectors when copyConnector=false', async () => {
            const { dataSource } = buildDataSource()

            configureCopyQueries(dataSource, {
                sourceApplication: {
                    id: 'application-1',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Source App' } }
                    },
                    description: null,
                    slug: 'source-app',
                    isPublic: false,
                    schemaName: 'app_source001'
                },
                generatedId: '018f8a78-7b8f-7c1d-a111-222233334449',
                slugChecks: {
                    'source-app-copy': null
                },
                copiedApplication: buildCopiedApplicationRow('018f8a78-7b8f-7c1d-a111-222233334449', {
                    slug: 'source-app-copy'
                })
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications/application-1/copy')
                .send({
                    name: { en: 'Source App (copy)' },
                    copyConnector: false,
                    createSchema: true
                })
                .expect(201)

            expect(response.body.id).toBe('018f8a78-7b8f-7c1d-a111-222233334449')
            expect(
                (dataSource.manager.query as jest.Mock).mock.calls.some(([sql]: [string]) =>
                    sql.includes('INSERT INTO applications.cat_connectors (')
                )
            ).toBe(false)
        })
    })

    describe('GET /applications/:applicationId', () => {
        it('should return 403 when user has no access', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue({
                id: 'application-1',
                name: 'Test'
            })
            applicationUserRepo.findOne.mockResolvedValue(null) // no membership

            const app = buildApp(dataSource)

            // API returns 403 when user has no access (checked before 404)
            await request(app).get('/applications/non-existent-id').expect(403)
        })

        it('should deny public non-members with only global read access', async () => {
            const { dataSource } = buildDataSource()
            ;(hasSubjectPermission as jest.Mock).mockImplementation(async (_executor, _userId, subject: string, action = 'read') => {
                return subject === 'applications' && action === 'read'
            })
            ;(getGlobalRoleCodename as jest.Mock).mockResolvedValue('User')

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications/application-public').expect(403)

            expect(response.body).toMatchObject({ error: 'Access denied to this application' })
        })

        it('should return application details for member', async () => {
            const { dataSource, applicationUserRepo } = buildDataSource()
            applicationUserRepo.findOne.mockResolvedValue({
                user_id: 'test-user-id',
                role: 'owner'
            })
            ;(dataSource.query as jest.Mock).mockResolvedValue([
                {
                    id: 'application-1',
                    name: 'Test Application',
                    description: 'Description',
                    slug: 'test-app',
                    isPublic: false,
                    schemaName: 'app_123',
                    schemaStatus: 'draft',
                    schemaSyncedAt: null,
                    schemaError: null,
                    version: 1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    updatedBy: 'test-user-id',
                    connectorsCount: 2,
                    membersCount: 4
                }
            ])

            const app = buildApp(dataSource)

            const response = await request(app).get('/applications/application-1').expect(200)

            expect(response.body).toMatchObject({
                id: 'application-1',
                name: 'Test Application'
            })
        })
    })

    describe('PATCH /applications/:applicationId', () => {
        it('should update application for owner', async () => {
            const { dataSource, applicationUserRepo } = buildDataSource()
            applicationUserRepo.findOne.mockResolvedValue({
                user_id: 'test-user-id',
                role: 'owner'
            })
            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM applications.rel_application_users')) {
                    return [
                        {
                            id: 'membership-id',
                            userId: 'test-user-id',
                            applicationId: 'application-1',
                            role: 'owner',
                            _uplCreatedAt: new Date()
                        }
                    ]
                }

                if (sql.includes('UPDATE applications.cat_applications')) {
                    return [
                        {
                            id: 'application-1',
                            name: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'New Name' } }
                            },
                            description: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Old Description' } }
                            },
                            slug: 'test-app',
                            isPublic: false,
                            schemaName: 'app_123',
                            schemaStatus: 'draft',
                            schemaSyncedAt: null,
                            schemaError: null,
                            version: 2,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            updatedBy: 'test-user-id'
                        }
                    ]
                }

                return [
                    {
                        id: 'application-1',
                        name: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Old Name' } }
                        },
                        description: {
                            _schema: 'v1',
                            _primary: 'en',
                            locales: { en: { content: 'Old Description' } }
                        },
                        slug: 'test-app',
                        isPublic: false,
                        schemaName: 'app_123',
                        schemaStatus: 'draft',
                        schemaSyncedAt: null,
                        schemaError: null,
                        version: 1,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        updatedBy: 'test-user-id',
                        connectorsCount: 0,
                        membersCount: 1
                    }
                ]
            })

            const app = buildApp(dataSource)

            const response = await request(app).patch('/applications/application-1').send({ name: 'New Name' }).expect(200)

            expect(response.body.name).toMatchObject({
                _primary: 'en'
            })
        })

        it('should reject visibility updates after creation', async () => {
            const { dataSource, applicationUserRepo } = buildDataSource()
            applicationUserRepo.findOne.mockResolvedValue({
                user_id: 'test-user-id',
                role: 'owner'
            })
            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM applications.rel_application_users')) {
                    return [
                        {
                            id: 'membership-id',
                            userId: 'test-user-id',
                            applicationId: 'application-1',
                            role: 'owner',
                            _uplCreatedAt: new Date()
                        }
                    ]
                }

                return [
                    {
                        id: 'application-1',
                        name: {
                            _schema: '1',
                            _primary: 'en',
                            locales: { en: { content: 'Existing App' } }
                        },
                        isPublic: false,
                        workspacesEnabled: false
                    }
                ]
            })

            const app = buildApp(dataSource)

            const response = await request(app).patch('/applications/application-1').send({ isPublic: true }).expect(400)

            expect(response.body.error).toContain('Immutable application parameters')
        })
    })

    describe('DELETE /applications/:applicationId', () => {
        it('should delete application for owner', async () => {
            const { dataSource, applicationUserRepo } = buildDataSource()
            applicationUserRepo.findOne.mockResolvedValue({
                user_id: 'test-user-id',
                role: 'owner'
            })
            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM applications.rel_application_users')) {
                    return [
                        {
                            id: 'membership-id',
                            userId: 'test-user-id',
                            applicationId: 'application-1',
                            role: 'owner',
                            _uplCreatedAt: new Date()
                        }
                    ]
                }

                return [
                    {
                        id: 'application-1',
                        name: 'Test Application',
                        description: null,
                        slug: 'test-app',
                        isPublic: false,
                        schemaName: 'app_1234567890abcdef1234567890abcdef',
                        schemaStatus: 'draft',
                        schemaSyncedAt: null,
                        schemaError: null,
                        version: 1,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        updatedBy: 'test-user-id',
                        connectorsCount: 0,
                        membersCount: 1
                    }
                ]
            })
            ;(dataSource.manager.query as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'application-1' }])

            const app = buildApp(dataSource)

            await request(app).delete('/applications/application-1').expect(204)

            expect(dataSource.transaction).toHaveBeenCalled()
            expect(dataSource.manager.query).toHaveBeenCalled()
        })

        it('should return 403 for non-owner', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue({
                id: 'application-1',
                name: 'Test Application'
            })
            applicationUserRepo.findOne.mockResolvedValue({
                user_id: 'test-user-id',
                role: 'editor' // not owner
            })

            const app = buildApp(dataSource)

            await request(app).delete('/applications/application-1').expect(403)
        })
    })

    describe('Members endpoints', () => {
        describe('GET /applications/:applicationId/members', () => {
            it('should return members list for admin', async () => {
                const { dataSource, applicationUserRepo } = buildDataSource()

                applicationUserRepo.findOne.mockResolvedValue({
                    userId: 'test-user-id',
                    role: 'admin'
                })
                ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                    if (sql.includes('COUNT(*) OVER()') && sql.includes('FROM applications.rel_application_users au')) {
                        return [
                            {
                                id: 'member-1',
                                applicationId: 'application-1',
                                userId: 'user-1',
                                role: 'member',
                                comment: null,
                                createdAt: new Date(),
                                email: 'member@example.com',
                                nickname: 'Member',
                                windowTotal: '1'
                            }
                        ]
                    }

                    if (sql.includes('FROM applications.rel_application_users')) {
                        const membership = normalizeMembershipRow(
                            await applicationUserRepo.findOne({
                                where: {
                                    applicationId: params?.[0],
                                    userId: params?.[1]
                                }
                            })
                        )
                        return membership ? [membership] : []
                    }

                    return []
                })

                const app = buildApp(dataSource)

                const response = await request(app).get('/applications/application-1/members').expect(200)

                expect(response.body.items).toHaveLength(1)
                expect(response.body.items[0]).toMatchObject({
                    userId: 'user-1',
                    role: 'member'
                })
            })
        })

        describe('POST /applications/:applicationId/members', () => {
            it('should invite new member', async () => {
                const { dataSource, applicationUserRepo } = buildDataSource()

                applicationUserRepo.findOne.mockImplementation(async ({ where }: { where: { userId: string } }) => {
                    if (where.userId === 'test-user-id') {
                        return { user_id: 'test-user-id', role: 'admin' }
                    }
                    return null
                })
                ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                    if (sql.includes('FROM auth.users')) {
                        return [{ id: 'new-user-id', email: 'newuser@example.com' }]
                    }

                    if (sql.includes('schema_name AS "schemaName"') && sql.includes('FROM applications.cat_applications')) {
                        return [{ id: 'application-1', schemaName: null, workspacesEnabled: false }]
                    }

                    if (sql.includes('FROM applications.rel_application_users')) {
                        const membership = normalizeMembershipRow(
                            await applicationUserRepo.findOne({
                                where: {
                                    applicationId: params?.[0],
                                    userId: params?.[1]
                                }
                            })
                        )
                        return membership ? [membership] : []
                    }

                    return []
                })
                ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                    if (sql.includes('WITH inserted AS')) {
                        return [
                            {
                                id: 'new-member-id',
                                applicationId: 'application-1',
                                userId: 'new-user-id',
                                role: 'member',
                                comment: null,
                                createdAt: new Date(),
                                email: 'newuser@example.com',
                                nickname: null
                            }
                        ]
                    }

                    return []
                })

                const app = buildApp(dataSource)

                const response = await request(app)
                    .post('/applications/application-1/members')
                    .send({ email: 'newuser@example.com', role: 'member' })
                    .expect(201)

                expect(response.body).toMatchObject({
                    userId: 'new-user-id',
                    role: 'member'
                })
            })

            it('should reject inviting already existing member', async () => {
                const { dataSource, applicationUserRepo } = buildDataSource()

                applicationUserRepo.findOne.mockImplementation(async ({ where }: { where: { userId: string } }) => {
                    if (where.userId === 'test-user-id') {
                        return { user_id: 'test-user-id', role: 'admin' }
                    }

                    if (where.userId === 'existing-id') {
                        return { user_id: 'existing-id', role: 'member' }
                    }

                    return null
                })
                ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                    if (sql.includes('FROM auth.users')) {
                        return [{ id: 'existing-id', email: 'existing@example.com' }]
                    }

                    if (sql.includes('FROM applications.rel_application_users')) {
                        const membership = normalizeMembershipRow(
                            await applicationUserRepo.findOne({
                                where: {
                                    applicationId: params?.[0],
                                    userId: params?.[1]
                                }
                            })
                        )
                        return membership ? [membership] : []
                    }

                    return []
                })

                const app = buildApp(dataSource)

                await request(app)
                    .post('/applications/application-1/members')
                    .send({ email: 'existing@example.com', role: 'member' })
                    .expect(409)
            })
        })

        describe('PATCH /applications/:applicationId/members/:userId', () => {
            it('should update member role', async () => {
                const { dataSource, applicationUserRepo } = buildDataSource()

                applicationUserRepo.findOne.mockResolvedValue({
                    user_id: 'test-user-id',
                    role: 'admin'
                })
                ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                    if (sql.includes('WITH updated AS')) {
                        return [
                            {
                                id: 'member-id',
                                applicationId: 'application-1',
                                userId: 'target-user',
                                role: 'editor',
                                comment: null,
                                createdAt: new Date(),
                                email: 'target@example.com',
                                nickname: null
                            }
                        ]
                    }

                    if (sql.includes('FROM applications.rel_application_users au') && sql.includes('au.id = $2')) {
                        return [
                            {
                                id: 'member-id',
                                applicationId: 'application-1',
                                userId: 'target-user',
                                role: 'member',
                                comment: null,
                                createdAt: new Date(),
                                email: 'target@example.com',
                                nickname: null
                            }
                        ]
                    }

                    if (sql.includes('FROM applications.rel_application_users')) {
                        const membership = normalizeMembershipRow(
                            await applicationUserRepo.findOne({
                                where: {
                                    applicationId: params?.[0],
                                    userId: params?.[1]
                                }
                            })
                        )
                        return membership ? [membership] : []
                    }

                    return []
                })

                const app = buildApp(dataSource)

                const response = await request(app)
                    .patch('/applications/application-1/members/target-user')
                    .send({ role: 'editor' })
                    .expect(200)

                expect(response.body.role).toBe('editor')
            })
        })

        describe('DELETE /applications/:applicationId/members/:userId', () => {
            it('should remove member', async () => {
                const { dataSource, applicationUserRepo } = buildDataSource()

                applicationUserRepo.findOne.mockResolvedValue({
                    user_id: 'test-user-id',
                    role: 'admin'
                })
                ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                    if (sql.includes('DELETE FROM applications.rel_application_users')) {
                        return [{ id: 'member-id' }]
                    }

                    if (sql.includes('schema_name AS "schemaName"') && sql.includes('FROM applications.cat_applications')) {
                        return [{ id: 'application-1', schemaName: null, workspacesEnabled: false }]
                    }

                    if (sql.includes('FROM applications.rel_application_users au') && sql.includes('au.id = $2')) {
                        return [
                            {
                                id: 'member-id',
                                applicationId: 'application-1',
                                userId: 'target-user',
                                role: 'member',
                                comment: null,
                                createdAt: new Date(),
                                email: 'target@example.com',
                                nickname: null
                            }
                        ]
                    }

                    if (sql.includes('FROM applications.rel_application_users')) {
                        const membership = normalizeMembershipRow(
                            await applicationUserRepo.findOne({
                                where: {
                                    applicationId: params?.[0],
                                    userId: params?.[1]
                                }
                            })
                        )
                        return membership ? [membership] : []
                    }

                    return []
                })

                const app = buildApp(dataSource)

                await request(app).delete('/applications/application-1/members/member-id').expect(204)

                expect(dataSource.query).toHaveBeenCalled()
            })

            it('should prevent removing owner', async () => {
                const { dataSource, applicationUserRepo } = buildDataSource()

                applicationUserRepo.findOne.mockResolvedValue({
                    user_id: 'test-user-id',
                    role: 'admin'
                })
                ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                    if (sql.includes('FROM applications.rel_application_users au') && sql.includes('au.id = $2')) {
                        return [
                            {
                                id: 'owner-id',
                                applicationId: 'application-1',
                                userId: 'owner-user',
                                role: 'owner',
                                comment: null,
                                createdAt: new Date(),
                                email: 'owner@example.com',
                                nickname: null
                            }
                        ]
                    }

                    if (sql.includes('FROM applications.rel_application_users')) {
                        const membership = normalizeMembershipRow(
                            await applicationUserRepo.findOne({
                                where: {
                                    applicationId: params?.[0],
                                    userId: params?.[1]
                                }
                            })
                        )
                        return membership ? [membership] : []
                    }

                    return []
                })

                const app = buildApp(dataSource)

                await request(app).delete('/applications/application-1/members/owner-user').expect(403)
            })
        })
    })

    describe('Public membership and settings endpoints', () => {
        const limitsCatalogId = '018f8a78-7b8f-7c1d-a111-222233334499'

        it('joins a public application inside one transaction', async () => {
            const { dataSource, applicationUserRepo } = buildDataSource()
            const publicApplicationId = '018f8a78-7b8f-7c1d-a111-222233334498'

            applicationUserRepo.findOne.mockResolvedValue(null)
            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM applications.cat_applications a')) {
                    return [
                        {
                            id: publicApplicationId,
                            name: 'Public App',
                            description: null,
                            slug: 'public-app',
                            isPublic: true,
                            workspacesEnabled: false,
                            schemaName: null,
                            schemaStatus: 'draft',
                            schemaSyncedAt: null,
                            schemaError: null,
                            version: 1,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            updatedBy: 'owner-id',
                            connectorsCount: 0,
                            membersCount: 1
                        }
                    ]
                }

                if (sql.includes('FROM applications.rel_application_users')) {
                    const membership = normalizeMembershipRow(
                        await applicationUserRepo.findOne({
                            where: {
                                applicationId: params?.[0],
                                userId: params?.[1]
                            }
                        })
                    )
                    return membership ? [membership] : []
                }

                return []
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('WITH inserted AS')) {
                    return [
                        {
                            id: 'joined-member-id',
                            applicationId: publicApplicationId,
                            userId: 'test-user-id',
                            role: 'member',
                            comment: null,
                            createdAt: new Date(),
                            email: 'test@example.com',
                            nickname: null
                        }
                    ]
                }

                return []
            })

            const app = buildApp(dataSource)

            const response = await request(app).post(`/applications/${publicApplicationId}/join`).expect(201)

            expect(response.body).toMatchObject({
                status: 'joined',
                member: {
                    id: 'joined-member-id',
                    role: 'member'
                }
            })
            expect(dataSource.transaction).toHaveBeenCalledTimes(1)
        })

        it('leaves an application inside one transaction', async () => {
            const { dataSource, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                id: 'member-id',
                applicationId: 'application-1',
                userId: 'test-user-id',
                role: 'member'
            })
            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('FROM applications.rel_application_users au')) {
                    return [
                        {
                            id: 'member-id',
                            applicationId: 'application-1',
                            userId: 'test-user-id',
                            role: 'member',
                            comment: null,
                            createdAt: new Date(),
                            email: 'test@example.com',
                            nickname: null
                        }
                    ]
                }

                if (sql.includes('schema_name AS "schemaName"') && sql.includes('FROM applications.cat_applications')) {
                    return [{ id: 'application-1', schemaName: null, workspacesEnabled: false }]
                }

                return []
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('UPDATE applications.rel_application_users')) {
                    return [{ id: 'member-id' }]
                }

                return []
            })

            const app = buildApp(dataSource)

            const response = await request(app).post('/applications/application-1/leave').expect(200)

            expect(response.body).toEqual({ status: 'left' })
            expect(dataSource.transaction).toHaveBeenCalledTimes(1)
        })

        it('updates workspace limits atomically inside one transaction', async () => {
            const { dataSource, applicationUserRepo } = buildDataSource()
            const limitsSchemaName = 'app_018f8a787b8f7c1da111222233334497'

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                role: 'owner'
            })
            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM applications.rel_application_users')) {
                    const membership = normalizeMembershipRow(
                        await applicationUserRepo.findOne({
                            where: {
                                applicationId: params?.[0],
                                userId: params?.[1]
                            }
                        })
                    )
                    return membership ? [membership] : []
                }

                if (sql.includes('schema_name AS "schemaName"') && sql.includes('FROM applications.cat_applications')) {
                    return [{ id: 'application-1', schemaName: limitsSchemaName, workspacesEnabled: true }]
                }

                if (sql.includes('FROM information_schema.tables')) {
                    return [{ exists: true }]
                }

                return []
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes(`FROM "${limitsSchemaName}"._app_objects`)) {
                    return [{ id: limitsCatalogId }]
                }

                if (sql.includes(`UPDATE "${limitsSchemaName}"."_app_limits"`)) {
                    return []
                }

                if (sql.includes(`LEFT JOIN "${limitsSchemaName}"."_app_limits"`)) {
                    return [{ objectId: limitsCatalogId, maxRows: null }]
                }

                return []
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .put('/applications/application-1/settings/limits')
                .send({
                    limits: [{ objectId: limitsCatalogId, maxRows: null }]
                })
                .expect(200)

            expect(response.body).toEqual({
                items: [{ objectId: limitsCatalogId, maxRows: null }]
            })
            expect(dataSource.transaction).toHaveBeenCalledTimes(1)
        })

        it('rejects duplicate workspace limit rows before starting a transaction', async () => {
            const { dataSource, applicationUserRepo } = buildDataSource()
            const limitsSchemaName = 'app_018f8a787b8f7c1da111222233334497'

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                role: 'owner'
            })
            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM applications.rel_application_users')) {
                    const membership = normalizeMembershipRow(
                        await applicationUserRepo.findOne({
                            where: {
                                applicationId: params?.[0],
                                userId: params?.[1]
                            }
                        })
                    )
                    return membership ? [membership] : []
                }

                if (sql.includes('schema_name AS "schemaName"') && sql.includes('FROM applications.cat_applications')) {
                    return [{ id: 'application-1', schemaName: limitsSchemaName, workspacesEnabled: true }]
                }

                if (sql.includes('FROM information_schema.tables')) {
                    return [{ exists: true }]
                }

                return []
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .put('/applications/application-1/settings/limits')
                .send({
                    limits: [
                        { objectId: limitsCatalogId, maxRows: 5 },
                        { objectId: limitsCatalogId, maxRows: 10 }
                    ]
                })
                .expect(400)

            expect(response.body.error).toContain('Duplicate catalog limit rows')
            expect(dataSource.transaction).not.toHaveBeenCalled()
        })

        it('rejects member access to the application members list', async () => {
            const { dataSource, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: 'application-1',
                role: 'member'
            })

            const app = buildApp(dataSource)
            await request(app).get('/applications/application-1/members').expect(403)
        })
    })

    describe('Runtime enumeration validation', () => {
        const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334444'
        const runtimeCatalogId = '018f8a78-7b8f-7c1d-a111-222233334445'

        it('rejects create when enum REF field in label mode is explicitly provided by user', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'owner'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test'
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [{ id: runtimeCatalogId, codename: 'orders', table_name: 'orders' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_attributes')) {
                    return [
                        {
                            id: 'attr-1',
                            codename: 'status',
                            column_name: 'status_ref',
                            data_type: 'REF',
                            is_required: false,
                            validation_rules: {},
                            target_object_id: 'enum-obj-1',
                            target_object_kind: 'enumeration',
                            ui_config: { enumPresentationMode: 'label' }
                        }
                    ]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows`)
                .send({
                    catalogId: runtimeCatalogId,
                    data: {
                        status_ref: '018f8a78-7b8f-7c1d-a111-222233334444'
                    }
                })
                .expect(400)

            expect(response.body.error).toBe('Field is read-only: status')
        })

        it('rejects PATCH when enum value does not belong to selected target enumeration', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'owner'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test'
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [{ id: runtimeCatalogId, codename: 'orders', table_name: 'orders' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_attributes')) {
                    return [
                        {
                            id: 'attr-1',
                            codename: 'status',
                            column_name: 'status_ref',
                            data_type: 'REF',
                            is_required: false,
                            validation_rules: {},
                            target_object_id: 'enum-obj-1',
                            target_object_kind: 'enumeration',
                            ui_config: { enumPresentationMode: 'select' }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_values')) {
                    return []
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .patch(`/applications/${runtimeApplicationId}/runtime/018f8a78-7b8f-7c1d-a111-222233334444`)
                .send({
                    catalogId: runtimeCatalogId,
                    field: 'status_ref',
                    value: '018f8a78-7b8f-7c1d-a111-222233334444'
                })
                .expect(400)

            expect(response.body.error).toBe('Enumeration value does not belong to target enumeration')
        })

        it('applies default enum value for label-mode REF when user value is omitted', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const defaultEnumValueId = '018f8a78-7b8f-7c1d-a111-222233334446'
            const insertedRowId = '018f8a78-7b8f-7c1d-a111-222233334447'

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'owner'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test'
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [{ id: runtimeCatalogId, codename: 'orders', table_name: 'orders' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_attributes')) {
                    return [
                        {
                            id: 'attr-1',
                            codename: 'status',
                            column_name: 'status_ref',
                            data_type: 'REF',
                            is_required: false,
                            validation_rules: {},
                            target_object_id: 'enum-obj-1',
                            target_object_kind: 'enumeration',
                            ui_config: { enumPresentationMode: 'label', defaultEnumValueId }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_values')) {
                    return [{ id: defaultEnumValueId }]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."orders"')) {
                    return [{ id: insertedRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows`)
                .send({
                    catalogId: runtimeCatalogId,
                    data: {}
                })
                .expect(201)

            expect(response.body).toEqual({ id: insertedRowId, status: 'created' })

            const insertCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('INSERT INTO "app_runtime_test"."orders"')
            )
            expect(insertCall).toBeDefined()
            expect(insertCall?.[1]).toContain(defaultEnumValueId)
        })
    })

    describe('Runtime lifecycle delete contract', () => {
        const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334450'
        const runtimeCatalogId = '018f8a78-7b8f-7c1d-a111-222233334451'
        const runtimeRowId = '018f8a78-7b8f-7c1d-a111-222233334452'

        it('rejects runtime delete when role permissions do not allow deleting content', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'editor'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                workspacesEnabled: false
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .delete(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .query({ catalogId: runtimeCatalogId })
                .expect(403)

            expect(response.body).toEqual({ error: 'Insufficient permissions for this action' })
        })

        it('uses physical DELETE when lifecycle contract is hard delete', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'owner'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test'
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeCatalogId,
                            codename: 'orders',
                            table_name: 'orders',
                            config: {
                                systemFields: {
                                    lifecycleContract: {
                                        delete: { mode: 'hard' }
                                    }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_attributes')) {
                    return []
                }
                if (sql.includes('DELETE FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .delete(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .query({ catalogId: runtimeCatalogId })
                .expect(200)

            expect(response.body).toEqual({ status: 'deleted' })
            const deleteCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('DELETE FROM "app_runtime_test"."orders"')
            )
            expect(deleteCall).toBeDefined()
            expect(String(deleteCall?.[0])).not.toContain('_app_deleted = false')
            expect(String(deleteCall?.[0])).not.toContain('SET _upl_deleted = true')
        })

        it('omits optional app delete audit columns when lifecycle contract disables them', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'owner'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test'
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeCatalogId,
                            codename: 'orders',
                            table_name: 'orders',
                            config: {
                                systemFields: {
                                    lifecycleContract: {
                                        delete: { mode: 'soft', trackAt: false, trackBy: false }
                                    }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_attributes')) {
                    return []
                }
                if (sql.includes('UPDATE "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            await request(app)
                .delete(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .query({ catalogId: runtimeCatalogId })
                .expect(200)

            const updateCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('UPDATE "app_runtime_test"."orders"')
            )
            expect(updateCall).toBeDefined()
            expect(String(updateCall?.[0])).toContain('_app_deleted = true')
            expect(String(updateCall?.[0])).not.toContain('_app_deleted_at = now()')
            expect(String(updateCall?.[0])).not.toContain('_app_deleted_by = $1')
        })

        it('omits platform delete predicates and updates when upl delete fields are disabled in catalog config', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'owner'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test'
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeCatalogId,
                            codename: 'orders',
                            table_name: 'orders',
                            config: {
                                systemFields: {
                                    fields: [
                                        { key: 'upl.archived', enabled: false },
                                        { key: 'upl.archived_at', enabled: false },
                                        { key: 'upl.archived_by', enabled: false },
                                        { key: 'upl.deleted', enabled: false },
                                        { key: 'upl.deleted_at', enabled: false },
                                        { key: 'upl.deleted_by', enabled: false }
                                    ],
                                    lifecycleContract: {
                                        delete: { mode: 'soft', trackAt: false, trackBy: false }
                                    }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_attributes')) {
                    return []
                }
                if (sql.includes('UPDATE "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            await request(app)
                .delete(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .query({ catalogId: runtimeCatalogId })
                .expect(200)

            const updateCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('UPDATE "app_runtime_test"."orders"')
            )

            expect(updateCall).toBeDefined()
            expect(String(updateCall?.[0])).toContain('_app_deleted = true')
            expect(String(updateCall?.[0])).not.toContain('_upl_deleted = true')
            expect(String(updateCall?.[0])).not.toContain('_upl_deleted = false')
        })
    })

    describe('Runtime tabular copy permission contract', () => {
        const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334560'
        const runtimeCatalogId = '018f8a78-7b8f-7c1d-a111-222233334561'
        const runtimeRecordId = '018f8a78-7b8f-7c1d-a111-222233334562'
        const runtimeChildRowId = '018f8a78-7b8f-7c1d-a111-222233334564'

        it('allows editor role to enter child-row copy because copy is governed by create permissions', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'editor'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                workspacesEnabled: false
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRecordId}/tabular/not-a-uuid/${runtimeChildRowId}/copy`)
                .query({ catalogId: runtimeCatalogId })
                .expect(400)

            expect(response.body).toEqual({ error: 'Invalid catalog or attribute ID format' })
        })
    })
})
