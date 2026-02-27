jest.mock(
    'typeorm',
    () => {
        const decorator = () => () => undefined
        return {
            __esModule: true,
            Entity: decorator,
            PrimaryGeneratedColumn: decorator,
            PrimaryColumn: decorator,
            Column: decorator,
            CreateDateColumn: decorator,
            UpdateDateColumn: decorator,
            VersionColumn: decorator,
            ManyToOne: decorator,
            OneToMany: decorator,
            OneToOne: decorator,
            ManyToMany: decorator,
            JoinTable: decorator,
            JoinColumn: decorator,
            Index: decorator,
            Unique: decorator,
            In: jest.fn((value) => value)
        }
    },
    { virtual: true }
)

jest.mock('@universo/admin-backend', () => ({
    __esModule: true,
    isSuperuserByDataSource: jest.fn(async () => false),
    getGlobalRoleCodenameByDataSource: jest.fn(async () => null),
    hasSubjectPermissionByDataSource: jest.fn(async () => false)
}))

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createMockDataSource, createMockRepository } from '../utils/typeormMocks'
import { createLayoutsRoutes } from '../../domains/layouts/routes/layoutsRoutes'

const mockEnsureMetahubAccess = jest.fn()
const mockEnsureSchema = jest.fn(async () => 'mhb_test_schema')
const mockGetLayoutById = jest.fn()
const mockDeleteLayout = jest.fn()
const mockKnex = {
    transaction: jest.fn()
}

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    KnexClient: {
        getInstance: () => mockKnex
    }
}))

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({
        ensureSchema: (...args: unknown[]) => mockEnsureSchema(...args)
    }))
}))

jest.mock('../../domains/layouts/services/MetahubLayoutsService', () => {
    const actual = jest.requireActual('../../domains/layouts/services/MetahubLayoutsService')
    return {
        ...actual,
        MetahubLayoutsService: jest.fn().mockImplementation(() => ({
            getLayoutById: (...args: unknown[]) => mockGetLayoutById(...args),
            deleteLayout: (...args: unknown[]) => mockDeleteLayout(...args)
        }))
    }
})

describe('Layouts Routes', () => {
    const createLayoutCopyTransactionStub = (params?: {
        copiedLayout?: Record<string, unknown>
        sourceWidgets?: Array<Record<string, unknown>>
    }) => {
        const created =
            params?.copiedLayout ??
            ({
                id: 'layout-copy-id',
                template_key: 'dashboard',
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Main dashboard (copy)' }
                    }
                },
                description: null,
                config: { showOverviewCards: true },
                is_active: true,
                is_default: false,
                sort_order: 0,
                _upl_version: 1,
                _upl_created_at: '2026-02-26T00:00:00.000Z',
                _upl_updated_at: '2026-02-26T00:00:00.000Z'
            } as Record<string, unknown>)

        const sourceWidgets = params?.sourceWidgets ?? []

        const layoutInsertReturning = jest.fn().mockResolvedValue([created])
        const layoutInsert = jest.fn(() => ({
            returning: (...args: unknown[]) => layoutInsertReturning(...args)
        }))
        const sourceWidgetsSelect = jest.fn().mockResolvedValue(sourceWidgets)
        const widgetInsert = jest.fn().mockResolvedValue(undefined)

        const trx = {
            withSchema: jest.fn(() => ({
                into: jest.fn((tableName: string) => {
                    if (tableName === '_mhb_layouts') {
                        return {
                            insert: (...args: unknown[]) => layoutInsert(...args)
                        }
                    }
                    return {
                        insert: (...args: unknown[]) => widgetInsert(...args)
                    }
                }),
                from: jest.fn((tableName: string) => {
                    if (tableName === '_mhb_widgets') {
                        return {
                            where: jest.fn(() => ({
                                orderBy: jest.fn(() => ({
                                    select: (...args: unknown[]) => sourceWidgetsSelect(...args)
                                }))
                            }))
                        }
                    }

                    return {
                        where: jest.fn()
                    }
                })
            }))
        }

        return { trx, layoutInsert, layoutInsertReturning, sourceWidgetsSelect, widgetInsert }
    }

    const mockMetahubRepo = createMockRepository<Record<string, unknown>>()

    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as unknown as { user?: { id: string } }).user = { id: 'test-user-id' }
        next()
    }

    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    const errorHandler = (err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, next: NextFunction) => {
        if (res.headersSent) {
            return next(err)
        }
        const statusCode = err.statusCode || err.status || 500
        res.status(statusCode).json({ error: err.message || 'Internal Server Error' })
    }

    const buildApp = () => {
        const dataSource = createMockDataSource({
            Metahub: mockMetahubRepo
        })
        const app = express()
        app.use(express.json())
        app.use(createLayoutsRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockMetahubRepo.findOne.mockResolvedValue({ id: 'metahub-1' })
        mockEnsureMetahubAccess.mockResolvedValue({ metahubId: 'metahub-1' })
        mockEnsureSchema.mockResolvedValue('mhb_test_schema')
        mockDeleteLayout.mockResolvedValue(undefined)
        mockGetLayoutById.mockResolvedValue({
            id: 'layout-1',
            templateKey: 'dashboard',
            name: {
                _schema: 'v1',
                _primary: 'en',
                locales: {
                    en: { content: 'Main dashboard' }
                }
            },
            description: null,
            config: { showOverviewCards: true },
            isActive: true,
            sortOrder: 0
        })
    })

    describe('POST /metahub/:metahubId/layout/:layoutId/copy', () => {
        it('returns 404 when metahub does not exist', async () => {
            mockMetahubRepo.findOne.mockResolvedValueOnce(null)

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/missing/layout/layout-1/copy')
                .send({ name: { en: 'Copy' } })
                .expect(404)

            expect(response.body.error).toBe('Metahub not found')
            expect(mockEnsureMetahubAccess).not.toHaveBeenCalled()
        })

        it('returns 403 when metahub access check fails', async () => {
            const forbidden = Object.assign(new Error('Access denied to this metahub'), { status: 403 })
            mockEnsureMetahubAccess.mockRejectedValueOnce(forbidden)

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/layout/layout-1/copy')
                .send({ name: { en: 'Copy' } })
                .expect(403)

            expect(response.body.error).toBe('Access denied to this metahub')
        })

        it('returns 400 for invalid copy payload', async () => {
            const app = buildApp()
            const response = await request(app).post('/metahub/metahub-1/layout/layout-1/copy').send({ copyWidgets: 'yes' }).expect(400)

            expect(response.body.error).toBe('Invalid input')
        })

        it('copies layout successfully without widgets when copyWidgets is disabled', async () => {
            const tx = createLayoutCopyTransactionStub()
            mockKnex.transaction.mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(tx.trx))

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/layout/layout-1/copy')
                .send({
                    copyWidgets: false,
                    name: { en: 'Main dashboard (copy)' }
                })
                .expect(201)

            expect(mockEnsureSchema).toHaveBeenCalledWith('metahub-1', 'test-user-id')
            expect(response.body.id).toBe('layout-copy-id')
            expect(response.body.templateKey).toBe('dashboard')
            expect(response.body.isDefault).toBe(false)
            const layoutInsertPayload = tx.layoutInsert.mock.calls[0]?.[0]
            expect(layoutInsertPayload?.config?.__skipDefaultZoneWidgetSeed).toBe(true)
            expect(tx.widgetInsert).not.toHaveBeenCalled()
        })

        it('copies widgets as deactivated when deactivateAllWidgets is enabled', async () => {
            const tx = createLayoutCopyTransactionStub({
                sourceWidgets: [
                    {
                        zone: 'left',
                        widget_key: 'menuWidget',
                        sort_order: 1,
                        config: {},
                        is_active: true
                    }
                ]
            })
            mockKnex.transaction.mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(tx.trx))

            const app = buildApp()
            await request(app)
                .post('/metahub/metahub-1/layout/layout-1/copy')
                .send({
                    copyWidgets: true,
                    deactivateAllWidgets: true,
                    name: { en: 'Main dashboard (copy)' }
                })
                .expect(201)

            expect(tx.sourceWidgetsSelect).toHaveBeenCalledTimes(1)
            expect(tx.widgetInsert).toHaveBeenCalledTimes(1)
            const insertedWidgets = tx.widgetInsert.mock.calls[0]?.[0]
            expect(Array.isArray(insertedWidgets)).toBe(true)
            expect(insertedWidgets[0]?.is_active).toBe(false)
        })
    })

    describe('DELETE /metahub/:metahubId/layout/:layoutId', () => {
        it('deletes layout successfully', async () => {
            const app = buildApp()

            await request(app).delete('/metahub/metahub-1/layout/layout-1').expect(204)

            expect(mockDeleteLayout).toHaveBeenCalledWith('metahub-1', 'layout-1', 'test-user-id')
        })

        it('returns 409 when service reports deletion conflict', async () => {
            mockDeleteLayout.mockRejectedValueOnce(
                Object.assign(new Error('At least one active layout is required'), {
                    statusCode: 409
                })
            )

            const app = buildApp()
            const response = await request(app).delete('/metahub/metahub-1/layout/layout-1').expect(409)

            expect(response.body.error).toBe('At least one active layout is required')
        })
    })
})
