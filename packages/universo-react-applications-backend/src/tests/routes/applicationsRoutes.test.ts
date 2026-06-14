jest.mock('@universo-react/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

const mockCloneSchemaWithExecutor = jest.fn(async () => undefined)
const mockGenerateSchemaName = jest.fn((id: string) => `app_${id.replace(/-/g, '')}`)
const mockGenerateChildTableName = jest.fn((attributeId: string) => `tab_${attributeId.replace(/-/g, '')}`)
const mockIsValidSchemaName = jest.fn(() => true)

jest.mock('@universo-react/schema-ddl', () => ({
    __esModule: true,
    cloneSchemaWithExecutor: (...args: unknown[]) => mockCloneSchemaWithExecutor(...args),
    generateSchemaName: (...args: unknown[]) => mockGenerateSchemaName(...(args as [string])),
    generateChildTableName: (...args: unknown[]) => mockGenerateChildTableName(...(args as [string])),
    isValidSchemaName: (...args: unknown[]) => mockIsValidSchemaName(...(args as [string]))
}))

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { getGlobalRoleCodename, hasSubjectPermission, isSuperuser } from '@universo-react/admin-backend'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')
import { createMockDbExecutor, createMockDataStore } from '../utils/dbMocks'
import { createApplicationsRoutes } from '../../routes/applicationsRoutes'
import { ROLE_PERMISSIONS } from '../../routes/guards'
import { RuntimeModulesService } from '../../services/runtimeModulesService'
import { buildRuntimeRecordAccessClause, type RuntimeObjectCollectionAttr } from '../../controllers/runtimeRowsController'

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

    const buildRuntimeSchemaName = (applicationId: string) => `app_${applicationId.replace(/-/g, '')}`

    const runtimeModulesTableFragment = (schemaName: string) => `FROM "${schemaName}"."_app_modules"`

    const buildOwnerOrSharedRuntimeConfig = (sharedObjectCodename = 'ContentAccessEntries') => ({
        runtimeLibrary: {
            shared: {
                objectCodename: sharedObjectCodename,
                targetObjectFieldCodename: 'TargetObjectCodename',
                targetRecordFieldCodename: 'TargetRecordId',
                principalTypeFieldCodename: 'PrincipalType',
                principalIdFieldCodename: 'PrincipalId',
                accessLevelFieldCodename: 'AccessLevel',
                allowedPrincipalTypes: ['workspaceMember', 'user']
            }
        },
        runtimeRecordAccess: {
            mode: 'ownerOrShared',
            ownerColumnName: '_upl_created_by',
            sharedRelationKey: 'shared'
        }
    })

    const runtimeAccessEntryComponents = [
        {
            id: 'target-object',
            codename: 'TargetObjectCodename',
            column_name: 'target_object_codename',
            data_type: 'STRING'
        },
        {
            id: 'target-record',
            codename: 'TargetRecordId',
            column_name: 'target_record_id',
            data_type: 'STRING'
        },
        {
            id: 'principal-type',
            codename: 'PrincipalType',
            column_name: 'principal_type',
            data_type: 'STRING'
        },
        {
            id: 'principal-id',
            codename: 'PrincipalId',
            column_name: 'principal_id',
            data_type: 'STRING'
        },
        {
            id: 'access-level',
            codename: 'AccessLevel',
            column_name: 'access_level',
            data_type: 'STRING'
        }
    ]

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

            if (sql.includes('schema_name AS "schemaName"') && sql.includes('FROM applications.obj_applications')) {
                const application = await applicationRepo.findOne({
                    where: {
                        id: params?.[0]
                    }
                })

                return application
                    ? [
                          {
                              id: application.id,
                              schemaName: (application as Record<string, unknown>).schemaName ?? null,
                              workspacesEnabled: (application as Record<string, unknown>).workspacesEnabled === true,
                              settings: ((application as Record<string, unknown>).settings as Record<string, unknown> | null) ?? null
                          }
                      ]
                    : []
            }

            return txExecutor.query(sql, params)
        })

        return {
            dataSource,
            executor,
            txExecutor,
            applicationRepo,
            applicationUserRepo
        }
    }

    beforeEach(() => {
        jest.restoreAllMocks()
        jest.clearAllMocks()
        mockCloneSchemaWithExecutor.mockClear()
        mockGenerateSchemaName.mockClear()
        mockGenerateChildTableName.mockClear()
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
            const runtimeLinkedCollectionId = '018f8a78-7b8f-7c1d-a111-222233334471'
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
                            id: runtimeLinkedCollectionId,
                            codename: {
                                _primary: 'en',
                                locales: {
                                    en: { content: 'orders' },
                                    ru: { content: 'orders_ru' }
                                }
                            },
                            table_name: 'orders',
                            presentation: null,
                            config: null
                        }
                    ]
                }

                if (sql.includes('FROM "app_runtime_test"._app_components')) {
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

            expect(response.body.section).toMatchObject({
                id: runtimeLinkedCollectionId,
                codename: 'orders'
            })
            expect(response.body.sections).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: runtimeLinkedCollectionId,
                        codename: 'orders'
                    })
                ])
            )
            expect(response.body.activeSectionId).toBe(runtimeLinkedCollectionId)
            expect(response.body.permissions).toMatchObject({
                createContent: false,
                editContent: false,
                deleteContent: false
            })
        })

        it('applies runtime search, sort, and filters only through declared components', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334472'
            const runtimeLinkedCollectionId = '018f8a78-7b8f-7c1d-a111-222233334473'
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const listQueries: Array<{ sql: string; params?: unknown[] }> = []

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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            kind: 'object',
                            codename: 'orders',
                            table_name: 'orders',
                            presentation: null,
                            config: null
                        }
                    ]
                }

                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334474',
                            codename: 'Name',
                            column_name: 'name',
                            data_type: 'STRING',
                            is_required: false,
                            is_display_component: true,
                            presentation: null,
                            validation_rules: { localized: true },
                            sort_order: 1,
                            ui_config: null,
                            target_object_id: null,
                            target_object_kind: null
                        },
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334475',
                            codename: 'Score',
                            column_name: 'score',
                            data_type: 'NUMBER',
                            is_required: false,
                            is_display_component: false,
                            presentation: null,
                            validation_rules: null,
                            sort_order: 2,
                            ui_config: null,
                            target_object_id: null,
                            target_object_kind: null
                        },
                        {
                            id: '018f8a78-7b8f-7c1d-a111-22223333447f',
                            codename: 'AssignedUserId',
                            column_name: 'assigned_user_id',
                            data_type: 'STRING',
                            is_required: false,
                            is_display_component: false,
                            presentation: null,
                            validation_rules: null,
                            sort_order: 4,
                            ui_config: null,
                            target_object_id: null,
                            target_object_kind: null
                        },
                        {
                            id: '018f8a78-7b8f-7c1d-a111-22223333448c',
                            codename: {
                                _primary: 'en',
                                locales: {
                                    en: { content: 'CompletedAt' },
                                    ru: { content: 'Завершено' }
                                }
                            },
                            column_name: 'completed_at',
                            data_type: 'DATETIME',
                            is_required: false,
                            is_display_component: false,
                            presentation: null,
                            validation_rules: null,
                            sort_order: 5,
                            ui_config: null,
                            target_object_id: null,
                            target_object_kind: null
                        }
                    ]
                }

                if (sql.includes('COUNT(*)::int AS total')) {
                    listQueries.push({ sql, params })
                    return [{ total: 1 }]
                }

                if (sql.includes('SELECT id') && sql.includes('FROM "app_runtime_test"."orders"')) {
                    listQueries.push({ sql, params })
                    return [{ id: 'row-1', name: 'Alice Example', score: '95', assigned_user_id: 'test-user-id' }]
                }

                if (sql.includes('FROM information_schema.tables')) {
                    return [{ exists: false, settingsExists: false, zoneWidgetsExists: false }]
                }

                return []
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .get(`/applications/${runtimeApplicationId}/runtime`)
                .query({
                    objectCollectionId: runtimeLinkedCollectionId,
                    search: 'Alice%',
                    sort: JSON.stringify([
                        { field: 'Name', direction: 'asc' },
                        { field: 'CompletedAt', direction: 'asc' },
                        { field: 'score', direction: 'desc' }
                    ]),
                    filters: JSON.stringify([
                        { field: 'name', operator: 'contains', value: 'Alice%' },
                        { field: 'score', operator: 'greaterThanOrEqual', value: '80' },
                        { field: 'AssignedUserId', operator: 'equals', value: { runtime: 'currentUserId' } }
                    ])
                })
                .expect(200)

            expect(response.body.rows).toEqual([
                expect.objectContaining({ id: 'row-1', name: 'Alice Example', score: 95, assigned_user_id: 'test-user-id' })
            ])
            expect(response.body.columns).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        codename: 'CompletedAt',
                        field: 'completed_at'
                    })
                ])
            )
            const dataQuery = listQueries.find((entry) => entry.sql.includes('ORDER BY'))
            expect(dataQuery?.sql).toContain(
                `COALESCE("name"->'locales'->("name"->>'_primary')->>'content', "name"->'locales'->'en'->>'content', "name" #>> '{}', '') ASC NULLS LAST`
            )
            expect(dataQuery?.sql).toContain('"completed_at" ASC NULLS LAST')
            expect(dataQuery?.sql).toContain('"score" DESC NULLS LAST')
            expect(dataQuery?.sql).toContain(
                `COALESCE("name"->'locales'->("name"->>'_primary')->>'content', "name"->'locales'->'en'->>'content', "name" #>> '{}', '')::text ILIKE`
            )
            expect(dataQuery?.params).toEqual(expect.arrayContaining(['%Alice\\%%', 80, 'test-user-id', 100, 0]))
        })

        it('rejects runtime list sort and filter fields that are not declared components', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334476'
            const runtimeLinkedCollectionId = '018f8a78-7b8f-7c1d-a111-222233334477'
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
                            id: runtimeLinkedCollectionId,
                            kind: 'object',
                            codename: 'orders',
                            table_name: 'orders',
                            presentation: null,
                            config: null
                        }
                    ]
                }

                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334478',
                            codename: 'Name',
                            column_name: 'name',
                            data_type: 'STRING',
                            is_required: false,
                            is_display_component: true,
                            presentation: null,
                            validation_rules: null,
                            sort_order: 1,
                            ui_config: null,
                            target_object_id: null,
                            target_object_kind: null
                        }
                    ]
                }

                return []
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .get(`/applications/${runtimeApplicationId}/runtime`)
                .query({
                    objectCollectionId: runtimeLinkedCollectionId,
                    sort: JSON.stringify([{ field: 'bad;drop', direction: 'asc' }]),
                    filters: JSON.stringify([{ field: 'payload', operator: 'contains', value: 'ignored' }])
                })
                .expect(400)

            expect(response.body).toMatchObject({
                error: 'Runtime list query references unknown or unsupported fields',
                fields: ['bad;drop', 'payload']
            })
        })

        it('applies metadata-driven shared library and owner-or-shared record access clauses for read-only members', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334476'
            const runtimeLinkedCollectionId = '018f8a78-7b8f-7c1d-a111-222233334477'
            const sharedEntriesObjectId = '018f8a78-7b8f-7c1d-a111-222233334478'
            const listQueries: Array<{ sql: string; params?: unknown[] }> = []
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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'ContentAccessEntries') {
                        return [
                            {
                                id: sharedEntriesObjectId,
                                kind: 'object',
                                codename: 'ContentAccessEntries',
                                table_name: 'content_access_entries',
                                config: null
                            }
                        ]
                    }
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            kind: 'object',
                            codename: 'LearningResources',
                            table_name: 'learning_resources',
                            presentation: null,
                            config: {
                                runtimeLibrary: {
                                    shared: {
                                        objectCodename: 'ContentAccessEntries',
                                        targetObjectFieldCodename: 'TargetObjectCodename',
                                        targetRecordFieldCodename: 'TargetRecordId',
                                        principalTypeFieldCodename: 'PrincipalType',
                                        principalIdFieldCodename: 'PrincipalId',
                                        allowedPrincipalTypes: ['workspaceMember', 'user']
                                    }
                                },
                                runtimeRecordAccess: {
                                    mode: 'ownerOrShared',
                                    ownerColumnName: '_upl_created_by',
                                    sharedRelationKey: 'shared'
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    if (params?.[0] === sharedEntriesObjectId) {
                        return [
                            {
                                id: 'target-object',
                                codename: 'TargetObjectCodename',
                                column_name: 'target_object_codename',
                                data_type: 'STRING'
                            },
                            {
                                id: 'target-record',
                                codename: 'TargetRecordId',
                                column_name: 'target_record_id',
                                data_type: 'STRING'
                            },
                            {
                                id: 'principal-type',
                                codename: 'PrincipalType',
                                column_name: 'principal_type',
                                data_type: 'STRING'
                            },
                            {
                                id: 'principal-id',
                                codename: 'PrincipalId',
                                column_name: 'principal_id',
                                data_type: 'STRING'
                            }
                        ]
                    }
                    return [
                        {
                            id: 'title',
                            codename: 'Title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: true,
                            is_display_component: true,
                            presentation: null,
                            validation_rules: null,
                            sort_order: 1,
                            ui_config: null,
                            target_object_id: null,
                            target_object_kind: null
                        }
                    ]
                }
                if (sql.includes('COUNT(*)::int AS total')) {
                    listQueries.push({ sql, params })
                    return [{ total: 1 }]
                }
                if (sql.includes('SELECT id') && sql.includes('FROM "app_runtime_test"."learning_resources"')) {
                    listQueries.push({ sql, params })
                    return [{ id: 'row-1', title: 'Visible shared resource' }]
                }
                if (sql.includes('FROM information_schema.tables')) {
                    return [{ exists: false, settingsExists: false, zoneWidgetsExists: false }]
                }
                return []
            })

            const app = buildApp(dataSource)
            await request(app)
                .get(`/applications/${runtimeApplicationId}/runtime`)
                .query({ objectCollectionId: runtimeLinkedCollectionId, libraryView: 'shared' })
                .expect(200)

            const dataQuery = listQueries.find((entry) => entry.sql.includes('ORDER BY'))
            expect(dataQuery?.sql).toContain('"_upl_created_by" = $1')
            expect(dataQuery?.sql).toContain('FROM "app_runtime_test"."content_access_entries" rel')
            expect(dataQuery?.sql).toContain('rel."principal_type" = ANY(')
            expect(dataQuery?.params).toEqual(
                expect.arrayContaining(['test-user-id', 'LearningResources', ['workspaceMember', 'user'], 100, 0])
            )
        })

        it.each([
            {
                label: 'create',
                run: (app: ReturnType<typeof buildApp>, applicationId: string, objectCollectionId: string) =>
                    request(app)
                        .post(`/applications/${applicationId}/runtime/rows`)
                        .send({ objectCollectionId, data: { Title: 'Forbidden write' } })
            },
            {
                label: 'edit',
                run: (app: ReturnType<typeof buildApp>, applicationId: string, objectCollectionId: string, rowId: string) =>
                    request(app)
                        .patch(`/applications/${applicationId}/runtime/${rowId}`)
                        .send({ objectCollectionId, field: 'Title', value: 'Forbidden edit' })
            },
            {
                label: 'copy',
                run: (app: ReturnType<typeof buildApp>, applicationId: string, objectCollectionId: string, rowId: string) =>
                    request(app).post(`/applications/${applicationId}/runtime/rows/${rowId}/copy`).send({ objectCollectionId })
            },
            {
                label: 'delete',
                run: (app: ReturnType<typeof buildApp>, applicationId: string, objectCollectionId: string, rowId: string) =>
                    request(app).delete(`/applications/${applicationId}/runtime/rows/${rowId}`).query({ objectCollectionId })
            },
            {
                label: 'restore',
                run: (app: ReturnType<typeof buildApp>, applicationId: string, objectCollectionId: string, rowId: string) =>
                    request(app).post(`/applications/${applicationId}/runtime/rows/${rowId}/restore`).send({ objectCollectionId })
            }
        ])('rejects direct $label attempts for shared-viewer members before runtime metadata reads', async ({ run }) => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-2222333344c0'
            const runtimeLinkedCollectionId = '018f8a78-7b8f-7c1d-a111-2222333344c1'
            const runtimeRowId = '018f8a78-7b8f-7c1d-a111-2222333344c2'
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

            const app = buildApp(dataSource)
            const response = await run(app, runtimeApplicationId, runtimeLinkedCollectionId, runtimeRowId).expect(403)

            expect(response.body).toEqual({ error: 'Insufficient permissions for this action' })
            expect(dataSource.manager.query).not.toHaveBeenCalled()
        })
    })

    describe('POST /applications/:applicationId/runtime/datasources/records/union', () => {
        it('runs records.union through the generic runtime list contract', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-2222333344a0'
            const resourceObjectId = '018f8a78-7b8f-7c1d-a111-2222333344a1'
            const courseObjectId = '018f8a78-7b8f-7c1d-a111-2222333344a2'
            const projectObjectId = '018f8a78-7b8f-7c1d-a111-2222333344a6'
            const projectRowId = '018f8a78-7b8f-7c1d-a111-2222333344a7'
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const listQueries: Array<{ sql: string; params?: unknown[] }> = []

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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === projectObjectId) {
                        return [
                            {
                                id: projectObjectId,
                                kind: 'object',
                                codename: 'ContentProjects',
                                table_name: 'content_projects',
                                presentation: { locales: { en: { content: 'Content Projects' } }, _primary: 'en' },
                                config: null
                            }
                        ]
                    }

                    return [
                        {
                            id: resourceObjectId,
                            kind: 'object',
                            codename: 'LearningResources',
                            table_name: 'learning_resources',
                            presentation: { locales: { en: { content: 'Learning Resources' } }, _primary: 'en' },
                            config: null
                        },
                        {
                            id: courseObjectId,
                            kind: 'object',
                            codename: 'Courses',
                            table_name: 'courses',
                            presentation: { locales: { en: { content: 'Courses' } }, _primary: 'en' },
                            config: null
                        }
                    ]
                }

                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    if (params?.[0] === projectObjectId) {
                        return [
                            {
                                id: '018f8a78-7b8f-7c1d-a111-2222333344a8',
                                codename: 'Title',
                                column_name: 'title',
                                data_type: 'STRING',
                                is_required: false,
                                is_display_component: true,
                                presentation: null,
                                validation_rules: { localized: true, versioned: true },
                                sort_order: 1,
                                ui_config: null,
                                target_object_id: null,
                                target_object_kind: null
                            }
                        ]
                    }

                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-2222333344a3',
                            codename: 'Title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: false,
                            is_display_component: true,
                            presentation: null,
                            validation_rules: null,
                            sort_order: 1,
                            ui_config: null,
                            target_object_id: null,
                            target_object_kind: null
                        },
                        {
                            id: '018f8a78-7b8f-7c1d-a111-2222333344a9',
                            codename: 'ProjectId',
                            column_name: 'project_id',
                            data_type: 'REF',
                            is_required: false,
                            is_display_component: false,
                            presentation: { locales: { en: { content: 'Project' } }, _primary: 'en' },
                            validation_rules: null,
                            sort_order: 2,
                            ui_config: null,
                            target_object_id: projectObjectId,
                            target_object_kind: 'object'
                        }
                    ]
                }

                if (sql.includes('FROM information_schema.tables')) {
                    return [{ exists: false }]
                }

                if (sql.includes('COUNT(*)::int AS total')) {
                    listQueries.push({ sql, params })
                    return [{ total: 2 }]
                }

                if (sql.includes('SELECT row_data AS row')) {
                    listQueries.push({ sql, params })
                    return [
                        {
                            row: {
                                id: `${courseObjectId}:018f8a78-7b8f-7c1d-a111-2222333344a5`,
                                __runtimeObjectCollectionId: courseObjectId,
                                __runtimeObjectCollectionCodename: 'Courses',
                                __runtimeSourceRowId: '018f8a78-7b8f-7c1d-a111-2222333344a5',
                                __runtimeDisplayType: 'Courses',
                                _upl_version: 7,
                                title: 'Safety',
                                project: { id: projectRowId, label: 'Onboarding' }
                            }
                        },
                        {
                            row: {
                                id: `${resourceObjectId}:018f8a78-7b8f-7c1d-a111-2222333344a4`,
                                __runtimeObjectCollectionId: resourceObjectId,
                                __runtimeObjectCollectionCodename: 'LearningResources',
                                __runtimeSourceRowId: '018f8a78-7b8f-7c1d-a111-2222333344a4',
                                __runtimeDisplayType: 'Learning Resources',
                                _upl_version: 3,
                                title: 'Welcome',
                                project: { id: projectRowId, label: 'Onboarding' }
                            }
                        }
                    ]
                }

                if (sql.includes('FROM "app_runtime_test"."learning_resources"')) {
                    listQueries.push({ sql, params })
                    return [{ id: '018f8a78-7b8f-7c1d-a111-2222333344a4', title: { locales: { en: { content: 'Welcome' } } } }]
                }

                if (sql.includes('FROM "app_runtime_test"."courses"')) {
                    listQueries.push({ sql, params })
                    return [{ id: '018f8a78-7b8f-7c1d-a111-2222333344a5', title: { locales: { en: { content: 'Safety' } } } }]
                }

                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/datasources/records/union`)
                .send({
                    datasource: {
                        kind: 'records.union',
                        targets: [
                            { sectionId: resourceObjectId, titleField: 'Title', projectField: 'ProjectId' },
                            { sectionCodename: 'Courses', titleField: 'Title', projectField: 'ProjectId' }
                        ],
                        query: {
                            search: 'Safe',
                            sort: [{ field: 'title', direction: 'asc' }]
                        }
                    },
                    limit: 20,
                    offset: 0,
                    locale: 'ru'
                })
                .expect(200)

            expect(response.body.pagination).toMatchObject({ total: 2, limit: 20, offset: 0 })
            expect(response.body.rows).toEqual([
                expect.objectContaining({
                    id: `${courseObjectId}:018f8a78-7b8f-7c1d-a111-2222333344a5`,
                    __runtimeObjectCollectionId: courseObjectId,
                    __runtimeSourceRowId: '018f8a78-7b8f-7c1d-a111-2222333344a5',
                    _upl_version: 7,
                    title: 'Safety',
                    project: { id: projectRowId, label: 'Onboarding' }
                }),
                expect.objectContaining({
                    id: `${resourceObjectId}:018f8a78-7b8f-7c1d-a111-2222333344a4`,
                    __runtimeObjectCollectionId: resourceObjectId,
                    __runtimeSourceRowId: '018f8a78-7b8f-7c1d-a111-2222333344a4',
                    _upl_version: 3,
                    title: 'Welcome',
                    project: { id: projectRowId, label: 'Onboarding' }
                })
            ])
            expect(response.body.columns.map((column: { field: string }) => column.field)).toEqual(['type', 'title', 'project'])
            expect(listQueries.some((entry) => entry.sql.includes('ILIKE'))).toBe(true)
            expect(listQueries.some((entry) => entry.sql.includes('"content_projects"'))).toBe(true)
            expect(listQueries.some((entry) => entry.sql.includes("->'locales'->'ru'->>'content'"))).toBe(true)

            listQueries.length = 0
            await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/datasources/records/union`)
                .send({
                    datasource: {
                        kind: 'records.union',
                        targets: [{ sectionId: resourceObjectId, titleField: 'Title', projectField: 'ProjectId' }]
                    },
                    limit: 20,
                    offset: 0,
                    locale: "ru' || pg_sleep(1) --"
                })
                .expect(200)
            const hostileLocaleSql = listQueries.map((entry) => entry.sql).join('\n')
            if (hostileLocaleSql.includes('pg_sleep(1)')) {
                expect(hostileLocaleSql).toContain("ru'' || pg_sleep(1)")
            }
            expect(hostileLocaleSql).not.toContain("->'locales'->'ru' || pg_sleep(1)")
        })

        it('rejects runtime access-entry helper objects as records.union targets', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-2222333344d1'
            const accessObjectId = '018f8a78-7b8f-7c1d-a111-2222333344d2'
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
                            id: accessObjectId,
                            kind: 'object',
                            codename: 'ContentAccessEntries',
                            table_name: 'content_access_entries',
                            presentation: { locales: { en: { content: 'Content Access Entries' } }, _primary: 'en' },
                            config: {
                                runtimeAccessEntry: {
                                    principalTypeFieldCodename: 'PrincipalType',
                                    principalIdFieldCodename: 'PrincipalId',
                                    supportedPrincipalTypes: ['workspaceMember', 'user']
                                }
                            }
                        }
                    ]
                }

                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/datasources/records/union`)
                .send({
                    datasource: {
                        kind: 'records.union',
                        targets: [{ sectionCodename: 'ContentAccessEntries', titleField: 'PrincipalId' }]
                    },
                    limit: 20,
                    offset: 0,
                    locale: 'en'
                })
                .expect(403)

            expect(response.body).toEqual({
                error: 'Records union datasource target is restricted',
                target: 'ContentAccessEntries'
            })
            expect(dataSource.manager.query).not.toHaveBeenCalledWith(
                expect.stringContaining('FROM "app_runtime_test"."content_access_entries"'),
                expect.anything()
            )
        })

        it('projects recent timestamps and sorts records.union recent views by recentAt', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-2222333344d0'
            const resourceObjectId = '018f8a78-7b8f-7c1d-a111-2222333344d1'
            const recentObjectId = '018f8a78-7b8f-7c1d-a111-2222333344d2'
            const sourceRowId = '018f8a78-7b8f-7c1d-a111-2222333344d3'
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const listQueries: Array<{ sql: string; params?: unknown[] }> = []

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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'RecentContentViews') {
                        return [
                            {
                                id: recentObjectId,
                                kind: 'object',
                                codename: 'RecentContentViews',
                                table_name: 'recent_content_views',
                                config: null
                            }
                        ]
                    }

                    return [
                        {
                            id: resourceObjectId,
                            kind: 'object',
                            codename: 'LearningResources',
                            table_name: 'learning_resources',
                            presentation: { locales: { en: { content: 'Learning Resources' } }, _primary: 'en' },
                            config: {
                                runtimeLibrary: {
                                    recent: {
                                        objectCodename: 'RecentContentViews',
                                        targetObjectFieldCodename: 'TargetObjectCodename',
                                        targetRecordFieldCodename: 'TargetRecordId',
                                        actorFieldCodename: 'UserId',
                                        timestampFieldCodename: 'ViewedAt'
                                    }
                                }
                            }
                        }
                    ]
                }

                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    if (params?.[0] === recentObjectId) {
                        return [
                            {
                                id: 'recent-target-object',
                                codename: 'TargetObjectCodename',
                                column_name: 'target_object_codename',
                                data_type: 'STRING'
                            },
                            {
                                id: 'recent-target-record',
                                codename: 'TargetRecordId',
                                column_name: 'target_record_id',
                                data_type: 'STRING'
                            },
                            { id: 'recent-user', codename: 'UserId', column_name: 'user_id', data_type: 'STRING' },
                            { id: 'recent-viewed-at', codename: 'ViewedAt', column_name: 'viewed_at', data_type: 'DATE' }
                        ]
                    }

                    return [
                        {
                            id: 'title',
                            codename: 'Title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: false,
                            is_display_component: true,
                            presentation: null,
                            validation_rules: null,
                            ui_config: null
                        }
                    ]
                }

                if (sql.includes('FROM information_schema.tables')) {
                    return [{ exists: false }]
                }

                if (sql.includes('COUNT(*)::int AS total')) {
                    listQueries.push({ sql, params })
                    return [{ total: 1 }]
                }

                if (sql.includes('SELECT row_data AS row')) {
                    listQueries.push({ sql, params })
                    return [
                        {
                            row: {
                                id: `${resourceObjectId}:${sourceRowId}`,
                                __runtimeObjectCollectionId: resourceObjectId,
                                __runtimeObjectCollectionCodename: 'LearningResources',
                                __runtimeSourceRowId: sourceRowId,
                                __runtimeDisplayType: 'Learning Resources',
                                _upl_version: 3,
                                title: 'Welcome',
                                recentAt: '2026-05-21T08:30:00.000Z'
                            }
                        }
                    ]
                }

                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/datasources/records/union`)
                .send({
                    datasource: {
                        kind: 'records.union',
                        targets: [{ sectionCodename: 'LearningResources', titleField: 'Title' }],
                        query: {
                            lifecycleState: 'active',
                            libraryView: 'recent',
                            sort: [{ field: 'recentAt', direction: 'desc' }]
                        }
                    },
                    limit: 20,
                    offset: 0,
                    locale: 'en'
                })
                .expect(200)

            expect(response.body.columns.map((column: { field: string }) => column.field)).toContain('recentAt')
            expect(response.body.rows[0]).toMatchObject({
                id: `${resourceObjectId}:${sourceRowId}`,
                title: 'Welcome',
                recentAt: '2026-05-21T08:30:00.000Z'
            })
            const selectQuery = listQueries.find((entry) => entry.sql.includes('SELECT row_data AS row'))
            expect(selectQuery?.sql).toContain('FROM "app_runtime_test"."recent_content_views" rel')
            expect(selectQuery?.sql).toContain("row_data ->> 'recentAt' DESC")
        })

        it('projects shared timestamps and sorts records.union shared views by sharedAt', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-2222333345d0'
            const resourceObjectId = '018f8a78-7b8f-7c1d-a111-2222333345d1'
            const accessObjectId = '018f8a78-7b8f-7c1d-a111-2222333345d2'
            const sourceRowId = '018f8a78-7b8f-7c1d-a111-2222333345d3'
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const listQueries: Array<{ sql: string; params?: unknown[] }> = []

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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'ContentAccessEntries') {
                        return [
                            {
                                id: accessObjectId,
                                kind: 'object',
                                codename: 'ContentAccessEntries',
                                table_name: 'content_access_entries',
                                config: null
                            }
                        ]
                    }

                    return [
                        {
                            id: resourceObjectId,
                            kind: 'object',
                            codename: 'LearningResources',
                            table_name: 'learning_resources',
                            presentation: { locales: { en: { content: 'Learning Resources' } }, _primary: 'en' },
                            config: {
                                runtimeLibrary: {
                                    shared: {
                                        objectCodename: 'ContentAccessEntries',
                                        targetObjectFieldCodename: 'TargetObjectCodename',
                                        targetRecordFieldCodename: 'TargetRecordId',
                                        principalTypeFieldCodename: 'PrincipalType',
                                        principalIdFieldCodename: 'PrincipalId',
                                        timestampFieldCodename: 'InvitedAt',
                                        allowedPrincipalTypes: ['workspaceMember', 'user']
                                    }
                                }
                            }
                        }
                    ]
                }

                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    if (params?.[0] === accessObjectId) {
                        return [
                            {
                                id: 'access-target-object',
                                codename: 'TargetObjectCodename',
                                column_name: 'target_object_codename',
                                data_type: 'STRING'
                            },
                            {
                                id: 'access-target-record',
                                codename: 'TargetRecordId',
                                column_name: 'target_record_id',
                                data_type: 'STRING'
                            },
                            {
                                id: 'access-principal-type',
                                codename: 'PrincipalType',
                                column_name: 'principal_type',
                                data_type: 'STRING'
                            },
                            {
                                id: 'access-principal-id',
                                codename: 'PrincipalId',
                                column_name: 'principal_id',
                                data_type: 'STRING'
                            },
                            { id: 'access-invited-at', codename: 'InvitedAt', column_name: 'invited_at', data_type: 'DATE' }
                        ]
                    }

                    return [
                        {
                            id: 'title',
                            codename: 'Title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: false,
                            is_display_component: true,
                            presentation: null,
                            validation_rules: null,
                            ui_config: null
                        }
                    ]
                }

                if (sql.includes('FROM information_schema.tables')) {
                    return [{ exists: false }]
                }

                if (sql.includes('COUNT(*)::int AS total')) {
                    listQueries.push({ sql, params })
                    return [{ total: 1 }]
                }

                if (sql.includes('SELECT row_data AS row')) {
                    listQueries.push({ sql, params })
                    return [
                        {
                            row: {
                                id: `${resourceObjectId}:${sourceRowId}`,
                                __runtimeObjectCollectionId: resourceObjectId,
                                __runtimeObjectCollectionCodename: 'LearningResources',
                                __runtimeSourceRowId: sourceRowId,
                                __runtimeDisplayType: 'Learning Resources',
                                _upl_version: 3,
                                title: 'Welcome',
                                __runtimeShared: true,
                                sharedAt: '2026-05-21T09:15:00.000Z'
                            }
                        }
                    ]
                }

                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/datasources/records/union`)
                .send({
                    datasource: {
                        kind: 'records.union',
                        targets: [{ sectionCodename: 'LearningResources', titleField: 'Title' }],
                        query: {
                            lifecycleState: 'active',
                            libraryView: 'shared',
                            sort: [{ field: 'sharedAt', direction: 'desc' }]
                        }
                    },
                    limit: 20,
                    offset: 0,
                    locale: 'en'
                })
                .expect(200)

            expect(response.body.columns.map((column: { field: string }) => column.field)).toContain('sharedAt')
            expect(response.body.rows[0]).toMatchObject({
                id: `${resourceObjectId}:${sourceRowId}`,
                title: 'Welcome',
                sharedAt: '2026-05-21T09:15:00.000Z'
            })
            expect(JSON.stringify(response.body.rows[0])).not.toContain('access-entry')
            const selectQuery = listQueries.find((entry) => entry.sql.includes('SELECT row_data AS row'))
            expect(selectQuery?.sql).toContain('FROM "app_runtime_test"."content_access_entries" rel')
            expect(selectQuery?.sql).toContain('rel."principal_type" = ANY')
            expect(selectQuery?.sql).toContain('rel."principal_id"::text')
            expect(selectQuery?.sql).toContain("row_data ->> 'sharedAt' DESC")
        })
    })

    describe('POST /applications/:applicationId/runtime/rows/:rowId/library/:relationKey', () => {
        it('requires shared canEdit access for edit-bound row predicates without rejecting legacy access-level casing', async () => {
            const manager = {
                query: jest.fn(async (sql: string, params?: unknown[]) => {
                    if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                        return [
                            {
                                id: 'access-object-id',
                                codename: 'ContentAccessEntries',
                                table_name: 'content_access_entries',
                                config: null
                            }
                        ]
                    }
                    if (sql.includes('FROM "app_runtime_test"._app_components')) {
                        expect(params?.[0]).toBe('access-object-id')
                        return runtimeAccessEntryComponents
                    }
                    return []
                })
            }
            const attrs: RuntimeObjectCollectionAttr[] = [
                {
                    id: 'title-attr',
                    codename: 'Title',
                    column_name: 'title',
                    data_type: 'STRING',
                    is_required: false,
                    validation_rules: {}
                }
            ]
            const values: unknown[] = []

            const editClause = await buildRuntimeRecordAccessClause({
                manager,
                schemaIdent: '"app_runtime_test"',
                currentWorkspaceId: null,
                currentUserId: 'shared-user-id',
                permissions: ROLE_PERMISSIONS.member,
                objectCodename: 'LearningResources',
                attrs,
                config: buildOwnerOrSharedRuntimeConfig(),
                outerRowIdSql: 'src.id',
                values,
                minimumAccessLevel: 'edit'
            })

            expect(editClause).toContain('"_upl_created_by" = $1')
            expect(editClause).toContain('LOWER(rel."access_level"::text) = \'canedit\'')
            expect(editClause).not.toContain('canView')
            expect(values).toEqual(['shared-user-id', 'LearningResources', 'shared-user-id', ['workspaceMember', 'user']])

            const readValues: unknown[] = []
            const readClause = await buildRuntimeRecordAccessClause({
                manager,
                schemaIdent: '"app_runtime_test"',
                currentWorkspaceId: null,
                currentUserId: 'shared-user-id',
                permissions: ROLE_PERMISSIONS.member,
                objectCodename: 'LearningResources',
                attrs,
                config: buildOwnerOrSharedRuntimeConfig(),
                outerRowIdSql: 'src.id',
                values: readValues,
                minimumAccessLevel: 'read'
            })

            expect(readClause).not.toContain('LOWER(rel."access_level"::text)')
        })

        it('inherits edit-bound runtime access from a configured parent record', async () => {
            const manager = {
                query: jest.fn(async (sql: string, params?: unknown[]) => {
                    if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                        if (params?.[0] === 'Courses') {
                            return [
                                {
                                    id: 'course-object-id',
                                    codename: 'Courses',
                                    table_name: 'courses',
                                    config: buildOwnerOrSharedRuntimeConfig()
                                }
                            ]
                        }
                        if (params?.[0] === 'ContentAccessEntries') {
                            return [
                                {
                                    id: 'access-object-id',
                                    codename: 'ContentAccessEntries',
                                    table_name: 'content_access_entries',
                                    config: null
                                }
                            ]
                        }
                    }
                    if (sql.includes('FROM "app_runtime_test"._app_components')) {
                        if (params?.[0] === 'course-object-id') {
                            return []
                        }
                        if (params?.[0] === 'access-object-id') {
                            return runtimeAccessEntryComponents
                        }
                    }
                    return []
                })
            }
            const values: unknown[] = []
            const clause = await buildRuntimeRecordAccessClause({
                manager,
                schemaIdent: '"app_runtime_test"',
                currentWorkspaceId: null,
                currentUserId: 'shared-user-id',
                permissions: ROLE_PERMISSIONS.member,
                objectCodename: 'CourseItems',
                attrs: [
                    {
                        id: 'course-id-attr',
                        codename: 'CourseId',
                        column_name: 'course_id',
                        data_type: 'REF',
                        target_object_id: 'course-object-id',
                        target_object_kind: 'object',
                        is_required: true,
                        validation_rules: {}
                    }
                ],
                config: {
                    runtimeRecordParentAccess: {
                        mode: 'parentRecord',
                        parentObjectCodename: 'Courses',
                        parentFieldCodename: 'CourseId'
                    }
                },
                outerRowIdSql: 'target.id',
                values,
                minimumAccessLevel: 'edit'
            })

            expect(clause).toContain('EXISTS')
            expect(clause).toContain('FROM "app_runtime_test"."courses" parent_access_0')
            expect(clause).toContain('parent_access_0.id::text = target."course_id"::text')
            expect(clause).toContain('rel."target_record_id"::text = parent_access_0.id::text')
            expect(clause).toContain('LOWER(rel."access_level"::text) = \'canedit\'')
            expect(values).toEqual(['shared-user-id', 'Courses', 'shared-user-id', ['workspaceMember', 'user']])
        })

        it('inserts a configured starred relation without requiring content edit permissions', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-2222333344b0'
            const resourceObjectId = '018f8a78-7b8f-7c1d-a111-2222333344b1'
            const starsObjectId = '018f8a78-7b8f-7c1d-a111-2222333344b2'
            const runtimeRowId = '018f8a78-7b8f-7c1d-a111-2222333344b3'
            const insertedRelationQueries: Array<{ sql: string; params?: unknown[] }> = []
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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'ContentStars') {
                        return [
                            {
                                id: starsObjectId,
                                kind: 'object',
                                codename: 'ContentStars',
                                table_name: 'content_stars',
                                config: null
                            }
                        ]
                    }

                    return [
                        {
                            id: resourceObjectId,
                            kind: 'object',
                            codename: 'LearningResources',
                            table_name: 'learning_resources',
                            config: {
                                runtimeLibrary: {
                                    starred: {
                                        objectCodename: 'ContentStars',
                                        targetObjectFieldCodename: 'TargetObjectCodename',
                                        targetRecordFieldCodename: 'TargetRecordId',
                                        actorFieldCodename: 'UserId',
                                        timestampFieldCodename: 'StarredAt'
                                    }
                                }
                            }
                        },
                        {
                            id: starsObjectId,
                            kind: 'object',
                            codename: 'ContentStars',
                            table_name: 'content_stars',
                            config: null
                        }
                    ]
                }

                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    if (params?.[0] === starsObjectId) {
                        return [
                            {
                                id: 'target-object',
                                codename: 'TargetObjectCodename',
                                column_name: 'target_object_codename',
                                data_type: 'STRING'
                            },
                            { id: 'target-record', codename: 'TargetRecordId', column_name: 'target_record_id', data_type: 'STRING' },
                            { id: 'actor', codename: 'UserId', column_name: 'user_id', data_type: 'STRING' },
                            { id: 'starred-at', codename: 'StarredAt', column_name: 'starred_at', data_type: 'DATE' }
                        ]
                    }
                    return [{ id: 'title', codename: 'Title', column_name: 'title', data_type: 'STRING' }]
                }

                if (sql.includes('FROM "app_runtime_test"."learning_resources" src')) {
                    return [{ id: runtimeRowId, owner_user_id: 'test-user-id' }]
                }
                if (sql.includes('pg_advisory_xact_lock')) {
                    return []
                }
                if (sql.includes('SELECT rel.id') && sql.includes('FROM "app_runtime_test"."content_stars" rel')) {
                    return []
                }
                if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-2222333344b4' }]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."content_stars"')) {
                    insertedRelationQueries.push({ sql, params })
                    return []
                }

                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/library/starred`)
                .send({ objectCollectionId: resourceObjectId, active: true })
                .expect(200)

            expect(response.body).toEqual({ relationKey: 'starred', active: true, changed: true })
            expect(insertedRelationQueries).toHaveLength(1)
            expect(insertedRelationQueries[0]?.sql).toContain('"starred_at"')
            expect(insertedRelationQueries[0]?.params).toEqual([
                '018f8a78-7b8f-7c1d-a111-2222333344b4',
                'LearningResources',
                runtimeRowId,
                'test-user-id',
                'test-user-id',
                'test-user-id'
            ])
        })

        it('inserts a configured shared relation for the current user without accepting raw principal IDs', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-2222333344b5'
            const resourceObjectId = '018f8a78-7b8f-7c1d-a111-2222333344b6'
            const accessObjectId = '018f8a78-7b8f-7c1d-a111-2222333344b7'
            const runtimeRowId = '018f8a78-7b8f-7c1d-a111-2222333344b8'
            const insertedRelationQueries: Array<{ sql: string; params?: unknown[] }> = []
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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'ContentAccessEntries') {
                        return [
                            {
                                id: accessObjectId,
                                kind: 'object',
                                codename: 'ContentAccessEntries',
                                table_name: 'content_access_entries',
                                config: null
                            }
                        ]
                    }

                    return [
                        {
                            id: resourceObjectId,
                            kind: 'object',
                            codename: 'LearningResources',
                            table_name: 'learning_resources',
                            config: {
                                runtimeLibrary: {
                                    shared: {
                                        objectCodename: 'ContentAccessEntries',
                                        targetObjectFieldCodename: 'TargetObjectCodename',
                                        targetRecordFieldCodename: 'TargetRecordId',
                                        principalTypeFieldCodename: 'PrincipalType',
                                        principalIdFieldCodename: 'PrincipalId',
                                        accessLevelFieldCodename: 'AccessLevel',
                                        defaultAccessLevel: 'canView',
                                        timestampFieldCodename: 'InvitedAt',
                                        allowedPrincipalTypes: ['workspaceMember', 'user']
                                    }
                                },
                                runtimeRecordAccess: {
                                    mode: 'ownerOrShared',
                                    ownerColumnName: '_upl_created_by',
                                    sharedRelationKey: 'shared'
                                }
                            }
                        },
                        {
                            id: accessObjectId,
                            kind: 'object',
                            codename: 'ContentAccessEntries',
                            table_name: 'content_access_entries',
                            config: null
                        }
                    ]
                }

                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    if (params?.[0] === accessObjectId) {
                        return [
                            {
                                id: 'target-object',
                                codename: 'TargetObjectCodename',
                                column_name: 'target_object_codename',
                                data_type: 'STRING'
                            },
                            { id: 'target-record', codename: 'TargetRecordId', column_name: 'target_record_id', data_type: 'STRING' },
                            { id: 'principal-type', codename: 'PrincipalType', column_name: 'principal_type', data_type: 'STRING' },
                            { id: 'principal-id', codename: 'PrincipalId', column_name: 'principal_id', data_type: 'STRING' },
                            { id: 'access-level', codename: 'AccessLevel', column_name: 'access_level', data_type: 'STRING' },
                            { id: 'invited-at', codename: 'InvitedAt', column_name: 'invited_at', data_type: 'DATE' }
                        ]
                    }
                    return [{ id: 'title', codename: 'Title', column_name: 'title', data_type: 'STRING' }]
                }

                if (sql.includes('FROM "app_runtime_test"."learning_resources" src')) {
                    return [{ id: runtimeRowId, owner_user_id: 'test-user-id' }]
                }
                if (sql.includes('pg_advisory_xact_lock')) {
                    return []
                }
                if (sql.includes('SELECT rel.id') && sql.includes('FROM "app_runtime_test"."content_access_entries" rel')) {
                    return []
                }
                if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-2222333344b9' }]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."content_access_entries"')) {
                    insertedRelationQueries.push({ sql, params })
                    return []
                }

                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/library/shared`)
                .send({ objectCollectionId: resourceObjectId, active: true })
                .expect(200)

            expect(response.body).toEqual({ relationKey: 'shared', active: true, changed: true })
            expect(insertedRelationQueries).toHaveLength(1)
            expect(insertedRelationQueries[0]?.sql).toContain('"principal_type"')
            expect(insertedRelationQueries[0]?.sql).toContain('"principal_id"')
            expect(insertedRelationQueries[0]?.sql).toContain('"access_level"')
            expect(insertedRelationQueries[0]?.sql).toContain('"invited_at"')
            expect(insertedRelationQueries[0]?.params).toEqual([
                '018f8a78-7b8f-7c1d-a111-2222333344b9',
                'LearningResources',
                runtimeRowId,
                'user',
                'test-user-id',
                'canView',
                'test-user-id',
                'test-user-id'
            ])
        })

        it('rejects shared-viewer attempts to re-share content before principal lookup or relation insert', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-2222333344c0'
            const resourceObjectId = '018f8a78-7b8f-7c1d-a111-2222333344c1'
            const accessObjectId = '018f8a78-7b8f-7c1d-a111-2222333344c2'
            const runtimeRowId = '018f8a78-7b8f-7c1d-a111-2222333344c3'
            const principalId = '018f8a78-7b8f-7c1d-a111-2222333344c4'
            const membershipQueries: Array<{ sql: string; params?: unknown[] }> = []
            const insertedRelationQueries: Array<{ sql: string; params?: unknown[] }> = []
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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM applications.rel_application_users')) {
                    membershipQueries.push({ sql, params })
                    return [{ id: 'principal-membership' }]
                }

                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'ContentAccessEntries') {
                        return [
                            {
                                id: accessObjectId,
                                kind: 'object',
                                codename: 'ContentAccessEntries',
                                table_name: 'content_access_entries',
                                config: null
                            }
                        ]
                    }

                    return [
                        {
                            id: resourceObjectId,
                            kind: 'object',
                            codename: 'LearningResources',
                            table_name: 'learning_resources',
                            config: {
                                runtimeLibrary: {
                                    shared: {
                                        objectCodename: 'ContentAccessEntries',
                                        targetObjectFieldCodename: 'TargetObjectCodename',
                                        targetRecordFieldCodename: 'TargetRecordId',
                                        principalTypeFieldCodename: 'PrincipalType',
                                        principalIdFieldCodename: 'PrincipalId',
                                        accessLevelFieldCodename: 'AccessLevel',
                                        defaultAccessLevel: 'canView',
                                        timestampFieldCodename: 'InvitedAt',
                                        allowedPrincipalTypes: ['workspaceMember', 'user']
                                    }
                                },
                                runtimeRecordAccess: {
                                    mode: 'ownerOrShared',
                                    ownerColumnName: '_upl_created_by',
                                    sharedRelationKey: 'shared'
                                }
                            }
                        },
                        {
                            id: accessObjectId,
                            kind: 'object',
                            codename: 'ContentAccessEntries',
                            table_name: 'content_access_entries',
                            config: null
                        }
                    ]
                }

                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    if (params?.[0] === accessObjectId) {
                        return [
                            {
                                id: 'target-object',
                                codename: 'TargetObjectCodename',
                                column_name: 'target_object_codename',
                                data_type: 'STRING'
                            },
                            { id: 'target-record', codename: 'TargetRecordId', column_name: 'target_record_id', data_type: 'STRING' },
                            { id: 'principal-type', codename: 'PrincipalType', column_name: 'principal_type', data_type: 'STRING' },
                            { id: 'principal-id', codename: 'PrincipalId', column_name: 'principal_id', data_type: 'STRING' },
                            { id: 'access-level', codename: 'AccessLevel', column_name: 'access_level', data_type: 'STRING' },
                            { id: 'invited-at', codename: 'InvitedAt', column_name: 'invited_at', data_type: 'DATE' }
                        ]
                    }
                    return [{ id: 'title', codename: 'Title', column_name: 'title', data_type: 'STRING' }]
                }

                if (sql.includes('FROM "app_runtime_test"."learning_resources" src')) {
                    return [{ id: runtimeRowId, owner_user_id: 'owner-user-id' }]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."content_access_entries"')) {
                    insertedRelationQueries.push({ sql, params })
                    return []
                }

                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/library/shared`)
                .send({ objectCollectionId: resourceObjectId, active: true, principalType: 'user', principalId })
                .expect(403)

            expect(response.body).toEqual({ error: 'Runtime library shared relation requires content owner or editor access' })
            expect(membershipQueries).toHaveLength(0)
            expect(insertedRelationQueries).toHaveLength(0)
        })

        it('validates configured shared relations for explicit principals', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-2222333344ba'
            const resourceObjectId = '018f8a78-7b8f-7c1d-a111-2222333344bb'
            const accessObjectId = '018f8a78-7b8f-7c1d-a111-2222333344bc'
            const runtimeRowId = '018f8a78-7b8f-7c1d-a111-2222333344bd'
            const principalId = '018f8a78-7b8f-7c1d-a111-2222333344be'
            const insertedRelationQueries: Array<{ sql: string; params?: unknown[] }> = []
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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM applications.rel_application_users')) {
                    return params?.[0] === runtimeApplicationId && params?.[1] === principalId ? [{ id: 'principal-membership' }] : []
                }

                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'ContentAccessEntries') {
                        return [
                            {
                                id: accessObjectId,
                                kind: 'object',
                                codename: 'ContentAccessEntries',
                                table_name: 'content_access_entries',
                                config: null
                            }
                        ]
                    }

                    return [
                        {
                            id: resourceObjectId,
                            kind: 'object',
                            codename: 'LearningResources',
                            table_name: 'learning_resources',
                            config: {
                                runtimeLibrary: {
                                    shared: {
                                        objectCodename: 'ContentAccessEntries',
                                        targetObjectFieldCodename: 'TargetObjectCodename',
                                        targetRecordFieldCodename: 'TargetRecordId',
                                        principalTypeFieldCodename: 'PrincipalType',
                                        principalIdFieldCodename: 'PrincipalId',
                                        accessLevelFieldCodename: 'AccessLevel',
                                        defaultAccessLevel: 'canView',
                                        timestampFieldCodename: 'InvitedAt',
                                        allowedPrincipalTypes: ['workspaceMember', 'user']
                                    }
                                },
                                runtimeRecordAccess: {
                                    mode: 'ownerOrShared',
                                    ownerColumnName: '_upl_created_by',
                                    sharedRelationKey: 'shared'
                                }
                            }
                        },
                        {
                            id: accessObjectId,
                            kind: 'object',
                            codename: 'ContentAccessEntries',
                            table_name: 'content_access_entries',
                            config: null
                        }
                    ]
                }

                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    if (params?.[0] === accessObjectId) {
                        return [
                            {
                                id: 'target-object',
                                codename: 'TargetObjectCodename',
                                column_name: 'target_object_codename',
                                data_type: 'STRING'
                            },
                            { id: 'target-record', codename: 'TargetRecordId', column_name: 'target_record_id', data_type: 'STRING' },
                            { id: 'principal-type', codename: 'PrincipalType', column_name: 'principal_type', data_type: 'STRING' },
                            { id: 'principal-id', codename: 'PrincipalId', column_name: 'principal_id', data_type: 'STRING' },
                            { id: 'access-level', codename: 'AccessLevel', column_name: 'access_level', data_type: 'STRING' },
                            { id: 'invited-at', codename: 'InvitedAt', column_name: 'invited_at', data_type: 'DATE' }
                        ]
                    }
                    return [{ id: 'title', codename: 'Title', column_name: 'title', data_type: 'STRING' }]
                }

                if (sql.includes('FROM "app_runtime_test"."learning_resources" src')) {
                    return [{ id: runtimeRowId, owner_user_id: 'test-user-id' }]
                }
                if (sql.includes('pg_advisory_xact_lock')) {
                    return []
                }
                if (sql.includes('SELECT rel.id') && sql.includes('FROM "app_runtime_test"."content_access_entries" rel')) {
                    return []
                }
                if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-2222333344bf' }]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."content_access_entries"')) {
                    insertedRelationQueries.push({ sql, params })
                    return []
                }

                return []
            })

            const app = buildApp(dataSource)

            const rejectedWorkspaceMemberResponse = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/library/shared`)
                .send({ objectCollectionId: resourceObjectId, active: true, principalType: 'workspaceMember', principalId })
                .expect(400)

            expect(rejectedWorkspaceMemberResponse.body).toEqual({
                error: 'Runtime shared workspace member requires an active workspace'
            })

            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/library/shared`)
                .send({ objectCollectionId: resourceObjectId, active: true, principalType: 'user', principalId })
                .expect(200)

            expect(response.body).toEqual({ relationKey: 'shared', active: true, changed: true })
            expect(insertedRelationQueries).toHaveLength(1)
            expect(insertedRelationQueries[0]?.params).toEqual([
                '018f8a78-7b8f-7c1d-a111-2222333344bf',
                'LearningResources',
                runtimeRowId,
                'user',
                principalId,
                'canView',
                'test-user-id',
                'test-user-id'
            ])
        })
    })

    describe('GET /applications/:applicationId/runtime/modules', () => {
        it('filters runtime modules by attachment and strips bundle bodies from the list surface', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334479'
            const runtimeSchemaName = buildRuntimeSchemaName(runtimeApplicationId)
            const runtimeLinkedCollectionId = '018f8a78-7b8f-7c1d-a111-22223333447a'
            const otherLinkedCollectionId = '018f8a78-7b8f-7c1d-a111-22223333447b'
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: runtimeSchemaName,
                workspacesEnabled: false
            })

            applicationUserRepo.findOne.mockResolvedValue({
                applicationId: runtimeApplicationId,
                userId: 'test-user-id',
                role: 'member'
            })

            const originalQueryImpl = (dataSource.query as jest.Mock).getMockImplementation()
            const originalManagerQueryImpl = (dataSource.manager.query as jest.Mock).getMockImplementation()
            const runtimeQueryImpl = async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT to_regclass($1) AS table_name')) {
                    return [{ table_name: `${runtimeSchemaName}._app_modules` }]
                }

                if (sql.includes(runtimeModulesTableFragment(runtimeSchemaName))) {
                    return [
                        {
                            id: 'module-1',
                            codename: 'quiz-widget',
                            presentation: {
                                name: {
                                    _primary: 'en',
                                    locales: { en: { content: 'Quiz widget' } }
                                }
                            },
                            attached_to_kind: 'object',
                            attached_to_id: runtimeLinkedCollectionId,
                            module_role: 'widget',
                            source_kind: 'embedded',
                            sdk_api_version: '1.0.0',
                            manifest: {
                                className: 'QuizWidgetModule',
                                sdkApiVersion: '1.0.0',
                                moduleRole: 'widget',
                                sourceKind: 'embedded',
                                capabilities: ['rpc.client'],
                                methods: [{ name: 'mount', target: 'client' }]
                            },
                            server_bundle: 'module.exports = class ServerWidget {}',
                            client_bundle: 'module.exports = class ClientWidget {}',
                            checksum: 'object-checksum',
                            is_active: true,
                            config: { apiKey: 'secret-api-key', token: 'secret-token' }
                        },
                        {
                            id: 'module-2',
                            codename: 'metahub-widget',
                            presentation: {
                                name: {
                                    _primary: 'en',
                                    locales: { en: { content: 'Metahub widget' } }
                                }
                            },
                            attached_to_kind: 'metahub',
                            attached_to_id: null,
                            module_role: 'widget',
                            source_kind: 'embedded',
                            sdk_api_version: '1.0.0',
                            manifest: {
                                className: 'MetahubWidgetModule',
                                sdkApiVersion: '1.0.0',
                                moduleRole: 'widget',
                                sourceKind: 'embedded',
                                capabilities: ['rpc.client'],
                                methods: [{ name: 'mount', target: 'client' }]
                            },
                            server_bundle: 'module.exports = class ServerWidget {}',
                            client_bundle: 'module.exports = class ClientWidget {}',
                            checksum: 'metahub-checksum',
                            is_active: true,
                            config: {}
                        },
                        {
                            id: 'module-3',
                            codename: 'server-only-widget',
                            presentation: {
                                name: {
                                    _primary: 'en',
                                    locales: { en: { content: 'Server only widget' } }
                                }
                            },
                            attached_to_kind: 'object',
                            attached_to_id: runtimeLinkedCollectionId,
                            module_role: 'widget',
                            source_kind: 'embedded',
                            sdk_api_version: '1.0.0',
                            manifest: {
                                className: 'ServerOnlyWidgetModule',
                                sdkApiVersion: '1.0.0',
                                moduleRole: 'widget',
                                sourceKind: 'embedded',
                                capabilities: ['rpc.client'],
                                methods: [{ name: 'submit', target: 'server' }]
                            },
                            server_bundle: 'module.exports = class ServerWidget {}',
                            client_bundle: null,
                            checksum: 'server-only-checksum',
                            is_active: true,
                            config: {}
                        },
                        {
                            id: 'module-4',
                            codename: 'other-object-widget',
                            presentation: {
                                name: {
                                    _primary: 'en',
                                    locales: { en: { content: 'Other object widget' } }
                                }
                            },
                            attached_to_kind: 'object',
                            attached_to_id: otherLinkedCollectionId,
                            module_role: 'widget',
                            source_kind: 'embedded',
                            sdk_api_version: '1.0.0',
                            manifest: {
                                className: 'OtherObjectWidgetModule',
                                sdkApiVersion: '1.0.0',
                                moduleRole: 'widget',
                                sourceKind: 'embedded',
                                capabilities: ['rpc.client'],
                                methods: [{ name: 'mount', target: 'client' }]
                            },
                            server_bundle: 'module.exports = class ServerWidget {}',
                            client_bundle: 'module.exports = class ClientWidget {}',
                            checksum: 'other-object-checksum',
                            is_active: true,
                            config: {}
                        }
                    ]
                }

                return originalQueryImpl ? originalQueryImpl(sql, params) : []
            }

            const runtimeManagerQueryImpl = async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT to_regclass($1) AS table_name')) {
                    return [{ table_name: `${runtimeSchemaName}._app_modules` }]
                }

                if (sql.includes(runtimeModulesTableFragment(runtimeSchemaName))) {
                    return [
                        {
                            id: 'module-server-only',
                            codename: 'server-only-widget',
                            presentation: {
                                name: {
                                    _primary: 'en',
                                    locales: { en: { content: 'Server only widget' } }
                                }
                            },
                            attached_to_kind: 'object',
                            attached_to_id: runtimeLinkedCollectionId,
                            module_role: 'module',
                            source_kind: 'embedded',
                            sdk_api_version: '1.0.0',
                            manifest: {
                                className: 'ServerOnlyWidgetModule',
                                sdkApiVersion: '1.0.0',
                                moduleRole: 'module',
                                sourceKind: 'embedded',
                                capabilities: [],
                                methods: [{ name: 'submit', target: 'server' }]
                            },
                            server_bundle: 'module.exports = class ServerWidget {}',
                            client_bundle: null,
                            checksum: 'server-only-checksum',
                            is_active: true,
                            config: {}
                        }
                    ]
                }

                return originalManagerQueryImpl ? originalManagerQueryImpl(sql, params) : []
            }

            ;(dataSource.query as jest.Mock).mockImplementation(runtimeQueryImpl)
            ;(dataSource.manager.query as jest.Mock).mockImplementation(runtimeManagerQueryImpl)

            const app = buildApp(dataSource)
            const response = await request(app)
                .get(`/applications/${runtimeApplicationId}/runtime/modules`)
                .query({ attachedToKind: 'object', attachedToId: runtimeLinkedCollectionId })
                .expect(200)

            expect(response.body.items).toEqual([
                expect.objectContaining({
                    id: 'module-1',
                    codename: 'quiz-widget',
                    attachedToKind: 'object',
                    attachedToId: runtimeLinkedCollectionId,
                    config: {}
                })
            ])
            expect(response.body.items[0]).not.toHaveProperty('clientBundle')
            expect(response.body.items[0]).not.toHaveProperty('serverBundle')
            expect(JSON.stringify(response.body)).not.toContain('module.exports')
            expect(JSON.stringify(response.body)).not.toContain('secret-api-key')
        })
    })

    describe('GET /applications/:applicationId/runtime/playcanvas-manifests', () => {
        it('returns active published PlayCanvas runtime manifests from the runtime schema', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-2222333344e8'
            const runtimeSchemaName = buildRuntimeSchemaName(runtimeApplicationId)
            const projectId = '018f8a78-7b8f-7c1d-a111-2222333344e9'
            const sceneId = '018f8a78-7b8f-7c1d-a111-2222333344ea'
            const checksum = 'd'.repeat(64)
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: runtimeSchemaName,
                workspacesEnabled: false
            })

            applicationUserRepo.findOne.mockResolvedValue({
                applicationId: runtimeApplicationId,
                userId: 'test-user-id',
                role: 'member'
            })

            const originalQueryImpl = (dataSource.query as jest.Mock).getMockImplementation()
            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM information_schema.tables') && sql.includes("_app_playcanvas_manifests'")) {
                    expect(params).toEqual([runtimeSchemaName])
                    return [{ exists: true }]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"."_app_playcanvas_manifests"`)) {
                    return [
                        {
                            source_project_id: projectId,
                            source_scene_id: sceneId,
                            manifest_checksum: checksum,
                            runtime_manifest: {
                                schemaVersion: '1',
                                projectId,
                                sceneId,
                                checksum,
                                assets: [],
                                scripts: [],
                                metadata: {
                                    mmoomm: {
                                        scene: {
                                            objects: [
                                                {
                                                    id: 'ship',
                                                    position: { x: 0, y: 0, z: 0 },
                                                    scale: { x: 12, y: 4, z: 4 },
                                                    selectable: true
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    ]
                }
                return originalQueryImpl ? originalQueryImpl(sql, params) : []
            })

            const app = buildApp(dataSource)

            const response = await request(app).get(`/applications/${runtimeApplicationId}/runtime/playcanvas-manifests`).expect(200)

            expect(response.body.manifests).toEqual([
                expect.objectContaining({
                    schemaVersion: '1',
                    projectId,
                    sceneId,
                    checksum,
                    assets: [],
                    scripts: [],
                    metadata: expect.objectContaining({
                        mmoomm: expect.objectContaining({
                            scene: expect.objectContaining({
                                objects: [
                                    {
                                        id: 'ship',
                                        position: { x: 0, y: 0, z: 0 },
                                        scale: { x: 12, y: 4, z: 4 },
                                        selectable: true
                                    }
                                ]
                            })
                        })
                    })
                })
            ])
            expect(dataSource.query).toHaveBeenCalledWith(
                expect.stringContaining(`FROM "${runtimeSchemaName}"."_app_playcanvas_manifests"`),
                []
            )
        })

        it('returns an empty manifest list when the runtime schema has no PlayCanvas manifest table', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-2222333344eb'
            const runtimeSchemaName = buildRuntimeSchemaName(runtimeApplicationId)
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: runtimeSchemaName,
                workspacesEnabled: false
            })

            applicationUserRepo.findOne.mockResolvedValue({
                applicationId: runtimeApplicationId,
                userId: 'test-user-id',
                role: 'member'
            })

            const originalQueryImpl = (dataSource.query as jest.Mock).getMockImplementation()
            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM information_schema.tables') && sql.includes("_app_playcanvas_manifests'")) {
                    expect(params).toEqual([runtimeSchemaName])
                    return [{ exists: false }]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"."_app_playcanvas_manifests"`)) {
                    throw new Error('PlayCanvas manifests table must not be queried when it is missing')
                }
                return originalQueryImpl ? originalQueryImpl(sql, params) : []
            })

            const app = buildApp(dataSource)

            const response = await request(app).get(`/applications/${runtimeApplicationId}/runtime/playcanvas-manifests`).expect(200)

            expect(response.body).toEqual({ manifests: [] })
        })
    })

    describe('GET /applications/:applicationId/runtime/modules/:moduleId/client', () => {
        it('returns the client bundle body with cache validators', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334480'
            const runtimeSchemaName = buildRuntimeSchemaName(runtimeApplicationId)
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: runtimeSchemaName,
                workspacesEnabled: false
            })

            applicationUserRepo.findOne.mockResolvedValue({
                applicationId: runtimeApplicationId,
                userId: 'test-user-id',
                role: 'member'
            })

            jest.spyOn(RuntimeModulesService.prototype, 'getClientModuleBundle').mockResolvedValue({
                bundle: 'export default class RuntimeQuizWidget {}',
                checksum: 'bundle-checksum'
            })

            const app = buildApp(dataSource)
            const response = await request(app).get(`/applications/${runtimeApplicationId}/runtime/modules/module-1/client`).expect(200)

            expect(response.text).toBe('export default class RuntimeQuizWidget {}')
            expect(response.headers['content-type']).toContain('application/javascript')
            expect(response.headers['etag']).toBe('"bundle-checksum"')
            expect(response.headers['cache-control']).toBe('private, max-age=0, must-revalidate')
            expect(response.headers['content-security-policy']).toBe("default-src 'none'; script-src 'self'")
            expect(response.headers['x-content-type-options']).toBe('nosniff')
            expect(response.headers['vary']).toBe('Cookie')
        })

        it('returns 304 when the client bundle checksum matches if-none-match', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334481'
            const runtimeSchemaName = buildRuntimeSchemaName(runtimeApplicationId)
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: runtimeSchemaName,
                workspacesEnabled: false
            })

            applicationUserRepo.findOne.mockResolvedValue({
                applicationId: runtimeApplicationId,
                userId: 'test-user-id',
                role: 'member'
            })

            jest.spyOn(RuntimeModulesService.prototype, 'getClientModuleBundle').mockResolvedValue({
                bundle: 'export default class RuntimeQuizWidget {}',
                checksum: 'bundle-checksum-304'
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .get(`/applications/${runtimeApplicationId}/runtime/modules/module-2/client`)
                .set('If-None-Match', '"bundle-checksum-304"')
                .expect(304)

            expect(response.text).toBe('')
            expect(response.headers['etag']).toBe('"bundle-checksum-304"')
            expect(response.headers['content-security-policy']).toBe("default-src 'none'; script-src 'self'")
            expect(response.headers['x-content-type-options']).toBe('nosniff')
        })
    })

    describe('POST /applications/:applicationId/runtime/modules/:moduleId/call', () => {
        const buildRuntimeModulesRouteDataSource = (applicationId: string, moduleRow: Record<string, unknown>) => {
            const runtimeSchemaName = buildRuntimeSchemaName(applicationId)
            const managerQuery = jest.fn(async (sql: string) => {
                if (sql.includes('SELECT to_regclass($1) AS table_name')) {
                    return [{ table_name: `${runtimeSchemaName}._app_modules` }]
                }

                if (sql.includes(runtimeModulesTableFragment(runtimeSchemaName))) {
                    return [moduleRow]
                }

                return []
            })

            const txExecutor = {
                query: managerQuery,
                transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(txExecutor)),
                isReleased: jest.fn(() => false)
            }

            const dataSource = {
                query: jest.fn(async (sql: string, params?: unknown[]) => {
                    if (sql.includes('FROM applications.rel_application_users')) {
                        return [
                            {
                                id: 'membership-id',
                                applicationId,
                                userId: 'test-user-id',
                                role: 'member',
                                _uplCreatedAt: new Date()
                            }
                        ]
                    }

                    if (sql.includes('schema_name AS "schemaName"') && sql.includes('FROM applications.obj_applications')) {
                        return [{ id: applicationId, schemaName: runtimeSchemaName }]
                    }

                    return managerQuery(sql, params)
                }),
                transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(txExecutor)),
                isReleased: jest.fn(() => false),
                manager: {
                    query: managerQuery
                }
            }

            return dataSource as TestDataSource
        }

        it('maps capability failures to HTTP 403', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334482'
            const runtimeSchemaName = buildRuntimeSchemaName(runtimeApplicationId)
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: runtimeSchemaName,
                workspacesEnabled: false
            })

            applicationUserRepo.findOne.mockResolvedValue({
                applicationId: runtimeApplicationId,
                userId: 'test-user-id',
                role: 'member'
            })

            jest.spyOn(RuntimeModulesService.prototype, 'callServerMethod').mockRejectedValue(
                new Error('Module capability "rpc.client" is not enabled for this module')
            )

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/modules/module-3/call`)
                .send({ methodName: 'submit', args: [] })
                .expect(403)

            expect(response.body).toEqual({ error: 'Runtime module call failed' })
        })

        it('rejects real runtime RPC calls when the module does not declare rpc.client', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334483'
            const runtimeLinkedCollectionId = '018f8a78-7b8f-7c1d-a111-222233334483'
            const dataSource = buildRuntimeModulesRouteDataSource(runtimeApplicationId, {
                id: 'module-server-only',
                codename: 'server-only-widget',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: { en: { content: 'Server only widget' } }
                    }
                },
                attached_to_kind: 'object',
                attached_to_id: runtimeLinkedCollectionId,
                module_role: 'module',
                source_kind: 'embedded',
                sdk_api_version: '1.0.0',
                manifest: {
                    className: 'ServerOnlyWidgetModule',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'module',
                    sourceKind: 'embedded',
                    capabilities: [],
                    methods: [{ name: 'submit', target: 'server' }]
                },
                server_bundle: 'module.exports = class ServerWidget {}',
                client_bundle: null,
                checksum: 'server-only-checksum',
                is_active: true,
                config: {}
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/modules/module-server-only/call`)
                .send({ methodName: 'submit', args: [] })
                .expect(403)

            expect(response.body).toEqual({ error: 'Runtime module call failed' })
        })

        it('rejects lifecycle handlers on the public runtime RPC route', async () => {
            const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334484'
            const runtimeLinkedCollectionId = '018f8a78-7b8f-7c1d-a111-222233334484'
            const dataSource = buildRuntimeModulesRouteDataSource(runtimeApplicationId, {
                id: 'module-lifecycle',
                codename: 'object-lifecycle',
                presentation: {
                    name: {
                        _primary: 'en',
                        locales: { en: { content: 'Object lifecycle' } }
                    }
                },
                attached_to_kind: 'object',
                attached_to_id: runtimeLinkedCollectionId,
                module_role: 'lifecycle',
                source_kind: 'embedded',
                sdk_api_version: '1.0.0',
                manifest: {
                    className: 'CatalogLifecycleModule',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'lifecycle',
                    sourceKind: 'embedded',
                    capabilities: ['lifecycle'],
                    methods: [{ name: 'afterCreate', target: 'server', eventName: 'afterCreate' }]
                },
                server_bundle: 'module.exports = class LifecycleModule {}',
                client_bundle: null,
                checksum: 'lifecycle-checksum',
                is_active: true,
                config: {}
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/modules/module-lifecycle/call`)
                .send({ methodName: 'afterCreate', args: [] })
                .expect(403)

            expect(response.body).toEqual({ error: 'Runtime module call failed' })
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

        it('should create public application shells without workspaces until connector schema sync enables them', async () => {
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
                    isPublic: true
                })
                .expect(201)

            expect(response.body).toMatchObject({
                isPublic: true,
                workspacesEnabled: false
            })
        })

        it('should reject legacy workspace mode input during application creation', async () => {
            const { dataSource } = buildDataSource()
            const app = buildApp(dataSource)

            const response = await request(app)
                .post('/applications')
                .send({
                    name: 'Public Application',
                    isPublic: true,
                    workspacesEnabled: true
                })
                .expect(400)

            expect(response.body.details).toHaveProperty('formErrors')
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
                if (sql.includes('SELECT *') && sql.includes('FROM applications.rel_application_users')) {
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

                if (sql.includes('SELECT') && sql.includes('FROM applications.obj_applications a') && sql.includes('schema_snapshot')) {
                    return [{ workspacesEnabled: false, ...options.sourceApplication }]
                }

                if (sql.includes('SELECT id, slug') && sql.includes('FROM applications.obj_applications')) {
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
                if (sql.includes('INSERT INTO applications.obj_applications (')) {
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
                    sql.includes('INSERT INTO applications.obj_connectors (')
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
                    copyAccess: false
                })
                .expect(201)

            expect(response.body.id).toBe('018f8a78-7b8f-7c1d-a111-222233334445')
            const insertApplicationCall = (dataSource.manager.query as jest.Mock).mock.calls.find(([sql]: [string]) =>
                sql.includes('INSERT INTO applications.obj_applications (')
            )
            expect(insertApplicationCall?.[1]).toContain('draft')
            expect(
                (dataSource.manager.query as jest.Mock).mock.calls.some(([sql]: [string]) =>
                    sql.includes('INSERT INTO applications.obj_connectors (')
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
                    copyAccess: false
                })
                .expect(201)

            expect(response.body.id).toBe('018f8a78-7b8f-7c1d-a111-222233334447')
            const insertApplicationCall = (dataSource.manager.query as jest.Mock).mock.calls.find(([sql]: [string]) =>
                sql.includes('INSERT INTO applications.obj_applications (')
            )
            expect(insertApplicationCall?.[1]?.[4]).toBe('source-app-copy-2')
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
                    if (sql.includes('INSERT INTO applications.obj_applications (')) {
                        throw slugRaceError
                    }
                    return []
                })
                .mockImplementation(async (sql: string) => {
                    if (sql.includes('INSERT INTO applications.obj_applications (')) {
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
                    copyAccess: false
                })
                .expect(201)

            expect(response.body.id).toBe('018f8a78-7b8f-7c1d-a111-222233334448')
            const insertCalls = (dataSource.manager.query as jest.Mock).mock.calls.filter(([sql]: [string]) =>
                sql.includes('INSERT INTO applications.obj_applications (')
            )
            expect(insertCalls).toHaveLength(2)
            expect(insertCalls[0][1][4]).toBe('source-app-copy')
            expect(insertCalls[1][1][4]).toBe('source-app-copy-2')
        })

        it('should reject legacy createSchema input on backend copy route', async () => {
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
                .expect(400)

            expect(response.body.error).toBe('Invalid input')
            expect(mockCloneSchemaWithExecutor).not.toHaveBeenCalled()
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
                if (sql.includes('SELECT *') && sql.includes('FROM applications.rel_application_users')) {
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

                if (sql.includes('UPDATE applications.obj_applications')) {
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

            const response = await request(app)
                .patch('/applications/application-1')
                .send({
                    name: 'New Name',
                    settings: {
                        dashboardDefaultMode: 'first-menu-item',
                        datasourceExecutionPolicy: 'layout-only',
                        workspaceOpenBehavior: 'default-workspace'
                    }
                })
                .expect(200)

            expect(response.body.name).toMatchObject({
                _primary: 'en'
            })
        })

        it('preserves server-managed public runtime settings when generic settings are saved', async () => {
            const { dataSource, applicationUserRepo } = buildDataSource()
            applicationUserRepo.findOne.mockResolvedValue({
                user_id: 'test-user-id',
                role: 'owner'
            })

            const existingPublicRuntime = {
                guest: {
                    objects: { students: 'Students' },
                    fields: { student: { displayName: 'DisplayName' } }
                }
            }
            let savedSettings: Record<string, unknown> | null = null

            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT *') && sql.includes('FROM applications.rel_application_users')) {
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

                if (sql.includes('UPDATE applications.obj_applications')) {
                    savedSettings = JSON.parse(String(params?.[0] ?? '{}'))

                    return [
                        {
                            id: 'application-1',
                            name: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Existing App' } }
                            },
                            description: null,
                            settings: savedSettings,
                            slug: 'test-app',
                            isPublic: false,
                            workspacesEnabled: false,
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
                            locales: { en: { content: 'Existing App' } }
                        },
                        description: null,
                        settings: {
                            publicRuntime: existingPublicRuntime
                        },
                        slug: 'test-app',
                        isPublic: false,
                        workspacesEnabled: false,
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

            const response = await request(app)
                .patch('/applications/application-1')
                .send({
                    settings: {
                        dashboardDefaultMode: 'first-menu-item',
                        datasourceExecutionPolicy: 'layout-only',
                        workspaceOpenBehavior: 'default-workspace',
                        schemaDiffLocalizedLabels: false,
                        publicRuntime: {
                            guest: {
                                objects: { students: 'TamperedStudents' }
                            }
                        }
                    }
                })
                .expect(200)

            expect(savedSettings).toEqual({
                dashboardDefaultMode: 'first-menu-item',
                datasourceExecutionPolicy: 'layout-only',
                workspaceOpenBehavior: 'default-workspace',
                schemaDiffLocalizedLabels: false,
                publicRuntime: existingPublicRuntime
            })
            expect(response.body.settings).not.toMatchObject({
                publicRuntime: {
                    guest: {
                        objects: { students: 'TamperedStudents' }
                    }
                }
            })
        })

        it('accepts Learning Content application settings when saved through the control panel contract', async () => {
            const { dataSource, applicationUserRepo } = buildDataSource()
            applicationUserRepo.findOne.mockResolvedValue({
                user_id: 'test-user-id',
                role: 'owner'
            })

            let savedSettings: Record<string, unknown> | null = null

            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT *') && sql.includes('FROM applications.rel_application_users')) {
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

                if (sql.includes('UPDATE applications.obj_applications')) {
                    savedSettings = JSON.parse(String(params?.[0] ?? '{}'))

                    return [
                        {
                            id: 'application-1',
                            name: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Learning App' } }
                            },
                            description: null,
                            settings: savedSettings,
                            slug: 'learning-app',
                            isPublic: false,
                            workspacesEnabled: false,
                            schemaName: 'app_learning',
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
                            locales: { en: { content: 'Learning App' } }
                        },
                        description: null,
                        settings: {},
                        slug: 'learning-app',
                        isPublic: false,
                        workspacesEnabled: false,
                        schemaName: 'app_learning',
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

            const response = await request(app)
                .patch('/applications/application-1')
                .send({
                    settings: {
                        dashboardDefaultMode: 'first-menu-item',
                        learningContent: {
                            defaultView: 'cards'
                        }
                    }
                })
                .expect(200)

            expect(savedSettings).toMatchObject({
                dashboardDefaultMode: 'first-menu-item',
                learningContent: {
                    defaultView: 'cards'
                }
            })
            expect(response.body.settings.learningContent.defaultView).toBe('cards')
        })

        it('downgrades unsupported scoped active role policy grants when settings are saved', async () => {
            const { dataSource, applicationUserRepo } = buildDataSource()
            applicationUserRepo.findOne.mockResolvedValue({
                user_id: 'test-user-id',
                role: 'owner'
            })

            let savedSettings: Record<string, unknown> | null = null

            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('SELECT *') && sql.includes('FROM applications.rel_application_users')) {
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

                if (sql.includes('UPDATE applications.obj_applications')) {
                    savedSettings = JSON.parse(String(params?.[0] ?? '{}'))

                    return [
                        {
                            id: 'application-1',
                            name: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Existing App' } }
                            },
                            description: null,
                            settings: savedSettings,
                            slug: 'test-app',
                            isPublic: false,
                            workspacesEnabled: false,
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
                            locales: { en: { content: 'Existing App' } }
                        },
                        description: null,
                        settings: {},
                        slug: 'test-app',
                        isPublic: false,
                        workspacesEnabled: false,
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

            await request(app)
                .patch('/applications/application-1')
                .send({
                    settings: {
                        rolePolicies: {
                            templates: [
                                {
                                    codename: 'reviewerPolicy',
                                    title: 'Reviewer permissions',
                                    baseRole: 'editor',
                                    rules: [
                                        {
                                            capability: 'assignment.review',
                                            effect: 'allow',
                                            scope: 'recordOwner'
                                        },
                                        {
                                            capability: 'reports.read',
                                            effect: 'allow',
                                            scope: 'workspace'
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                })
                .expect(200)

            expect(savedSettings?.rolePolicies).toMatchObject({
                templates: [
                    {
                        rules: [
                            {
                                capability: 'assignment.review',
                                effect: 'deny',
                                scope: 'recordOwner'
                            },
                            {
                                capability: 'reports.read',
                                effect: 'allow',
                                scope: 'workspace'
                            }
                        ]
                    }
                ]
            })
        })

        it('should update visibility for owner', async () => {
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

                if (sql.includes('UPDATE applications.obj_applications')) {
                    expect(sql).toContain('is_public')
                    return [
                        {
                            id: 'application-1',
                            name: {
                                _schema: 'v1',
                                _primary: 'en',
                                locales: { en: { content: 'Existing App' } }
                            },
                            description: null,
                            slug: 'test-app',
                            isPublic: true,
                            workspacesEnabled: false,
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
                            _schema: '1',
                            _primary: 'en',
                            locales: { en: { content: 'Existing App' } }
                        },
                        isPublic: false,
                        slug: 'test-app',
                        description: null,
                        version: 1,
                        updatedAt: new Date(),
                        updatedBy: 'test-user-id',
                        workspacesEnabled: false
                    }
                ]
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .patch('/applications/application-1')
                .send({ isPublic: true, expectedVersion: 1 })
                .expect(200)

            expect(response.body).toMatchObject({
                id: 'application-1',
                isPublic: true,
                workspacesEnabled: false,
                version: 2
            })
        })

        it('should reject workspace mode updates after creation', async () => {
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

            const response = await request(app).patch('/applications/application-1').send({ workspacesEnabled: true }).expect(400)

            expect(response.body.error).toContain('Immutable application parameters')
            expect(response.body.details).toHaveProperty('workspacesEnabled')
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

                    if (sql.includes('schema_name AS "schemaName"') && sql.includes('FROM applications.obj_applications')) {
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

            it('should reject admin updates to another admin role', async () => {
                const { dataSource, applicationUserRepo } = buildDataSource()

                applicationUserRepo.findOne.mockResolvedValue({
                    user_id: 'test-user-id',
                    role: 'admin'
                })
                ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                    if (sql.includes('WITH updated AS')) {
                        throw new Error('update should not run')
                    }

                    if (sql.includes('FROM applications.rel_application_users au') && sql.includes('au.id = $2')) {
                        return [
                            {
                                id: 'member-id',
                                applicationId: 'application-1',
                                userId: 'target-admin',
                                role: 'admin',
                                comment: null,
                                createdAt: new Date(),
                                email: 'target-admin@example.com',
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

                await request(app).patch('/applications/application-1/members/member-id').send({ role: 'editor' }).expect(403)
            })

            it('should reject admin promotion of a member to admin', async () => {
                const { dataSource, applicationUserRepo } = buildDataSource()

                applicationUserRepo.findOne.mockResolvedValue({
                    user_id: 'test-user-id',
                    role: 'admin'
                })
                ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                    if (sql.includes('WITH updated AS')) {
                        throw new Error('update should not run')
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

                await request(app).patch('/applications/application-1/members/member-id').send({ role: 'admin' }).expect(403)
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

                    if (sql.includes('schema_name AS "schemaName"') && sql.includes('FROM applications.obj_applications')) {
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
        const limitsLinkedCollectionId = '018f8a78-7b8f-7c1d-a111-222233334499'

        it('joins a public application inside one transaction', async () => {
            const { dataSource, applicationUserRepo } = buildDataSource()
            const publicApplicationId = '018f8a78-7b8f-7c1d-a111-222233334498'

            applicationUserRepo.findOne.mockResolvedValue(null)
            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM applications.obj_applications a')) {
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

                if (sql.includes('schema_name AS "schemaName"') && sql.includes('FROM applications.obj_applications')) {
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

                if (sql.includes('schema_name AS "schemaName"') && sql.includes('FROM applications.obj_applications')) {
                    return [{ id: 'application-1', schemaName: limitsSchemaName, workspacesEnabled: true }]
                }

                if (sql.includes('FROM information_schema.tables')) {
                    return [{ exists: true }]
                }

                return []
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes(`FROM "${limitsSchemaName}"._app_objects`)) {
                    return [{ id: limitsLinkedCollectionId }]
                }

                if (sql.includes(`UPDATE "${limitsSchemaName}"."_app_limits"`)) {
                    return []
                }

                if (sql.includes(`LEFT JOIN "${limitsSchemaName}"."_app_limits"`)) {
                    return [{ objectId: limitsLinkedCollectionId, maxRows: null }]
                }

                return []
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .put('/applications/application-1/settings/limits')
                .send({
                    limits: [{ objectId: limitsLinkedCollectionId, maxRows: null }]
                })
                .expect(200)

            expect(response.body).toEqual({
                items: [{ objectId: limitsLinkedCollectionId, maxRows: null }]
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

                if (sql.includes('schema_name AS "schemaName"') && sql.includes('FROM applications.obj_applications')) {
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
                        { objectId: limitsLinkedCollectionId, maxRows: 5 },
                        { objectId: limitsLinkedCollectionId, maxRows: 10 }
                    ]
                })
                .expect(400)

            expect(response.body.error).toContain('Duplicate object limit rows')
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
        const runtimeLinkedCollectionId = '018f8a78-7b8f-7c1d-a111-222233334445'

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
                    return [{ id: runtimeLinkedCollectionId, codename: 'orders', table_name: 'orders' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
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
                    objectCollectionId: runtimeLinkedCollectionId,
                    data: {
                        status_ref: '018f8a78-7b8f-7c1d-a111-222233334444'
                    }
                })
                .expect(400)

            expect(response.body.error).toBe('Field is read-only: status')
        })

        it('persists Learning Content page progress through the metadata-defined progress object', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                settings: {
                    learningContent: {
                        progressStore: {
                            enabled: true,
                            objectCodename: 'ContentProgress'
                        }
                    }
                }
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'LearnerHome') {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334498',
                            codename: 'LearnerHome',
                            kind: 'page',
                            table_name: null,
                            config: null
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'ContentProgress') {
                    return [{ id: 'progress-object-id', codename: 'ContentProgress', kind: 'object', table_name: 'content_progress' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        { codename: 'TargetObjectCodename', column_name: 'target_object_codename' },
                        { codename: 'TargetRecordId', column_name: 'target_record_id' },
                        { codename: 'UserId', column_name: 'user_id' },
                        { codename: 'ProgressStatus', column_name: 'progress_status' },
                        { codename: 'ProgressPercent', column_name: 'progress_percent' },
                        { codename: 'StartedAt', column_name: 'started_at' },
                        { codename: 'CompletedAt', column_name: 'completed_at' },
                        { codename: 'LastViewedAt', column_name: 'last_viewed_at' }
                    ]
                }
                if (sql.includes('SELECT id') && sql.includes('FROM "app_runtime_test"."content_progress"')) {
                    return []
                }
                if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334499' }]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."content_progress"')) {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334499' }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const targetRecordId = '018f8a78-7b8f-7c1d-a111-222233334498'

            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/progress/content`)
                .send({
                    targetObjectCodename: 'LearnerHome',
                    targetRecordId,
                    action: 'complete'
                })
                .expect(200)

            expect(response.body).toEqual({
                persisted: true,
                targetObjectCodename: 'LearnerHome',
                targetRecordId,
                progressPercent: 100,
                status: 'completed'
            })
            const insertCall = (dataSource.manager.query as jest.Mock).mock.calls.find(([sql]) =>
                String(sql).includes('INSERT INTO "app_runtime_test"."content_progress"')
            )
            expect(insertCall?.[1]).toEqual([
                '018f8a78-7b8f-7c1d-a111-222233334499',
                'LearnerHome',
                targetRecordId,
                'test-user-id',
                'completed',
                100,
                'test-user-id',
                'test-user-id'
            ])
        })

        it('returns persisted completion status when a viewed Learning Content target already has progress', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                settings: {
                    learningContent: {
                        progressStore: {
                            enabled: true,
                            objectCodename: 'ContentProgress'
                        }
                    }
                }
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'LearnerHome') {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334498',
                            codename: 'LearnerHome',
                            kind: 'page',
                            table_name: null,
                            config: null
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'ContentProgress') {
                    return [{ id: 'progress-object-id', codename: 'ContentProgress', kind: 'object', table_name: 'content_progress' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        { codename: 'TargetObjectCodename', column_name: 'target_object_codename' },
                        { codename: 'TargetRecordId', column_name: 'target_record_id' },
                        { codename: 'UserId', column_name: 'user_id' },
                        { codename: 'ProgressStatus', column_name: 'progress_status' },
                        { codename: 'ProgressPercent', column_name: 'progress_percent' },
                        { codename: 'StartedAt', column_name: 'started_at' },
                        { codename: 'CompletedAt', column_name: 'completed_at' },
                        { codename: 'LastViewedAt', column_name: 'last_viewed_at' }
                    ]
                }
                if (sql.includes('SELECT id') && sql.includes('FROM "app_runtime_test"."content_progress"')) {
                    return [{ id: 'progress-row-id', status: 'completed', progress_percent: 100 }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."content_progress"')) {
                    return [{ id: 'progress-row-id' }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const targetRecordId = '018f8a78-7b8f-7c1d-a111-222233334498'

            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/progress/content`)
                .send({
                    targetObjectCodename: 'LearnerHome',
                    targetRecordId,
                    action: 'view'
                })
                .expect(200)

            expect(response.body).toEqual({
                persisted: true,
                targetObjectCodename: 'LearnerHome',
                targetRecordId,
                progressPercent: 100,
                status: 'completed'
            })
            const updateCall = (dataSource.manager.query as jest.Mock).mock.calls.find(([sql]) =>
                String(sql).includes('UPDATE "app_runtime_test"."content_progress"')
            )
            expect(updateCall?.[1]).toEqual(['progress-row-id', 'test-user-id'])
        })

        it('checks owner-or-shared access before persisting non-page Learning Content progress', async () => {
            const targetObjectId = '018f8a78-7b8f-7c1d-a111-2222333344d0'
            const accessObjectId = '018f8a78-7b8f-7c1d-a111-2222333344d1'
            const targetRecordId = '018f8a78-7b8f-7c1d-a111-2222333344d2'
            const targetQueries: Array<{ sql: string; params?: unknown[] }> = []
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                settings: {
                    learningContent: {
                        progressStore: {
                            enabled: true,
                            objectCodename: 'ContentProgress'
                        }
                    }
                }
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'LearningResources') {
                    return [
                        {
                            id: targetObjectId,
                            codename: 'LearningResources',
                            kind: 'object',
                            table_name: 'learning_resources',
                            config: buildOwnerOrSharedRuntimeConfig()
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'ContentAccessEntries') {
                    return [
                        {
                            id: accessObjectId,
                            codename: 'ContentAccessEntries',
                            kind: 'object',
                            table_name: 'content_access_entries',
                            config: null
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    if (params?.[0] === accessObjectId) return runtimeAccessEntryComponents
                    return [{ codename: 'Title', column_name: 'title', data_type: 'STRING' }]
                }
                if (sql.includes('SELECT id') && sql.includes('FROM "app_runtime_test"."learning_resources"')) {
                    targetQueries.push({ sql, params })
                    return []
                }
                if (sql.includes('content_progress')) {
                    throw new Error('Progress store must not be touched before target access is proven')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/progress/content`)
                .send({
                    targetObjectCodename: 'LearningResources',
                    targetRecordId,
                    action: 'complete'
                })
                .expect(404)

            expect(response.body).toEqual({ error: 'Progress target row not found' })
            expect(targetQueries).toHaveLength(1)
            expect(targetQueries[0]?.sql).toContain('"_upl_created_by" = $2')
            expect(targetQueries[0]?.sql).toContain('FROM "app_runtime_test"."content_access_entries" rel')
            expect(targetQueries[0]?.sql).toContain('rel."target_record_id"::text = "app_runtime_test"."learning_resources".id::text')
            expect(targetQueries[0]?.params).toEqual([
                targetRecordId,
                'test-user-id',
                'LearningResources',
                'test-user-id',
                ['workspaceMember', 'user']
            ])
        })

        it('captures recent content views through generic runtime library metadata', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const insertedRecentQueries: Array<{ sql: string; params?: unknown[] }> = []
            const updatedRecentQueries: Array<{ sql: string; params?: unknown[] }> = []
            const generatedIds = ['018f8a78-7b8f-7c1d-a111-2222333344c9', '018f8a78-7b8f-7c1d-a111-2222333344ca']

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                settings: {
                    learningContent: {
                        progressStore: {
                            enabled: true,
                            objectCodename: 'ContentProgress'
                        }
                    }
                }
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'LearningResources') {
                    return [
                        {
                            id: 'learning-resources-object-id',
                            codename: 'LearningResources',
                            kind: 'object',
                            table_name: 'learning_resources',
                            config: {
                                runtimeLibrary: {
                                    recent: {
                                        objectCodename: 'RecentContentViews',
                                        targetObjectFieldCodename: 'TargetObjectCodename',
                                        targetRecordFieldCodename: 'TargetRecordId',
                                        actorFieldCodename: 'UserId',
                                        timestampFieldCodename: 'ViewedAt'
                                    }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'ContentProgress') {
                    return [{ id: 'progress-object-id', codename: 'ContentProgress', kind: 'object', table_name: 'content_progress' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'RecentContentViews') {
                    return [
                        {
                            id: 'recent-object-id',
                            codename: 'RecentContentViews',
                            kind: 'object',
                            table_name: 'recent_content_views',
                            config: null
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === 'progress-object-id') {
                    return [
                        { codename: 'TargetObjectCodename', column_name: 'target_object_codename' },
                        { codename: 'TargetRecordId', column_name: 'target_record_id' },
                        { codename: 'UserId', column_name: 'user_id' },
                        { codename: 'ProgressStatus', column_name: 'progress_status' },
                        { codename: 'ProgressPercent', column_name: 'progress_percent' },
                        { codename: 'StartedAt', column_name: 'started_at' },
                        { codename: 'CompletedAt', column_name: 'completed_at' },
                        { codename: 'LastViewedAt', column_name: 'last_viewed_at' }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === 'recent-object-id') {
                    return [
                        { codename: 'TargetObjectCodename', column_name: 'target_object_codename' },
                        { codename: 'TargetRecordId', column_name: 'target_record_id' },
                        { codename: 'UserId', column_name: 'user_id' },
                        { codename: 'ViewedAt', column_name: 'viewed_at' }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."learning_resources"')) {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-2222333344c8' }]
                }
                if (sql.includes('SELECT id') && sql.includes('FROM "app_runtime_test"."content_progress"')) {
                    return []
                }
                if (sql.includes('SELECT rel.id') && sql.includes('FROM "app_runtime_test"."recent_content_views" rel')) {
                    return []
                }
                if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                    return [{ id: generatedIds.shift() }]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."recent_content_views"')) {
                    insertedRecentQueries.push({ sql, params })
                    return []
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."content_progress"')) {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-2222333344ca' }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."recent_content_views"')) {
                    updatedRecentQueries.push({ sql, params })
                    return [{ id: 'recent-row-id' }]
                }
                if (sql.includes('pg_advisory_xact_lock')) {
                    return []
                }
                return []
            })

            const app = buildApp(dataSource)
            const targetRecordId = '018f8a78-7b8f-7c1d-a111-2222333344c8'

            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/progress/content`)
                .send({
                    targetObjectCodename: 'LearningResources',
                    targetRecordId,
                    action: 'view'
                })
                .expect(200)

            expect(response.body).toMatchObject({
                persisted: true,
                targetObjectCodename: 'LearningResources',
                targetRecordId,
                progressPercent: 0,
                status: 'inProgress'
            })
            expect(insertedRecentQueries).toHaveLength(1)
            expect(insertedRecentQueries[0]?.sql).toContain('"viewed_at"')
            expect(insertedRecentQueries[0]?.params).toEqual([
                '018f8a78-7b8f-7c1d-a111-2222333344ca',
                'LearningResources',
                targetRecordId,
                'test-user-id',
                'test-user-id',
                'test-user-id'
            ])
            expect(updatedRecentQueries).toHaveLength(0)
        })

        it('rejects browser-supplied progress values for Learning Content progress', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'viewer'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                settings: {
                    learningContent: {
                        progressStore: {
                            enabled: true,
                            objectCodename: 'ContentProgress'
                        }
                    }
                }
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/progress/content`)
                .send({
                    targetObjectCodename: 'LearnerHome',
                    targetRecordId: '018f8a78-7b8f-7c1d-a111-222233334498',
                    action: 'complete',
                    progressPercent: 15,
                    status: 'completed'
                })
                .expect(400)

            expect(response.body).toMatchObject({ error: 'Invalid body' })
            expect((dataSource.manager.query as jest.Mock).mock.calls.some(([sql]) => String(sql).includes('content_progress'))).toBe(false)
        })

        it('rejects direct progress completion for a sequence-locked CourseItem target', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const firstItemId = '018f8a78-7b8f-7c1d-a111-222233334501'
            const lockedItemId = '018f8a78-7b8f-7c1d-a111-222233334502'
            const courseId = '018f8a78-7b8f-7c1d-a111-222233334503'

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                settings: {
                    learningContent: {
                        progressStore: {
                            enabled: true,
                            objectCodename: 'ContentProgress'
                        }
                    }
                }
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'CourseItems') {
                    return [
                        {
                            id: 'course-items-object-id',
                            codename: 'CourseItems',
                            kind: 'object',
                            table_name: 'course_items',
                            config: {
                                runtimeProgress: {
                                    sequencePolicy: {
                                        mode: 'sequential',
                                        scopeFieldCodename: 'CourseId',
                                        orderFieldCodename: 'SortOrder'
                                    }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'ContentProgress') {
                    return [{ id: 'progress-object-id', codename: 'ContentProgress', kind: 'object', table_name: 'content_progress' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === 'progress-object-id') {
                    return [
                        { codename: 'TargetObjectCodename', column_name: 'target_object_codename' },
                        { codename: 'TargetRecordId', column_name: 'target_record_id' },
                        { codename: 'UserId', column_name: 'user_id' },
                        { codename: 'ProgressStatus', column_name: 'progress_status' },
                        { codename: 'ProgressPercent', column_name: 'progress_percent' },
                        { codename: 'StartedAt', column_name: 'started_at' },
                        { codename: 'CompletedAt', column_name: 'completed_at' },
                        { codename: 'LastViewedAt', column_name: 'last_viewed_at' }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === 'course-items-object-id') {
                    return [
                        { codename: 'CourseId', column_name: 'course_id' },
                        { codename: 'SortOrder', column_name: 'sort_order' }
                    ]
                }
                if (
                    sql.includes('FROM "app_runtime_test"."course_items"') &&
                    sql.includes('WHERE id = $1') &&
                    !sql.includes('AS "field_0"')
                ) {
                    return [{ id: lockedItemId }]
                }
                if (
                    sql.includes('FROM "app_runtime_test"."course_items"') &&
                    sql.includes('WHERE id = $1') &&
                    sql.includes('AS "field_0"')
                ) {
                    return [{ id: lockedItemId, field_0: courseId, field_1: 2 }]
                }
                if (sql.includes('FROM "app_runtime_test"."course_items"') && sql.includes('"course_id" IS NOT DISTINCT FROM $1')) {
                    return [
                        { id: firstItemId, field_0: courseId, field_1: 1 },
                        { id: lockedItemId, field_0: courseId, field_1: 2 }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."content_progress"') && sql.includes('ANY($3::text[])')) {
                    return []
                }
                return []
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/progress/content`)
                .send({
                    targetObjectCodename: 'CourseItems',
                    targetRecordId: lockedItemId,
                    action: 'complete'
                })
                .expect(423)

            expect(response.body).toMatchObject({
                error: 'Progress target is locked by sequence policy',
                code: 'SEQUENCE_ITEM_LOCKED',
                reason: 'sequentialLocked',
                lockedByStepIds: [firstItemId]
            })
            expect(
                (dataSource.manager.query as jest.Mock).mock.calls.some(([sql]) =>
                    String(sql).includes('INSERT INTO "app_runtime_test"."content_progress"')
                )
            ).toBe(false)
        })

        it('aggregates CourseItem progress into parent Course progress through metadata', async () => {
            const { dataSource, txExecutor, applicationRepo, applicationUserRepo } = buildDataSource()
            const firstItemId = '018f8a78-7b8f-7c1d-a111-222233334511'
            const secondItemId = '018f8a78-7b8f-7c1d-a111-222233334512'
            const optionalItemId = '018f8a78-7b8f-7c1d-a111-222233334513'
            const courseId = '018f8a78-7b8f-7c1d-a111-222233334514'

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                settings: {
                    learningContent: {
                        progressStore: {
                            enabled: true,
                            objectCodename: 'ContentProgress'
                        }
                    }
                }
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'CourseItems') {
                    return [
                        {
                            id: 'course-items-object-id',
                            codename: 'CourseItems',
                            kind: 'object',
                            table_name: 'course_items',
                            config: {
                                runtimeProgress: {
                                    aggregateParents: [
                                        {
                                            parentObjectCodename: 'Courses',
                                            parentIdFieldCodename: 'CourseId',
                                            itemWeightFieldCodename: 'CompletionWeight',
                                            itemRequiredFieldCodename: 'IsRequired',
                                            requiredOnly: true
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'ContentProgress') {
                    return [{ id: 'progress-object-id', codename: 'ContentProgress', kind: 'object', table_name: 'content_progress' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'Courses') {
                    return [{ id: 'courses-object-id', codename: 'Courses', kind: 'object', table_name: 'courses' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === 'progress-object-id') {
                    return [
                        { codename: 'TargetObjectCodename', column_name: 'target_object_codename' },
                        { codename: 'TargetRecordId', column_name: 'target_record_id' },
                        { codename: 'UserId', column_name: 'user_id' },
                        { codename: 'ProgressStatus', column_name: 'progress_status' },
                        { codename: 'ProgressPercent', column_name: 'progress_percent' },
                        { codename: 'StartedAt', column_name: 'started_at' },
                        { codename: 'CompletedAt', column_name: 'completed_at' },
                        { codename: 'LastViewedAt', column_name: 'last_viewed_at' }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === 'course-items-object-id') {
                    return [
                        { codename: 'CourseId', column_name: 'course_id' },
                        { codename: 'CompletionWeight', column_name: 'completion_weight' },
                        { codename: 'IsRequired', column_name: 'is_required' }
                    ]
                }
                if (
                    sql.includes('FROM "app_runtime_test"."course_items"') &&
                    sql.includes('WHERE id = $1') &&
                    !sql.includes('AS "parent_id"')
                ) {
                    return [{ id: secondItemId }]
                }
                if (sql.includes('FROM "app_runtime_test"."course_items"') && sql.includes('"course_id" IS NOT DISTINCT FROM $1')) {
                    return [
                        { id: firstItemId, parent_id: courseId, item_weight: '1', item_required: true },
                        { id: secondItemId, parent_id: courseId, item_weight: '3', item_required: true },
                        { id: optionalItemId, parent_id: courseId, item_weight: '100', item_required: false }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."course_items"') && sql.includes('AS "parent_id"')) {
                    return [{ id: secondItemId, parent_id: courseId, item_weight: '3', item_required: true }]
                }
                if (sql.includes('FROM "app_runtime_test"."content_progress"') && sql.includes('ANY($3::text[])')) {
                    return [
                        { target_record_id: firstItemId, status: 'completed', progress_percent: 100 },
                        { target_record_id: secondItemId, status: 'completed', progress_percent: 100 }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."courses"') && sql.includes('WHERE id = $1')) {
                    return [{ id: courseId }]
                }
                if (
                    sql.includes('FROM "app_runtime_test"."content_progress"') &&
                    sql.includes('LIMIT 1') &&
                    params?.[0] === 'CourseItems'
                ) {
                    return []
                }
                if (sql.includes('FROM "app_runtime_test"."content_progress"') && sql.includes('LIMIT 1') && params?.[0] === 'Courses') {
                    return [{ id: 'course-progress-id' }]
                }
                if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334515' }]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."content_progress"')) {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334515' }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."content_progress"')) {
                    return [{ id: 'course-progress-id' }]
                }
                return []
            })

            const app = buildApp(dataSource)

            await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/progress/content`)
                .send({
                    targetObjectCodename: 'CourseItems',
                    targetRecordId: secondItemId,
                    action: 'complete'
                })
                .expect(200)

            const parentProgressUpdate = (txExecutor.query as jest.Mock).mock.calls.find(
                ([sql, params]) =>
                    String(sql).includes('UPDATE "app_runtime_test"."content_progress"') &&
                    Array.isArray(params) &&
                    params[0] === 'course-progress-id'
            )
            expect(parentProgressUpdate?.[1]).toEqual(['course-progress-id', 'completed', 100, 'test-user-id'])
        })

        it('recalculates parent Course progress through metadata without accepting client progress values', async () => {
            const { dataSource, txExecutor, applicationRepo, applicationUserRepo } = buildDataSource()
            const firstItemId = '018f8a78-7b8f-7c1d-a111-222233334521'
            const secondItemId = '018f8a78-7b8f-7c1d-a111-222233334522'
            const courseId = '018f8a78-7b8f-7c1d-a111-222233334523'

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                settings: {
                    learningContent: {
                        progressStore: {
                            enabled: true,
                            objectCodename: 'ContentProgress'
                        }
                    }
                }
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'CourseItems') {
                    return [
                        {
                            id: 'course-items-object-id',
                            codename: 'CourseItems',
                            kind: 'object',
                            table_name: 'course_items',
                            config: {
                                runtimeProgress: {
                                    aggregateParents: [
                                        {
                                            parentObjectCodename: 'Courses',
                                            parentIdFieldCodename: 'CourseId',
                                            itemWeightFieldCodename: 'CompletionWeight'
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'ContentProgress') {
                    return [{ id: 'progress-object-id', codename: 'ContentProgress', kind: 'object', table_name: 'content_progress' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'Courses') {
                    return [{ id: 'courses-object-id', codename: 'Courses', kind: 'object', table_name: 'courses' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === 'progress-object-id') {
                    return [
                        { codename: 'TargetObjectCodename', column_name: 'target_object_codename' },
                        { codename: 'TargetRecordId', column_name: 'target_record_id' },
                        { codename: 'UserId', column_name: 'user_id' },
                        { codename: 'ProgressStatus', column_name: 'progress_status' },
                        { codename: 'ProgressPercent', column_name: 'progress_percent' },
                        { codename: 'StartedAt', column_name: 'started_at' },
                        { codename: 'CompletedAt', column_name: 'completed_at' },
                        { codename: 'LastViewedAt', column_name: 'last_viewed_at' }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === 'course-items-object-id') {
                    return [
                        { codename: 'CourseId', column_name: 'course_id' },
                        { codename: 'CompletionWeight', column_name: 'completion_weight' }
                    ]
                }
                if (
                    sql.includes('FROM "app_runtime_test"."course_items"') &&
                    sql.includes('WHERE id = $1') &&
                    !sql.includes('AS "parent_id"')
                ) {
                    return [{ id: secondItemId }]
                }
                if (sql.includes('FROM "app_runtime_test"."course_items"') && sql.includes('AS "parent_id"')) {
                    return [{ id: secondItemId, parent_id: courseId, item_weight: '2' }]
                }
                if (sql.includes('FROM "app_runtime_test"."course_items"') && sql.includes('"course_id" IS NOT DISTINCT FROM $1')) {
                    return [
                        { id: firstItemId, parent_id: courseId, item_weight: '1' },
                        { id: secondItemId, parent_id: courseId, item_weight: '2' }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."content_progress"') && sql.includes('ANY($3::text[])')) {
                    return [
                        { target_record_id: firstItemId, status: 'completed', progress_percent: 100 },
                        { target_record_id: secondItemId, status: 'completed', progress_percent: 100 }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."courses"') && sql.includes('WHERE id = $1')) {
                    return [{ id: courseId }]
                }
                if (sql.includes('FROM "app_runtime_test"."content_progress"') && sql.includes('LIMIT 1') && params?.[0] === 'Courses') {
                    return [{ id: 'course-progress-id' }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."content_progress"')) {
                    return [{ id: 'course-progress-id' }]
                }
                return []
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/progress/content`)
                .send({
                    targetObjectCodename: 'CourseItems',
                    targetRecordId: secondItemId,
                    action: 'recalculate'
                })
                .expect(200)

            expect(response.body).toEqual({
                persisted: true,
                action: 'recalculate',
                targetObjectCodename: 'CourseItems',
                targetRecordId: secondItemId
            })
            expect(
                txExecutor.query.mock.calls.some(
                    ([sql, params]) =>
                        String(sql).includes('INSERT INTO "app_runtime_test"."content_progress"') &&
                        Array.isArray(params) &&
                        params[1] === 'CourseItems'
                )
            ).toBe(false)
            const parentProgressUpdate = txExecutor.query.mock.calls.find(
                ([sql, params]) =>
                    String(sql).includes('UPDATE "app_runtime_test"."content_progress"') &&
                    Array.isArray(params) &&
                    params[0] === 'course-progress-id'
            )
            expect(parentProgressUpdate?.[1]).toEqual(['course-progress-id', 'completed', 100, 'test-user-id'])
        })

        it('fails closed when progress recalculation metadata is missing', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const courseItemId = '018f8a78-7b8f-7c1d-a111-222233334524'

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                settings: {
                    learningContent: {
                        progressStore: {
                            enabled: true,
                            objectCodename: 'ContentProgress'
                        }
                    }
                }
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'CourseItems') {
                    return [
                        {
                            id: 'course-items-object-id',
                            codename: 'CourseItems',
                            kind: 'object',
                            table_name: 'course_items',
                            config: {}
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'ContentProgress') {
                    return [{ id: 'progress-object-id', codename: 'ContentProgress', kind: 'object', table_name: 'content_progress' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === 'progress-object-id') {
                    return [
                        { codename: 'TargetObjectCodename', column_name: 'target_object_codename' },
                        { codename: 'TargetRecordId', column_name: 'target_record_id' },
                        { codename: 'UserId', column_name: 'user_id' },
                        { codename: 'ProgressStatus', column_name: 'progress_status' },
                        { codename: 'ProgressPercent', column_name: 'progress_percent' },
                        { codename: 'StartedAt', column_name: 'started_at' },
                        { codename: 'CompletedAt', column_name: 'completed_at' },
                        { codename: 'LastViewedAt', column_name: 'last_viewed_at' }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."course_items"') && sql.includes('WHERE id = $1')) {
                    return [{ id: courseItemId }]
                }
                return []
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/progress/content`)
                .send({
                    targetObjectCodename: 'CourseItems',
                    targetRecordId: courseItemId,
                    action: 'recalculate'
                })
                .expect(409)

            expect(response.body).toEqual({
                error: 'Progress recalculation is not configured for this target',
                code: 'PROGRESS_RECALCULATION_UNAVAILABLE'
            })
            expect(dataSource.transaction).not.toHaveBeenCalled()
        })

        it('fails closed when runtime progress sequence policy metadata is invalid', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const targetRecordId = '018f8a78-7b8f-7c1d-a111-222233334504'

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                settings: {
                    learningContent: {
                        progressStore: {
                            enabled: true,
                            objectCodename: 'ContentProgress'
                        }
                    }
                }
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'CourseItems') {
                    return [
                        {
                            id: 'course-items-object-id',
                            codename: 'CourseItems',
                            kind: 'object',
                            table_name: 'course_items',
                            config: {
                                runtimeProgress: {
                                    sequencePolicy: {
                                        mode: 'sequential',
                                        scopeFieldCodename: ''
                                    }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects') && params?.[0] === 'ContentProgress') {
                    return [{ id: 'progress-object-id', codename: 'ContentProgress', kind: 'object', table_name: 'content_progress' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === 'progress-object-id') {
                    return [
                        { codename: 'TargetObjectCodename', column_name: 'target_object_codename' },
                        { codename: 'TargetRecordId', column_name: 'target_record_id' },
                        { codename: 'UserId', column_name: 'user_id' },
                        { codename: 'ProgressStatus', column_name: 'progress_status' },
                        { codename: 'ProgressPercent', column_name: 'progress_percent' },
                        { codename: 'StartedAt', column_name: 'started_at' },
                        { codename: 'CompletedAt', column_name: 'completed_at' },
                        { codename: 'LastViewedAt', column_name: 'last_viewed_at' }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."course_items"') && sql.includes('WHERE id = $1')) {
                    return [{ id: targetRecordId }]
                }
                return []
            })

            const app = buildApp(dataSource)

            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/progress/content`)
                .send({
                    targetObjectCodename: 'CourseItems',
                    targetRecordId,
                    action: 'complete'
                })
                .expect(409)

            expect(response.body).toMatchObject({
                error: 'Progress sequence policy is not configured for this target',
                code: 'SEQUENCE_POLICY_INVALID'
            })
            expect(
                (dataSource.manager.query as jest.Mock).mock.calls.some(([sql]) =>
                    String(sql).includes('INSERT INTO "app_runtime_test"."content_progress"')
                )
            ).toBe(false)
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
                    return [{ id: runtimeLinkedCollectionId, codename: 'orders', table_name: 'orders' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
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
                    objectCollectionId: runtimeLinkedCollectionId,
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
                    return [{ id: runtimeLinkedCollectionId, codename: 'orders', table_name: 'orders' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
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
                    objectCollectionId: runtimeLinkedCollectionId,
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

    describe('Runtime single-row read contract', () => {
        const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334440'
        const runtimeLinkedCollectionId = '018f8a78-7b8f-7c1d-a111-222233334441'
        const runtimeRowId = '018f8a78-7b8f-7c1d-a111-222233334442'

        it('exposes the runtime row version for optimistic follow-up actions', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                workspacesEnabled: false
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'orders',
                            table_name: 'orders',
                            config: null,
                            presentation: null
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334443',
                            codename: 'Name',
                            column_name: 'name',
                            data_type: 'STRING',
                            is_required: false,
                            is_display_component: true,
                            validation_rules: null,
                            presentation: null,
                            sort_order: 1,
                            ui_config: null,
                            target_object_id: null,
                            target_object_kind: null
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId, name: 'Runtime row', _upl_version: 7 }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .get(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .query({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(200)

            expect(response.body).toEqual({
                id: runtimeRowId,
                version: 7,
                data: {
                    name: 'Runtime row'
                }
            })
            const selectCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('FROM "app_runtime_test"."orders"')
            )
            expect(selectCall).toBeDefined()
            expect(String(selectCall?.[0])).toContain('"_upl_version"')
        })

        it('applies owner-or-shared runtime access to direct single-row reads', async () => {
            const accessObjectId = '018f8a78-7b8f-7c1d-a111-222233334444'
            const readQueries: Array<{ sql: string; params?: unknown[] }> = []
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                workspacesEnabled: false
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'ContentAccessEntries') {
                        return [
                            {
                                id: accessObjectId,
                                codename: 'ContentAccessEntries',
                                table_name: 'content_access_entries',
                                config: null
                            }
                        ]
                    }
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'LearningResources',
                            table_name: 'learning_resources',
                            config: buildOwnerOrSharedRuntimeConfig()
                        },
                        {
                            id: accessObjectId,
                            codename: 'ContentAccessEntries',
                            table_name: 'content_access_entries',
                            config: null
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    if (params?.[0] === accessObjectId) return runtimeAccessEntryComponents
                    return [
                        {
                            id: 'title',
                            codename: 'Title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_display_component: true
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."learning_resources"')) {
                    readQueries.push({ sql, params })
                    return []
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .get(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .query({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(404)

            expect(response.body).toEqual({ error: 'Row not found' })
            expect(readQueries).toHaveLength(1)
            expect(readQueries[0]?.sql).toContain('"_upl_created_by" = $2')
            expect(readQueries[0]?.sql).toContain('FROM "app_runtime_test"."content_access_entries" rel')
            expect(readQueries[0]?.sql).toContain('rel."target_record_id"::text = "app_runtime_test"."learning_resources".id::text')
            expect(readQueries[0]?.params).toEqual([
                runtimeRowId,
                'test-user-id',
                'LearningResources',
                'test-user-id',
                ['workspaceMember', 'user']
            ])
        })
    })

    describe('Runtime lifecycle delete contract', () => {
        const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334450'
        const runtimeLinkedCollectionId = '018f8a78-7b8f-7c1d-a111-222233334451'
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
                .query({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(403)

            expect(response.body).toEqual({ error: 'Insufficient permissions for this action' })
        })

        it('uses physical DELETE when lifecycle contract is hard delete', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const dispatchLifecycleEventSpy = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue()

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
                            id: runtimeLinkedCollectionId,
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
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId, _upl_locked: false }]
                }
                if (sql.includes('DELETE FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .delete(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .query({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(200)

            expect(response.body).toEqual({ status: 'deleted' })
            const deleteCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('DELETE FROM "app_runtime_test"."orders"')
            )
            expect(deleteCall).toBeDefined()
            expect(String(deleteCall?.[0])).not.toContain('_app_deleted = false')
            expect(String(deleteCall?.[0])).not.toContain('SET _upl_deleted = true')
            expect(dispatchLifecycleEventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({ eventName: 'beforeDelete' })
                })
            )
            expect(dispatchLifecycleEventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({ eventName: 'afterDelete' })
                })
            )
        })

        it('applies expected-version predicate to hard-delete runtime mutations', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue()

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
                            id: runtimeLinkedCollectionId,
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
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId, _upl_locked: false, _upl_version: 4 }]
                }
                if (sql.includes('DELETE FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            await request(app)
                .delete(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .query({ objectCollectionId: runtimeLinkedCollectionId, expectedVersion: 4 })
                .expect(200)

            const deleteCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('DELETE FROM "app_runtime_test"."orders"')
            )
            expect(deleteCall).toBeDefined()
            expect(String(deleteCall?.[0])).toContain('COALESCE(_upl_version, 1) = $2')
            expect(deleteCall?.[1]).toEqual([runtimeRowId, 4])
        })

        it('applies owner-or-shared access at runtime delete read and mutation boundaries', async () => {
            const accessObjectId = '018f8a78-7b8f-7c1d-a111-222233334453'
            const sourceQueries: Array<{ sql: string; params?: unknown[] }> = []
            const mutationQueries: Array<{ sql: string; params?: unknown[] }> = []
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                settings: {
                    rolePolicies: {
                        templates: [
                            {
                                codename: 'memberPolicy',
                                title: { en: 'Member permissions' },
                                rules: [{ capability: 'content.delete', effect: 'allow', scope: 'workspace' }]
                            }
                        ]
                    }
                }
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'ContentAccessEntries') {
                        return [
                            {
                                id: accessObjectId,
                                codename: 'ContentAccessEntries',
                                table_name: 'content_access_entries',
                                config: null
                            }
                        ]
                    }
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'LearningResources',
                            table_name: 'learning_resources',
                            config: {
                                ...buildOwnerOrSharedRuntimeConfig(),
                                systemFields: { lifecycleContract: { delete: { mode: 'soft' } } }
                            }
                        },
                        {
                            id: accessObjectId,
                            codename: 'ContentAccessEntries',
                            table_name: 'content_access_entries',
                            config: null
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    if (params?.[0] === accessObjectId) return runtimeAccessEntryComponents
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."learning_resources"')) {
                    sourceQueries.push({ sql, params })
                    return [{ id: runtimeRowId, _upl_locked: false, _upl_version: 4, _upl_created_by: 'owner-user-id' }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."learning_resources"')) {
                    mutationQueries.push({ sql, params })
                    return [{ id: runtimeRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            await request(app)
                .delete(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .query({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(200)

            expect(sourceQueries[0]?.sql).toContain('"_upl_created_by" = $2')
            expect(sourceQueries[0]?.sql).toContain('rel."target_record_id"::text = "app_runtime_test"."learning_resources".id::text')
            expect(mutationQueries[0]?.sql).toContain('"_upl_created_by" = $3')
            expect(mutationQueries[0]?.sql).toContain('rel."target_record_id"::text = "app_runtime_test"."learning_resources".id::text')
            expect(mutationQueries[0]?.params).toEqual([
                'test-user-id',
                runtimeRowId,
                'test-user-id',
                'LearningResources',
                'test-user-id',
                ['workspaceMember', 'user']
            ])
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
                            id: runtimeLinkedCollectionId,
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
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId, _upl_locked: false }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            await request(app)
                .delete(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .query({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(200)

            const updateCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('UPDATE "app_runtime_test"."orders"')
            )
            expect(updateCall).toBeDefined()
            expect(String(updateCall?.[0])).toContain('_app_deleted = true')
            expect(String(updateCall?.[0])).not.toContain('_app_deleted_at = now()')
            expect(String(updateCall?.[0])).not.toContain('_app_deleted_by = $1')
        })

        it('rejects stale-version runtime delete before mutating the runtime table', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const dispatchLifecycleEventSpy = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue()

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
                            id: runtimeLinkedCollectionId,
                            codename: 'orders',
                            table_name: 'orders',
                            config: {
                                systemFields: {
                                    lifecycleContract: {
                                        delete: { mode: 'soft' }
                                    }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId, _upl_locked: false, _upl_version: 4 }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."orders"') || sql.includes('DELETE FROM "app_runtime_test"."orders"')) {
                    throw new Error('Mutation should not run when expectedVersion is stale')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .delete(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .query({ objectCollectionId: runtimeLinkedCollectionId, expectedVersion: 3 })
                .expect(409)

            expect(response.body).toMatchObject({
                error: 'Record version conflict',
                code: 'RUNTIME_RECORD_VERSION_CONFLICT',
                expectedVersion: 3,
                actualVersion: 4
            })
            expect(dispatchLifecycleEventSpy).not.toHaveBeenCalled()
        })

        it('applies expected-version predicate to runtime delete mutations', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue()

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
                            id: runtimeLinkedCollectionId,
                            codename: 'orders',
                            table_name: 'orders',
                            config: {
                                systemFields: {
                                    lifecycleContract: {
                                        delete: { mode: 'soft' }
                                    }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId, _upl_locked: false, _upl_version: 4 }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            await request(app)
                .delete(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .query({ objectCollectionId: runtimeLinkedCollectionId, expectedVersion: 4 })
                .expect(200)

            const updateCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('UPDATE "app_runtime_test"."orders"')
            )
            expect(updateCall).toBeDefined()
            expect(String(updateCall?.[0])).toContain('COALESCE(_upl_version, 1) = $3')
            expect(updateCall?.[1]).toEqual(['test-user-id', runtimeRowId, 4])
        })

        it('rejects runtime delete when version changes between read and mutation', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const dispatchLifecycleEventSpy = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue()

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
                            id: runtimeLinkedCollectionId,
                            codename: 'orders',
                            table_name: 'orders',
                            config: {
                                systemFields: {
                                    lifecycleContract: {
                                        delete: { mode: 'soft' }
                                    }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId, _upl_locked: false, _upl_version: 4 }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."orders"')) {
                    return []
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .delete(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .query({ objectCollectionId: runtimeLinkedCollectionId, expectedVersion: 4 })
                .expect(409)

            expect(response.body).toMatchObject({
                error: 'Record version conflict',
                code: 'RUNTIME_RECORD_VERSION_CONFLICT',
                expectedVersion: 4
            })
            expect(dispatchLifecycleEventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({ eventName: 'beforeDelete' })
                })
            )
            expect(dispatchLifecycleEventSpy).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({ eventName: 'afterDelete' })
                })
            )
        })

        it('restores a soft-deleted runtime row with optimistic concurrency', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const dispatchLifecycleEventSpy = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue()

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
                            id: runtimeLinkedCollectionId,
                            codename: 'orders',
                            table_name: 'orders',
                            config: {
                                systemFields: {
                                    lifecycleContract: {
                                        delete: { mode: 'soft' }
                                    }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId, _upl_locked: false, _upl_version: 4, _app_deleted: true }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/restore`)
                .send({ objectCollectionId: runtimeLinkedCollectionId, expectedVersion: 4 })
                .expect(200)

            expect(response.body).toEqual({ status: 'restored' })
            const updateCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('UPDATE "app_runtime_test"."orders"')
            )
            expect(updateCall).toBeDefined()
            expect(String(updateCall?.[0])).toContain('_app_deleted = false')
            expect(String(updateCall?.[0])).toContain('_app_deleted_at = NULL')
            expect(String(updateCall?.[0])).toContain('_upl_version = COALESCE(_upl_version, 1) + 1')
            expect(String(updateCall?.[0])).toContain('COALESCE(_upl_version, 1) = $3')
            expect(updateCall?.[1]).toEqual(['test-user-id', runtimeRowId, 4])
            expect(dispatchLifecycleEventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({ eventName: 'beforeUpdate', metadata: { action: 'restore' } })
                })
            )
            expect(dispatchLifecycleEventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({ eventName: 'afterUpdate', metadata: { action: 'restore' } })
                })
            )
        })

        it('rejects restoring a soft-deleted runtime row when the workspace row limit is already reached', async () => {
            const workspaceId = '018f8a78-7b8f-7c1d-a111-2222333344d0'
            const runtimeSchemaName = buildRuntimeSchemaName(runtimeApplicationId)
            const runtimeSchemaIdent = `"${runtimeSchemaName}"`
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const dispatchLifecycleEventSpy = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue()
            let updateAttempted = false
            let limitLockAttempted = false

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'owner'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: runtimeSchemaName,
                workspacesEnabled: true
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('information_schema.tables')) {
                    return [{ exists: true }]
                }
                if (sql.includes('set_config(')) {
                    return []
                }
                if (sql.includes(`FROM ${runtimeSchemaIdent}."_app_workspaces"`) && sql.includes("workspace_type = 'personal'")) {
                    return [{ id: workspaceId }]
                }
                if (sql.includes(`FROM ${runtimeSchemaIdent}."_app_workspace_roles"`)) {
                    return [{ id: params?.[0] === 'member' ? 'workspace-role-member' : 'workspace-role-owner', codename: params?.[0] }]
                }
                if (sql.includes(`FROM ${runtimeSchemaIdent}."_app_workspace_user_roles"`) && sql.includes('WHERE workspace_id = $1')) {
                    return [{ workspaceId, userId: 'test-user-id', isDefaultWorkspace: true }]
                }
                if (sql.includes(`FROM ${runtimeSchemaIdent}."_app_workspace_user_roles"`) && sql.includes('INNER JOIN')) {
                    return [{ workspaceId, isDefaultWorkspace: true }]
                }
                if (sql.includes(`FROM ${runtimeSchemaIdent}._app_objects`)) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'orders',
                            table_name: 'orders',
                            config: {
                                systemFields: {
                                    lifecycleContract: {
                                        delete: { mode: 'soft' }
                                    }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes(`FROM ${runtimeSchemaIdent}._app_components`)) {
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes(`FROM ${runtimeSchemaIdent}."orders"`)) {
                    return [{ id: runtimeRowId, workspace_id: workspaceId, _upl_locked: false, _upl_version: 4, _app_deleted: true }]
                }
                if (sql.includes(`FROM ${runtimeSchemaIdent}."_app_limits"`)) {
                    return [{ maxRows: 1 }]
                }
                if (sql.includes('pg_advisory_xact_lock') && String(params?.[0]).startsWith('workspace-limit:')) {
                    limitLockAttempted = true
                    return []
                }
                if (sql.includes('COUNT(*)::int AS total') && sql.includes(`FROM ${runtimeSchemaIdent}."orders"`)) {
                    return [{ total: 1 }]
                }
                if (sql.includes(`UPDATE ${runtimeSchemaIdent}."orders"`)) {
                    updateAttempted = true
                    return [{ id: runtimeRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/restore`)
                .query({ workspaceId })
                .send({ objectCollectionId: runtimeLinkedCollectionId, expectedVersion: 4 })
                .expect(409)

            expect(response.body).toMatchObject({
                error: 'Workspace object row limit reached',
                code: 'WORKSPACE_LIMIT_REACHED',
                details: { maxRows: 1, currentRows: 1, canCreate: false }
            })
            expect(limitLockAttempted).toBe(true)
            expect(updateAttempted).toBe(false)
            expect(dispatchLifecycleEventSpy).not.toHaveBeenCalled()
        })

        it('applies owner-or-shared access at runtime restore read and mutation boundaries', async () => {
            const accessObjectId = '018f8a78-7b8f-7c1d-a111-222233334454'
            const sourceQueries: Array<{ sql: string; params?: unknown[] }> = []
            const mutationQueries: Array<{ sql: string; params?: unknown[] }> = []
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                settings: {
                    rolePolicies: {
                        templates: [
                            {
                                codename: 'memberPolicy',
                                title: { en: 'Member permissions' },
                                rules: [{ capability: 'records.edit', effect: 'allow', scope: 'workspace' }]
                            }
                        ]
                    }
                }
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'ContentAccessEntries') {
                        return [
                            {
                                id: accessObjectId,
                                codename: 'ContentAccessEntries',
                                table_name: 'content_access_entries',
                                config: null
                            }
                        ]
                    }
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'LearningResources',
                            table_name: 'learning_resources',
                            config: {
                                ...buildOwnerOrSharedRuntimeConfig(),
                                systemFields: { lifecycleContract: { delete: { mode: 'soft' } } }
                            }
                        },
                        {
                            id: accessObjectId,
                            codename: 'ContentAccessEntries',
                            table_name: 'content_access_entries',
                            config: null
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    if (params?.[0] === accessObjectId) return runtimeAccessEntryComponents
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."learning_resources"')) {
                    sourceQueries.push({ sql, params })
                    return [{ id: runtimeRowId, _upl_locked: false, _upl_version: 4, _upl_created_by: 'owner-user-id' }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."learning_resources"')) {
                    mutationQueries.push({ sql, params })
                    return [{ id: runtimeRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/restore`)
                .send({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(200)

            expect(sourceQueries[0]?.sql).toContain('"_upl_created_by" = $2')
            expect(sourceQueries[0]?.sql).toContain('rel."target_record_id"::text = "app_runtime_test"."learning_resources".id::text')
            expect(mutationQueries[0]?.sql).toContain('"_upl_created_by" = $3')
            expect(mutationQueries[0]?.sql).toContain('rel."target_record_id"::text = "app_runtime_test"."learning_resources".id::text')
            expect(mutationQueries[0]?.params).toEqual([
                'test-user-id',
                runtimeRowId,
                'test-user-id',
                'LearningResources',
                'test-user-id',
                ['workspaceMember', 'user']
            ])
        })

        it('restores a soft-deleted runtime row into a validated target parent', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const targetProjectObjectId = '018f8a78-7b8f-7c1d-a111-222233334590'
            const targetProjectRowId = '018f8a78-7b8f-7c1d-a111-222233334591'

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'owner'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test'
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'orders',
                            table_name: 'orders',
                            config: {
                                systemFields: {
                                    lifecycleContract: {
                                        delete: { mode: 'soft' }
                                    }
                                }
                            }
                        },
                        {
                            id: targetProjectObjectId,
                            codename: 'projects',
                            table_name: 'projects',
                            config: {
                                systemFields: {
                                    lifecycleContract: {
                                        delete: { mode: 'soft' }
                                    }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === runtimeLinkedCollectionId) {
                    return [
                        {
                            id: 'project-id-component',
                            codename: {
                                _primary: 'en',
                                locales: { en: { content: 'ProjectId' } }
                            },
                            column_name: 'project_id',
                            data_type: 'REF',
                            is_required: false,
                            validation_rules: {},
                            target_object_id: targetProjectObjectId,
                            target_object_kind: 'object',
                            ui_config: {}
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId, _upl_locked: false, _upl_version: 4, _app_deleted: true }]
                }
                if (sql.includes('SELECT id') && sql.includes('FROM "app_runtime_test"."projects"')) {
                    return [{ id: targetProjectRowId }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/restore`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    expectedVersion: 4,
                    restoreTarget: {
                        mode: 'target',
                        targetObjectCollectionId: targetProjectObjectId,
                        targetRecordId: targetProjectRowId,
                        parentFieldCodename: 'ProjectId'
                    }
                })
                .expect(200)

            expect(response.body).toEqual({ status: 'restored' })
            const updateCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('UPDATE "app_runtime_test"."orders"')
            )
            expect(String(updateCall?.[0])).toContain('"project_id" = $4')
            expect(updateCall?.[1]).toEqual(['test-user-id', runtimeRowId, 4, targetProjectRowId])
        })

        it('fails closed when restoring to the original parent that is no longer editable', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const targetProjectObjectId = '018f8a78-7b8f-7c1d-a111-222233334590'
            const accessObjectId = '018f8a78-7b8f-7c1d-a111-222233334593'
            const targetProjectRowId = '018f8a78-7b8f-7c1d-a111-222233334591'

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                settings: {
                    rolePolicies: {
                        templates: [
                            {
                                codename: 'memberPolicy',
                                title: { en: 'Member permissions' },
                                rules: [{ capability: 'records.edit', effect: 'allow', scope: 'workspace' }]
                            }
                        ]
                    }
                }
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'Projects' || params?.[0] === targetProjectObjectId) {
                        return [
                            {
                                id: targetProjectObjectId,
                                codename: 'Projects',
                                table_name: 'projects',
                                config: buildOwnerOrSharedRuntimeConfig()
                            }
                        ]
                    }
                    if (params?.[0] === 'ContentAccessEntries') {
                        return [
                            {
                                id: accessObjectId,
                                codename: 'ContentAccessEntries',
                                table_name: 'content_access_entries',
                                config: null
                            }
                        ]
                    }
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'Orders',
                            table_name: 'orders',
                            config: {
                                systemFields: {
                                    lifecycleContract: {
                                        delete: { mode: 'soft' }
                                    }
                                },
                                runtimeRecordParentAccess: {
                                    mode: 'parentRecord',
                                    parentObjectCodename: 'Projects',
                                    parentFieldCodename: 'ProjectId'
                                }
                            }
                        },
                        {
                            id: targetProjectObjectId,
                            codename: 'Projects',
                            table_name: 'projects',
                            config: buildOwnerOrSharedRuntimeConfig()
                        },
                        {
                            id: accessObjectId,
                            codename: 'ContentAccessEntries',
                            table_name: 'content_access_entries',
                            config: null
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === runtimeLinkedCollectionId) {
                    return [
                        {
                            id: 'project-id-component',
                            codename: 'ProjectId',
                            column_name: 'project_id',
                            data_type: 'REF',
                            is_required: true,
                            validation_rules: {},
                            target_object_id: targetProjectObjectId,
                            target_object_kind: 'object',
                            ui_config: {}
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === accessObjectId) {
                    return runtimeAccessEntryComponents
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."orders"')) {
                    return [
                        {
                            id: runtimeRowId,
                            project_id: targetProjectRowId,
                            _upl_locked: false,
                            _upl_version: 4,
                            _app_deleted: true
                        }
                    ]
                }
                if (sql.includes('SELECT id') && sql.includes('FROM "app_runtime_test"."projects"')) {
                    return []
                }
                if (sql.includes('UPDATE "app_runtime_test"."orders"')) {
                    throw new Error('Restore mutation should not run without an editable original parent')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/restore`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    expectedVersion: 4,
                    restoreTarget: { mode: 'original' }
                })
                .expect(404)

            expect(response.body).toMatchObject({
                code: 'RUNTIME_RESTORE_ORIGINAL_PARENT_NOT_FOUND'
            })
        })

        it('rejects stale-version runtime restore before mutating the runtime table', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const dispatchLifecycleEventSpy = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue()

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
                            id: runtimeLinkedCollectionId,
                            codename: 'orders',
                            table_name: 'orders',
                            config: {
                                systemFields: {
                                    lifecycleContract: {
                                        delete: { mode: 'soft' }
                                    }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId, _upl_locked: false, _upl_version: 4, _app_deleted: true }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."orders"')) {
                    throw new Error('Mutation should not run when expectedVersion is stale')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/restore`)
                .send({ objectCollectionId: runtimeLinkedCollectionId, expectedVersion: 3 })
                .expect(409)

            expect(response.body).toMatchObject({
                error: 'Record version conflict',
                code: 'RUNTIME_RECORD_VERSION_CONFLICT',
                expectedVersion: 3,
                actualVersion: 4
            })
            expect(dispatchLifecycleEventSpy).not.toHaveBeenCalled()
        })

        it('rejects runtime restore when version changes between read and mutation', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const dispatchLifecycleEventSpy = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue()

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
                            id: runtimeLinkedCollectionId,
                            codename: 'orders',
                            table_name: 'orders',
                            config: {
                                systemFields: {
                                    lifecycleContract: {
                                        delete: { mode: 'soft' }
                                    }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId, _upl_locked: false, _upl_version: 4, _app_deleted: true }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."orders"')) {
                    return []
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/restore`)
                .send({ objectCollectionId: runtimeLinkedCollectionId, expectedVersion: 4 })
                .expect(409)

            expect(response.body).toMatchObject({
                error: 'Record version conflict',
                code: 'RUNTIME_RECORD_VERSION_CONFLICT',
                expectedVersion: 4
            })
            expect(dispatchLifecycleEventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({ eventName: 'beforeUpdate', metadata: { action: 'restore' } })
                })
            )
            expect(dispatchLifecycleEventSpy).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({ eventName: 'afterUpdate', metadata: { action: 'restore' } })
                })
            )
        })

        it('omits platform delete predicates and updates when upl delete fields are disabled in object config', async () => {
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
                            id: runtimeLinkedCollectionId,
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
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId, _upl_locked: false }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            await request(app)
                .delete(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .query({ objectCollectionId: runtimeLinkedCollectionId })
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

    describe('Runtime parent-row permission contract', () => {
        const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334470'
        const runtimeLinkedCollectionId = '018f8a78-7b8f-7c1d-a111-222233334471'
        const runtimeRowId = '018f8a78-7b8f-7c1d-a111-222233334472'
        const copiedRowId = '018f8a78-7b8f-7c1d-a111-222233334473'
        const reorderedRowIdA = '018f8a78-7b8f-7c1d-a111-222233334474'
        const reorderedRowIdB = '018f8a78-7b8f-7c1d-a111-222233334475'

        it('rejects duplicate runtime row reorder ids before resolving the target object', async () => {
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
                .post(`/applications/${runtimeApplicationId}/runtime/rows/reorder`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    orderedRowIds: [reorderedRowIdA, reorderedRowIdA],
                    expectedVersionsByRowId: {
                        [reorderedRowIdA]: 2
                    }
                })
                .expect(400)

            expect(response.body).toMatchObject({
                error: 'Runtime row reorder received duplicate row IDs',
                code: 'RUNTIME_REORDER_DUPLICATE_ROWS'
            })
            expect(
                (dataSource.manager.query as jest.Mock).mock.calls.some((call) =>
                    String(call[0]).includes('FROM "app_runtime_test"._app_objects')
                )
            ).toBe(false)
        })

        it('rejects runtime row reorder version maps that do not match the ordered ids', async () => {
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
                .post(`/applications/${runtimeApplicationId}/runtime/rows/reorder`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    orderedRowIds: [reorderedRowIdA, reorderedRowIdB],
                    expectedVersionsByRowId: {
                        [reorderedRowIdA]: 2,
                        [runtimeRowId]: 9
                    }
                })
                .expect(409)

            expect(response.body).toMatchObject({
                error: 'Runtime row reorder expected-version map must match ordered rows',
                code: 'RUNTIME_REORDER_VERSION_MAP_MISMATCH',
                details: {
                    missingVersionRows: [reorderedRowIdB],
                    extraVersionRows: [runtimeRowId]
                }
            })
            expect(
                (dataSource.manager.query as jest.Mock).mock.calls.some((call) =>
                    String(call[0]).includes('FROM "app_runtime_test"._app_objects')
                )
            ).toBe(false)
        })

        it('keeps application member role read-only for runtime content mutations', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                workspacesEnabled: false
            })

            const app = buildApp(dataSource)

            await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    data: { title: 'Member-created row' }
                })
                .expect(403)

            await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/copy`)
                .send({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(403)

            await request(app)
                .patch(`/applications/${runtimeApplicationId}/runtime/${runtimeRowId}`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    field: 'title',
                    value: 'Member edit'
                })
                .expect(403)

            await request(app)
                .delete(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .query({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(403)

            expect(dataSource.manager.query).not.toHaveBeenCalled()
        })

        it('rejects inline PATCH before touching runtime tables when edit permissions are unavailable', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const originalEditPermission = ROLE_PERMISSIONS.editor.editContent

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

            ROLE_PERMISSIONS.editor.editContent = false

            try {
                const app = buildApp(dataSource)
                const response = await request(app)
                    .patch(`/applications/${runtimeApplicationId}/runtime/${runtimeRowId}`)
                    .send({
                        objectCollectionId: runtimeLinkedCollectionId,
                        field: 'title',
                        value: 'Updated title'
                    })
                    .expect(403)

                expect(response.body).toEqual({ error: 'Insufficient permissions for this action' })
                expect(dataSource.manager.query).not.toHaveBeenCalled()
            } finally {
                ROLE_PERMISSIONS.editor.editContent = originalEditPermission
            }
        })

        it('allows editor role to create a parent runtime row because create is governed by create permissions', async () => {
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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [{ id: runtimeLinkedCollectionId, codename: 'orders', table_name: 'orders', config: null }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    data: {}
                })
                .expect(201)

            expect(response.body).toEqual({ id: runtimeRowId, status: 'created' })
        })

        it('revalidates parent-derived edit access inside the create transaction', async () => {
            const courseObjectId = '018f8a78-7b8f-7c1d-a111-2222333345d1'
            const accessObjectId = '018f8a78-7b8f-7c1d-a111-2222333345d2'
            const targetCourseId = '018f8a78-7b8f-7c1d-a111-2222333345d3'
            const { dataSource, txExecutor, applicationRepo, applicationUserRepo } = buildDataSource()
            let inTransaction = false

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
            ;(dataSource.transaction as jest.Mock).mockImplementation(async (callback: (tx: typeof txExecutor) => Promise<unknown>) => {
                inTransaction = true
                try {
                    return await callback(txExecutor)
                } finally {
                    inTransaction = false
                }
            })
            ;(txExecutor.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'Courses') {
                        return [
                            {
                                id: courseObjectId,
                                codename: 'Courses',
                                table_name: 'courses',
                                config: buildOwnerOrSharedRuntimeConfig()
                            }
                        ]
                    }
                    if (params?.[0] === 'ContentAccessEntries') {
                        return [
                            {
                                id: accessObjectId,
                                codename: 'ContentAccessEntries',
                                table_name: 'content_access_entries',
                                config: null
                            }
                        ]
                    }
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'CourseItems',
                            table_name: 'course_items',
                            config: {
                                runtimeRecordParentAccess: {
                                    mode: 'parentRecord',
                                    parentObjectCodename: 'Courses',
                                    parentFieldCodename: 'CourseId'
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    if (params?.[0] === runtimeLinkedCollectionId) {
                        return [
                            {
                                id: 'course-ref',
                                codename: 'CourseId',
                                column_name: 'course_id',
                                data_type: 'REF',
                                target_object_id: courseObjectId,
                                target_object_kind: 'object',
                                is_required: true,
                                validation_rules: {}
                            },
                            {
                                id: 'title',
                                codename: 'Title',
                                column_name: 'title',
                                data_type: 'STRING',
                                is_required: false,
                                validation_rules: {}
                            }
                        ]
                    }
                    if (params?.[0] === accessObjectId) return runtimeAccessEntryComponents
                    return []
                }
                if (sql.includes('FROM "app_runtime_test"."courses"')) {
                    return params?.[0] === targetCourseId && !inTransaction ? [{ id: targetCourseId }] : []
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."course_items"')) {
                    throw new Error('Create must not insert when parent edit access disappears inside the transaction')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    data: {
                        CourseId: targetCourseId,
                        Title: 'Transactional access proof'
                    }
                })
                .expect(400)

            expect(response.body).toEqual({ error: 'Parent record is not editable for CourseId' })
            expect(dataSource.transaction).toHaveBeenCalledTimes(1)
            expect(
                (txExecutor.query as jest.Mock).mock.calls.some((call) =>
                    String(call[0]).includes('INSERT INTO "app_runtime_test"."course_items"')
                )
            ).toBe(false)
        })

        it('rejects metadata-configured access entry creation outside an active workspace', async () => {
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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'ContentAccessEntries',
                            table_name: 'content_access_entries',
                            config: {
                                runtimeAccessEntry: {
                                    principalTypeFieldCodename: 'PrincipalType',
                                    principalIdFieldCodename: 'PrincipalId',
                                    supportedPrincipalTypes: ['workspaceMember', 'user']
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: 'principal-type',
                            codename: 'PrincipalType',
                            column_name: 'principal_type',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: null
                        },
                        {
                            id: 'principal-id',
                            codename: 'PrincipalId',
                            column_name: 'principal_id',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: null
                        }
                    ]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."content_access_entries"')) {
                    throw new Error('Access entry insert should not run without an active workspace')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    data: {
                        PrincipalType: 'workspaceMember',
                        PrincipalId: '018f8a78-7b8f-7c1d-a111-222233334499'
                    }
                })
                .expect(400)

            expect(response.body).toEqual({ error: 'Access entries require an active workspace' })
            expect(dataSource.manager.query).not.toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO "app_runtime_test"."content_access_entries"'),
                expect.any(Array)
            )
        })

        it('rejects metadata-configured access entry copy outside an active workspace', async () => {
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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'ContentAccessEntries',
                            table_name: 'content_access_entries',
                            config: {
                                runtimeAccessEntry: {
                                    principalTypeFieldCodename: 'PrincipalType',
                                    principalIdFieldCodename: 'PrincipalId',
                                    supportedPrincipalTypes: ['workspaceMember', 'user']
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: 'principal-type',
                            codename: 'PrincipalType',
                            column_name: 'principal_type',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: null
                        },
                        {
                            id: 'principal-id',
                            codename: 'PrincipalId',
                            column_name: 'principal_id',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: null
                        }
                    ]
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."content_access_entries"')) {
                    return [
                        {
                            id: runtimeRowId,
                            principal_type: 'workspaceMember',
                            principal_id: '018f8a78-7b8f-7c1d-a111-222233334499',
                            _upl_locked: false,
                            _upl_version: 1
                        }
                    ]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."content_access_entries"')) {
                    throw new Error('Access entry copy insert should not run without an active workspace')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/copy`)
                .send({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(400)

            expect(response.body).toEqual({ error: 'Access entries require an active workspace' })
            expect(dataSource.manager.query).not.toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO "app_runtime_test"."content_access_entries"'),
                expect.any(Array)
            )
        })

        it('rejects direct enrollment creation without create permissions before touching runtime metadata', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                workspacesEnabled: false
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    data: {
                        EnrolledAt: '2026-05-20T00:00:00.000Z',
                        DueDate: '2026-05-30T00:00:00.000Z',
                        TargetType: 'course',
                        TargetId: runtimeRowId
                    }
                })
                .expect(403)

            expect(response.body).toEqual({ error: 'Insufficient permissions for this action' })
            expect(dataSource.manager.query).not.toHaveBeenCalled()
        })

        it('rejects enrollment creation when DueDate is before EnrolledAt', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const enrollmentConfig = {
                runtimeValidations: {
                    dateOrder: [
                        {
                            startField: 'EnrolledAt',
                            endField: 'DueDate',
                            allowEqual: true
                        }
                    ]
                }
            }

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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'Enrollments',
                            table_name: 'enrollments',
                            config: enrollmentConfig
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                            codename: 'EnrolledAt',
                            column_name: 'enrolled_at',
                            data_type: 'DATE',
                            is_required: true,
                            validation_rules: null,
                            target_object_id: null,
                            target_object_kind: null,
                            ui_config: null
                        },
                        {
                            id: '018f8a78-7b8f-7c1d-a111-2222333344a2',
                            codename: 'DueDate',
                            column_name: 'due_date',
                            data_type: 'DATE',
                            is_required: false,
                            validation_rules: null,
                            target_object_id: null,
                            target_object_kind: null,
                            ui_config: null
                        }
                    ]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."enrollments"')) {
                    throw new Error('Enrollment insert should not run after date validation failure')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    data: {
                        EnrolledAt: '2026-05-20T00:00:00.000Z',
                        DueDate: '2026-05-19T23:59:59.000Z'
                    }
                })
                .expect(400)

            expect(response.body).toEqual({ error: 'Invalid date order: DueDate must be on or after EnrolledAt' })
            expect(dataSource.manager.query).not.toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO "app_runtime_test"."enrollments"'),
                expect.any(Array)
            )
        })

        it('rejects enrollment creation when a conditional due-date field is missing', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const enrollmentConfig = {
                runtimeValidations: {
                    requiredWhen: [
                        {
                            field: 'DueDate',
                            when: { field: 'DueDateMode', equals: 'ByDate' }
                        }
                    ]
                }
            }

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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'Enrollments',
                            table_name: 'enrollments',
                            config: enrollmentConfig
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-2222333344a3',
                            codename: 'DueDateMode',
                            column_name: 'due_date_mode',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: null,
                            target_object_id: null,
                            target_object_kind: null,
                            ui_config: null
                        },
                        {
                            id: '018f8a78-7b8f-7c1d-a111-2222333344a4',
                            codename: 'DueDate',
                            column_name: 'due_date',
                            data_type: 'DATE',
                            is_required: false,
                            validation_rules: null,
                            target_object_id: null,
                            target_object_kind: null,
                            ui_config: null
                        }
                    ]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."enrollments"')) {
                    throw new Error('Enrollment insert should not run after requiredWhen validation failure')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    data: {
                        DueDateMode: 'ByDate'
                    }
                })
                .expect(400)

            expect(response.body).toEqual({ error: 'Required field missing: DueDate is required when DueDateMode matches' })
            expect(dataSource.manager.query).not.toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO "app_runtime_test"."enrollments"'),
                expect.any(Array)
            )
        })

        it('derives enrollment due dates from metadata-defined period rules before insert', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const enrollmentConfig = {
                runtimeValidations: {
                    requiredWhen: [
                        {
                            field: 'DuePeriodDays',
                            when: { field: 'DueDateMode', equals: 'ForPeriod' }
                        }
                    ],
                    dateOrder: [
                        {
                            startField: 'EnrolledAt',
                            endField: 'DueDate',
                            allowEqual: true
                        }
                    ]
                },
                runtimeDerivations: {
                    dateOffset: [
                        {
                            targetField: 'DueDate',
                            startField: 'EnrolledAt',
                            offsetDaysField: 'DuePeriodDays',
                            when: { field: 'DueDateMode', equals: 'ForPeriod' },
                            clearWhen: { field: 'DueDateMode', equals: 'NoDueDate' }
                        }
                    ]
                }
            }

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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'Enrollments',
                            table_name: 'enrollments',
                            config: enrollmentConfig
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-2222333344b1',
                            codename: 'EnrolledAt',
                            column_name: 'enrolled_at',
                            data_type: 'DATE',
                            is_required: true,
                            validation_rules: null,
                            target_object_id: null,
                            target_object_kind: null,
                            ui_config: null
                        },
                        {
                            id: '018f8a78-7b8f-7c1d-a111-2222333344b2',
                            codename: 'DueDateMode',
                            column_name: 'due_date_mode',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: null,
                            target_object_id: null,
                            target_object_kind: null,
                            ui_config: null
                        },
                        {
                            id: '018f8a78-7b8f-7c1d-a111-2222333344b3',
                            codename: 'DuePeriodDays',
                            column_name: 'due_period_days',
                            data_type: 'NUMBER',
                            is_required: false,
                            validation_rules: null,
                            target_object_id: null,
                            target_object_kind: null,
                            ui_config: null
                        },
                        {
                            id: '018f8a78-7b8f-7c1d-a111-2222333344b4',
                            codename: 'DueDate',
                            column_name: 'due_date',
                            data_type: 'DATE',
                            is_required: false,
                            validation_rules: null,
                            target_object_id: null,
                            target_object_kind: null,
                            ui_config: null
                        }
                    ]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."enrollments"')) {
                    return [{ id: runtimeRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    data: {
                        EnrolledAt: '2026-03-28',
                        DueDateMode: 'ForPeriod',
                        DuePeriodDays: 2
                    }
                })
                .expect(201)

            const insertCall = (dataSource.manager.query as jest.Mock).mock.calls.find(([sql]) =>
                String(sql).includes('INSERT INTO "app_runtime_test"."enrollments"')
            )
            expect(insertCall?.[1]).toEqual(expect.arrayContaining(['2026-03-30']))
        })

        it('rejects enrollment due-date updates that would move DueDate before EnrolledAt', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const enrollmentConfig = {
                runtimeValidations: {
                    dateOrder: [
                        {
                            startField: 'EnrolledAt',
                            endField: 'DueDate',
                            allowEqual: true
                        }
                    ]
                }
            }

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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'Enrollments',
                            table_name: 'enrollments',
                            config: enrollmentConfig
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                            codename: 'EnrolledAt',
                            column_name: 'enrolled_at',
                            data_type: 'DATE',
                            is_required: true,
                            validation_rules: null,
                            target_object_id: null,
                            target_object_kind: null,
                            ui_config: null
                        },
                        {
                            id: '018f8a78-7b8f-7c1d-a111-2222333344a2',
                            codename: 'DueDate',
                            column_name: 'due_date',
                            data_type: 'DATE',
                            is_required: false,
                            validation_rules: null,
                            target_object_id: null,
                            target_object_kind: null,
                            ui_config: null
                        }
                    ]
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."enrollments"')) {
                    return [
                        {
                            id: runtimeRowId,
                            enrolled_at: '2026-05-20T00:00:00.000Z',
                            due_date: '2026-05-30T00:00:00.000Z'
                        }
                    ]
                }
                if (sql.includes('UPDATE "app_runtime_test"."enrollments"')) {
                    throw new Error('Enrollment update should not run after date validation failure')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .patch(`/applications/${runtimeApplicationId}/runtime/${runtimeRowId}`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    field: 'due_date',
                    value: '2026-05-19T23:59:59.000Z'
                })
                .expect(400)

            expect(response.body).toEqual({ error: 'Invalid date order: DueDate must be on or after EnrolledAt' })
            expect(dataSource.manager.query).not.toHaveBeenCalledWith(
                expect.stringContaining('UPDATE "app_runtime_test"."enrollments"'),
                expect.any(Array)
            )
        })

        it('rejects metadata runtime record picker references to unsupported target objects', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const targetRecordId = '018f8a78-7b8f-7c1d-a111-222233334476'

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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            kind: 'object',
                            codename: 'CourseItems',
                            table_name: 'course_items',
                            config: null
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334477',
                            codename: 'TargetObjectCodename',
                            column_name: 'target_object_codename',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: { maxLength: 128 },
                            ui_config: null
                        },
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334478',
                            codename: 'TargetRecordId',
                            column_name: 'target_record_id',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: { maxLength: 128 },
                            ui_config: {
                                widget: 'runtimeRecordPicker',
                                runtimeRecordPicker: {
                                    targetObjectCodenameField: 'TargetObjectCodename',
                                    allowedObjectCodenames: ['LearningResources']
                                }
                            }
                        }
                    ]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    data: {
                        TargetObjectCodename: 'ContentProjects',
                        TargetRecordId: targetRecordId
                    }
                })
                .expect(400)

            expect(response.body).toEqual({ error: 'Unsupported target object for TargetRecordId' })
            expect((dataSource.manager.query as jest.Mock).mock.calls.some((call) => String(call[0]).includes('INSERT INTO'))).toBe(false)
        })

        it('rejects metadata runtime record picker references to missing target rows', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const targetRecordId = '018f8a78-7b8f-7c1d-a111-222233334479'

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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'LearningResources') {
                        return [
                            {
                                id: '018f8a78-7b8f-7c1d-a111-22223333447a',
                                kind: 'object',
                                codename: 'LearningResources',
                                table_name: 'learning_resources',
                                config: null
                            }
                        ]
                    }
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            kind: 'object',
                            codename: 'CourseItems',
                            table_name: 'course_items',
                            config: null
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-22223333447b',
                            codename: 'TargetObjectCodename',
                            column_name: 'target_object_codename',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: { maxLength: 128 },
                            ui_config: null
                        },
                        {
                            id: '018f8a78-7b8f-7c1d-a111-22223333447c',
                            codename: 'TargetRecordId',
                            column_name: 'target_record_id',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: { maxLength: 128 },
                            ui_config: {
                                widget: 'runtimeRecordPicker',
                                runtimeRecordPicker: {
                                    targetObjectCodenameField: 'TargetObjectCodename',
                                    allowedObjectCodenames: ['LearningResources']
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."learning_resources"')) {
                    return []
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    data: {
                        TargetObjectCodename: 'LearningResources',
                        TargetRecordId: targetRecordId
                    }
                })
                .expect(400)

            expect(response.body).toEqual({ error: 'Target record not found for TargetRecordId' })
            expect((dataSource.manager.query as jest.Mock).mock.calls.some((call) => String(call[0]).includes('INSERT INTO'))).toBe(false)
        })

        it('applies owner-or-shared access before copying a runtime row by id', async () => {
            const accessObjectId = '018f8a78-7b8f-7c1d-a111-22223333447b'
            const sourceQueries: Array<{ sql: string; params?: unknown[] }> = []
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                workspacesEnabled: false,
                settings: {
                    rolePolicies: {
                        templates: [
                            {
                                codename: 'memberPolicy',
                                title: { en: 'Member permissions' },
                                rules: [{ capability: 'records.create', effect: 'allow', scope: 'workspace' }]
                            }
                        ]
                    }
                }
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'ContentAccessEntries') {
                        return [
                            {
                                id: accessObjectId,
                                codename: 'ContentAccessEntries',
                                table_name: 'content_access_entries',
                                config: null
                            }
                        ]
                    }
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'LearningResources',
                            table_name: 'learning_resources',
                            config: buildOwnerOrSharedRuntimeConfig()
                        },
                        {
                            id: accessObjectId,
                            codename: 'ContentAccessEntries',
                            table_name: 'content_access_entries',
                            config: null
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    if (params?.[0] === accessObjectId) return runtimeAccessEntryComponents
                    return [{ id: 'title', codename: 'Title', column_name: 'title', data_type: 'STRING' }]
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."learning_resources"')) {
                    sourceQueries.push({ sql, params })
                    return []
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/copy`)
                .send({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(404)

            expect(response.body).toEqual({ error: 'Row not found' })
            expect(sourceQueries).toHaveLength(1)
            expect(sourceQueries[0]?.sql).toContain('"_upl_created_by" = $2')
            expect(sourceQueries[0]?.sql).toContain('rel."target_record_id"::text = "app_runtime_test"."learning_resources".id::text')
            expect(sourceQueries[0]?.params).toEqual([
                runtimeRowId,
                'test-user-id',
                'LearningResources',
                'test-user-id',
                ['workspaceMember', 'user']
            ])
        })

        it('rejects copy overrides that move child rows under a parent without edit access', async () => {
            const courseObjectId = '018f8a78-7b8f-7c1d-a111-2222333344d1'
            const accessObjectId = '018f8a78-7b8f-7c1d-a111-2222333344d2'
            const sourceCourseId = '018f8a78-7b8f-7c1d-a111-2222333344d3'
            const targetCourseId = '018f8a78-7b8f-7c1d-a111-2222333344d4'
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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'Courses') {
                        return [
                            {
                                id: courseObjectId,
                                codename: 'Courses',
                                table_name: 'courses',
                                config: buildOwnerOrSharedRuntimeConfig()
                            }
                        ]
                    }
                    if (params?.[0] === 'ContentAccessEntries') {
                        return [
                            {
                                id: accessObjectId,
                                codename: 'ContentAccessEntries',
                                table_name: 'content_access_entries',
                                config: null
                            }
                        ]
                    }
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'CourseItems',
                            table_name: 'course_items',
                            config: {
                                runtimeRecordParentAccess: {
                                    mode: 'parentRecord',
                                    parentObjectCodename: 'Courses',
                                    parentFieldCodename: 'CourseId'
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    if (params?.[0] === runtimeLinkedCollectionId) {
                        return [
                            {
                                id: 'course-ref',
                                codename: 'CourseId',
                                column_name: 'course_id',
                                data_type: 'REF',
                                target_object_id: courseObjectId,
                                target_object_kind: 'object',
                                is_required: true,
                                validation_rules: {}
                            },
                            {
                                id: 'title',
                                codename: 'Title',
                                column_name: 'title',
                                data_type: 'STRING',
                                is_required: false,
                                validation_rules: {}
                            }
                        ]
                    }
                    if (params?.[0] === accessObjectId) return runtimeAccessEntryComponents
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."course_items"')) {
                    return [{ id: runtimeRowId, course_id: sourceCourseId, title: 'Original item', _upl_locked: false, _upl_version: 1 }]
                }
                if (sql.includes('FROM "app_runtime_test"."courses"')) {
                    return params?.[0] === sourceCourseId ? [{ id: sourceCourseId }] : []
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."course_items"')) {
                    throw new Error('Copy must not insert a child row under an unauthorized parent')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/copy`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    data: { CourseId: targetCourseId }
                })
                .expect(400)

            expect(response.body).toEqual({ error: 'Parent record is not editable for CourseId' })
            expect(
                (dataSource.manager.query as jest.Mock).mock.calls.some((call) =>
                    String(call[0]).includes('INSERT INTO "app_runtime_test"."course_items"')
                )
            ).toBe(false)
        })

        it('allows editor role to copy a parent runtime row because copy is governed by create permissions', async () => {
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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [{ id: runtimeLinkedCollectionId, codename: 'orders', table_name: 'orders', config: null }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes('FROM "app_runtime_test"."orders"')) {
                    if (Array.isArray(params) && params[0] === runtimeRowId) {
                        return [{ id: runtimeRowId, title: 'Source row', _upl_locked: false }]
                    }
                    return []
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."orders"')) {
                    return [{ id: copiedRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/copy`)
                .send({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(201)

            expect(response.body).toEqual({
                id: copiedRowId,
                status: 'created',
                copyOptions: { copyChildTables: true },
                hasRequiredChildTables: false
            })
        })

        it('copies TABLE child rows with declared child data type and validation metadata', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const tableComponentId = '018f8a78-7b8f-7c1d-a111-222233334476'

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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [{ id: runtimeLinkedCollectionId, codename: 'orders', table_name: 'orders', config: null }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === tableComponentId) {
                    expect(sql).toContain('data_type')
                    expect(sql).toContain('validation_rules')
                    return [
                        {
                            codename: 'Body',
                            column_name: 'body',
                            data_type: 'STRING',
                            validation_rules: { localized: true, versioned: true }
                        },
                        {
                            codename: 'Payload',
                            column_name: 'payload',
                            data_type: 'JSON',
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: 'attr-title',
                            codename: 'Title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: false,
                            validation_rules: {}
                        },
                        {
                            id: tableComponentId,
                            codename: 'ContentItems',
                            column_name: 'content_items',
                            data_type: 'TABLE',
                            is_required: false,
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."orders"')) {
                    if (Array.isArray(params) && params[0] === runtimeRowId) {
                        return [{ id: runtimeRowId, title: 'Source row', _upl_locked: false }]
                    }
                    if (Array.isArray(params) && params[0] === copiedRowId) {
                        return [{ id: copiedRowId, title: 'Source row', _upl_locked: false }]
                    }
                    return []
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."orders"')) {
                    return [{ id: copiedRowId }]
                }
                if (sql.includes('FROM "app_runtime_test"."content_items"')) {
                    return [
                        {
                            body: { _primary: 'en', locales: { en: { content: 'Intro', version: 1, isActive: true } } },
                            payload: { duration: 5 },
                            _tp_sort_order: 0
                        }
                    ]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."content_items"')) {
                    return []
                }
                return []
            })

            const app = buildApp(dataSource)
            await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/copy`)
                .send({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(201)

            const childInsertCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('INSERT INTO "app_runtime_test"."content_items"')
            )

            expect(childInsertCall).toBeDefined()
            expect(childInsertCall?.[1]).toEqual([
                copiedRowId,
                0,
                'test-user-id',
                JSON.stringify({ _primary: 'en', locales: { en: { content: 'Intro', version: 1, isActive: true } } }),
                JSON.stringify({ duration: 5 })
            ])
        })

        it('dispatches beforeCopy inside the transaction and afterCopy after commit', async () => {
            const { dataSource, applicationRepo, applicationUserRepo, txExecutor } = buildDataSource()
            const dispatchLifecycleEventSpy = jest
                .spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent')
                .mockResolvedValue(undefined)

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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [{ id: runtimeLinkedCollectionId, codename: 'orders', table_name: 'orders', config: null }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes('FROM "app_runtime_test"."orders"')) {
                    if (Array.isArray(params) && params[0] === runtimeRowId) {
                        return [{ id: runtimeRowId, title: 'Source row', _upl_locked: false }]
                    }
                    if (Array.isArray(params) && params[0] === copiedRowId) {
                        return [{ id: copiedRowId, title: 'Source row (copy)', _upl_locked: false }]
                    }
                    return []
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."orders"')) {
                    return [{ id: copiedRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/copy`)
                .send({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(201)

            expect(response.body).toEqual({
                id: copiedRowId,
                status: 'created',
                copyOptions: { copyChildTables: true },
                hasRequiredChildTables: false
            })
            expect(dispatchLifecycleEventSpy).toHaveBeenCalledTimes(2)
            expect(dispatchLifecycleEventSpy).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    executor: txExecutor,
                    payload: expect.objectContaining({
                        eventName: 'beforeCopy',
                        previousRow: expect.objectContaining({ id: runtimeRowId }),
                        metadata: { copyChildTables: true }
                    })
                })
            )
            expect(dispatchLifecycleEventSpy).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    executor: dataSource,
                    payload: expect.objectContaining({
                        eventName: 'afterCopy',
                        previousRow: expect.objectContaining({ id: runtimeRowId }),
                        row: expect.objectContaining({ id: copiedRowId }),
                        metadata: { copyChildTables: true }
                    })
                })
            )
        })

        it('copies through the runtime copy endpoint with optimistic version and data overrides', async () => {
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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [{ id: runtimeLinkedCollectionId, codename: 'orders', table_name: 'orders', config: null }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: 'attr-title',
                            codename: 'Title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."orders"')) {
                    if (Array.isArray(_params) && _params[0] === runtimeRowId) {
                        return [{ id: runtimeRowId, title: 'Source row', _upl_version: 5, _upl_locked: false }]
                    }
                    if (Array.isArray(_params) && _params[0] === copiedRowId) {
                        return [{ id: copiedRowId, title: 'Copied row', _upl_version: 1, _upl_locked: false }]
                    }
                    return []
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."orders"')) {
                    return [{ id: copiedRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/copy`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    expectedVersion: 5,
                    data: { Title: 'Copied row' }
                })
                .expect(201)

            expect(response.body).toMatchObject({
                id: copiedRowId,
                status: 'created'
            })
            const insertCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('INSERT INTO "app_runtime_test"."orders"')
            )
            expect(insertCall?.[1]).toEqual(['Copied row', 'test-user-id'])
        })

        it('rejects stale-version runtime copy before mutating the runtime table', async () => {
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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [{ id: runtimeLinkedCollectionId, codename: 'orders', table_name: 'orders', config: null }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: 'attr-title',
                            codename: 'Title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId, title: 'Source row', _upl_version: 5, _upl_locked: false }]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."orders"')) {
                    throw new Error('Copy insert should not run when expectedVersion is stale')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/copy`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    expectedVersion: 4,
                    data: { Title: 'Copied row' }
                })
                .expect(409)

            expect(response.body).toEqual({
                error: 'Version mismatch',
                expectedVersion: 4,
                actualVersion: 5
            })
        })

        it('rejects TABLE overrides during runtime copy instead of silently discarding user input', async () => {
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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [{ id: runtimeLinkedCollectionId, codename: 'orders', table_name: 'orders', config: null }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: 'attr-title',
                            codename: 'Title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: {}
                        },
                        {
                            id: 'attr-lines',
                            codename: 'Lines',
                            column_name: 'lines',
                            data_type: 'TABLE',
                            is_required: false,
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."orders"')) {
                    return [{ id: runtimeRowId, title: 'Source row', _upl_locked: false }]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."orders"')) {
                    throw new Error('Copy insert should not run when TABLE override is provided')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/copy`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    data: { Lines: [{ Title: 'Mutated line' }] }
                })
                .expect(400)

            expect(response.body).toEqual({
                error: 'TABLE overrides are not supported during copy: Lines'
            })
        })

        it('ignores empty TABLE form echoes during runtime copy while preserving copyChildTables semantics', async () => {
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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, _params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [{ id: runtimeLinkedCollectionId, codename: 'orders', table_name: 'orders', config: null }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: 'attr-title',
                            codename: 'Title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: {}
                        },
                        {
                            id: 'attr-lines',
                            codename: 'Lines',
                            column_name: 'lines',
                            data_type: 'TABLE',
                            is_required: false,
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."orders"')) {
                    if (Array.isArray(_params) && _params[0] === runtimeRowId) {
                        return [{ id: runtimeRowId, title: 'Source row', _upl_version: 3, _upl_locked: false }]
                    }
                    if (Array.isArray(_params) && _params[0] === copiedRowId) {
                        return [{ id: copiedRowId, title: 'Copied row', _upl_version: 1, _upl_locked: false }]
                    }
                    return []
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."orders"')) {
                    return [{ id: copiedRowId }]
                }
                if (sql.includes('"app_runtime_test"."lines"')) {
                    throw new Error('Child table copy should follow copyChildTables=false')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/copy`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    copyChildTables: false,
                    data: { Title: 'Copied row', Lines: [] }
                })
                .expect(201)

            expect(response.body).toMatchObject({
                id: copiedRowId,
                status: 'created',
                copyOptions: { copyChildTables: false },
                hasRequiredChildTables: false
            })
            const insertCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('INSERT INTO "app_runtime_test"."orders"')
            )
            expect(insertCall?.[1]).toEqual(['Copied row', 'test-user-id'])
        })

        it('copies metadata-configured course outline relations without copying enrollments or progress rows', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const sourceCourseId = runtimeRowId
            const copiedCourseId = copiedRowId
            const sourceSectionId = '018f8a78-7b8f-7c1d-a111-222233334481'
            const copiedSectionId = '018f8a78-7b8f-7c1d-a111-222233334482'
            const sourceItemId = '018f8a78-7b8f-7c1d-a111-222233334483'
            const copiedItemId = '018f8a78-7b8f-7c1d-a111-222233334484'
            const targetResourceId = '018f8a78-7b8f-7c1d-a111-222233334485'

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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'CourseSections') {
                        return [
                            {
                                id: 'course-sections-object-id',
                                codename: 'CourseSections',
                                kind: 'object',
                                table_name: 'course_sections',
                                config: null
                            }
                        ]
                    }
                    if (params?.[0] === 'CourseItems') {
                        return [
                            {
                                id: 'course-items-object-id',
                                codename: 'CourseItems',
                                kind: 'object',
                                table_name: 'course_items',
                                config: null
                            }
                        ]
                    }
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'Courses',
                            kind: 'object',
                            table_name: 'courses',
                            config: {
                                runtimeCopy: {
                                    relations: [
                                        {
                                            objectCodename: 'CourseSections',
                                            parentFieldCodename: 'CourseId',
                                            orderFieldCodename: 'SortOrder'
                                        },
                                        {
                                            objectCodename: 'CourseItems',
                                            parentFieldCodename: 'CourseId',
                                            orderFieldCodename: 'SortOrder',
                                            refRemaps: [
                                                {
                                                    fieldCodename: 'SectionId',
                                                    sourceObjectCodename: 'CourseSections'
                                                }
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === runtimeLinkedCollectionId) {
                    return [
                        {
                            id: 'course-title-attr',
                            codename: 'Title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === 'course-sections-object-id') {
                    return [
                        {
                            id: 'section-course-attr',
                            codename: 'CourseId',
                            column_name: 'course_id',
                            data_type: 'REF',
                            is_required: true,
                            validation_rules: {}
                        },
                        {
                            id: 'section-title-attr',
                            codename: 'Title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: {}
                        },
                        {
                            id: 'section-order-attr',
                            codename: 'SortOrder',
                            column_name: 'sort_order',
                            data_type: 'NUMBER',
                            is_required: false,
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components') && params?.[0] === 'course-items-object-id') {
                    return [
                        {
                            id: 'item-course-attr',
                            codename: 'CourseId',
                            column_name: 'course_id',
                            data_type: 'REF',
                            is_required: true,
                            validation_rules: {}
                        },
                        {
                            id: 'item-section-attr',
                            codename: 'SectionId',
                            column_name: 'section_id',
                            data_type: 'REF',
                            is_required: false,
                            validation_rules: {}
                        },
                        {
                            id: 'item-title-attr',
                            codename: 'Title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: {}
                        },
                        {
                            id: 'item-target-object-attr',
                            codename: 'TargetObjectCodename',
                            column_name: 'target_object_codename',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: {}
                        },
                        {
                            id: 'item-target-record-attr',
                            codename: 'TargetRecordId',
                            column_name: 'target_record_id',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: {}
                        },
                        {
                            id: 'item-order-attr',
                            codename: 'SortOrder',
                            column_name: 'sort_order',
                            data_type: 'NUMBER',
                            is_required: false,
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"."courses"')) {
                    if (params?.[0] === sourceCourseId) {
                        return [{ id: sourceCourseId, title: 'Safety course', _upl_locked: false }]
                    }
                    if (params?.[0] === copiedCourseId) {
                        return [{ id: copiedCourseId, title: 'Safety course', _upl_locked: false }]
                    }
                    return []
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."courses"')) {
                    return [{ id: copiedCourseId }]
                }
                if (sql.includes('FROM "app_runtime_test"."course_sections"')) {
                    return [{ id: sourceSectionId, course_id: sourceCourseId, title: 'Introduction', sort_order: 1 }]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."course_sections"')) {
                    return [{ id: copiedSectionId }]
                }
                if (sql.includes('FROM "app_runtime_test"."course_items"')) {
                    return [
                        {
                            id: sourceItemId,
                            course_id: sourceCourseId,
                            section_id: sourceSectionId,
                            title: 'Start here',
                            target_object_codename: 'LearningResources',
                            target_record_id: targetResourceId,
                            sort_order: 1
                        }
                    ]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."course_items"')) {
                    return [{ id: copiedItemId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${sourceCourseId}/copy`)
                .send({ objectCollectionId: runtimeLinkedCollectionId, copyChildTables: false })
                .expect(201)

            expect(response.body).toEqual({
                id: copiedCourseId,
                status: 'created',
                copyOptions: { copyChildTables: false },
                hasRequiredChildTables: false
            })
            const sectionInsertCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('INSERT INTO "app_runtime_test"."course_sections"')
            )
            expect(sectionInsertCall?.[1]).toEqual([copiedCourseId, 'Introduction', 1, 'test-user-id'])

            const itemInsertCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('INSERT INTO "app_runtime_test"."course_items"')
            )
            expect(itemInsertCall?.[1]).toEqual([
                copiedCourseId,
                copiedSectionId,
                'Start here',
                'LearningResources',
                targetResourceId,
                1,
                'test-user-id'
            ])
            expect(
                (dataSource.manager.query as jest.Mock).mock.calls.some((call) =>
                    /"app_runtime_test"\."(enrollments|content_progress|progress_ledger)"/.test(String(call[0]))
                )
            ).toBe(false)
        })

        it('allows editor role to persist runtime row reorder when the object enables it', async () => {
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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('information_schema.tables')) {
                    return [{ exists: true }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'orders',
                            table_name: 'orders'
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_layouts')) {
                    return [
                        {
                            id: 'layout-orders',
                            config: {
                                objectBehavior: {
                                    enableRowReordering: true,
                                    reorderPersistenceField: 'SortOrder'
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: 'attr-sort-order',
                            codename: {
                                _primary: 'en',
                                locales: {
                                    en: { content: 'SortOrder' }
                                }
                            },
                            column_name: 'cmp_sort_order',
                            data_type: 'NUMBER',
                            is_required: false,
                            validation_rules: {},
                            ui_config: {}
                        }
                    ]
                }
                if (sql.includes('COUNT(*)::int AS total')) {
                    return [{ total: 2 }]
                }
                if (sql.includes('WHERE id = ANY($1::uuid[])')) {
                    return [
                        { id: reorderedRowIdA, _upl_version: 2, _upl_locked: false },
                        { id: reorderedRowIdB, _upl_version: 3, _upl_locked: false }
                    ]
                }
                if (sql.includes('UPDATE "app_runtime_test"."orders" AS target')) {
                    return [{ id: reorderedRowIdA }, { id: reorderedRowIdB }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/reorder`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    orderedRowIds: [reorderedRowIdA, reorderedRowIdB],
                    expectedVersionsByRowId: {
                        [reorderedRowIdA]: 2,
                        [reorderedRowIdB]: 3
                    }
                })
                .expect(200)

            expect(response.body).toEqual({ status: 'reordered' })
            const updateCall = (dataSource.manager.query as jest.Mock).mock.calls.find(([sql]) =>
                String(sql).includes('UPDATE "app_runtime_test"."orders" AS target')
            )
            expect(String(updateCall?.[0])).toContain('COALESCE(target._upl_locked, false) = false')
        })

        it('rejects persisted runtime row reorder when any selected row is locked', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            let matchedRowsQuery = ''
            let updateAttempted = false

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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('information_schema.tables')) {
                    return [{ exists: true }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'orders',
                            table_name: 'orders'
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_layouts')) {
                    return [
                        {
                            id: 'layout-orders',
                            config: {
                                objectBehavior: {
                                    enableRowReordering: true,
                                    reorderPersistenceField: 'SortOrder'
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: 'attr-sort-order',
                            codename: {
                                _primary: 'en',
                                locales: {
                                    en: { content: 'SortOrder' }
                                }
                            },
                            column_name: 'cmp_sort_order',
                            data_type: 'NUMBER',
                            is_required: false,
                            validation_rules: {},
                            ui_config: {}
                        }
                    ]
                }
                if (sql.includes('COUNT(*)::int AS total')) {
                    return [{ total: 2 }]
                }
                if (sql.includes('WHERE id = ANY($1::uuid[])')) {
                    matchedRowsQuery = sql
                    return [
                        { id: reorderedRowIdA, _upl_version: 2, _upl_locked: true },
                        { id: reorderedRowIdB, _upl_version: 3, _upl_locked: false }
                    ]
                }
                if (sql.includes('UPDATE "app_runtime_test"."orders" AS target')) {
                    updateAttempted = true
                    return [{ id: reorderedRowIdA }, { id: reorderedRowIdB }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/reorder`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    orderedRowIds: [reorderedRowIdA, reorderedRowIdB],
                    expectedVersionsByRowId: {
                        [reorderedRowIdA]: 2,
                        [reorderedRowIdB]: 3
                    }
                })
                .expect(423)

            expect(response.body).toMatchObject({ error: 'Record is locked' })
            expect(matchedRowsQuery).toContain('_upl_locked')
            expect(updateAttempted).toBe(false)
        })

        it('rejects stale runtime row reorder before persisting sort order', async () => {
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
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('information_schema.tables')) {
                    return [{ exists: true }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'orders',
                            table_name: 'orders'
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_layouts')) {
                    return [
                        {
                            id: 'layout-orders',
                            config: {
                                objectBehavior: {
                                    enableRowReordering: true,
                                    reorderPersistenceField: 'SortOrder'
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: 'attr-sort-order',
                            codename: {
                                _primary: 'en',
                                locales: {
                                    en: { content: 'SortOrder' }
                                }
                            },
                            column_name: 'cmp_sort_order',
                            data_type: 'NUMBER',
                            is_required: false,
                            validation_rules: {},
                            ui_config: {}
                        }
                    ]
                }
                if (sql.includes('COUNT(*)::int AS total')) {
                    return [{ total: 2 }]
                }
                if (sql.includes('WHERE id = ANY($1::uuid[])')) {
                    return [
                        { id: reorderedRowIdA, _upl_version: 9 },
                        { id: reorderedRowIdB, _upl_version: 3 }
                    ]
                }
                if (sql.includes('UPDATE "app_runtime_test"."orders" AS target')) {
                    throw new Error('Reorder update should not run when expectedVersion is stale')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/reorder`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    orderedRowIds: [reorderedRowIdA, reorderedRowIdB],
                    expectedVersionsByRowId: {
                        [reorderedRowIdA]: 2,
                        [reorderedRowIdB]: 3
                    }
                })
                .expect(409)

            expect(response.body).toMatchObject({
                code: 'RUNTIME_RECORD_VERSION_CONFLICT',
                expectedVersion: 2,
                actualVersion: 9
            })
        })
    })

    describe('Runtime record command contract', () => {
        const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334570'
        const runtimeLinkedCollectionId = '018f8a78-7b8f-7c1d-a111-222233334571'
        const runtimeRowId = '018f8a78-7b8f-7c1d-a111-222233334572'
        const runtimeComponentId = '018f8a78-7b8f-7c1d-a111-222233334573'
        const runtimeChildRowId = '018f8a78-7b8f-7c1d-a111-222233334574'

        const recordBehaviorConfig = {
            recordBehavior: {
                mode: 'transactional',
                numbering: {
                    enabled: true,
                    scope: 'workspace',
                    periodicity: 'none',
                    prefix: 'DOC-',
                    minLength: 4
                },
                effectiveDate: {
                    enabled: true,
                    defaultToNow: true
                },
                lifecycle: {
                    enabled: true,
                    states: []
                },
                posting: {
                    mode: 'manual',
                    targetLedgers: []
                },
                immutability: 'posted'
            }
        }
        const recordBehaviorWithLedgerConfig = {
            recordBehavior: {
                ...recordBehaviorConfig.recordBehavior,
                posting: {
                    mode: 'manual',
                    targetLedgers: ['ProgressLedger']
                }
            }
        }

        const mockRuntimeApplication = (
            applicationRepo: ReturnType<typeof buildDataSource>['applicationRepo'],
            applicationUserRepo: ReturnType<typeof buildDataSource>['applicationUserRepo'],
            role: 'owner' | 'admin' | 'editor' | 'member',
            workspacesEnabled = false,
            settings: Record<string, unknown> = {}
        ) => {
            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                workspacesEnabled,
                settings
            })
        }

        const mockRecordCatalogQueries = (
            dataSource: ReturnType<typeof buildDataSource>['dataSource'],
            previousRow: Record<string, unknown>,
            nextRow?: Record<string, unknown>
        ) => {
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            kind: 'object',
                            codename: 'documents',
                            table_name: 'documents',
                            config: recordBehaviorConfig
                        }
                    ]
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."documents"')) {
                    return [previousRow]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"._app_record_counters')) {
                    return [{ last_number: '7' }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."documents"')) {
                    return [
                        nextRow ?? {
                            ...previousRow,
                            _app_record_state: 'posted',
                            _app_record_number: previousRow._app_record_number ?? 'DOC-0007',
                            _app_posted_at: new Date('2026-05-08T00:00:00.000Z'),
                            _app_posting_batch_id: '018f8a78-7b8f-7c1d-a111-222233334575'
                        }
                    ]
                }
                return []
            })
        }

        it('runs configured workflow actions from trusted object metadata with optimistic locking', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const runtimeSchemaName = 'app_018f8a787b8f7c1da111222233334570'

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'member', false, {
                rolePolicies: {
                    templates: [
                        {
                            codename: 'memberPolicy',
                            title: { en: 'Member permissions' },
                            rules: [
                                { capability: 'records.edit', effect: 'allow', scope: 'workspace' },
                                { capability: 'assignment.review', effect: 'allow', scope: 'workspace' }
                            ]
                        }
                    ]
                }
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: runtimeSchemaName,
                workspacesEnabled: false,
                settings: {
                    rolePolicies: {
                        templates: [
                            {
                                codename: 'memberPolicy',
                                title: { en: 'Member permissions' },
                                rules: [
                                    { capability: 'records.edit', effect: 'allow', scope: 'workspace' },
                                    { capability: 'assignment.review', effect: 'allow', scope: 'workspace' }
                                ]
                            }
                        ]
                    }
                }
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_objects`)) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            kind: 'object',
                            codename: 'documents',
                            table_name: 'documents',
                            config: {
                                workflowActions: [
                                    {
                                        codename: 'AcceptSubmission',
                                        title: 'Accept submission',
                                        from: ['Submitted'],
                                        to: 'Accepted',
                                        statusFieldCodename: 'SubmissionStatus',
                                        requiredCapabilities: ['assignment.review']
                                    }
                                ]
                            }
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_components`)) {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334579',
                            codename: 'SubmissionStatus',
                            column_name: 'status',
                            data_type: 'STRING',
                            is_required: false,
                            validation_rules: {},
                            target_object_id: null,
                            target_object_kind: null,
                            ui_config: {}
                        }
                    ]
                }
                if (sql.includes('SELECT "id", "status", "_upl_version", "_upl_locked"')) {
                    return [
                        {
                            id: runtimeRowId,
                            status: 'Submitted',
                            _upl_version: 2,
                            _upl_locked: false
                        }
                    ]
                }
                if (sql.includes(`SELECT *`) && sql.includes(`FROM "${runtimeSchemaName}"."documents"`)) {
                    return [
                        {
                            id: runtimeRowId,
                            status: 'Submitted',
                            _upl_version: 2,
                            _upl_locked: false
                        }
                    ]
                }
                if (sql.includes(`UPDATE "${runtimeSchemaName}"."documents"`)) {
                    return [
                        {
                            id: runtimeRowId,
                            status: 'Accepted',
                            _upl_version: 3
                        }
                    ]
                }
                if (sql.includes(`INSERT INTO "${runtimeSchemaName}"."_app_workflow_action_audit"`)) {
                    return []
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/workflow/AcceptSubmission`)
                .send({ objectCollectionId: runtimeLinkedCollectionId, expectedVersion: 2 })
                .expect(200)

            expect(response.body).toMatchObject({
                id: runtimeRowId,
                actionCodename: 'AcceptSubmission',
                fromStatus: 'Submitted',
                toStatus: 'Accepted',
                version: 3
            })

            const updateCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes(`UPDATE "${runtimeSchemaName}"."documents"`)
            )
            expect(updateCall?.[1]).toEqual([runtimeRowId, 'Accepted', 'test-user-id', 2, ['Submitted']])
            const auditCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes(`INSERT INTO "${runtimeSchemaName}"."_app_workflow_action_audit"`)
            )
            expect(auditCall?.[1]).toEqual([
                runtimeLinkedCollectionId,
                'documents',
                runtimeRowId,
                null,
                'AcceptSubmission',
                'Submitted',
                'Accepted',
                null,
                JSON.stringify({ source: 'runtime.rows.workflowAction', applicationId: runtimeApplicationId }),
                'test-user-id'
            ])
        })

        it('runs configured workflow actions against REF enumeration status fields by status codename', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const runtimeSchemaName = 'app_018f8a787b8f7c1da111222233334570'
            const draftStatusId = '018f8a78-7b8f-7c1d-a111-222233334581'
            const publishedStatusId = '018f8a78-7b8f-7c1d-a111-222233334582'
            const publicationStatusEnumId = '018f8a78-7b8f-7c1d-a111-222233334583'

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'editor', false, {
                rolePolicies: {
                    templates: [
                        {
                            codename: 'editorPolicy',
                            title: { en: 'Editor permissions' },
                            rules: [{ capability: 'workflow.execute', effect: 'allow', scope: 'workspace' }]
                        }
                    ]
                }
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: runtimeSchemaName,
                workspacesEnabled: false,
                settings: {
                    rolePolicies: {
                        templates: [
                            {
                                codename: 'editorPolicy',
                                title: { en: 'Editor permissions' },
                                rules: [{ capability: 'workflow.execute', effect: 'allow', scope: 'workspace' }]
                            }
                        ]
                    }
                }
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_objects`)) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            kind: 'object',
                            codename: 'LearningResources',
                            table_name: 'learning_resources',
                            config: {
                                workflowActions: [
                                    {
                                        codename: 'PublishLearningResource',
                                        title: 'Publish',
                                        from: ['Draft'],
                                        to: 'Published',
                                        statusFieldCodename: 'PublicationStatus',
                                        requiredCapabilities: ['workflow.execute']
                                    }
                                ]
                            }
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_components`)) {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334584',
                            codename: 'PublicationStatus',
                            column_name: 'publication_status_id',
                            data_type: 'REF',
                            is_required: false,
                            validation_rules: {},
                            target_object_id: publicationStatusEnumId,
                            target_object_kind: 'enumeration',
                            ui_config: {}
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_values`)) {
                    return [
                        { id: draftStatusId, codename: 'Draft' },
                        { id: publishedStatusId, codename: 'Published' }
                    ]
                }
                if (sql.includes('SELECT "id", "publication_status_id", "_upl_version", "_upl_locked"')) {
                    return [
                        {
                            id: runtimeRowId,
                            publication_status_id: draftStatusId,
                            _upl_version: 2,
                            _upl_locked: false
                        }
                    ]
                }
                if (sql.includes(`SELECT *`) && sql.includes(`FROM "${runtimeSchemaName}"."learning_resources"`)) {
                    return [
                        {
                            id: runtimeRowId,
                            publication_status_id: draftStatusId,
                            _upl_version: 2,
                            _upl_locked: false
                        }
                    ]
                }
                if (sql.includes(`UPDATE "${runtimeSchemaName}"."learning_resources"`)) {
                    return [
                        {
                            id: runtimeRowId,
                            publication_status_id: publishedStatusId,
                            _upl_version: 3
                        }
                    ]
                }
                if (sql.includes(`INSERT INTO "${runtimeSchemaName}"."_app_workflow_action_audit"`)) {
                    return []
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/workflow/PublishLearningResource`)
                .send({ objectCollectionId: runtimeLinkedCollectionId, expectedVersion: 2 })
                .expect(200)

            expect(response.body).toMatchObject({
                id: runtimeRowId,
                actionCodename: 'PublishLearningResource',
                fromStatus: 'Draft',
                toStatus: 'Published',
                version: 3
            })

            const updateCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes(`UPDATE "${runtimeSchemaName}"."learning_resources"`)
            )
            expect(updateCall?.[1]).toEqual([runtimeRowId, publishedStatusId, 'test-user-id', 2, [draftStatusId]])
        })

        it('rejects workflow actions that are not configured in server-side object metadata', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const runtimeSchemaName = 'app_018f8a787b8f7c1da111222233334570'

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: runtimeSchemaName,
                workspacesEnabled: false
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_objects`)) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            kind: 'object',
                            codename: 'documents',
                            table_name: 'documents',
                            config: { workflowActions: [] }
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_components`)) {
                    return []
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/workflow/AcceptSubmission`)
                .send({ objectCollectionId: runtimeLinkedCollectionId, expectedVersion: 2 })
                .expect(404)

            expect(response.body.code).toBe('WORKFLOW_ACTION_NOT_CONFIGURED')
            const rowSelectCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes(`FROM "${runtimeSchemaName}"."documents"`)
            )
            expect(rowSelectCall).toBeUndefined()
        })

        it('posts draft records with atomic numbering and posting metadata', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const dispatchLifecycleEventSpy = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue()

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            mockRecordCatalogQueries(dataSource, {
                id: runtimeRowId,
                _upl_locked: false,
                _upl_version: 1,
                _app_record_state: 'draft',
                _app_record_number: null
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/post`)
                .send({ objectCollectionId: runtimeLinkedCollectionId, expectedVersion: 1 })
                .expect(200)

            expect(response.body).toMatchObject({
                id: runtimeRowId,
                status: 'posted',
                recordState: 'posted',
                recordNumber: 'DOC-0007'
            })

            const counterCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('INSERT INTO "app_runtime_test"._app_record_counters')
            )
            expect(counterCall?.[1]).toEqual([
                runtimeLinkedCollectionId,
                'workspace:00000000-0000-0000-0000-000000000000',
                'all',
                'DOC-',
                'test-user-id'
            ])

            const updateCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('UPDATE "app_runtime_test"."documents"')
            )
            expect(String(updateCall?.[0])).toContain('_app_record_state = $3')
            expect(String(updateCall?.[0])).toContain('_app_posting_batch_id = public.uuid_generate_v7()')
            expect(dispatchLifecycleEventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({ eventName: 'beforePost' })
                })
            )
            expect(dispatchLifecycleEventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({ eventName: 'afterPost' })
                })
            )
        })

        it('applies owner-or-shared edit access before posting a runtime record', async () => {
            const accessObjectId = '018f8a78-7b8f-7c1d-a111-222233334594'
            const sourceQueries: Array<{ sql: string; params?: unknown[] }> = []
            const updateQueries: Array<{ sql: string; params?: unknown[] }> = []
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue()

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'member', false, {
                rolePolicies: {
                    templates: [
                        {
                            codename: 'memberPolicy',
                            title: { en: 'Member permissions' },
                            rules: [{ capability: 'records.edit', effect: 'allow', scope: 'workspace' }]
                        }
                    ]
                }
            })
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    if (params?.[0] === 'ContentAccessEntries') {
                        return [
                            {
                                id: accessObjectId,
                                kind: 'object',
                                codename: 'ContentAccessEntries',
                                table_name: 'content_access_entries',
                                config: null
                            }
                        ]
                    }
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            kind: 'object',
                            codename: 'Documents',
                            table_name: 'documents',
                            config: {
                                ...recordBehaviorConfig,
                                ...buildOwnerOrSharedRuntimeConfig()
                            }
                        },
                        {
                            id: accessObjectId,
                            kind: 'object',
                            codename: 'ContentAccessEntries',
                            table_name: 'content_access_entries',
                            config: null
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    if (params?.[0] === accessObjectId) return runtimeAccessEntryComponents
                    return []
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."documents"')) {
                    sourceQueries.push({ sql, params })
                    return [
                        {
                            id: runtimeRowId,
                            _upl_locked: false,
                            _upl_version: 1,
                            _app_record_state: 'draft',
                            _app_record_number: null,
                            _upl_created_by: 'owner-user-id'
                        }
                    ]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"._app_record_counters')) {
                    return [{ last_number: '7' }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."documents"')) {
                    updateQueries.push({ sql, params })
                    return [
                        {
                            id: runtimeRowId,
                            _app_record_state: 'posted',
                            _app_record_number: 'DOC-0007',
                            _app_posted_at: new Date('2026-05-08T00:00:00.000Z'),
                            _app_posting_batch_id: '018f8a78-7b8f-7c1d-a111-222233334575'
                        }
                    ]
                }
                return []
            })

            const app = buildApp(dataSource)
            await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/post`)
                .send({ objectCollectionId: runtimeLinkedCollectionId, expectedVersion: 1 })
                .expect(200)

            expect(sourceQueries[0]?.sql).toContain('"_upl_created_by" = $2')
            expect(sourceQueries[0]?.sql).toContain('rel."target_record_id"::text = "app_runtime_test"."documents".id::text')
            expect(sourceQueries[0]?.sql).toContain('LOWER(rel."access_level"::text) = \'canedit\'')
            expect(updateQueries[0]?.sql).toContain('"_upl_created_by" = $')
            expect(updateQueries[0]?.sql).toContain('rel."target_record_id"::text = "app_runtime_test"."documents".id::text')
            expect(updateQueries[0]?.sql).toContain('LOWER(rel."access_level"::text) = \'canedit\'')
        })

        it('appends declarative posting movements before afterPost runs', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const dispatchLifecycleEventSpy = jest
                .spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent')
                .mockImplementation(async (params) =>
                    params.payload.eventName === 'beforePost'
                        ? [
                              {
                                  movements: [
                                      {
                                          ledgerCodename: 'ProgressLedger',
                                          facts: [{ data: { Learner: 'student-1', ProgressDelta: 10 } }]
                                      }
                                  ]
                              }
                          ]
                        : []
                )

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (
                    sql.includes('FROM "app_runtime_test"._app_objects') &&
                    sql.includes("config->'capabilities'->'ledgerSchema'") &&
                    !sql.includes('AND NOT')
                ) {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334576',
                            kind: 'ledger',
                            codename: { _primary: 'en', locales: { en: { content: 'ProgressLedger' } } },
                            table_name: 'led_progress',
                            config: {
                                capabilities: {
                                    dataSchema: { enabled: true },
                                    physicalTable: { enabled: true },
                                    ledgerSchema: { enabled: true }
                                },
                                ledger: { fieldRoles: [], projections: [], idempotency: { keyFields: [] } }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            kind: 'object',
                            codename: 'documents',
                            table_name: 'documents',
                            config: recordBehaviorWithLedgerConfig
                        }
                    ]
                }
                if (sql.includes('information_schema.columns')) {
                    return [{ column_name: '_app_reversal_of_fact_id' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: 'ledger-learner',
                            codename: 'Learner',
                            column_name: 'learner',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: {}
                        },
                        {
                            id: 'ledger-progress',
                            codename: 'ProgressDelta',
                            column_name: 'progress_delta',
                            data_type: 'NUMBER',
                            is_required: true,
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."documents"')) {
                    return [{ id: runtimeRowId, _upl_locked: false, _upl_version: 1, _app_record_state: 'draft' }]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"._app_record_counters')) {
                    return [{ last_number: '8' }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."documents"')) {
                    return [
                        {
                            id: runtimeRowId,
                            _app_record_state: 'posted',
                            _app_record_number: 'DOC-0008',
                            _app_posted_at: new Date('2026-05-08T00:00:00.000Z'),
                            _app_posting_batch_id: '018f8a78-7b8f-7c1d-a111-222233334577'
                        }
                    ]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."led_progress"')) {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334578' }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/post`)
                .send({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(200)

            expect(response.body.postingMovements).toEqual([
                {
                    ledgerCodename: 'ProgressLedger',
                    facts: [{ id: '018f8a78-7b8f-7c1d-a111-222233334578' }]
                }
            ])
            const ledgerInsertCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('INSERT INTO "app_runtime_test"."led_progress"')
            )
            expect(ledgerInsertCall?.[1]).toEqual(['student-1', 10, 'test-user-id', 'test-user-id'])

            const afterPostCallIndex = dispatchLifecycleEventSpy.mock.calls.findIndex((call) => call[0].payload.eventName === 'afterPost')
            expect(afterPostCallIndex).toBeGreaterThan(-1)
            expect(dispatchLifecycleEventSpy.mock.invocationCallOrder[afterPostCallIndex]).toBeGreaterThan(
                (dataSource.manager.query as jest.Mock).mock.invocationCallOrder[
                    (dataSource.manager.query as jest.Mock).mock.calls.indexOf(ledgerInsertCall)
                ]
            )
        })

        it('reverses persisted posting movements before unposting a posted record', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const dispatchLifecycleEventSpy = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue([])
            const sourceFactId = '018f8a78-7b8f-7c1d-a111-222233334579'
            const reversedFactId = '018f8a78-7b8f-7c1d-a111-222233334580'

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (
                    sql.includes('FROM "app_runtime_test"._app_objects') &&
                    sql.includes("config->'capabilities'->'ledgerSchema'") &&
                    !sql.includes('AND NOT')
                ) {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334576',
                            kind: 'ledger',
                            codename: { _primary: 'en', locales: { en: { content: 'ProgressLedger' } } },
                            table_name: 'led_progress',
                            config: {
                                capabilities: {
                                    dataSchema: { enabled: true },
                                    physicalTable: { enabled: true },
                                    ledgerSchema: { enabled: true }
                                },
                                ledger: {
                                    sourcePolicy: 'registrar',
                                    registrarKinds: ['object'],
                                    fieldRoles: [
                                        { fieldCodename: 'Learner', role: 'dimension' },
                                        { fieldCodename: 'ProgressDelta', role: 'resource', aggregate: 'sum' }
                                    ],
                                    projections: [],
                                    idempotency: { keyFields: [] }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            kind: 'object',
                            codename: 'documents',
                            table_name: 'documents',
                            config: recordBehaviorWithLedgerConfig
                        }
                    ]
                }
                if (sql.includes('information_schema.columns')) {
                    return [{ column_name: '_app_reversal_of_fact_id' }]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: 'ledger-learner',
                            codename: 'Learner',
                            column_name: 'learner',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: {}
                        },
                        {
                            id: 'ledger-progress',
                            codename: 'ProgressDelta',
                            column_name: 'progress_delta',
                            data_type: 'NUMBER',
                            is_required: true,
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."documents"')) {
                    return [
                        {
                            id: runtimeRowId,
                            _upl_locked: false,
                            _upl_version: 3,
                            _app_record_state: 'posted',
                            _app_posting_movements: [
                                {
                                    ledgerCodename: 'ProgressLedger',
                                    facts: [{ id: sourceFactId }]
                                }
                            ]
                        }
                    ]
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."led_progress"')) {
                    return [{ id: sourceFactId, learner: 'student-1', progress_delta: '10' }]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."led_progress"')) {
                    return [{ id: reversedFactId }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."documents"')) {
                    return [
                        {
                            id: runtimeRowId,
                            _app_record_state: 'draft',
                            _app_record_number: 'DOC-0008',
                            _app_posted_at: null,
                            _app_posting_batch_id: null,
                            _app_posting_movements: null
                        }
                    ]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/unpost`)
                .send({ objectCollectionId: runtimeLinkedCollectionId, expectedVersion: 3 })
                .expect(200)

            expect(response.body).toMatchObject({
                id: runtimeRowId,
                status: 'unposted',
                recordState: 'draft',
                postingMovements: [],
                postingReversals: [
                    {
                        ledgerCodename: 'ProgressLedger',
                        facts: [{ id: reversedFactId }]
                    }
                ]
            })

            const ledgerInsertCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('INSERT INTO "app_runtime_test"."led_progress"')
            )
            expect(ledgerInsertCall?.[1]).toEqual(['student-1', -10, 'test-user-id', 'test-user-id', sourceFactId])

            const updateCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('UPDATE "app_runtime_test"."documents"')
            )
            expect(String(updateCall?.[0])).toContain('_app_posting_movements = NULL')

            const afterUnpostCallIndex = dispatchLifecycleEventSpy.mock.calls.findIndex(
                (call) => call[0].payload.eventName === 'afterUnpost'
            )
            expect(afterUnpostCallIndex).toBeGreaterThan(-1)
            expect(dispatchLifecycleEventSpy.mock.invocationCallOrder[afterUnpostCallIndex]).toBeGreaterThan(
                (dataSource.manager.query as jest.Mock).mock.invocationCallOrder[
                    (dataSource.manager.query as jest.Mock).mock.calls.indexOf(ledgerInsertCall)
                ]
            )
        })

        it('fails closed when declarative posting movements contain invalid ledger fields', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const dispatchLifecycleEventSpy = jest
                .spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent')
                .mockImplementation(async (params) =>
                    params.payload.eventName === 'beforePost'
                        ? [
                              {
                                  movements: [
                                      {
                                          ledgerCodename: 'ProgressLedger',
                                          facts: [{ data: { Unexpected: true } }]
                                      }
                                  ]
                              }
                          ]
                        : []
                )

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (
                    sql.includes('FROM "app_runtime_test"._app_objects') &&
                    sql.includes("config->'capabilities'->'ledgerSchema'") &&
                    !sql.includes('AND NOT')
                ) {
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334576',
                            kind: 'ledger',
                            codename: { _primary: 'en', locales: { en: { content: 'ProgressLedger' } } },
                            table_name: 'led_progress',
                            config: {
                                capabilities: {
                                    dataSchema: { enabled: true },
                                    physicalTable: { enabled: true },
                                    ledgerSchema: { enabled: true }
                                },
                                ledger: { fieldRoles: [], projections: [], idempotency: { keyFields: [] } }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            kind: 'object',
                            codename: 'documents',
                            table_name: 'documents',
                            config: recordBehaviorWithLedgerConfig
                        }
                    ]
                }
                if (sql.includes('information_schema.columns')) {
                    return []
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: 'ledger-learner',
                            codename: 'Learner',
                            column_name: 'learner',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."documents"')) {
                    return [{ id: runtimeRowId, _upl_locked: false, _upl_version: 1, _app_record_state: 'draft' }]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"._app_record_counters')) {
                    return [{ last_number: '9' }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."documents"')) {
                    return [
                        {
                            id: runtimeRowId,
                            _app_record_state: 'posted',
                            _app_record_number: 'DOC-0009'
                        }
                    ]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/post`)
                .send({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(409)

            expect(response.body).toMatchObject({
                code: 'POSTING_MOVEMENT_INVALID',
                ledgerCodename: 'ProgressLedger'
            })
            expect(response.body.error).toContain('Ledger fact contains an unknown field: Unexpected')
            expect(dispatchLifecycleEventSpy.mock.calls.some((call) => call[0].payload.eventName === 'afterPost')).toBe(false)
            expect(
                (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                    String(call[0]).includes('INSERT INTO "app_runtime_test"."led_progress"')
                )
            ).toBeUndefined()
        })

        it.each([
            ['post', 'posted', 'RECORD_ALREADY_POSTED'],
            ['post', 'voided', 'RECORD_VOIDED'],
            ['unpost', 'draft', 'RECORD_NOT_POSTED'],
            ['void', 'voided', 'RECORD_ALREADY_VOIDED']
        ] as const)('rejects invalid %s transition from %s state', async (command, state, code) => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            mockRecordCatalogQueries(dataSource, {
                id: runtimeRowId,
                _upl_locked: false,
                _upl_version: 1,
                _app_record_state: state
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/${command}`)
                .send({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(409)

            expect(response.body.code).toBe(code)
            const updateCall = (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                String(call[0]).includes('UPDATE "app_runtime_test"."documents"')
            )
            expect(updateCall).toBeUndefined()
        })

        it('rejects record commands before touching runtime tables when edit permissions are unavailable', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'member')

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/post`)
                .send({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(403)

            expect(response.body).toEqual({ error: 'Insufficient permissions for this action' })
            expect(dataSource.manager.query).not.toHaveBeenCalled()
        })

        it('blocks parent row updates and deletes when posted rows are immutable', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'documents',
                            table_name: 'documents',
                            config: recordBehaviorConfig
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: 'title-attr',
                            codename: 'title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: false,
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."documents"')) {
                    return [{ id: runtimeRowId, _upl_locked: false, _app_record_state: 'posted' }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."documents"')) {
                    throw new Error('posted rows must not be updated')
                }
                if (sql.includes('DELETE FROM "app_runtime_test"."documents"')) {
                    throw new Error('posted rows must not be deleted')
                }
                return []
            })

            const app = buildApp(dataSource)
            const updateResponse = await request(app)
                .patch(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .send({
                    objectCollectionId: runtimeLinkedCollectionId,
                    data: { title: 'Blocked update' }
                })
                .expect(409)
            expect(updateResponse.body).toMatchObject({ code: 'RECORD_IMMUTABLE', state: 'posted' })

            const deleteResponse = await request(app)
                .delete(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}`)
                .query({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(409)
            expect(deleteResponse.body).toMatchObject({ code: 'RECORD_IMMUTABLE', state: 'posted' })
        })

        it('blocks tabular edits when the parent record is posted and immutable', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLinkedCollectionId,
                            codename: 'documents',
                            table_name: 'documents',
                            config: recordBehaviorConfig
                        }
                    ]
                }
                if (sql.includes("data_type = 'TABLE'")) {
                    return [
                        {
                            id: runtimeComponentId,
                            codename: 'items',
                            column_name: 'items',
                            data_type: 'TABLE',
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('parent_component_id = $1')) {
                    return [
                        {
                            id: 'child-title',
                            codename: 'title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: false,
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."documents"')) {
                    return [{ id: runtimeRowId, _upl_locked: false, _app_record_state: 'posted' }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."items"')) {
                    throw new Error('posted parent child rows must not be updated')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .patch(
                    `/applications/${runtimeApplicationId}/runtime/rows/${runtimeRowId}/tabular/${runtimeComponentId}/${runtimeChildRowId}`
                )
                .query({ objectCollectionId: runtimeLinkedCollectionId })
                .send({ data: { title: 'Blocked child edit' } })
                .expect(409)

            expect(response.body).toMatchObject({ code: 'RECORD_IMMUTABLE', state: 'posted' })
        })
    })

    describe('Runtime ledger permission contract', () => {
        const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334590'
        const runtimeLedgerId = '018f8a78-7b8f-7c1d-a111-222233334591'
        const runtimeFactId = '018f8a78-7b8f-7c1d-a111-222233334592'

        const mockRuntimeApplication = (
            applicationRepo: ReturnType<typeof buildDataSource>['applicationRepo'],
            applicationUserRepo: ReturnType<typeof buildDataSource>['applicationUserRepo'],
            role: 'owner' | 'admin' | 'editor' | 'member'
        ) => {
            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                workspacesEnabled: false
            })
        }

        it.each([
            ['append', 'facts', { facts: [{ data: { Learner: 'student-1', ProgressDelta: 10 } }] }],
            ['reverse', 'facts/reverse', { factIds: [runtimeFactId] }]
        ] as const)(
            'rejects ledger %s before touching runtime tables when create permissions are unavailable',
            async (_label, path, body) => {
                const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

                mockRuntimeApplication(applicationRepo, applicationUserRepo, 'member')

                const app = buildApp(dataSource)
                const response = await request(app)
                    .post(`/applications/${runtimeApplicationId}/runtime/ledgers/${runtimeLedgerId}/${path}`)
                    .send(body)
                    .expect(403)

                expect(response.body).toEqual({ error: 'Insufficient permissions for this action' })
                expect(dataSource.manager.query).not.toHaveBeenCalled()
            }
        )

        it.each(['patch', 'delete'] as const)(
            'rejects ledger fact %s before touching runtime tables when mutation permissions are unavailable',
            async (method) => {
                const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

                mockRuntimeApplication(applicationRepo, applicationUserRepo, 'member')

                const app = buildApp(dataSource)
                const requestBuilder =
                    method === 'patch'
                        ? request(app)
                              .patch(`/applications/${runtimeApplicationId}/runtime/ledgers/${runtimeLedgerId}/facts/${runtimeFactId}`)
                              .send({ data: { ProgressDelta: 15 } })
                        : request(app).delete(
                              `/applications/${runtimeApplicationId}/runtime/ledgers/${runtimeLedgerId}/facts/${runtimeFactId}`
                          )
                const response = await requestBuilder.expect(403)

                expect(response.body).toEqual({ error: 'Insufficient permissions for this action' })
                expect(dataSource.manager.query).not.toHaveBeenCalled()
            }
        )

        it('rejects direct manual writes to registrar-only ledgers for privileged users', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLedgerId,
                            kind: 'ledger',
                            codename: { _primary: 'en', locales: { en: { content: 'ProgressLedger' } } },
                            table_name: 'led_progress',
                            config: {
                                ledger: {
                                    sourcePolicy: 'registrar',
                                    registrarKinds: ['object'],
                                    fieldRoles: [],
                                    projections: [],
                                    idempotency: { keyFields: [] }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('information_schema.columns') || sql.includes('FROM "app_runtime_test"._app_components')) {
                    return []
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."led_progress"')) {
                    throw new Error('registrar-only ledger must not accept manual inserts')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/ledgers/${runtimeLedgerId}/facts`)
                .send({ facts: [{ data: { Learner: 'student-1', ProgressDelta: 10 } }] })
                .expect(403)

            expect(response.body).toMatchObject({
                code: 'LEDGER_REGISTRAR_ONLY'
            })
            expect(
                (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                    String(call[0]).includes('INSERT INTO "app_runtime_test"."led_progress"')
                )
            ).toBeUndefined()
        })

        it('returns controlled validation errors for direct ledger append payloads with invalid field values', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLedgerId,
                            kind: 'ledger',
                            codename: { _primary: 'en', locales: { en: { content: 'ProgressLedger' } } },
                            table_name: 'led_progress',
                            config: {
                                ledger: {
                                    sourcePolicy: 'manual',
                                    mutationPolicy: 'appendOnly',
                                    fieldRoles: [{ fieldCodename: 'ProgressDelta', role: 'resource', aggregate: 'sum', required: true }],
                                    projections: [],
                                    registrarKinds: [],
                                    idempotency: { keyFields: [] }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('information_schema.columns')) {
                    return []
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    return [
                        {
                            id: 'ledger-learner',
                            codename: 'Learner',
                            column_name: 'learner',
                            data_type: 'STRING',
                            is_required: true,
                            validation_rules: {}
                        },
                        {
                            id: 'ledger-progress',
                            codename: 'ProgressDelta',
                            column_name: 'progress_delta',
                            data_type: 'NUMBER',
                            is_required: true,
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."led_progress"')) {
                    throw new Error('invalid ledger append payload must not be inserted')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/ledgers/${runtimeLedgerId}/facts`)
                .send({ facts: [{ data: { Learner: 'student-1', ProgressDelta: 'not-a-number' } }] })
                .expect(400)

            expect(response.body).toMatchObject({
                code: 'LEDGER_FACT_FIELD_VALUE_INVALID',
                field: 'ProgressDelta'
            })
            expect(
                (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                    String(call[0]).includes('INSERT INTO "app_runtime_test"."led_progress"')
                )
            ).toBeUndefined()
        })

        it('rejects direct fact updates for append-only manual ledgers without scanning writable columns', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [
                        {
                            id: runtimeLedgerId,
                            kind: 'ledger',
                            codename: { _primary: 'en', locales: { en: { content: 'ProgressLedger' } } },
                            table_name: 'led_progress',
                            config: {
                                ledger: {
                                    sourcePolicy: 'manual',
                                    mutationPolicy: 'appendOnly',
                                    registrarKinds: [],
                                    fieldRoles: [],
                                    projections: [],
                                    idempotency: { keyFields: [] }
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM "app_runtime_test"._app_components')) {
                    throw new Error('append-only ledger updates must not inspect writable columns')
                }
                if (sql.includes('UPDATE "app_runtime_test"."led_progress"')) {
                    throw new Error('append-only ledger must not accept direct updates')
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .patch(`/applications/${runtimeApplicationId}/runtime/ledgers/${runtimeLedgerId}/facts/${runtimeFactId}`)
                .send({ data: { ProgressDelta: 15 } })
                .expect(409)

            expect(response.body).toMatchObject({
                code: 'LEDGER_APPEND_ONLY'
            })
            expect(
                (dataSource.manager.query as jest.Mock).mock.calls.find((call) =>
                    String(call[0]).includes('UPDATE "app_runtime_test"."led_progress"')
                )
            ).toBeUndefined()
        })
    })

    describe('Runtime reports route contract', () => {
        const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-2222333346a0'
        const runtimeSchemaName = 'app_018f8a787b8f7c1da1112222333346a0'

        const reportDefinition = {
            codename: 'LearnerProgress',
            title: 'Learner progress',
            datasource: {
                kind: 'records.list',
                sectionCodename: 'ContentProgress',
                query: { sort: [{ field: 'ProgressPercent', direction: 'desc' }] }
            },
            columns: [{ field: 'ProgressPercent', label: 'Progress', type: 'number' }],
            filters: [],
            aggregations: [{ field: 'ProgressPercent', function: 'avg', alias: 'AverageProgress' }]
        }

        const learningContentSummaryDefinition = {
            codename: 'LearningContentSummary',
            title: 'Learning Content summary',
            datasource: {
                kind: 'records.union',
                projectedFields: ['Instructor'],
                targets: [
                    {
                        sectionCodename: 'LearningResources',
                        displayType: 'resource',
                        titleField: 'Title',
                        statusField: 'PublicationStatus',
                        projectField: 'ProjectId'
                    },
                    {
                        sectionCodename: 'Courses',
                        displayType: 'course',
                        titleField: 'Title',
                        statusField: 'Status',
                        projectField: 'ProjectId'
                    },
                    {
                        sectionCodename: 'LearningTracks',
                        displayType: 'track',
                        titleField: 'Title',
                        statusField: 'Status',
                        projectField: 'ProjectId'
                    }
                ],
                query: {
                    lifecycleState: 'active',
                    libraryView: 'all',
                    sort: [{ field: 'title', direction: 'asc' }]
                }
            },
            columns: [
                { field: 'type', label: 'Type', type: 'text' },
                { field: 'title', label: 'Title', type: 'text' },
                { field: 'status', label: 'Status', type: 'status' },
                { field: 'Instructor', label: 'Instructor', type: 'text' },
                { field: 'project', label: 'Project', type: 'text' }
            ],
            filters: [],
            aggregations: []
        }

        const mockRuntimeApplication = (
            applicationRepo: ReturnType<typeof buildDataSource>['applicationRepo'],
            applicationUserRepo: ReturnType<typeof buildDataSource>['applicationUserRepo'],
            role: 'owner' | 'admin' | 'editor' | 'member'
        ) => {
            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: runtimeSchemaName,
                workspacesEnabled: false,
                settings: {}
            })
        }

        it('rejects report execution before touching runtime metadata when report permissions are unavailable', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'member')

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/reports/run`)
                .send({ reportCodename: 'LearnerProgress' })
                .expect(403)

            expect(response.body).toEqual({ error: 'Insufficient permissions for this action' })
            expect((dataSource.query as jest.Mock).mock.calls.some((call) => String(call[0]).includes('._app_objects'))).toBe(false)
        })

        it('rejects arbitrary inline report definitions before runtime metadata lookup', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/reports/run`)
                .send({ definition: reportDefinition })
                .expect(400)

            expect(response.body).toMatchObject({ error: 'Invalid report payload' })
            expect((dataSource.query as jest.Mock).mock.calls.some((call) => String(call[0]).includes('._app_objects'))).toBe(false)
        })

        it('runs a records.list report through published runtime metadata for report-capable roles', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            const baseQuery = (dataSource.query as jest.Mock).getMockImplementation()
            const reportQueryCalls: Array<{ sql: string; params?: unknown[] }> = []

            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_objects`)) {
                    if (params?.[0] === 'Reports') {
                        return [
                            {
                                id: '018f8a78-7b8f-7c1d-a111-2222333346b1',
                                codename: 'Reports',
                                table_name: 'reports',
                                config: {}
                            }
                        ]
                    }
                    expect(params).toEqual(['ContentProgress'])
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-2222333346a1',
                            codename: 'ContentProgress',
                            table_name: 'content_progress',
                            config: {}
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_components`)) {
                    if (params?.[0] === '018f8a78-7b8f-7c1d-a111-2222333346b1') {
                        return [
                            {
                                codename: 'Definition',
                                column_name: 'definition',
                                data_type: 'JSON'
                            }
                        ]
                    }
                    return [
                        {
                            codename: 'ProgressPercent',
                            column_name: 'progress_percent',
                            data_type: 'NUMBER'
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"."reports"`)) {
                    expect(params).toEqual(['LearnerProgress'])
                    return [{ definition: reportDefinition }]
                }
                if (
                    sql.includes('SELECT "progress_percent" AS "report_field_1"') &&
                    sql.includes(`FROM "${runtimeSchemaName}"."content_progress"`)
                ) {
                    reportQueryCalls.push({ sql, params })
                    return [{ report_field_1: 75 }]
                }
                if (sql.includes('SELECT count(*) AS total') && sql.includes(`FROM "${runtimeSchemaName}"."content_progress"`)) {
                    reportQueryCalls.push({ sql, params })
                    return [{ total: '1' }]
                }
                if (sql.includes('SELECT AVG("progress_percent") AS "average_progress"')) {
                    reportQueryCalls.push({ sql, params })
                    return [{ average_progress: '75' }]
                }

                return baseQuery?.(sql, params) ?? []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/reports/run`)
                .send({
                    reportCodename: 'LearnerProgress',
                    filters: [{ field: 'ProgressPercent', operator: 'lessThanOrEqual', value: 90 }],
                    limit: 25,
                    offset: 0
                })
                .expect(200)

            expect(response.body).toMatchObject({
                rows: [{ ProgressPercent: 75 }],
                total: 1,
                aggregations: { AverageProgress: 75 },
                definition: { codename: 'LearnerProgress' }
            })

            expect(reportQueryCalls).toHaveLength(3)
            expect(reportQueryCalls[0]?.sql).toContain('"progress_percent" <= $1')
            expect(reportQueryCalls[0]?.params).toEqual([90, 25, 0])
            expect(reportQueryCalls[1]?.sql).toContain('"progress_percent" <= $1')
            expect(reportQueryCalls[1]?.params).toEqual([90])
            expect(reportQueryCalls[2]?.sql).toContain('"progress_percent" <= $1')
            expect(reportQueryCalls[2]?.params).toEqual([90])
        })

        it('applies owner-or-shared runtime access to records.list reports for report-only members', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const contentProgressObjectId = '018f8a78-7b8f-7c1d-a111-2222333346d1'
            const accessObjectId = '018f8a78-7b8f-7c1d-a111-2222333346d2'
            const baseQuery = (dataSource.query as jest.Mock).getMockImplementation()
            const reportQueryCalls: Array<{ sql: string; params?: unknown[] }> = []

            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role: 'member'
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: runtimeSchemaName,
                workspacesEnabled: false,
                settings: {
                    rolePolicies: {
                        templates: [
                            {
                                codename: 'memberPolicy',
                                title: { en: 'Member permissions' },
                                rules: [{ capability: 'reports.read', effect: 'allow', scope: 'workspace' }]
                            }
                        ]
                    }
                }
            })
            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_objects`)) {
                    if (params?.[0] === 'Reports') {
                        return [
                            {
                                id: '018f8a78-7b8f-7c1d-a111-2222333346b1',
                                codename: 'Reports',
                                table_name: 'reports',
                                config: {}
                            }
                        ]
                    }
                    if (params?.[0] === 'ContentAccessEntries') {
                        return [
                            {
                                id: accessObjectId,
                                codename: 'ContentAccessEntries',
                                table_name: 'content_access_entries',
                                config: null
                            }
                        ]
                    }
                    expect(params).toEqual(['ContentProgress'])
                    return [
                        {
                            id: contentProgressObjectId,
                            codename: 'ContentProgress',
                            table_name: 'content_progress',
                            config: buildOwnerOrSharedRuntimeConfig()
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_components`)) {
                    if (params?.[0] === '018f8a78-7b8f-7c1d-a111-2222333346b1') {
                        return [
                            {
                                codename: 'Definition',
                                column_name: 'definition',
                                data_type: 'JSON'
                            }
                        ]
                    }
                    if (params?.[0] === accessObjectId) return runtimeAccessEntryComponents
                    return [
                        {
                            codename: 'ProgressPercent',
                            column_name: 'progress_percent',
                            data_type: 'NUMBER'
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"."reports"`)) {
                    expect(params).toEqual(['LearnerProgress'])
                    return [{ definition: reportDefinition }]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"."content_progress"`)) {
                    reportQueryCalls.push({ sql, params })
                    if (sql.includes('SELECT count(*) AS total')) return [{ total: '1' }]
                    if (sql.includes('SELECT AVG("progress_percent") AS "average_progress"')) return [{ average_progress: '75' }]
                    return [{ report_field_1: 75 }]
                }

                return baseQuery?.(sql, params) ?? []
            })

            const app = buildApp(dataSource)
            await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/reports/run`)
                .send({ reportCodename: 'LearnerProgress' })
                .expect(200)

            expect(reportQueryCalls).toHaveLength(3)
            for (const queryCall of reportQueryCalls) {
                expect(queryCall.sql).toContain('"_upl_created_by" = $1')
                expect(queryCall.sql).toContain(`FROM "${runtimeSchemaName}"."content_access_entries" rel`)
                expect(queryCall.sql).toContain(`rel."target_record_id"::text = "${runtimeSchemaName}"."content_progress".id::text`)
                expect(queryCall.params).toEqual(expect.arrayContaining(['test-user-id', 'ContentProgress', ['workspaceMember', 'user']]))
            }
        })

        it('resolves REF report columns through target display metadata', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            const baseQuery = (dataSource.query as jest.Mock).getMockImplementation()
            const studentObjectId = '018f8a78-7b8f-7c1d-a111-2222333346c1'
            const refReportDefinition = {
                ...reportDefinition,
                columns: [
                    { field: 'ProgressStudentId', label: 'Learner', type: 'text' },
                    { field: 'ProgressPercent', label: 'Progress', type: 'number' }
                ],
                aggregations: []
            }

            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_objects`) && sql.includes('id = ANY($1::uuid[])')) {
                    expect(params).toEqual([[studentObjectId]])
                    return [
                        {
                            id: studentObjectId,
                            table_name: 'students',
                            config: {}
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_objects`)) {
                    if (params?.[0] === 'Reports') {
                        return [
                            {
                                id: '018f8a78-7b8f-7c1d-a111-2222333346b1',
                                codename: 'Reports',
                                table_name: 'reports',
                                config: {}
                            }
                        ]
                    }
                    expect(params).toEqual(['ContentProgress'])
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-2222333346a1',
                            codename: 'ContentProgress',
                            table_name: 'content_progress',
                            config: {}
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_components`)) {
                    if (params?.[0] === '018f8a78-7b8f-7c1d-a111-2222333346b1') {
                        return [
                            {
                                codename: 'Definition',
                                column_name: 'definition',
                                data_type: 'JSON'
                            }
                        ]
                    }
                    if (Array.isArray(params?.[0]) && params[0][0] === studentObjectId) {
                        return [
                            {
                                object_id: studentObjectId,
                                column_name: 'display_name',
                                data_type: 'STRING',
                                is_display_component: true,
                                sort_order: 1
                            }
                        ]
                    }
                    return [
                        {
                            codename: 'ProgressStudentId',
                            column_name: 'progress_student_id',
                            data_type: 'REF',
                            target_object_id: studentObjectId,
                            target_object_kind: 'object'
                        },
                        {
                            codename: 'ProgressPercent',
                            column_name: 'progress_percent',
                            data_type: 'NUMBER'
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"."reports"`)) {
                    expect(params).toEqual(['LearnerProgress'])
                    return [{ definition: refReportDefinition }]
                }
                if (
                    sql.includes('LEFT JOIN') &&
                    sql.includes(`FROM "${runtimeSchemaName}"."students"`) &&
                    sql.includes(`FROM "${runtimeSchemaName}"."content_progress"`)
                ) {
                    expect(params).toEqual([100, 0])
                    return [
                        {
                            report_field_1: {
                                id: '018f8a78-7b8f-7c1d-a111-2222333346ff',
                                label: { en: 'Ava Learner', ru: 'Ава Учащаяся' }
                            },
                            report_field_2: 75
                        }
                    ]
                }
                if (sql.includes('SELECT count(*) AS total') && sql.includes(`FROM "${runtimeSchemaName}"."content_progress"`)) {
                    return [{ total: '1' }]
                }

                return baseQuery?.(sql, params) ?? []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/reports/run`)
                .send({ reportCodename: 'LearnerProgress' })
                .expect(200)

            expect(response.body.rows).toEqual([
                {
                    ProgressStudentId: {
                        id: '018f8a78-7b8f-7c1d-a111-2222333346ff',
                        label: { en: 'Ava Learner', ru: 'Ава Учащаяся' }
                    },
                    ProgressPercent: 75
                }
            ])
        })

        it('exports a saved records.list report as CSV for report-capable roles', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            const baseQuery = (dataSource.query as jest.Mock).getMockImplementation()
            const exportReportDefinition = {
                ...reportDefinition,
                columns: [
                    { field: 'Learner', label: 'Learner', type: 'text' },
                    { field: 'ProgressPercent', label: 'Progress', type: 'number' }
                ]
            }

            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_objects`)) {
                    if (params?.[0] === 'Reports') {
                        return [
                            {
                                id: '018f8a78-7b8f-7c1d-a111-2222333346b1',
                                codename: 'Reports',
                                table_name: 'reports',
                                config: {}
                            }
                        ]
                    }
                    expect(params).toEqual(['ContentProgress'])
                    return [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-2222333346a1',
                            codename: 'ContentProgress',
                            table_name: 'content_progress',
                            config: {}
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_components`)) {
                    if (params?.[0] === '018f8a78-7b8f-7c1d-a111-2222333346b1') {
                        return [
                            {
                                codename: 'Definition',
                                column_name: 'definition',
                                data_type: 'JSON'
                            }
                        ]
                    }
                    return [
                        {
                            codename: 'ProgressPercent',
                            column_name: 'progress_percent',
                            data_type: 'NUMBER'
                        },
                        {
                            codename: 'Learner',
                            column_name: 'learner',
                            data_type: 'STRING'
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"."reports"`)) {
                    expect(params).toEqual(['LearnerProgress'])
                    return [{ definition: exportReportDefinition }]
                }
                if (
                    sql.includes('SELECT "learner" AS "report_field_1", "progress_percent" AS "report_field_2"') &&
                    sql.includes(`FROM "${runtimeSchemaName}"."content_progress"`)
                ) {
                    expect(params).toEqual([5000, 0])
                    return [
                        {
                            report_field_1: { id: '018f8a78-7b8f-7c1d-a111-2222333346ff', name: 'Ava Learner' },
                            report_field_2: 75
                        }
                    ]
                }
                if (sql.includes('SELECT count(*) AS total') && sql.includes(`FROM "${runtimeSchemaName}"."content_progress"`)) {
                    return [{ total: '1' }]
                }
                if (sql.includes('SELECT AVG("progress_percent") AS "average_progress"')) {
                    return [{ average_progress: '75' }]
                }

                return baseQuery?.(sql, params) ?? []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/reports/export`)
                .send({ reportCodename: 'LearnerProgress', locale: 'en' })
                .expect(200)

            expect(response.headers['content-type']).toContain('text/csv')
            expect(response.headers['content-disposition']).toContain('Learner-Progress.csv')
            expect(response.text).toBe('Learner,Progress\r\nAva Learner,75\r\n')
            expect(response.text).not.toContain('{')
            expect(response.text).not.toContain('}')
            expect(response.text).not.toContain('018f8a78-7b8f-7c1d-a111-2222333346')
        })

        it('runs a records.union report through the generic runtime datasource executor', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            const baseQuery = (dataSource.query as jest.Mock).getMockImplementation()
            const reportObjectId = '018f8a78-7b8f-7c1d-a111-2222333346b1'
            const resourceObjectId = '018f8a78-7b8f-7c1d-a111-2222333346d1'
            const courseObjectId = '018f8a78-7b8f-7c1d-a111-2222333346d2'
            const trackObjectId = '018f8a78-7b8f-7c1d-a111-2222333346d3'
            const projectObjectId = '018f8a78-7b8f-7c1d-a111-2222333346d4'
            const projectRowId = '018f8a78-7b8f-7c1d-a111-2222333346d5'
            const sourceRowId = '018f8a78-7b8f-7c1d-a111-2222333346d6'
            const statusEnumerationId = '018f8a78-7b8f-7c1d-a111-2222333346d7'
            const publishedStatusValueId = '018f8a78-7b8f-7c1d-a111-2222333346d8'
            const unionQueries: Array<{ sql: string; params?: unknown[] }> = []

            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_objects`) && sql.includes('id = $1')) {
                    expect(params).toEqual([projectObjectId])
                    return [
                        {
                            id: projectObjectId,
                            table_name: 'content_projects',
                            config: {}
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_objects`)) {
                    if (params?.[0] === 'Reports') {
                        return [
                            {
                                id: reportObjectId,
                                codename: 'Reports',
                                table_name: 'reports',
                                config: {}
                            }
                        ]
                    }
                    return [
                        {
                            id: resourceObjectId,
                            kind: 'object',
                            codename: 'LearningResources',
                            table_name: 'learning_resources',
                            presentation: { locales: { en: { content: 'Learning Resources' } }, _primary: 'en' },
                            config: {}
                        },
                        {
                            id: courseObjectId,
                            kind: 'object',
                            codename: 'Courses',
                            table_name: 'courses',
                            presentation: { locales: { en: { content: 'Courses' } }, _primary: 'en' },
                            config: {}
                        },
                        {
                            id: trackObjectId,
                            kind: 'object',
                            codename: 'LearningTracks',
                            table_name: 'learning_tracks',
                            presentation: { locales: { en: { content: 'Learning Tracks' } }, _primary: 'en' },
                            config: {}
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_components`)) {
                    if (params?.[0] === reportObjectId) {
                        return [
                            {
                                codename: 'Definition',
                                column_name: 'definition',
                                data_type: 'JSON'
                            }
                        ]
                    }
                    if (params?.[0] === projectObjectId) {
                        return [
                            {
                                id: 'project-title',
                                codename: 'Title',
                                column_name: 'title',
                                data_type: 'STRING',
                                is_required: false,
                                is_display_component: true,
                                presentation: null,
                                validation_rules: { localized: true, versioned: true },
                                sort_order: 1,
                                ui_config: null,
                                target_object_id: null,
                                target_object_kind: null
                            }
                        ]
                    }
                    return [
                        {
                            id: 'title',
                            codename: 'Title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: false,
                            is_display_component: true,
                            presentation: null,
                            validation_rules: null,
                            sort_order: 1,
                            ui_config: null,
                            target_object_id: null,
                            target_object_kind: null
                        },
                        {
                            id: 'status',
                            codename: 'Status',
                            column_name: 'status',
                            data_type: 'REF',
                            is_required: false,
                            is_display_component: false,
                            presentation: null,
                            validation_rules: null,
                            sort_order: 2,
                            ui_config: null,
                            target_object_id: statusEnumerationId,
                            target_object_kind: 'enumeration'
                        },
                        {
                            id: 'publication-status',
                            codename: 'PublicationStatus',
                            column_name: 'publication_status',
                            data_type: 'REF',
                            is_required: false,
                            is_display_component: false,
                            presentation: null,
                            validation_rules: null,
                            sort_order: 3,
                            ui_config: null,
                            target_object_id: statusEnumerationId,
                            target_object_kind: 'enumeration'
                        },
                        {
                            id: 'project',
                            codename: 'ProjectId',
                            column_name: 'project_id',
                            data_type: 'REF',
                            is_required: false,
                            is_display_component: false,
                            presentation: null,
                            validation_rules: null,
                            sort_order: 4,
                            ui_config: null,
                            target_object_id: projectObjectId,
                            target_object_kind: 'object'
                        },
                        {
                            id: 'instructor',
                            codename: 'Instructor',
                            column_name: 'instructor',
                            data_type: 'STRING',
                            is_required: false,
                            is_display_component: false,
                            presentation: null,
                            validation_rules: null,
                            sort_order: 5,
                            ui_config: null,
                            target_object_id: null,
                            target_object_kind: null
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_values`)) {
                    expect(params).toEqual([[statusEnumerationId]])
                    return [
                        {
                            id: publishedStatusValueId,
                            object_id: statusEnumerationId,
                            codename: 'Published',
                            presentation: { locales: { en: { content: 'Published' } }, _primary: 'en' },
                            sort_order: 1,
                            is_default: true
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"."reports"`)) {
                    expect(params).toEqual(['LearningContentSummary'])
                    return [{ definition: learningContentSummaryDefinition }]
                }
                if (sql.includes('FROM information_schema.tables')) {
                    return [{ exists: false }]
                }
                if (sql.includes('COUNT(*)::int AS total')) {
                    unionQueries.push({ sql, params })
                    return [{ total: 1 }]
                }
                if (sql.includes('SELECT row_data AS row')) {
                    unionQueries.push({ sql, params })
                    return [
                        {
                            row: {
                                id: `${resourceObjectId}:${sourceRowId}`,
                                __runtimeObjectCollectionId: resourceObjectId,
                                __runtimeObjectCollectionCodename: 'LearningResources',
                                __runtimeSourceRowId: sourceRowId,
                                __runtimeDisplayType: 'resource',
                                _upl_version: 9,
                                type: 'Learning Resources',
                                title: 'Workplace Safety',
                                status: 'Published',
                                Instructor: 'Training Team',
                                project: { id: projectRowId, label: 'Compliance' }
                            }
                        }
                    ]
                }

                return baseQuery?.(sql, params) ?? []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/reports/run`)
                .send({
                    reportCodename: 'LearningContentSummary',
                    limit: 25,
                    offset: 0,
                    filters: [{ field: 'Instructor', operator: 'contains', value: 'Training' }]
                })
                .expect(200)

            expect(response.body).toMatchObject({
                total: 1,
                aggregations: {},
                definition: { codename: 'LearningContentSummary' }
            })
            expect(response.body.rows).toEqual([
                {
                    type: 'Learning Resources',
                    title: 'Workplace Safety',
                    status: 'Published',
                    Instructor: 'Training Team',
                    project: 'Compliance'
                }
            ])
            expect(JSON.stringify(response.body.rows)).not.toContain('__runtime')
            expect(JSON.stringify(response.body.rows)).not.toContain(projectRowId)
            expect(JSON.stringify(response.body.rows)).not.toContain(sourceRowId)
            const selectQuery = unionQueries.find((entry) => entry.sql.includes('SELECT row_data AS row'))
            expect(selectQuery?.sql).toContain('runtime_enum_option')
            expect(selectQuery?.sql).toContain('Published')
            expect(selectQuery?.sql).toContain('"instructor"::text ILIKE')
            expect(selectQuery?.params).toContain('%Training%')
            const countQuery = unionQueries.find((entry) => entry.sql.includes('COUNT(*)::int AS total'))
            expect(countQuery?.sql).toContain('"instructor"::text ILIKE')
            expect(countQuery?.params).toContain('%Training%')
        })

        it('exports a records.union report without leaking runtime identifiers into CSV', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            const baseQuery = (dataSource.query as jest.Mock).getMockImplementation()
            const reportObjectId = '018f8a78-7b8f-7c1d-a111-2222333346b1'
            const resourceObjectId = '018f8a78-7b8f-7c1d-a111-2222333346e1'
            const projectObjectId = '018f8a78-7b8f-7c1d-a111-2222333346e2'
            const projectRowId = '018f8a78-7b8f-7c1d-a111-2222333346e3'
            const sourceRowId = '018f8a78-7b8f-7c1d-a111-2222333346e4'

            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_objects`) && sql.includes('id = $1')) {
                    return [{ id: projectObjectId, table_name: 'content_projects', config: {} }]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_objects`)) {
                    if (params?.[0] === 'Reports') {
                        return [{ id: reportObjectId, codename: 'Reports', table_name: 'reports', config: {} }]
                    }
                    return [
                        {
                            id: resourceObjectId,
                            kind: 'object',
                            codename: 'LearningResources',
                            table_name: 'learning_resources',
                            presentation: { locales: { en: { content: 'Learning Resources' } }, _primary: 'en' },
                            config: {}
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_components`)) {
                    if (params?.[0] === reportObjectId) {
                        return [{ codename: 'Definition', column_name: 'definition', data_type: 'JSON' }]
                    }
                    if (params?.[0] === projectObjectId) {
                        return [
                            {
                                id: 'project-title',
                                codename: 'Title',
                                column_name: 'title',
                                data_type: 'STRING',
                                is_display_component: true,
                                sort_order: 1
                            }
                        ]
                    }
                    return [
                        {
                            id: 'title',
                            codename: 'Title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_display_component: true,
                            sort_order: 1
                        },
                        {
                            id: 'publication-status',
                            codename: 'PublicationStatus',
                            column_name: 'publication_status',
                            data_type: 'STRING',
                            is_display_component: false,
                            sort_order: 2
                        },
                        {
                            id: 'project',
                            codename: 'ProjectId',
                            column_name: 'project_id',
                            data_type: 'REF',
                            is_display_component: false,
                            sort_order: 3,
                            target_object_id: projectObjectId,
                            target_object_kind: 'object'
                        },
                        {
                            id: 'instructor',
                            codename: 'Instructor',
                            column_name: 'instructor',
                            data_type: 'STRING',
                            is_display_component: false,
                            sort_order: 4
                        }
                    ]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"."reports"`)) {
                    expect(params).toEqual(['LearningContentSummary'])
                    return [
                        {
                            definition: {
                                ...learningContentSummaryDefinition,
                                datasource: {
                                    ...learningContentSummaryDefinition.datasource,
                                    targets: [learningContentSummaryDefinition.datasource.targets[0]]
                                }
                            }
                        }
                    ]
                }
                if (sql.includes('FROM information_schema.tables')) {
                    return [{ exists: false }]
                }
                if (sql.includes('COUNT(*)::int AS total')) {
                    return [{ total: 1 }]
                }
                if (sql.includes('SELECT row_data AS row')) {
                    return [
                        {
                            row: {
                                id: `${resourceObjectId}:${sourceRowId}`,
                                __runtimeObjectCollectionId: resourceObjectId,
                                __runtimeSourceRowId: sourceRowId,
                                _upl_version: 2,
                                type: 'Learning Resources',
                                title: 'Workplace Safety',
                                status: 'Published',
                                Instructor: 'Training Team',
                                project: { id: projectRowId, label: 'Compliance' }
                            }
                        }
                    ]
                }

                return baseQuery?.(sql, params) ?? []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/reports/export`)
                .send({ reportCodename: 'LearningContentSummary', locale: 'en' })
                .expect(200)

            expect(response.headers['content-type']).toContain('text/csv')
            expect(response.headers['content-disposition']).toContain('Learning-Content-Summary.csv')
            expect(response.text).toBe(
                'Type,Title,Status,Instructor,Project\r\nLearning Resources,Workplace Safety,Published,Training Team,Compliance\r\n'
            )
            expect(response.text).not.toContain('{')
            expect(response.text).not.toContain('}')
            expect(response.text).not.toContain('__runtime')
            expect(response.text).not.toContain(projectRowId)
            expect(response.text).not.toContain(sourceRowId)
        })

        it('rejects records.union report aggregations before executing the datasource', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            const baseQuery = (dataSource.query as jest.Mock).getMockImplementation()
            const reportObjectId = '018f8a78-7b8f-7c1d-a111-2222333346b1'

            ;(dataSource.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_objects`)) {
                    expect(params?.[0]).toBe('Reports')
                    return [{ id: reportObjectId, codename: 'Reports', table_name: 'reports', config: {} }]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"._app_components`)) {
                    expect(params?.[0]).toBe(reportObjectId)
                    return [{ codename: 'Definition', column_name: 'definition', data_type: 'JSON' }]
                }
                if (sql.includes(`FROM "${runtimeSchemaName}"."reports"`)) {
                    expect(params).toEqual(['LearningContentSummary'])
                    return [
                        {
                            definition: {
                                ...learningContentSummaryDefinition,
                                aggregations: [{ field: 'title', function: 'count', alias: 'TotalContent' }]
                            }
                        }
                    ]
                }

                return baseQuery?.(sql, params) ?? []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/reports/run`)
                .send({ reportCodename: 'LearningContentSummary' })
                .expect(400)

            expect(response.body).toMatchObject({
                code: 'REPORT_UNION_AGGREGATIONS_UNSUPPORTED'
            })
            expect((dataSource.query as jest.Mock).mock.calls.some((call) => String(call[0]).includes('SELECT row_data AS row'))).toBe(
                false
            )
        })
    })

    describe('Runtime tabular copy permission contract', () => {
        const runtimeApplicationId = '018f8a78-7b8f-7c1d-a111-222233334560'
        const runtimeLinkedCollectionId = '018f8a78-7b8f-7c1d-a111-222233334561'
        const runtimeRecordId = '018f8a78-7b8f-7c1d-a111-222233334562'
        const runtimeComponentId = '018f8a78-7b8f-7c1d-a111-222233334563'
        const runtimeChildRowId = '018f8a78-7b8f-7c1d-a111-222233334564'
        const copiedChildRowId = '018f8a78-7b8f-7c1d-a111-222233334565'

        const mockRuntimeApplication = (
            applicationRepo: ReturnType<typeof buildDataSource>['applicationRepo'],
            applicationUserRepo: ReturnType<typeof buildDataSource>['applicationUserRepo'],
            role: 'owner' | 'admin' | 'editor' | 'member'
        ) => {
            applicationUserRepo.findOne.mockResolvedValue({
                userId: 'test-user-id',
                applicationId: runtimeApplicationId,
                role
            })
            applicationRepo.findOne.mockResolvedValue({
                id: runtimeApplicationId,
                schemaName: 'app_runtime_test',
                workspacesEnabled: false
            })
        }

        it('allows editor role to enter child-row copy because copy is governed by create permissions', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'editor')

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRecordId}/tabular/not-a-uuid/${runtimeChildRowId}/copy`)
                .query({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(400)

            expect(response.body).toEqual({ error: 'Invalid object or component ID format' })
        })

        it('allows member role to read child rows without granting mutation permissions', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'member')
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [{ id: runtimeLinkedCollectionId, codename: 'orders', table_name: 'orders', config: null }]
                }
                if (sql.includes("data_type = 'TABLE'")) {
                    return [
                        {
                            id: runtimeComponentId,
                            codename: 'items',
                            column_name: 'items',
                            data_type: 'TABLE',
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('parent_component_id = $1')) {
                    return [
                        {
                            id: 'child-title',
                            codename: 'title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: false,
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('COUNT(*)::int AS total')) {
                    return [{ total: 1 }]
                }
                if (sql.includes('FROM "app_runtime_test"."items"')) {
                    return [{ id: runtimeChildRowId, _tp_sort_order: 0, title: 'Visible child row' }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .get(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRecordId}/tabular/${runtimeComponentId}`)
                .query({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(200)

            expect(response.body).toEqual({
                items: [{ id: runtimeChildRowId, _tp_sort_order: 0, title: 'Visible child row' }],
                total: 1
            })
        })

        it('keeps member role read-only for child-row mutations before touching runtime tables', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'member')

            const app = buildApp(dataSource)

            await request(app)
                .post(`/applications/${runtimeApplicationId}/runtime/rows/${runtimeRecordId}/tabular/${runtimeComponentId}`)
                .query({ objectCollectionId: runtimeLinkedCollectionId })
                .send({ data: { title: 'Blocked' } })
                .expect(403)
            await request(app)
                .patch(
                    `/applications/${runtimeApplicationId}/runtime/rows/${runtimeRecordId}/tabular/${runtimeComponentId}/${runtimeChildRowId}`
                )
                .query({ objectCollectionId: runtimeLinkedCollectionId })
                .send({ data: { title: 'Blocked' } })
                .expect(403)
            await request(app)
                .post(
                    `/applications/${runtimeApplicationId}/runtime/rows/${runtimeRecordId}/tabular/${runtimeComponentId}/${runtimeChildRowId}/copy`
                )
                .query({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(403)
            await request(app)
                .delete(
                    `/applications/${runtimeApplicationId}/runtime/rows/${runtimeRecordId}/tabular/${runtimeComponentId}/${runtimeChildRowId}`
                )
                .query({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(403)

            expect(dataSource.manager.query).not.toHaveBeenCalled()
        })

        it('checks edit permission, not create permission, before updating child rows', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()
            const originalEditPermission = ROLE_PERMISSIONS.editor.editContent

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'editor')
            ROLE_PERMISSIONS.editor.editContent = false

            try {
                const app = buildApp(dataSource)
                const response = await request(app)
                    .patch(
                        `/applications/${runtimeApplicationId}/runtime/rows/${runtimeRecordId}/tabular/${runtimeComponentId}/${runtimeChildRowId}`
                    )
                    .query({ objectCollectionId: runtimeLinkedCollectionId })
                    .send({ data: { title: 'Blocked' } })
                    .expect(403)

                expect(response.body).toEqual({ error: 'Insufficient permissions for this action' })
                expect(dataSource.manager.query).not.toHaveBeenCalled()
            } finally {
                ROLE_PERMISSIONS.editor.editContent = originalEditPermission
            }
        })

        it('copies child rows with declared child data type and validation metadata', async () => {
            const { dataSource, applicationRepo, applicationUserRepo } = buildDataSource()

            mockRuntimeApplication(applicationRepo, applicationUserRepo, 'owner')
            ;(dataSource.manager.query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes('FROM "app_runtime_test"._app_objects')) {
                    return [{ id: runtimeLinkedCollectionId, codename: 'orders', table_name: 'orders', config: null }]
                }
                if (sql.includes("data_type = 'TABLE'")) {
                    return [
                        {
                            id: runtimeComponentId,
                            codename: 'items',
                            column_name: 'items',
                            data_type: 'TABLE',
                            validation_rules: {}
                        }
                    ]
                }
                if (sql.includes('parent_component_id = $1')) {
                    return [
                        {
                            id: 'child-title',
                            codename: 'title',
                            column_name: 'title',
                            data_type: 'STRING',
                            is_required: false,
                            validation_rules: { localized: true, versioned: true }
                        },
                        {
                            id: 'child-payload',
                            codename: 'payload',
                            column_name: 'payload',
                            data_type: 'JSON',
                            is_required: false,
                            validation_rules: {}
                        }
                    ]
                }
                if (
                    sql.includes('FROM "app_runtime_test"."orders"') &&
                    (sql.includes('SELECT id, _upl_locked') || sql.includes('SELECT *'))
                ) {
                    return [{ id: runtimeRecordId, _upl_locked: false }]
                }
                if (sql.includes('SELECT *') && sql.includes('FROM "app_runtime_test"."items"')) {
                    return [
                        {
                            id: runtimeChildRowId,
                            _tp_sort_order: 0,
                            title: { _primary: 'en', locales: { en: { content: 'Copied title' } } },
                            payload: { ok: true }
                        }
                    ]
                }
                if (sql.includes('COUNT(*)::int AS cnt')) {
                    return [{ cnt: 1 }]
                }
                if (sql.includes('UPDATE "app_runtime_test"."items"')) {
                    return []
                }
                if (sql.includes('INSERT INTO "app_runtime_test"."items"')) {
                    expect(params).toEqual([
                        runtimeRecordId,
                        1,
                        'test-user-id',
                        '{"_primary":"en","locales":{"en":{"content":"Copied title"}}}',
                        '{"ok":true}'
                    ])
                    return [{ id: copiedChildRowId }]
                }
                return []
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post(
                    `/applications/${runtimeApplicationId}/runtime/rows/${runtimeRecordId}/tabular/${runtimeComponentId}/${runtimeChildRowId}/copy`
                )
                .query({ objectCollectionId: runtimeLinkedCollectionId })
                .expect(201)

            expect(response.body).toEqual({ id: copiedChildRowId, status: 'created' })
        })
    })
})
