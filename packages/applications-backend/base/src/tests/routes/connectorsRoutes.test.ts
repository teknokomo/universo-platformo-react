jest.mock('@universo/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createMockDbExecutor } from '../utils/dbMocks'
import { createConnectorsRoutes } from '../../routes/connectorsRoutes'

type QueryScope = 'root' | 'tx'
type QueryHandler = (sql: string, params: unknown[], scope: QueryScope) => unknown[] | undefined

const defaultMembershipRow = {
    applicationId: 'application-1',
    application_id: 'application-1',
    userId: 'test-user-id',
    user_id: 'test-user-id',
    role: 'owner'
}

const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
    ;(req as Request & { user?: { id: string } }).user = { id: 'test-user-id' }
    next()
}

const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
    next()
}) as RateLimitRequestHandler

const errorHandler = (err: Error & { statusCode?: number; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) {
        return _next(err)
    }

    const statusCode = err.statusCode ?? err.status ?? 500
    res.status(statusCode).json({ error: err.message || 'Internal Server Error' })
}

const createResponder = (handler?: QueryHandler) => {
    return async (sql: string, params: unknown[] = [], scope: QueryScope) => {
        const override = handler?.(sql, params, scope)
        if (override !== undefined) {
            return override
        }

        if (sql.includes('FROM applications.rel_application_users')) {
            return [defaultMembershipRow]
        }

        return []
    }
}

const buildDataSource = (handler?: QueryHandler) => {
    const { executor, txExecutor } = createMockDbExecutor()
    const responder = createResponder(handler)

    // Expose manager-like structure so existing test assertions on
    // dataSource.manager.query keep working with zero body changes.
    const dataSource = Object.assign(executor, {
        manager: { query: txExecutor.query }
    })

    ;(executor.query as jest.Mock).mockImplementation((sql: string, params: unknown[] = []) => responder(sql, params, 'root'))
    ;(txExecutor.query as jest.Mock).mockImplementation((sql: string, params: unknown[] = []) => responder(sql, params, 'tx'))

    return dataSource
}

const buildApp = (dataSource: ReturnType<typeof buildDataSource>) => {
    const app = express()
    app.use(express.json())
    app.use(
        '/',
        createConnectorsRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
    )
    app.use(errorHandler)
    return app
}

describe('Connectors Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('GET /applications/:applicationId/connectors', () => {
        it('should reject ordinary members from reading connector metadata', async () => {
            const dataSource = buildDataSource((sql, _params, _scope) => {
                if (sql.includes('FROM applications.rel_application_users')) {
                    return [{ ...defaultMembershipRow, role: 'member' }]
                }

                return undefined
            })

            const app = buildApp(dataSource)
            await request(app).get('/applications/application-1/connectors').expect(403)
        })

        it('should return empty array when no connectors exist', async () => {
            const dataSource = buildDataSource((_sql, _params, scope) => {
                if (scope === 'root' && _sql.includes('COUNT(*) OVER()')) {
                    return []
                }

                return undefined
            })

            const app = buildApp(dataSource)
            const response = await request(app).get('/applications/application-1/connectors').expect(200)

            expect(response.body).toMatchObject({
                items: [],
                pagination: { total: 0, limit: 100, offset: 0 }
            })
        })

        it('should return connectors list for application', async () => {
            const dataSource = buildDataSource((sql, _params, scope) => {
                if (scope === 'root' && sql.includes('COUNT(*) OVER()')) {
                    return [
                        {
                            id: 'connector-1',
                            applicationId: 'application-1',
                            name: { en: 'Connector One', _primary: 'en' },
                            description: { en: 'Description', _primary: 'en' },
                            sortOrder: 1,
                            isSingleMetahub: false,
                            isRequiredMetahub: false,
                            version: 1,
                            createdAt: new Date('2025-01-01'),
                            updatedAt: new Date('2025-01-02'),
                            updatedBy: null,
                            windowTotal: '1'
                        }
                    ]
                }

                return undefined
            })

            const app = buildApp(dataSource)
            const response = await request(app).get('/applications/application-1/connectors').expect(200)

            expect(response.body.items).toHaveLength(1)
            expect(response.body.items[0]).toMatchObject({
                id: 'connector-1'
            })
            expect(response.body.pagination.total).toBe(1)
        })

        it('should support pagination parameters', async () => {
            const dataSource = buildDataSource((_sql, _params, scope) => {
                if (scope === 'root' && _sql.includes('COUNT(*) OVER()')) {
                    return []
                }

                return undefined
            })

            const app = buildApp(dataSource)
            const response = await request(app).get('/applications/application-1/connectors').query({ limit: 10, offset: 5 }).expect(200)

            expect(response.body).toMatchObject({
                items: [],
                pagination: { total: 0, limit: 10, offset: 5 }
            })
        })

        it('should support search parameter', async () => {
            const dataSource = buildDataSource((_sql, _params, scope) => {
                if (scope === 'root' && _sql.includes('COUNT(*) OVER()')) {
                    return []
                }

                return undefined
            })

            const app = buildApp(dataSource)
            await request(app).get('/applications/application-1/connectors').query({ search: 'test' }).expect(200)

            const searchCall = dataSource.query.mock.calls.find(
                ([sql, params]) => typeof sql === 'string' && sql.includes('ILIKE') && Array.isArray(params) && params.includes('%test%')
            )
            expect(searchCall).toBeDefined()
        })
    })

    describe('POST /applications/:applicationId/connectors', () => {
        it('should create a new connector', async () => {
            const dataSource = buildDataSource((sql, _params, scope) => {
                if (scope === 'root' && sql.includes('FROM applications.cat_applications') && sql.includes('schema_status')) {
                    return [{ id: 'application-1', schemaStatus: null }]
                }

                if (scope === 'tx' && sql.includes('INSERT INTO applications.cat_connectors')) {
                    return [
                        {
                            id: 'new-connector-id',
                            applicationId: 'application-1',
                            name: { en: 'New Connector', _primary: 'en' },
                            description: { en: 'Description', _primary: 'en' },
                            sortOrder: 0,
                            isSingleMetahub: false,
                            isRequiredMetahub: false,
                            version: 1,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            updatedBy: 'test-user-id'
                        }
                    ]
                }

                return undefined
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .post('/applications/application-1/connectors')
                .send({
                    name: 'New Connector',
                    description: 'Description'
                })
                .expect(201)

            expect(response.body).toMatchObject({
                id: 'new-connector-id'
            })
        })

        it('should return 404 when application does not exist', async () => {
            const dataSource = buildDataSource((sql, _params, scope) => {
                if (scope === 'root' && sql.includes('FROM applications.cat_applications') && sql.includes('schema_status')) {
                    return []
                }

                return undefined
            })

            const app = buildApp(dataSource)
            const response = await request(app).post('/applications/non-existent/connectors').send({ name: 'New Connector' }).expect(404)

            expect(response.body.error).toBe('Application not found')
        })

        it('should reject empty name', async () => {
            const dataSource = buildDataSource((sql, _params, scope) => {
                if (scope === 'root' && sql.includes('FROM applications.cat_applications') && sql.includes('schema_status')) {
                    return [{ id: 'application-1', schemaStatus: null }]
                }

                return undefined
            })

            const app = buildApp(dataSource)
            await request(app).post('/applications/application-1/connectors').send({ name: '' }).expect(400)
        })

        it('should use sortOrder 0 when not provided', async () => {
            const dataSource = buildDataSource((sql, params, scope) => {
                if (scope === 'root' && sql.includes('FROM applications.cat_applications') && sql.includes('schema_status')) {
                    return [{ id: 'application-1', schemaStatus: null }]
                }

                if (scope === 'tx' && sql.includes('INSERT INTO applications.cat_connectors')) {
                    expect(params[3]).toBe(0)

                    return [
                        {
                            id: 'new-id',
                            applicationId: 'application-1',
                            name: { en: 'New Connector', _primary: 'en' },
                            description: null,
                            sortOrder: 0,
                            isSingleMetahub: false,
                            isRequiredMetahub: false,
                            version: 1,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            updatedBy: 'test-user-id'
                        }
                    ]
                }

                return undefined
            })

            const app = buildApp(dataSource)
            await request(app).post('/applications/application-1/connectors').send({ name: 'New Connector' }).expect(201)
        })
    })

    describe('GET /applications/:applicationId/connectors/:connectorId', () => {
        it('should return 404 for non-existent connector', async () => {
            const dataSource = buildDataSource((sql, _params, scope) => {
                if (scope === 'root' && sql.includes('FROM applications.cat_connectors') && sql.includes('application_id = $2')) {
                    return []
                }

                return undefined
            })

            const app = buildApp(dataSource)
            await request(app).get('/applications/application-1/connectors/non-existent-id').expect(404)
        })

        it('should return connector details', async () => {
            const dataSource = buildDataSource((sql, _params, scope) => {
                if (scope === 'root' && sql.includes('FROM applications.cat_connectors') && sql.includes('application_id = $2')) {
                    return [
                        {
                            id: 'connector-1',
                            applicationId: 'application-1',
                            name: { en: 'Test Connector', _primary: 'en' },
                            description: { en: 'Description', _primary: 'en' },
                            sortOrder: 1,
                            isSingleMetahub: false,
                            isRequiredMetahub: false,
                            version: 1,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            updatedBy: null
                        }
                    ]
                }

                return undefined
            })

            const app = buildApp(dataSource)
            const response = await request(app).get('/applications/application-1/connectors/connector-1').expect(200)

            expect(response.body).toMatchObject({
                id: 'connector-1'
            })
        })
    })

    describe('PATCH /applications/:applicationId/connectors/:connectorId', () => {
        it('should update connector', async () => {
            const dataSource = buildDataSource((sql, _params, scope) => {
                if (scope === 'root' && sql.includes('FROM applications.cat_connectors') && sql.includes('application_id = $2')) {
                    if (
                        dataSource.query.mock.calls.filter(([value]) => String(value).includes('FROM applications.cat_connectors'))
                            .length === 1
                    ) {
                        return [
                            {
                                id: 'connector-1',
                                applicationId: 'application-1',
                                name: { en: 'Old Name', _primary: 'en' },
                                description: null,
                                sortOrder: 1,
                                isSingleMetahub: false,
                                isRequiredMetahub: false,
                                version: 1,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                                updatedBy: null
                            }
                        ]
                    }

                    return [
                        {
                            id: 'connector-1',
                            applicationId: 'application-1',
                            name: { en: 'New Name', _primary: 'en' },
                            description: null,
                            sortOrder: 1,
                            isSingleMetahub: false,
                            isRequiredMetahub: false,
                            version: 2,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            updatedBy: 'test-user-id'
                        }
                    ]
                }

                if (scope === 'root' && sql.includes('UPDATE applications.cat_connectors')) {
                    return [
                        {
                            id: 'connector-1',
                            applicationId: 'application-1',
                            name: { en: 'New Name', _primary: 'en' },
                            description: null,
                            sortOrder: 1,
                            isSingleMetahub: false,
                            isRequiredMetahub: false,
                            version: 2,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            updatedBy: 'test-user-id'
                        }
                    ]
                }

                return undefined
            })

            const app = buildApp(dataSource)
            const response = await request(app)
                .patch('/applications/application-1/connectors/connector-1')
                .send({ name: 'New Name' })
                .expect(200)

            expect(response.body.name).toMatchObject({ en: 'New Name' })
        })
    })

    describe('DELETE /applications/:applicationId/connectors/:connectorId', () => {
        it('should delete connector and touch schema status in one transaction', async () => {
            const dataSource = buildDataSource((sql, _params, scope) => {
                if (scope === 'root' && sql.includes('FROM applications.cat_connectors') && sql.includes('application_id = $2')) {
                    return [
                        {
                            id: 'connector-1',
                            applicationId: 'application-1',
                            name: { en: 'Connector', _primary: 'en' },
                            description: null,
                            sortOrder: 1,
                            isSingleMetahub: false,
                            isRequiredMetahub: false,
                            version: 1,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            updatedBy: null
                        }
                    ]
                }

                if (
                    scope === 'tx' &&
                    sql.includes('UPDATE applications.cat_connectors') &&
                    sql.includes('_upl_deleted = true') &&
                    sql.includes('_app_deleted = true')
                ) {
                    return [{ id: 'connector-1' }]
                }

                if (scope === 'tx' && sql.includes("UPDATE applications.cat_applications\n        SET schema_status = 'synced'")) {
                    return [{ id: 'application-1' }]
                }

                return undefined
            })

            const app = buildApp(dataSource)
            await request(app).delete('/applications/application-1/connectors/connector-1').expect(204)

            expect(
                dataSource.manager.query.mock.calls.some(
                    ([sql]) =>
                        String(sql).includes('UPDATE applications.cat_connectors') &&
                        String(sql).includes('_upl_deleted = true') &&
                        String(sql).includes('_app_deleted = true')
                )
            ).toBe(true)
            expect(dataSource.manager.query.mock.calls.some(([sql]) => String(sql).includes("SET schema_status = 'synced'"))).toBe(true)
        })

        it('should return 404 for non-existent connector', async () => {
            const dataSource = buildDataSource((sql, _params, scope) => {
                if (scope === 'root' && sql.includes('FROM applications.cat_connectors') && sql.includes('application_id = $2')) {
                    return []
                }

                return undefined
            })

            const app = buildApp(dataSource)
            await request(app).delete('/applications/application-1/connectors/non-existent').expect(404)
        })
    })
})
