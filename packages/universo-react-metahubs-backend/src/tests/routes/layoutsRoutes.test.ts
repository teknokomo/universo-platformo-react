jest.mock('@universo-react/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createLayoutsRoutes } from '../../domains/layouts/routes/layoutsRoutes'

const mockFindMetahubById = jest.fn(async () => ({ id: 'metahub-1' }))

jest.mock('../../persistence', () => ({
    __esModule: true,
    findMetahubById: (...args: unknown[]) => mockFindMetahubById(...args)
}))

const mockEnsureMetahubAccess = jest.fn()
const mockEnsureSchema = jest.fn(async () => 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
const mockGetLayoutById = jest.fn()
const mockDeleteLayout = jest.fn()
const mockUpdateLayoutZoneSetting = jest.fn()
const mockResetLayoutZoneSetting = jest.fn()
const layoutIdV7 = '0190a9b5-3cde-7abc-8def-0123456789a1'
const baseLayoutIdV7 = '0190a9b5-3cde-7abc-8def-0123456789b1'
const baseWidgetOneIdV7 = '0190a9b5-3cde-7abc-8def-0123456789b2'
const baseWidgetTwoIdV7 = '0190a9b5-3cde-7abc-8def-0123456789b3'

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

jest.mock('../../domains/ddl', () => ({
    __esModule: true
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
            deleteLayout: (...args: unknown[]) => mockDeleteLayout(...args),
            updateLayoutZoneSetting: (...args: unknown[]) => mockUpdateLayoutZoneSetting(...args),
            resetLayoutZoneSetting: (...args: unknown[]) => mockResetLayoutZoneSetting(...args)
        }))
    }
})

describe('Layouts Routes', () => {
    type MockExecTransaction = {
        query: jest.Mock
        transaction: jest.Mock
        isReleased: () => boolean
    }

    const createLayoutCopyTransactionTrx = (params?: {
        sourceLayout?: Record<string, unknown>
        copiedLayout?: Record<string, unknown>
        sourceWidgets?: Array<Record<string, unknown>>
        sourceOverrides?: Array<Record<string, unknown>>
        baseWidgets?: Array<Record<string, unknown>>
    }) => {
        const sourceLayout =
            params?.sourceLayout ??
            ({
                id: layoutIdV7,
                scope_entity_id: null,
                base_layout_id: null,
                template_key: 'dashboard',
                name: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: { en: { content: 'Main dashboard' } }
                },
                description: null,
                config: { showOverviewCards: true },
                is_active: true,
                is_default: true,
                sort_order: 0,
                _upl_version: 1,
                _upl_created_at: '2026-02-25T00:00:00.000Z',
                _upl_updated_at: '2026-02-25T00:00:00.000Z'
            } as Record<string, unknown>)

        const created =
            params?.copiedLayout ??
            ({
                id: 'layout-copy-id',
                scope_entity_id: null,
                base_layout_id: null,
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

        const withCanonicalLayoutConfig = (layout: Record<string, unknown>): Record<string, unknown> => {
            const rawConfig = layout.config
            const rendererConfig =
                rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig) ? (rawConfig as Record<string, unknown>) : {}
            const existingNeutral =
                rendererConfig.__layout && typeof rendererConfig.__layout === 'object' && !Array.isArray(rendererConfig.__layout)
                    ? (rendererConfig.__layout as Record<string, unknown>)
                    : {}
            const baseLayoutId = typeof layout.base_layout_id === 'string' ? layout.base_layout_id : null
            return {
                ...layout,
                config: {
                    ...rendererConfig,
                    __layout: {
                        ...existingNeutral,
                        composition: {
                            mode: baseLayoutId ? 'overlay' : 'independent',
                            baseLayoutId
                        }
                    }
                }
            }
        }

        const canonicalSourceLayout = withCanonicalLayoutConfig(sourceLayout)
        const canonicalCreatedLayout = withCanonicalLayoutConfig(created)

        const sourceWidgets = params?.sourceWidgets ?? []
        const sourceOverrides = params?.sourceOverrides ?? []
        const baseWidgets = params?.baseWidgets ?? []
        const isOverlayLayout = typeof sourceLayout.base_layout_id === 'string'

        const queryMock = jest.fn().mockResolvedValue([])
        // Sequence: lock source → (lock base) → INSERT layout RETURNING *.
        queryMock.mockResolvedValueOnce([canonicalSourceLayout])
        if (isOverlayLayout) {
            queryMock.mockResolvedValueOnce([{ id: sourceLayout.base_layout_id }])
        }
        queryMock.mockResolvedValueOnce([canonicalCreatedLayout])
        if (sourceWidgets.length > 0) {
            // SELECT widgets → sourceWidgets
            queryMock.mockResolvedValueOnce(sourceWidgets)
            // INSERT widgets batch RETURNING id
            queryMock.mockResolvedValueOnce(sourceWidgets.map((widget, index) => ({ id: String(widget.id ?? `copied-widget-${index}`) })))
        }
        if (isOverlayLayout) {
            queryMock.mockResolvedValueOnce(sourceOverrides)
            queryMock.mockResolvedValueOnce(baseWidgets)
            queryMock.mockResolvedValueOnce(
                Array.from({ length: Math.max(sourceOverrides.length, baseWidgets.length) }, (_, index) => ({
                    id: String(baseWidgets[index]?.id ?? sourceOverrides[index]?.base_widget_id ?? `copied-override-${index}`)
                }))
            )
        }

        return { query: queryMock }
    }

    const mockExec = {
        query: jest.fn(async () => []),
        transaction: jest.fn(async (cb: (trx: MockExecTransaction) => Promise<unknown>) =>
            cb({ query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false })
        ),
        isReleased: () => false
    }

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
        const app = express()
        app.use(express.json())
        app.use(createLayoutsRoutes(ensureAuth, () => mockExec as never, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockFindMetahubById.mockResolvedValue({ id: 'metahub-1' })
        mockEnsureMetahubAccess.mockResolvedValue({ metahubId: 'metahub-1' })
        mockEnsureSchema.mockResolvedValue('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        mockDeleteLayout.mockResolvedValue(undefined)
        mockUpdateLayoutZoneSetting.mockResolvedValue({ id: layoutIdV7, config: { appearance: 'kept' }, version: 5 })
        mockResetLayoutZoneSetting.mockResolvedValue({ id: layoutIdV7, config: { appearance: 'kept' }, version: 6 })
        mockGetLayoutById.mockResolvedValue({
            id: layoutIdV7,
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

    describe('zone setting routes', () => {
        it('updates a sparse zone setting through the dedicated controller', async () => {
            const app = buildApp()
            const response = await request(app)
                .patch(`/metahub/metahub-1/layout/${layoutIdV7}/zone-settings/marketing-header/position`)
                .send({ value: 'flow', expectedVersion: 4 })
                .expect(200)

            expect(response.body).toMatchObject({ item: { id: layoutIdV7, version: 5 } })
            expect(mockUpdateLayoutZoneSetting).toHaveBeenCalledWith(
                'metahub-1',
                layoutIdV7,
                'marketing-header',
                'position',
                'flow',
                'test-user-id',
                4
            )
        })

        it('resets a sparse zone setting through the dedicated controller', async () => {
            const app = buildApp()
            await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/zone-settings/marketing-header/position/reset`)
                .send({ expectedVersion: 5 })
                .expect(200)

            expect(mockResetLayoutZoneSetting).toHaveBeenCalledWith(
                'metahub-1',
                layoutIdV7,
                'marketing-header',
                'position',
                'test-user-id',
                5
            )
        })

        it('rejects reserved layout metadata in renderer mutation payloads', async () => {
            const app = buildApp()
            await request(app)
                .patch(`/metahub/metahub-1/layout/${layoutIdV7}`)
                .send({ config: { __layout: { composition: { mode: 'independent', baseLayoutId: null } } }, expectedVersion: 1 })
                .expect(400)

            expect(mockGetLayoutById).not.toHaveBeenCalled()
        })
    })

    describe('POST /metahub/:metahubId/layout/:layoutId/copy', () => {
        it('returns 403 when metahub does not exist (access denied)', async () => {
            const forbidden = Object.assign(new Error('Access denied to this metahub'), { status: 403 })
            mockEnsureMetahubAccess.mockRejectedValueOnce(forbidden)

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/missing/layout/${layoutIdV7}/copy`)
                .send({ name: { en: 'Copy' } })
                .expect(403)

            expect(response.body.error).toBe('Access denied to this metahub')
        })

        it('returns 403 when metahub access check fails', async () => {
            const forbidden = Object.assign(new Error('Access denied to this metahub'), { status: 403 })
            mockEnsureMetahubAccess.mockRejectedValueOnce(forbidden)

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ name: { en: 'Copy' } })
                .expect(403)

            expect(response.body.error).toBe('Access denied to this metahub')
        })

        it('returns 400 for invalid copy payload', async () => {
            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: 'yes' })
                .expect(400)

            expect(response.body.error).toBe('Invalid input')
        })

        it('returns 400 for a non-positive copy expectedVersion', async () => {
            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ expectedVersion: 0 })
                .expect(400)

            expect(response.body.error).toBe('Invalid input')
        })

        it('returns 400 for a non-v7 layout path before loading the layout', async () => {
            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/layout/550e8400-e29b-41d4-a716-446655440000/copy')
                .send({ name: { en: 'Copy' } })
                .expect(400)

            expect(response.body.error).toBe('Invalid layout ID')
            expect(mockGetLayoutById).not.toHaveBeenCalled()
        })

        it('returns 400 for a malformed layout path before loading the layout', async () => {
            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/layout/layout-1/copy')
                .send({ name: { en: 'Copy' } })
                .expect(400)

            expect(response.body.error).toBe('Invalid layout ID')
            expect(mockGetLayoutById).not.toHaveBeenCalled()
        })

        it('fails closed when the source layout contains application-only source zone settings', async () => {
            const trx = createLayoutCopyTransactionTrx({
                sourceLayout: {
                    id: layoutIdV7,
                    scope_entity_id: null,
                    base_layout_id: null,
                    template_key: 'marketing-page',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Marketing page' } }
                    },
                    description: null,
                    config: {
                        __layout: {
                            sourceZoneSettings: { 'marketing-header': { position: 'flow' } }
                        }
                    },
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                }
            })
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: false, name: { en: 'Invalid copy' } })
                .expect(409)

            expect(response.body.error).toBe('Layout configuration metadata is invalid')
            expect(trx.query).toHaveBeenCalledTimes(1)
        })

        it('copies layout successfully without widgets when copyWidgets is disabled', async () => {
            const trx = createLayoutCopyTransactionTrx()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({
                    copyWidgets: false,
                    name: { en: 'Main dashboard (copy)' }
                })
                .expect(201)

            expect(mockEnsureSchema).toHaveBeenCalledWith('metahub-1', 'test-user-id')
            expect(response.body.id).toBe('layout-copy-id')
            expect(response.body.templateKey).toBe('dashboard')
            expect(response.body.isDefault).toBe(false)
            // Source lock + INSERT layout query, no widget queries
            expect(trx.query).toHaveBeenCalledTimes(2)
            const insertParams = (trx.query as jest.Mock).mock.calls[1]?.[1]
            const config = JSON.parse(insertParams?.[5] as string)
            expect(config.__skipDefaultZoneWidgetSeed).toBe(true)
        })

        it('copies widgets as deactivated when deactivateAllWidgets is enabled', async () => {
            const trx = createLayoutCopyTransactionTrx({
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
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({
                    copyWidgets: true,
                    deactivateAllWidgets: true,
                    name: { en: 'Main dashboard (copy)' }
                })
                .expect(201)

            // Lock source + INSERT layout + SELECT widgets + INSERT widgets = 4 queries
            expect(trx.query).toHaveBeenCalledTimes(4)
            // 4th call is the widget INSERT — check is_active=false in params
            const widgetInsertParams = (trx.query as jest.Mock).mock.calls[3]?.[1] as unknown[]
            // is_active is the 6th param per widget (index 5)
            expect(widgetInsertParams?.[5]).toBe(false)
        })

        it('copies scoped layout entity scope and inherited overrides when deactivating copied widgets', async () => {
            const trx = createLayoutCopyTransactionTrx({
                sourceLayout: {
                    id: layoutIdV7,
                    scope_entity_id: 'object-1',
                    base_layout_id: baseLayoutIdV7,
                    template_key: 'dashboard',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Entity dashboard' } }
                    },
                    description: null,
                    config: {
                        dashboardBehavior: {
                            showCreateButton: false,
                            searchMode: 'server'
                        }
                    },
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                },
                copiedLayout: {
                    id: 'layout-copy-id',
                    scope_entity_id: 'object-1',
                    base_layout_id: baseLayoutIdV7,
                    template_key: 'dashboard',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'Entity dashboard (copy)' }
                        }
                    },
                    description: null,
                    config: {
                        dashboardBehavior: {
                            showCreateButton: false,
                            searchMode: 'server'
                        }
                    },
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1,
                    _upl_created_at: '2026-02-26T00:00:00.000Z',
                    _upl_updated_at: '2026-02-26T00:00:00.000Z'
                },
                sourceWidgets: [
                    {
                        id: 'owned-widget-1',
                        zone: 'left',
                        widget_key: 'menuWidget',
                        sort_order: 1,
                        config: { title: 'Owned menu' },
                        is_active: true
                    }
                ],
                sourceOverrides: [
                    {
                        base_widget_id: baseWidgetOneIdV7,
                        zone: 'right',
                        sort_order: 2,
                        config: { title: 'Entity override' },
                        is_active: true,
                        is_deleted_override: false
                    }
                ],
                baseWidgets: [
                    { id: baseWidgetOneIdV7, widget_key: 'resourcePreview', zone: 'right', is_active: true },
                    { id: baseWidgetTwoIdV7, widget_key: 'detailsTable', zone: 'center', is_active: true }
                ]
            })
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({
                    copyWidgets: true,
                    deactivateAllWidgets: true,
                    name: { en: 'Entity dashboard (copy)' }
                })
                .expect(201)

            expect(response.body.scopeEntityId).toBe('object-1')
            expect(response.body.baseLayoutId).toBe(baseLayoutIdV7)
            expect(trx.query).toHaveBeenCalledTimes(8)

            const layoutInsertParams = (trx.query as jest.Mock).mock.calls[2]?.[1] as unknown[]
            expect(layoutInsertParams?.[0]).toBe('object-1')
            expect(layoutInsertParams?.[1]).toBe(baseLayoutIdV7)

            const overrideInsertParams = (trx.query as jest.Mock).mock.calls[7]?.[1] as unknown[]
            expect(overrideInsertParams?.[0]).toBe('layout-copy-id')
            expect(overrideInsertParams?.[1]).toBe(baseWidgetOneIdV7)
            expect(overrideInsertParams?.[5]).toBe(false)
            expect(overrideInsertParams?.[6]).toBe(false)
            expect(overrideInsertParams?.[12]).toBe('layout-copy-id')
            expect(overrideInsertParams?.[13]).toBe(baseWidgetTwoIdV7)
            expect(overrideInsertParams?.[17]).toBe(false)
            expect(overrideInsertParams?.[18]).toBe(false)
            expect(overrideInsertParams?.[23]).toBe(true)
        })

        it('preserves an independent entity scope when the source has no base layout', async () => {
            const trx = createLayoutCopyTransactionTrx({
                sourceLayout: {
                    id: layoutIdV7,
                    scope_entity_id: 'page-1',
                    base_layout_id: null,
                    template_key: 'dashboard',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Entity dashboard' } }
                    },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                },
                copiedLayout: {
                    id: 'layout-copy-id',
                    scope_entity_id: 'page-1',
                    base_layout_id: null,
                    template_key: 'dashboard',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Entity dashboard (copy)' } }
                    },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1,
                    _upl_created_at: '2026-02-26T00:00:00.000Z',
                    _upl_updated_at: '2026-02-26T00:00:00.000Z'
                },
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
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: true, name: { en: 'Entity dashboard (copy)' } })
                .expect(201)

            expect(response.body.scopeEntityId).toBe('page-1')
            expect(response.body.baseLayoutId).toBeNull()
            expect(trx.query).toHaveBeenCalledTimes(4)

            const layoutInsertParams = (trx.query as jest.Mock).mock.calls[1]?.[1] as unknown[]
            expect(layoutInsertParams?.[0]).toBe('page-1')
            expect(layoutInsertParams?.[1]).toBeNull()
        })

        it('copies a shared language switcher placed in the marketing header', async () => {
            const trx = createLayoutCopyTransactionTrx({
                sourceLayout: {
                    id: layoutIdV7,
                    scope_entity_id: null,
                    base_layout_id: null,
                    template_key: 'marketing-page',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Marketing page' } }
                    },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                },
                copiedLayout: {
                    id: 'layout-copy-id',
                    scope_entity_id: null,
                    base_layout_id: null,
                    template_key: 'marketing-page',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Marketing page (copy)' } }
                    },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1,
                    _upl_created_at: '2026-02-26T00:00:00.000Z',
                    _upl_updated_at: '2026-02-26T00:00:00.000Z'
                },
                sourceWidgets: [
                    {
                        zone: 'marketing-header',
                        widget_key: 'languageSwitcher',
                        sort_order: 1,
                        config: {},
                        is_active: true
                    }
                ]
            })
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: true, name: { en: 'Marketing page (copy)' } })
                .expect(201)

            expect(trx.query).toHaveBeenCalledTimes(4)
            const widgetInsertParams = (trx.query as jest.Mock).mock.calls[3]?.[1] as unknown[]
            expect(JSON.parse(widgetInsertParams?.[4] as string)).toEqual({})
        })
    })

    describe('GET /metahub/:metahubId/layout/:layoutId/zone-widgets/object', () => {
        it('returns 400 for a non-v7 layout path', async () => {
            const app = buildApp()

            const response = await request(app).get('/metahub/metahub-1/layout/layout-1/zone-widgets/object').expect(400)

            expect(response.body.error).toBe('Invalid layout ID')
        })

        it('returns the canonical widget and zone metadata for the layout editor', async () => {
            const app = buildApp()

            const response = await request(app).get(`/metahub/metahub-1/layout/${layoutIdV7}/zone-widgets/object`).expect(200)

            expect(response.body.items).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        key: 'marketing.hero',
                        templateKey: 'marketing-page',
                        supportedTemplates: ['marketing-page'],
                        allowedZonesByTemplate: { 'marketing-page': ['marketing-main'] },
                        requiredHostCapabilities: [],
                        shared: false,
                        labelKey: 'layouts.widgets.marketing.hero',
                        defaultLabel: 'Hero'
                    }),
                    expect.objectContaining({
                        key: 'marketing.collection',
                        templateKey: 'marketing-page',
                        supportedTemplates: ['marketing-page'],
                        allowedZonesByTemplate: { 'marketing-page': ['marketing-main'] },
                        requiredHostCapabilities: [],
                        shared: false,
                        labelKey: 'layouts.widgets.marketing.collection',
                        defaultLabel: 'Collection'
                    })
                ])
            )

            const marketingTemplate = response.body.templates.find((template: { key?: string }) => template.key === 'marketing-page')
            expect(marketingTemplate).toEqual(
                expect.objectContaining({
                    key: 'marketing-page',
                    zones: expect.arrayContaining([
                        expect.objectContaining({
                            key: 'marketing-header',
                            labelKey: 'layouts.zones.marketingHeader'
                        }),
                        expect.objectContaining({
                            key: 'marketing-main',
                            labelKey: 'layouts.zones.marketingMain'
                        }),
                        expect.objectContaining({
                            key: 'marketing-footer',
                            labelKey: 'layouts.zones.marketingFooter'
                        })
                    ])
                })
            )
            expect(marketingTemplate.widgets).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        key: 'languageSwitcher',
                        templateKey: 'dashboard',
                        supportedTemplates: ['dashboard', 'marketing-page'],
                        allowedZonesByTemplate: {
                            dashboard: ['top'],
                            'marketing-page': ['marketing-header']
                        },
                        shared: true
                    })
                ])
            )
            expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(expect.anything(), 'test-user-id', 'metahub-1', undefined, undefined)
        })
    })

    describe('DELETE /metahub/:metahubId/layout/:layoutId', () => {
        it('deletes layout successfully', async () => {
            const app = buildApp()

            await request(app).delete(`/metahub/metahub-1/layout/${layoutIdV7}`).query({ expectedVersion: 1 }).expect(204)

            expect(mockDeleteLayout).toHaveBeenCalledWith('metahub-1', layoutIdV7, 1, 'test-user-id')
        })

        it('returns 409 when service reports deletion conflict', async () => {
            mockDeleteLayout.mockRejectedValueOnce(
                Object.assign(new Error('At least one active layout is required'), {
                    statusCode: 409
                })
            )

            const app = buildApp()
            const response = await request(app).delete(`/metahub/metahub-1/layout/${layoutIdV7}`).query({ expectedVersion: 1 }).expect(409)

            expect(response.body.error).toBe('At least one active layout is required')
        })
    })

    describe('UUID v7 ingress guards', () => {
        it('rejects non-v7 scope and base identities before create service access', async () => {
            const app = buildApp()

            await request(app)
                .post('/metahub/metahub-1/layouts')
                .send({
                    scopeEntityId: 'scope-1',
                    baseLayoutId: 'base-1',
                    name: { en: 'Scoped layout' }
                })
                .expect(400)
        })

        it('rejects a non-v7 widget path before widget deletion', async () => {
            const app = buildApp()

            const response = await request(app)
                .delete(`/metahub/metahub-1/layout/${layoutIdV7}/zone-widget/widget-1`)
                .query({ expectedVersion: 1 })
                .expect(400)

            expect(response.body.error).toBe('Invalid widget ID')
        })

        it('rejects a non-v7 scope path before scope visibility mutation', async () => {
            const app = buildApp()

            const response = await request(app)
                .patch(`/metahub/metahub-1/layout/${layoutIdV7}/zone-widget/${layoutIdV7}/scope-visibility/scope-1`)
                .send({ isVisible: true, expectedVersion: 1 })
                .expect(400)

            expect(response.body.error).toBe('Invalid scope entity ID')
        })

        it('rejects a non-v7 widget identity in the move body before the service', async () => {
            const app = buildApp()

            const response = await request(app)
                .patch(`/metahub/metahub-1/layout/${layoutIdV7}/zone-widgets/move`)
                .send({ widgetId: 'widget-1', expectedVersion: 1 })
                .expect(400)

            expect(response.body.error).toBe('Invalid input')
        })
    })
})
