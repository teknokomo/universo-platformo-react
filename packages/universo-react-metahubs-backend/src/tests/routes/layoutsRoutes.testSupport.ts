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
const mockReadWidgetBindings = jest.fn()
const mockUpdateWidgetBinding = jest.fn()
const mockListWidgetBindingSources = jest.fn()
const mockListWidgetBindingRecords = jest.fn()
const mockDiscoverWidgetBindingSources = jest.fn()
const mockDiscoverWidgetBindingRecords = jest.fn()
const mockProvisionWidgetBindingSource = jest.fn()
const mockGetWidgetBindingUsage = jest.fn()
const mockMetahubLayoutsServiceConstructor = jest.fn()
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
        MetahubLayoutsService: jest.fn().mockImplementation((...args: unknown[]) => {
            mockMetahubLayoutsServiceConstructor(...args)
            return {
                getLayoutById: (...serviceArgs: unknown[]) => mockGetLayoutById(...serviceArgs),
                deleteLayout: (...serviceArgs: unknown[]) => mockDeleteLayout(...serviceArgs),
                updateLayoutZoneSetting: (...serviceArgs: unknown[]) => mockUpdateLayoutZoneSetting(...serviceArgs),
                resetLayoutZoneSetting: (...serviceArgs: unknown[]) => mockResetLayoutZoneSetting(...serviceArgs),
                widgetBindings: {
                    readWidgetBindings: (...serviceArgs: unknown[]) => mockReadWidgetBindings(...serviceArgs),
                    updateWidgetBinding: (...serviceArgs: unknown[]) => mockUpdateWidgetBinding(...serviceArgs),
                    listWidgetBindingSources: (...serviceArgs: unknown[]) => mockListWidgetBindingSources(...serviceArgs),
                    discoverWidgetBindingSources: (...serviceArgs: unknown[]) => mockDiscoverWidgetBindingSources(...serviceArgs),
                    listWidgetBindingRecords: (...serviceArgs: unknown[]) => mockListWidgetBindingRecords(...serviceArgs),
                    discoverWidgetBindingRecords: (...serviceArgs: unknown[]) => mockDiscoverWidgetBindingRecords(...serviceArgs),
                    provisionWidgetBindingSource: (...serviceArgs: unknown[]) => mockProvisionWidgetBindingSource(...serviceArgs),
                    getWidgetBindingUsage: (...serviceArgs: unknown[]) => mockGetWidgetBindingUsage(...serviceArgs)
                }
            }
        })
    }
})

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
    scopeOwnerRow?: Record<string, unknown> | null
    baseLayoutRow?: Record<string, unknown> | null
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

    const queryMock = jest.fn(async (sql: string, queryParams: unknown[] = []) => {
        const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase()
        const parameterId = queryParams[0]

        if (normalizedSql.includes('pg_advisory_xact_lock')) return []

        if (normalizedSql.startsWith('select t.capabilities') && normalizedSql.includes('_mhb_objects')) {
            const defaultScopeOwner = { capabilities: { layoutConfig: { enabled: true } } }
            const ownerRows =
                params && Object.prototype.hasOwnProperty.call(params, 'scopeOwnerRow')
                    ? params.scopeOwnerRow
                        ? [params.scopeOwnerRow]
                        : []
                    : [defaultScopeOwner]
            return parameterId === sourceLayout.scope_entity_id ? ownerRows : []
        }

        if (normalizedSql.startsWith('select *') && normalizedSql.includes('_mhb_layouts')) {
            return parameterId === sourceLayout.id ? [canonicalSourceLayout] : []
        }

        if (normalizedSql.startsWith('select id, scope_entity_id, base_layout_id') && normalizedSql.includes('_mhb_layouts')) {
            const defaultBaseLayout = withCanonicalLayoutConfig({
                id: sourceLayout.base_layout_id,
                scope_entity_id: null,
                base_layout_id: null,
                template_key: sourceLayout.template_key,
                config: {}
            })
            const baseRows =
                params && Object.prototype.hasOwnProperty.call(params, 'baseLayoutRow')
                    ? params.baseLayoutRow
                        ? [params.baseLayoutRow]
                        : []
                    : [defaultBaseLayout]
            return parameterId === sourceLayout.base_layout_id ? baseRows : []
        }

        if (normalizedSql.startsWith('select id') && normalizedSql.includes('_mhb_widgets')) {
            if (parameterId === sourceLayout.id) return params?.sourceWidgets ?? []
            if (parameterId === sourceLayout.base_layout_id) return params?.baseWidgets ?? []
            return []
        }

        if (normalizedSql.startsWith('select base_widget_id') && normalizedSql.includes('_mhb_layout_widget_overrides')) {
            return parameterId === sourceLayout.id ? params?.sourceOverrides ?? [] : []
        }

        if (normalizedSql.startsWith('insert into') && normalizedSql.includes('_mhb_layouts')) {
            return [canonicalCreatedLayout]
        }

        if (normalizedSql.startsWith('insert into') && normalizedSql.includes('_mhb_widgets')) {
            const widgetCount = params?.sourceWidgets?.length ?? 0
            return Array.from({ length: params?.widgetInsertReturnCount ?? widgetCount }, (_, index) => ({
                id: String(params?.sourceWidgets?.[index]?.id ?? `copied-widget-${index}`)
            }))
        }

        if (normalizedSql.startsWith('insert into') && normalizedSql.includes('_mhb_layout_widget_overrides')) {
            const count =
                params?.overrideInsertReturnCount ?? Math.max(params?.sourceOverrides?.length ?? 0, params?.baseWidgets?.length ?? 0)
            return Array.from({ length: count }, (_, index) => ({
                id: String(
                    params?.baseWidgets?.[index]?.id ?? params?.sourceOverrides?.[index]?.base_widget_id ?? `copied-override-${index}`
                )
            }))
        }

        throw new Error(`Unexpected layout-copy fixture query: ${sql}`)
    })

    const trx: MockExecTransaction = {
        query: queryMock,
        transaction: jest.fn(async (callback: (trx: MockExecTransaction) => Promise<unknown>) => callback(trx)),
        isReleased: () => false
    }
    return trx
}

const findLayoutCopyQueryCalls = (trx: MockExecTransaction, action: 'SELECT' | 'INSERT', table: string) =>
    trx.query.mock.calls.filter(([sql]) => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim().toLowerCase()
        return normalizedSql.startsWith(action.toLowerCase()) && normalizedSql.includes(table.toLowerCase())
    })

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

export const resetLayoutsRouteMocks = () => {
    jest.clearAllMocks()
    mockFindMetahubById.mockResolvedValue({ id: 'metahub-1' })
    mockEnsureMetahubAccess.mockResolvedValue({ metahubId: 'metahub-1' })
    mockEnsureSchema.mockResolvedValue('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
    mockDeleteLayout.mockResolvedValue(undefined)
    mockUpdateLayoutZoneSetting.mockResolvedValue({ id: layoutIdV7, config: { appearance: 'kept' }, version: 5 })
    mockResetLayoutZoneSetting.mockResolvedValue({ id: layoutIdV7, config: { appearance: 'kept' }, version: 6 })
    mockReadWidgetBindings.mockResolvedValue({ widgetKey: 'marketing.hero', version: 4, bindings: [] })
    mockUpdateWidgetBinding.mockResolvedValue({ widgetKey: 'marketing.hero', version: 5 })
    mockListWidgetBindingSources.mockResolvedValue({
        widgetKey: 'marketing.hero',
        slot: 'content',
        selectorKinds: ['semantic-key'],
        sources: [],
        nextOffset: null,
        truncated: false
    })
    mockListWidgetBindingRecords.mockResolvedValue({
        widgetKey: 'marketing.hero',
        slot: 'content',
        sourceKey: 'MarketingPageHero',
        records: [],
        nextOffset: null,
        truncated: false
    })
    mockDiscoverWidgetBindingSources.mockResolvedValue({
        widgetKey: 'marketing.collection',
        slot: 'items',
        selectorKinds: ['record-set'],
        sources: [],
        nextOffset: null,
        truncated: false
    })
    mockDiscoverWidgetBindingRecords.mockResolvedValue({
        widgetKey: 'marketing.hero',
        slot: 'content',
        sourceKey: 'MarketingPageHero',
        records: [],
        selectedRecord: null,
        nextOffset: null,
        truncated: false
    })
    mockProvisionWidgetBindingSource.mockResolvedValue({
        widgetKey: 'marketing.hero',
        slot: 'content',
        source: { sourceKey: 'MarketingWidgetSourceNew', label: 'Alternative source', recordsCount: 0, selectorKinds: ['semantic-key'] }
    })
    mockGetWidgetBindingUsage.mockResolvedValue({ inUse: true })
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
}

export {
    request,
    mockFindMetahubById,
    mockEnsureMetahubAccess,
    mockEnsureSchema,
    mockGetLayoutById,
    mockDeleteLayout,
    mockUpdateLayoutZoneSetting,
    mockResetLayoutZoneSetting,
    mockReadWidgetBindings,
    mockUpdateWidgetBinding,
    mockListWidgetBindingSources,
    mockListWidgetBindingRecords,
    mockDiscoverWidgetBindingSources,
    mockDiscoverWidgetBindingRecords,
    mockProvisionWidgetBindingSource,
    mockGetWidgetBindingUsage,
    mockMetahubLayoutsServiceConstructor,
    layoutIdV7,
    baseLayoutIdV7,
    baseWidgetOneIdV7,
    baseWidgetTwoIdV7,
    createLayoutCopyTransactionTrx,
    findLayoutCopyQueryCalls,
    mockExec,
    buildApp,
    resetLayoutsRouteMocks
}
export type { MockExecTransaction }
