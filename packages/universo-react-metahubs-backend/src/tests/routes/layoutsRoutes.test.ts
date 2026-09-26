jest.mock('@universo-react/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import {
    buildSingleTargetWidgetBinding,
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    LAYOUT_WIDGET_DEFINITIONS
} from '@universo-react/types'
import { uuidV7Schema } from '@universo-react/utils'
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
const mockGetWidgetBinding = jest.fn()
const mockUpdateWidgetBinding = jest.fn()
const mockListBindingSources = jest.fn()
const mockProvisionBindingSource = jest.fn()
const mockGetBindingUsage = jest.fn()
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
            resetLayoutZoneSetting: (...args: unknown[]) => mockResetLayoutZoneSetting(...args),
            getLayoutZoneWidgetBindingTarget: (...args: unknown[]) => mockGetWidgetBinding(...args),
            updateLayoutZoneWidgetBinding: (...args: unknown[]) => mockUpdateWidgetBinding(...args),
            listMarketingHeroBindingSources: (...args: unknown[]) => mockListBindingSources(...args),
            provisionMarketingHeroBindingSource: (...args: unknown[]) => mockProvisionBindingSource(...args),
            getMarketingHeroBindingUsage: (...args: unknown[]) => mockGetBindingUsage(...args)
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
        copyWidgetsRequested?: boolean
        widgetInsertReturnCount?: number
        overrideInsertReturnCount?: number
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
        const copiesWidgets = params?.copyWidgetsRequested ?? params?.sourceWidgets !== undefined
        // Sequence: graph lock → lock source → (lock base) → optional source widgets → overlay reads → INSERT layout.
        queryMock.mockResolvedValueOnce([])
        queryMock.mockResolvedValueOnce([canonicalSourceLayout])
        if (isOverlayLayout) {
            queryMock.mockResolvedValueOnce([{ id: sourceLayout.base_layout_id }])
        }
        if (copiesWidgets) {
            queryMock.mockResolvedValueOnce(sourceWidgets)
        }
        if (isOverlayLayout) {
            queryMock.mockResolvedValueOnce(sourceOverrides)
            queryMock.mockResolvedValueOnce(baseWidgets)
        }
        queryMock.mockResolvedValueOnce([canonicalCreatedLayout])
        if (sourceWidgets.length > 0) {
            // INSERT widgets batch RETURNING id
            queryMock.mockResolvedValueOnce(
                Array.from({ length: params?.widgetInsertReturnCount ?? sourceWidgets.length }, (_, index) => ({
                    id: String(sourceWidgets[index]?.id ?? `copied-widget-${index}`)
                }))
            )
        }
        if (isOverlayLayout) {
            queryMock.mockResolvedValueOnce(
                Array.from(
                    { length: params?.overrideInsertReturnCount ?? Math.max(sourceOverrides.length, baseWidgets.length) },
                    (_, index) => ({
                        id: String(baseWidgets[index]?.id ?? sourceOverrides[index]?.base_widget_id ?? `copied-override-${index}`)
                    })
                )
            )
        }

        const trx: MockExecTransaction = {
            query: queryMock,
            transaction: jest.fn(async (callback: (trx: MockExecTransaction) => Promise<unknown>) => callback(trx)),
            isReleased: () => false
        }
        return trx
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
        mockGetWidgetBinding.mockResolvedValue({
            recordId: baseWidgetOneIdV7,
            recordVersion: 3,
            widgetVersion: 4,
            label: 'Product Hero'
        })
        mockUpdateWidgetBinding.mockResolvedValue({ id: baseWidgetOneIdV7, widgetKey: 'marketing.hero', version: 4 })
        mockListBindingSources.mockResolvedValue({ items: [] })
        mockProvisionBindingSource.mockResolvedValue({
            source: { entityId: baseWidgetOneIdV7 },
            initialRecord: { recordId: baseWidgetTwoIdV7 }
        })
        mockGetBindingUsage.mockResolvedValue({ recordId: baseWidgetOneIdV7, usageCount: 2 })
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
        const createBoundHeroMarketingLayoutTrx = () => {
            const heroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
            if (!heroDefinition) throw new Error('Expected marketing.hero to be registered')
            const heroInstanceKey = '0190a9b5-3cde-7abc-8def-0123456789d1'
            const heroBindings = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
                entityKind: 'object',
                entityCodename: 'MarketingPageHero',
                semanticKey: 'hero-featured'
            })
            const widgetContext = { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
            const sourceWidgetConfig = encodeWidgetConfigEnvelope(
                { rendererConfig: { instanceKey: heroInstanceKey }, neutral: { bindings: heroBindings } },
                widgetContext
            )
            const trx = createLayoutCopyTransactionTrx({
                sourceLayout: {
                    id: layoutIdV7,
                    scope_entity_id: null,
                    base_layout_id: null,
                    template_key: 'marketing-page',
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Marketing page' } } },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                },
                sourceWidgets: [
                    {
                        id: baseWidgetOneIdV7,
                        zone: 'marketing-main',
                        widget_key: 'marketing.hero',
                        sort_order: 1,
                        config: sourceWidgetConfig,
                        is_active: true
                    }
                ]
            })
            return { trx, widgetContext, heroBindings, heroInstanceKey }
        }

        const createOverlayWithInheritedBoundHeroTrx = (includeSourceOverride = false, copyWidgetsRequested = true) => {
            const heroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
            if (!heroDefinition) throw new Error('Expected marketing.hero to be registered')
            const heroInstanceKey = '0190a9b5-3cde-7abc-8def-0123456789d2'
            const heroBindings = buildSingleTargetWidgetBinding(heroDefinition, 'content', {
                entityKind: 'object',
                entityCodename: 'MarketingPageHero',
                semanticKey: 'hero-inherited'
            })
            const widgetContext = { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
            const baseWidgetConfig = encodeWidgetConfigEnvelope(
                { rendererConfig: { instanceKey: heroInstanceKey }, neutral: { bindings: heroBindings } },
                widgetContext
            )
            const sourceOverrideConfig = encodeWidgetConfigEnvelope(
                { rendererConfig: { instanceKey: heroInstanceKey }, neutral: { bindings: heroBindings } },
                widgetContext
            )
            const trx = createLayoutCopyTransactionTrx({
                sourceLayout: {
                    id: layoutIdV7,
                    scope_entity_id: '0190a9b5-3cde-7abc-8def-0123456789c1',
                    base_layout_id: baseLayoutIdV7,
                    template_key: 'marketing-page',
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Entity overlay' } } },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                },
                copiedLayout: {
                    id: 'layout-overlay-copy-id',
                    scope_entity_id: '0190a9b5-3cde-7abc-8def-0123456789c1',
                    base_layout_id: baseLayoutIdV7,
                    template_key: 'marketing-page',
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Entity overlay (copy)' } } },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                },
                sourceWidgets: [],
                copyWidgetsRequested,
                sourceOverrides: includeSourceOverride
                    ? [
                          {
                              base_widget_id: baseWidgetOneIdV7,
                              zone: null,
                              sort_order: null,
                              config: sourceOverrideConfig,
                              is_active: true,
                              is_deleted_override: false
                          }
                      ]
                    : [],
                baseWidgets: [
                    {
                        id: baseWidgetOneIdV7,
                        widget_key: 'marketing.hero',
                        zone: 'marketing-main',
                        sort_order: 1,
                        config: baseWidgetConfig,
                        is_active: true
                    }
                ]
            })
            return { trx, widgetContext, heroBindings, heroInstanceKey }
        }

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
            expect(trx.query).toHaveBeenCalledTimes(2)
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
            // Graph lock + source lock + INSERT layout, no widget queries
            expect(trx.query).toHaveBeenCalledTimes(3)
            const insertParams = (trx.query as jest.Mock).mock.calls[2]?.[1]
            const config = JSON.parse(insertParams?.[5] as string)
            expect(config.__skipDefaultZoneWidgetSeed).toBe(true)
        })

        it('rolls back a failed overlay copy after layout, widget, and override inserts', async () => {
            const trx = createLayoutCopyTransactionTrx({
                sourceLayout: {
                    id: layoutIdV7,
                    scope_entity_id: '0190a9b5-3cde-7abc-8def-0123456789c1',
                    base_layout_id: baseLayoutIdV7,
                    template_key: 'dashboard',
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Entity overlay' } } },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                },
                copiedLayout: {
                    id: 'layout-overlay-copy-id',
                    scope_entity_id: '0190a9b5-3cde-7abc-8def-0123456789c1',
                    base_layout_id: baseLayoutIdV7,
                    template_key: 'dashboard',
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Entity overlay (copy)' } } },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                },
                sourceWidgets: [
                    {
                        id: baseWidgetOneIdV7,
                        zone: 'left',
                        widget_key: 'menuWidget',
                        sort_order: 1,
                        config: {},
                        is_active: true
                    }
                ],
                sourceOverrides: [
                    {
                        base_widget_id: baseWidgetTwoIdV7,
                        zone: 'right',
                        sort_order: 2,
                        config: {},
                        is_active: true,
                        is_deleted_override: false
                    }
                ],
                baseWidgets: [
                    {
                        id: baseWidgetTwoIdV7,
                        zone: 'right',
                        widget_key: 'resourcePreview',
                        sort_order: 2,
                        config: {},
                        is_active: true
                    }
                ],
                overrideInsertReturnCount: 0
            })
            const persistedCopyState = { layouts: [] as unknown[][], widgets: [] as unknown[][], overrides: [] as unknown[][] }
            const query = trx.query
            trx.query = jest.fn(async (sql: string, queryParams?: unknown[]) => {
                const result = await query(sql, queryParams)
                const targetRows = sql.includes('_mhb_layout_widget_overrides')
                    ? persistedCopyState.overrides
                    : sql.includes('_mhb_widgets')
                    ? persistedCopyState.widgets
                    : sql.includes('_mhb_layouts')
                    ? persistedCopyState.layouts
                    : null
                if (targetRows && sql.includes('INSERT INTO')) targetRows.push(queryParams ?? [])
                return result
            })
            trx.transaction = jest.fn(async (callback: (transaction: unknown) => Promise<unknown>) => {
                const checkpoint = {
                    layouts: persistedCopyState.layouts.length,
                    widgets: persistedCopyState.widgets.length,
                    overrides: persistedCopyState.overrides.length
                }
                try {
                    return await callback(trx)
                } catch (error) {
                    persistedCopyState.layouts.length = checkpoint.layouts
                    persistedCopyState.widgets.length = checkpoint.widgets
                    persistedCopyState.overrides.length = checkpoint.overrides
                    throw error
                }
            })
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: true, name: { en: 'Main dashboard (copy)' } })
                .expect(500)

            expect(response.body.code).toBe('SCHEMA_SYNC_FAILED')
            expect(trx.transaction).toHaveBeenCalledTimes(1)
            expect(persistedCopyState).toEqual({ layouts: [], widgets: [], overrides: [] })
            expect((trx.query as jest.Mock).mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO')).length).toBe(3)
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

            // Graph lock + source lock + SELECT widgets + INSERT layout + INSERT widgets = 5 queries
            expect(trx.query).toHaveBeenCalledTimes(5)
            const widgetInsertParams = (trx.query as jest.Mock).mock.calls[4]?.[1] as unknown[]
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
            expect(trx.query).toHaveBeenCalledTimes(9)

            const layoutInsertCall = (trx.query as jest.Mock).mock.calls.find(
                ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_layouts')
            )
            const layoutInsertParams = layoutInsertCall?.[1] as unknown[]
            expect(layoutInsertParams?.[0]).toBe('object-1')
            expect(layoutInsertParams?.[1]).toBe(baseLayoutIdV7)

            const overrideInsertCall = (trx.query as jest.Mock).mock.calls.find(
                ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_layout_widget_overrides')
            )
            const overrideInsertParams = overrideInsertCall?.[1] as unknown[]
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
            expect(trx.query).toHaveBeenCalledTimes(5)

            const layoutInsertParams = (trx.query as jest.Mock).mock.calls[3]?.[1] as unknown[]
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

            expect(trx.query).toHaveBeenCalledTimes(5)
            const widgetInsertParams = (trx.query as jest.Mock).mock.calls[4]?.[1] as unknown[]
            expect(JSON.parse(widgetInsertParams?.[4] as string)).toEqual({})
        })

        it('requires an explicit choice before copying a bound Hero placement', async () => {
            const { trx } = createBoundHeroMarketingLayoutTrx()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            const response = await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ name: { en: 'Marketing page (copy)' } })
                .expect(409)

            expect(response.body.code).toBe('MARKETING_HERO_COPY_MODE_REQUIRED')
            expect((trx.query as jest.Mock).mock.calls.some(([sql]) => /^\s*INSERT\b/iu.test(String(sql)))).toBe(false)
        })

        it('requires an explicit choice when a scoped overlay inherits a bound Hero from its base layout', async () => {
            const { trx } = createOverlayWithInheritedBoundHeroTrx()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const response = await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: true, name: { en: 'Entity overlay copy' } })
                .expect(409)

            expect(response.body.code).toBe('MARKETING_HERO_COPY_MODE_REQUIRED')
            expect((trx.query as jest.Mock).mock.calls.some(([sql]) => /^\s*INSERT\b/iu.test(String(sql)))).toBe(false)
        })

        it('writes a tombstone when omitting a bound Hero inherited by a scoped overlay copy', async () => {
            const { trx } = createOverlayWithInheritedBoundHeroTrx()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: true, heroBindingCopyMode: 'omit', name: { en: 'Entity overlay without Hero' } })
                .expect(201)

            const overrideInsert = (trx.query as jest.Mock).mock.calls.find(
                ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_layout_widget_overrides')
            )
            expect(overrideInsert).toBeDefined()
            const insertedOverrideParams = overrideInsert?.[1] as unknown[] | undefined
            expect(insertedOverrideParams?.slice(0, 7)).toEqual(['layout-overlay-copy-id', baseWidgetOneIdV7, null, null, null, null, true])
        })

        it('requires a Hero copy choice when an overlay is copied without local widgets', async () => {
            const { trx } = createOverlayWithInheritedBoundHeroTrx(false, false)
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const response = await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: false, name: { en: 'Entity overlay copy without local widgets' } })
                .expect(409)

            expect(response.body.code).toBe('MARKETING_HERO_COPY_MODE_REQUIRED')
            expect((trx.query as jest.Mock).mock.calls.some(([sql]) => /^\s*INSERT\b/iu.test(String(sql)))).toBe(false)
        })

        it('writes an inherited Hero tombstone when copyWidgets is disabled and omit is explicit', async () => {
            const { trx } = createOverlayWithInheritedBoundHeroTrx(false, false)
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({
                    copyWidgets: false,
                    heroBindingCopyMode: 'omit',
                    name: { en: 'Entity overlay without inherited Hero' }
                })
                .expect(201)

            expect(
                (trx.query as jest.Mock).mock.calls.some(
                    ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_widgets')
                )
            ).toBe(false)
            const overrideInsert = (trx.query as jest.Mock).mock.calls.find(
                ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_layout_widget_overrides')
            )
            expect(overrideInsert).toBeDefined()
            const insertedOverrideParams = overrideInsert?.[1] as unknown[] | undefined
            expect(insertedOverrideParams?.slice(0, 7)).toEqual(['layout-overlay-copy-id', baseWidgetOneIdV7, null, null, null, null, true])
        })

        it('rolls back an inherited Hero tombstone copy when the override insert fails', async () => {
            const { trx } = createOverlayWithInheritedBoundHeroTrx()
            const persistedCopyState = { layouts: [] as unknown[][], overrides: [] as unknown[][] }
            const query = trx.query
            trx.query = jest.fn(async (sql: string, queryParams?: unknown[]) => {
                if (sql.includes('_mhb_layout_widget_overrides') && /^\s*INSERT\b/iu.test(sql)) {
                    await query(sql, queryParams)
                    return []
                }

                const result = await query(sql, queryParams)
                if (sql.includes('_mhb_layouts') && /^\s*INSERT\b/iu.test(sql)) {
                    persistedCopyState.layouts.push(queryParams ?? [])
                }
                return result
            })
            trx.transaction = jest.fn(async (callback: (transaction: unknown) => Promise<unknown>) => {
                const layoutCheckpoint = persistedCopyState.layouts.length
                const overrideCheckpoint = persistedCopyState.overrides.length
                try {
                    return await callback(trx)
                } catch (error) {
                    persistedCopyState.layouts.length = layoutCheckpoint
                    persistedCopyState.overrides.length = overrideCheckpoint
                    throw error
                }
            })
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const response = await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({
                    copyWidgets: true,
                    heroBindingCopyMode: 'omit',
                    name: { en: 'Entity overlay without Hero (copy)' }
                })
                .expect(500)

            expect(response.body.code).toBe('SCHEMA_SYNC_FAILED')
            expect(trx.transaction).toHaveBeenCalledTimes(1)
            expect(persistedCopyState).toEqual({ layouts: [], overrides: [] })
            expect(
                (trx.query as jest.Mock).mock.calls.some(
                    ([sql]) => String(sql).includes('_mhb_layout_widget_overrides') && /^\s*INSERT\b/iu.test(String(sql))
                )
            ).toBe(true)
        })

        it('preserves an overridden inherited Hero binding when a scoped overlay is copied with reuse', async () => {
            const { trx, widgetContext, heroBindings, heroInstanceKey } = createOverlayWithInheritedBoundHeroTrx(true)
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ copyWidgets: true, heroBindingCopyMode: 'reuse', name: { en: 'Entity overlay reuse copy' } })
                .expect(201)

            const overrideInsert = (trx.query as jest.Mock).mock.calls.find(
                ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_layout_widget_overrides')
            )
            expect(overrideInsert).toBeDefined()
            const insertedOverrideParams = overrideInsert?.[1] as unknown[] | undefined
            expect(insertedOverrideParams?.slice(0, 2)).toEqual(['layout-overlay-copy-id', baseWidgetOneIdV7])
            expect(insertedOverrideParams?.[6]).toBe(false)

            const copiedOverrideConfig = JSON.parse(String(insertedOverrideParams?.[4])) as Record<string, unknown>
            const copiedOverride = decodeWidgetConfigEnvelope(copiedOverrideConfig, widgetContext)
            expect(copiedOverride.rendererConfig.instanceKey).toBe(heroInstanceKey)
            expect(copiedOverride.neutral.bindings).toEqual(heroBindings)
        })

        it('copies a Hero-bound marketing layout within its metahub when reuse is explicit', async () => {
            const { trx, widgetContext, heroBindings, heroInstanceKey } = createBoundHeroMarketingLayoutTrx()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ name: { en: 'Marketing page (copy)' }, heroBindingCopyMode: 'reuse' })
                .expect(201)

            expect(mockEnsureSchema).toHaveBeenCalledWith('metahub-1', 'test-user-id')
            const widgetInsert = (trx.query as jest.Mock).mock.calls.find(
                ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_widgets')
            )
            expect(widgetInsert).toBeDefined()

            const insertParams = widgetInsert?.[1] as unknown[]
            const copiedWidgetConfig = JSON.parse(String(insertParams?.[4])) as Record<string, unknown>
            const copiedWidget = decodeWidgetConfigEnvelope(copiedWidgetConfig, widgetContext)
            expect(copiedWidget.neutral.bindings).toEqual(heroBindings)
            expect(copiedWidget.rendererConfig.instanceKey).toBe(heroInstanceKey)
            expect(uuidV7Schema.safeParse(copiedWidget.rendererConfig.instanceKey).success).toBe(true)
            expect(JSON.stringify(copiedWidget.neutral.bindings)).not.toContain('0190a9b5-3cde-7abc-8def-0123456789c1')
        })

        it('omits bound Hero placements when the copy choice requests it', async () => {
            const { trx } = createBoundHeroMarketingLayoutTrx()
            ;(mockExec.transaction as jest.Mock).mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) =>
                callback(trx)
            )

            const app = buildApp()
            await request(app)
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/copy`)
                .send({ name: { en: 'Marketing page (copy)' }, heroBindingCopyMode: 'omit' })
                .expect(201)

            expect(
                (trx.query as jest.Mock).mock.calls.some(
                    ([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('_mhb_widgets')
                )
            ).toBe(false)
        })

        it('rejects malformed Hero binding metadata before writing the copied layout', async () => {
            const trx = createLayoutCopyTransactionTrx({
                sourceLayout: {
                    id: layoutIdV7,
                    scope_entity_id: null,
                    base_layout_id: null,
                    template_key: 'marketing-page',
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Marketing page' } } },
                    description: null,
                    config: {},
                    is_active: true,
                    is_default: false,
                    sort_order: 0,
                    _upl_version: 1
                },
                sourceWidgets: [
                    {
                        id: baseWidgetOneIdV7,
                        zone: 'marketing-main',
                        widget_key: 'marketing.hero',
                        sort_order: 1,
                        config: {
                            instanceKey: 'hero-source-instance',
                            __layout: {
                                bindings: {
                                    version: 1,
                                    slots: [
                                        {
                                            slot: 'content',
                                            targets: [
                                                {
                                                    entityKind: 'object',
                                                    entityCodename: 'MarketingPageHero',
                                                    selector: { kind: 'semantic-key', field: 'key', value: 'default' },
                                                    projection: []
                                                }
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
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
                .send({ name: { en: 'Invalid Hero copy' } })
                .expect(409)

            expect(response.body.error).toBe('Layout widget configuration is invalid')
            expect((trx.query as jest.Mock).mock.calls.some(([sql]) => /^\s*INSERT\b/iu.test(String(sql)))).toBe(false)
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

    describe('Hero binding routes', () => {
        it('lists only the registered Hero content sources', async () => {
            const response = await request(buildApp())
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-sources/marketing.hero/content`)
                .query({ locale: 'ru', excludeWidgetId: baseWidgetOneIdV7 })
                .expect(200)
            expect(response.body).toEqual({ items: [] })
            expect(mockListBindingSources).toHaveBeenCalledWith('metahub-1', layoutIdV7, 'ru', 'test-user-id', baseWidgetOneIdV7)
            await request(buildApp())
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-sources/marketing.hero/content`)
                .query({ excludeWidgetId: 'not-a-uuid' })
                .expect(400)
            await request(buildApp())
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-sources/marketing.brand/content`)
                .expect(404)
        })

        it('provisions a Hero source only with both layout and content permissions', async () => {
            const response = await request(buildApp())
                .post(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-sources/marketing.hero/content`)
                .send({ codename: 'custom_hero', name: { en: 'Custom Hero', ru: 'Свой первый экран' } })
                .expect(201)
            expect(response.body.initialRecord.recordId).toBe(baseWidgetTwoIdV7)
            expect(mockEnsureMetahubAccess).toHaveBeenNthCalledWith(
                1,
                expect.anything(),
                'test-user-id',
                'metahub-1',
                'manageMetahub',
                undefined
            )
            expect(mockEnsureMetahubAccess).toHaveBeenNthCalledWith(2, expect.anything(), 'test-user-id', 'metahub-1', 'editContent')
        })

        it('reports semantic binding usage for a record', async () => {
            const response = await request(buildApp())
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/widget-binding-usage`)
                .query({ recordId: baseWidgetOneIdV7, excludeWidgetId: baseWidgetTwoIdV7 })
                .expect(200)
            expect(response.body.usageCount).toBe(2)
            expect(mockGetBindingUsage).toHaveBeenCalledWith('metahub-1', baseWidgetOneIdV7, baseWidgetTwoIdV7, 'test-user-id')
            expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(expect.anything(), 'test-user-id', 'metahub-1', 'editContent', undefined)
        })

        it('returns the current record details required by the authoring picker', async () => {
            const app = buildApp()
            const response = await request(app)
                .get(`/metahub/metahub-1/layout/${layoutIdV7}/zone-widget/${baseWidgetOneIdV7}/binding`)
                .query({ locale: 'ru' })
                .expect(200)

            expect(response.body).toEqual({ recordId: baseWidgetOneIdV7, recordVersion: 3, widgetVersion: 4, label: 'Product Hero' })
            expect(mockGetWidgetBinding).toHaveBeenCalledWith('metahub-1', layoutIdV7, baseWidgetOneIdV7, 'ru', 'test-user-id')
            expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(expect.anything(), 'test-user-id', 'metahub-1', 'editContent', undefined)
        })

        it('rejects non-v7 rebind targets and passes valid optimistic versions to the service', async () => {
            const app = buildApp()
            await request(app)
                .patch(`/metahub/metahub-1/layout/${layoutIdV7}/zone-widget/${baseWidgetOneIdV7}/binding`)
                .send({ recordId: '550e8400-e29b-41d4-a716-446655440000', expectedVersion: 1 })
                .expect(400)

            const response = await request(app)
                .patch(`/metahub/metahub-1/layout/${layoutIdV7}/zone-widget/${baseWidgetOneIdV7}/binding`)
                .send({ recordId: baseWidgetTwoIdV7, expectedVersion: 3 })
                .expect(200)

            expect(response.body).toEqual({ id: baseWidgetOneIdV7, widgetKey: 'marketing.hero', version: 4 })
            expect(response.body).not.toHaveProperty('item')
            expect(mockUpdateWidgetBinding).toHaveBeenCalledWith(
                'metahub-1',
                layoutIdV7,
                baseWidgetOneIdV7,
                { recordId: baseWidgetTwoIdV7, expectedVersion: 3 },
                'test-user-id'
            )
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
