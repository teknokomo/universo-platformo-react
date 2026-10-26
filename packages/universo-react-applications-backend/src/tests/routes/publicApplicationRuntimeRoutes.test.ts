import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo-react/utils'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

const mockResolvePublicApplication = jest.fn()
const mockResolvePublicEntryWorkspace = jest.fn()
const mockResolvePublicDashboardWorkspace = jest.fn()
const mockResolveEffectiveLayout = jest.fn()
const mockResolvePublicLayoutStructure = jest.fn()
const mockProjectPublicDashboardRuntime = jest.fn()
const mockResolveInterpretationNetworkRuntimeSurface = jest.fn()
const mockReadPublicInterpretationNetwork = jest.fn()
const mockCreateMarketingController = jest.fn()
const mockCreatePublicMarketingBindingRecordLoader = jest.fn()
const mockSerializePublicMarketingRuntime = jest.fn()
const mockPublicMarketingRecordLoader = jest.fn()

jest.mock('../../services/publicApplicationRuntime', () => ({
    __esModule: true,
    ...jest.requireActual('../../services/publicApplicationRuntime'),
    resolvePublicApplication: (...args: unknown[]) => mockResolvePublicApplication(...args)
}))

jest.mock('../../services/applicationWorkspaces', () => ({
    __esModule: true,
    ...jest.requireActual('../../services/applicationWorkspaces'),
    resolvePublicEntryWorkspace: (...args: unknown[]) => mockResolvePublicEntryWorkspace(...args),
    resolvePublicDashboardWorkspace: (...args: unknown[]) => mockResolvePublicDashboardWorkspace(...args)
}))

jest.mock('../../services/effectiveLayoutResolver', () => ({
    __esModule: true,
    resolveEffectiveLayoutForPublicTransaction: (...args: unknown[]) => mockResolveEffectiveLayout(...args)
}))

jest.mock('../../services/effectiveLayoutResolverCore', () => ({
    __esModule: true,
    ...jest.requireActual('../../services/effectiveLayoutResolverCore'),
    resolveEffectiveLayoutForPublicTransactionWithRuntimeData: (...args: unknown[]) => mockResolvePublicLayoutStructure(...args)
}))

jest.mock('../../services/publicDashboardRuntime', () => ({
    __esModule: true,
    ...jest.requireActual('../../services/publicDashboardRuntime'),
    projectPublicDashboardRuntime: (...args: unknown[]) => mockProjectPublicDashboardRuntime(...args)
}))

jest.mock('../../services/interpretationNetwork/runtimeInterpretationNetworkSurface', () => ({
    __esModule: true,
    ...jest.requireActual('../../services/interpretationNetwork/runtimeInterpretationNetworkSurface'),
    resolveInterpretationNetworkRuntimeSurface: (...args: unknown[]) => mockResolveInterpretationNetworkRuntimeSurface(...args)
}))

jest.mock('../../services/publicInterpretationNetworkRuntime', () => ({
    __esModule: true,
    ...jest.requireActual('../../services/publicInterpretationNetworkRuntime'),
    readPublicInterpretationNetwork: (...args: unknown[]) => mockReadPublicInterpretationNetwork(...args)
}))

jest.mock('../../controllers/runtimeMarketingPageController', () => ({
    __esModule: true,
    createRuntimeMarketingPageController: (...args: unknown[]) => mockCreateMarketingController(...args)
}))

jest.mock('../../persistence/publicApplicationRuntimeStore', () => ({
    __esModule: true,
    ...jest.requireActual('../../persistence/publicApplicationRuntimeStore'),
    createPublicMarketingBindingRecordLoader: (...args: unknown[]) => mockCreatePublicMarketingBindingRecordLoader(...args)
}))

jest.mock('../../services/publicMarketingRuntime', () => ({
    __esModule: true,
    ...jest.requireActual('../../services/publicMarketingRuntime'),
    serializePublicMarketingRuntime: (...args: unknown[]) => mockSerializePublicMarketingRuntime(...args)
}))

import { createPublicApplicationRuntimeRoutes } from '../../routes/publicApplicationRuntimeRoutes'
import { PublicApplicationUnavailableError } from '../../services/publicApplicationRuntime'
import { EffectiveLayoutError } from '../../services/effectiveLayoutContract'

const applicationId = '0190a9b5-3cde-7abc-8def-0123456789ab'
const layoutId = '0190a9b5-3cde-7abc-8def-0123456789ac'
const interpretationNetworkWidgetId = '0190a9b5-3cde-7abc-8def-0123456789ad'
const schemaName = 'app_0190a9b53cde7abc8def0123456789ab'
const workspaceId = '0190a9b5-3cde-7abc-8def-0123456789ae'
const interpretationNetworkInstanceKey = 'interpretation-workspace'

const dashboardLayout = () => ({
    status: 'ok',
    target: { applicationId, targetKind: null, locale: 'en' },
    layout: { id: layoutId, templateKey: 'dashboard' },
    widgets: [
        {
            id: interpretationNetworkWidgetId,
            layoutId,
            instanceKey: interpretationNetworkInstanceKey,
            parentInstanceKey: null,
            slotKey: null,
            zone: 'center',
            semanticRegion: 'main',
            widgetKey: 'interpretationNetworkWorkspace',
            sortOrder: 0,
            config: {},
            isActive: true
        }
    ]
})

const publicMarketingPayload = {
    route: {
        matchedBy: 'uuid',
        matchedAlias: null,
        routingMode: 'direct',
        primaryAlias: null,
        canonicalAlias: null
    },
    templateKey: 'marketing-page',
    marketingPage: {
        templateKey: 'marketing-page',
        locale: 'en',
        config: {
            themeMode: 'system',
            allowEmailActions: true,
            allowTelephoneActions: true,
            externalLinkTarget: 'new-tab'
        },
        widgets: [
            {
                instanceKey: 'marketing-image-0',
                zone: 'marketing-main',
                widgetKey: 'marketing.image',
                sortOrder: 0,
                isActive: true,
                config: {},
                data: {
                    records: [
                        {
                            kind: 'image',
                            semanticKey: 'hero-image',
                            order: 0,
                            isVisible: true,
                            media: {
                                kind: 'hero',
                                resource: { type: 'url', url: 'https://example.test/hero.webp', launchMode: 'inline' },
                                decorative: true
                            }
                        }
                    ]
                }
            }
        ]
    }
}

const readLimiter = ((_req: Request, _res: Response, next: NextFunction) => next()) as RateLimitRequestHandler

const createExecutor = () => {
    const tx = { query: jest.fn() } as unknown as DbExecutor
    const executor = {
        query: jest.fn(),
        transaction: jest.fn(async (callback: (transaction: DbExecutor) => Promise<unknown>) => callback(tx))
    } as unknown as DbExecutor
    return { executor, tx }
}

const resolvedApplication = (overrides: Record<string, unknown> = {}) => ({
    application: {
        id: applicationId,
        schemaName,
        schemaStatus: 'synced',
        isPublic: true,
        workspacesEnabled: false,
        aliasRoutingMode: 'direct',
        installedReleaseMetadata: {},
        lastSyncedPublicationVersionId: null,
        uplArchived: false,
        uplDeleted: false,
        appPublished: true,
        appArchived: false,
        appDeleted: false,
        hasActiveAlias: false,
        matchedAlias: null,
        primaryAlias: null,
        ...overrides
    },
    route: {
        applicationId,
        matchedBy: 'uuid',
        matchedAlias: null,
        routingMode: 'direct',
        primaryAlias: null,
        canonicalAlias: null
    }
})

describe('public application runtime routes', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockResolvePublicApplication.mockResolvedValue(resolvedApplication())
        mockResolvePublicEntryWorkspace.mockResolvedValue(null)
        mockResolvePublicDashboardWorkspace.mockResolvedValue(null)
        mockResolveEffectiveLayout.mockResolvedValue({ layout: { id: layoutId }, widgets: [] })
        mockResolvePublicLayoutStructure.mockResolvedValue({ layout: { id: layoutId, templateKey: 'marketing-page' }, widgets: [] })
        mockProjectPublicDashboardRuntime.mockResolvedValue({ locale: 'en', workspaceAvailability: 'none', placements: [] })
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'ready',
            applicationId,
            schemaName,
            workspaceId: null,
            layoutId,
            widgetId: interpretationNetworkWidgetId,
            widgetKey: 'interpretationNetworkWorkspace'
        })
        mockReadPublicInterpretationNetwork.mockResolvedValue({
            locale: 'en',
            view: 'structures',
            items: [],
            page: { offset: 0, limit: 100, hasMore: false }
        })
        mockCreatePublicMarketingBindingRecordLoader.mockReturnValue(mockPublicMarketingRecordLoader)
        mockSerializePublicMarketingRuntime.mockReturnValue(publicMarketingPayload)
        mockCreateMarketingController.mockImplementation((_getExecutor, options) => ({
            getMarketingPage: async (req: Request, res: Response) => {
                const context = await options.resolveRuntimeContext(req, res)
                await options.resolveEffectiveLayout(context, applicationId, { applicationId, locale: 'en' })
                return res.status(200).json(publicMarketingPayload)
            }
        }))
    })

    it('uses one transaction executor and returns a redacted no-store public payload', async () => {
        const { executor, tx } = createExecutor()
        const app = express()
        app.use(createPublicApplicationRuntimeRoutes(() => executor, readLimiter))

        const response = await request(app).get(`/public/applications/${applicationId}/runtime?locale=en`).expect(200)

        expect(response.headers['cache-control']).toBe('no-store')
        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(tx.query).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
        expect(mockResolvePublicApplication).toHaveBeenCalledWith(tx, applicationId)
        expect(mockCreateMarketingController).not.toHaveBeenCalled()
        expect(mockCreatePublicMarketingBindingRecordLoader).toHaveBeenCalledWith(tx, {
            schemaName,
            workspaceId: null
        })
        expect(mockSerializePublicMarketingRuntime).toHaveBeenCalledWith({
            route: resolvedApplication().route,
            locale: 'en',
            effectiveLayout: { layout: { id: layoutId, templateKey: 'marketing-page' }, widgets: [] },
            loadRecords: mockPublicMarketingRecordLoader
        })
        expect(mockResolveEffectiveLayout).not.toHaveBeenCalled()
        expect(response.body.route).toEqual({
            matchedBy: 'uuid',
            matchedAlias: null,
            routingMode: 'direct',
            primaryAlias: null,
            canonicalAlias: null
        })
        expect(JSON.stringify(response.body)).not.toContain(applicationId)
        expect(JSON.stringify(response.body)).not.toContain(layoutId)
        expect(response.body.marketingPage.runtime).toBeUndefined()
        expect(response.body.marketingPage.provenance).toBeUndefined()
        expect(JSON.stringify(response.body)).not.toContain('sourceContentHash')
        expect(JSON.stringify(response.body)).not.toContain('sourceLayoutId')
    })

    it('selects and pins the designated public workspace before renderer reads', async () => {
        const { executor, tx } = createExecutor()
        const workspaceId = '0190a9b5-3cde-7abc-8def-0123456789ad'
        mockResolvePublicApplication.mockResolvedValue(resolvedApplication({ workspacesEnabled: true }))
        mockResolvePublicEntryWorkspace.mockResolvedValue({ workspaceId })
        mockResolvePublicDashboardWorkspace.mockResolvedValue({ workspaceId })
        const app = express()
        app.use(createPublicApplicationRuntimeRoutes(() => executor, readLimiter))

        await request(app).get(`/public/applications/${applicationId}/runtime?locale=en`).expect(200)

        expect(mockResolvePublicEntryWorkspace).toHaveBeenCalledWith(tx, schemaName)
        expect(mockResolvePublicEntryWorkspace).toHaveBeenCalledTimes(1)
        expect(mockResolveEffectiveLayout).not.toHaveBeenCalled()
        expect(mockCreatePublicMarketingBindingRecordLoader).toHaveBeenCalledWith(tx, { schemaName, workspaceId })
        expect(mockCreateMarketingController).not.toHaveBeenCalled()
    })

    it('dispatches Dashboard through the public projection after structure-only layout resolution', async () => {
        const { executor, tx } = createExecutor()
        mockResolvePublicApplication.mockResolvedValue(resolvedApplication({ workspacesEnabled: true }))
        mockResolvePublicEntryWorkspace.mockResolvedValue({ workspaceId })
        mockResolvePublicLayoutStructure.mockResolvedValue(dashboardLayout())
        mockProjectPublicDashboardRuntime.mockResolvedValue({ locale: 'ru', workspaceAvailability: 'available', placements: [] })
        const app = express()
        app.use(createPublicApplicationRuntimeRoutes(() => executor, readLimiter))

        const response = await request(app).get(`/public/applications/${applicationId}/runtime?locale=ru`).expect(200)

        expect(response.headers['cache-control']).toBe('no-store')
        expect(response.body).toEqual({
            route: {
                matchedBy: 'uuid',
                matchedAlias: null,
                routingMode: 'direct',
                primaryAlias: null,
                canonicalAlias: null
            },
            templateKey: 'dashboard',
            dashboard: { locale: 'ru', workspaceAvailability: 'available', placements: [] }
        })
        expect(mockResolvePublicLayoutStructure).toHaveBeenCalledWith(tx, expect.any(Object), workspaceId, expect.any(Function))
        expect(mockProjectPublicDashboardRuntime).toHaveBeenCalledWith({
            executor: tx,
            resolved: resolvedApplication({ workspacesEnabled: true }),
            workspaceId,
            workspaceAvailable: true,
            locale: 'ru',
            effectiveLayout: dashboardLayout()
        })
        expect(mockSerializePublicMarketingRuntime).not.toHaveBeenCalled()
        expect(mockResolveEffectiveLayout).not.toHaveBeenCalled()
    })

    it('renders a public Dashboard empty state when no shared workspace is available', async () => {
        const { executor, tx } = createExecutor()
        mockResolvePublicApplication.mockResolvedValue(resolvedApplication({ workspacesEnabled: true }))
        mockResolvePublicLayoutStructure.mockResolvedValue(dashboardLayout())
        mockProjectPublicDashboardRuntime.mockResolvedValue({ locale: 'en', workspaceAvailability: 'none', placements: [] })
        const app = express()
        app.use(createPublicApplicationRuntimeRoutes(() => executor, readLimiter))

        const response = await request(app).get(`/public/applications/${applicationId}/runtime?locale=en`).expect(200)

        expect(response.body.templateKey).toBe('dashboard')
        expect(response.body.dashboard.workspaceAvailability).toBe('none')
        expect(mockResolvePublicEntryWorkspace).toHaveBeenCalledWith(tx, schemaName)
        expect(mockResolvePublicDashboardWorkspace).toHaveBeenCalledWith(tx, schemaName)
        expect(mockResolvePublicLayoutStructure).toHaveBeenCalledWith(tx, expect.any(Object), null, expect.any(Function), {
            allowMissingWorkspace: true
        })
        expect(mockProjectPublicDashboardRuntime).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: null, workspaceAvailable: false })
        )
    })

    it('re-resolves public workspace, target, active placement and ready IN surface for each specialized read', async () => {
        const { executor, tx } = createExecutor()
        mockResolvePublicApplication.mockResolvedValue(resolvedApplication({ workspacesEnabled: true }))
        mockResolvePublicDashboardWorkspace.mockResolvedValue({ workspaceId })
        mockResolvePublicLayoutStructure.mockResolvedValue(dashboardLayout())
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'ready',
            applicationId,
            schemaName,
            workspaceId,
            layoutId,
            widgetId: interpretationNetworkWidgetId,
            widgetKey: 'interpretationNetworkWorkspace'
        })
        const app = express()
        app.use(createPublicApplicationRuntimeRoutes(() => executor, readLimiter))

        const response = await request(app)
            .get(
                `/public/applications/${applicationId}/runtime/widgets/${interpretationNetworkInstanceKey}/interpretation-network?locale=en&view=structures`
            )
            .expect(200)

        expect(response.headers['cache-control']).toBe('no-store')
        expect(response.body).toEqual({ locale: 'en', view: 'structures', items: [], page: { offset: 0, limit: 100, hasMore: false } })
        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(tx.query).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
        expect(mockResolvePublicApplication).toHaveBeenCalledWith(tx, applicationId)
        expect(mockResolvePublicDashboardWorkspace).toHaveBeenCalledWith(tx, schemaName)
        expect(mockResolvePublicLayoutStructure).toHaveBeenCalledWith(tx, expect.any(Object), workspaceId, expect.any(Function))
        expect(mockResolveInterpretationNetworkRuntimeSurface).toHaveBeenCalledWith(tx, {
            applicationId,
            schemaName,
            workspaceId,
            scopeEntityId: null,
            layoutId,
            widgetId: interpretationNetworkWidgetId
        })
        expect(mockReadPublicInterpretationNetwork).toHaveBeenCalledWith(
            expect.objectContaining({
                executor: tx,
                layoutId,
                widgetId: interpretationNetworkWidgetId,
                instanceKey: interpretationNetworkInstanceKey
            })
        )
        const payload = JSON.stringify(response.body)
        for (const internalId of [applicationId, layoutId, interpretationNetworkWidgetId, workspaceId])
            expect(payload).not.toContain(internalId)
    })

    it('returns the same private/unready 404 for inactive placement and mismatched RLS surface', async () => {
        const { executor } = createExecutor()
        mockResolvePublicLayoutStructure.mockResolvedValue(dashboardLayout())
        const app = express()
        app.use(createPublicApplicationRuntimeRoutes(() => executor, readLimiter))

        const inactive = await request(app)
            .get(`/public/applications/${applicationId}/runtime/widgets/other-widget/interpretation-network?locale=en`)
            .expect(404)
        expect(inactive.body).toEqual({ code: 'PUBLIC_APPLICATION_NOT_AVAILABLE' })
        expect(inactive.headers['cache-control']).toBe('no-store')
        expect(mockResolveInterpretationNetworkRuntimeSurface).not.toHaveBeenCalled()

        mockResolvePublicApplication.mockResolvedValue(resolvedApplication({ workspacesEnabled: true }))
        mockResolvePublicEntryWorkspace.mockResolvedValue({ workspaceId })
        mockResolveInterpretationNetworkRuntimeSurface.mockResolvedValue({
            featureState: 'ready',
            applicationId,
            schemaName,
            workspaceId: '0190a9b5-3cde-7abc-8def-0123456789af',
            layoutId,
            widgetId: interpretationNetworkWidgetId,
            widgetKey: 'interpretationNetworkWorkspace'
        })
        const mismatched = await request(app)
            .get(
                `/public/applications/${applicationId}/runtime/widgets/${interpretationNetworkInstanceKey}/interpretation-network?locale=en`
            )
            .expect(404)
        expect(mismatched.body).toEqual(inactive.body)
        expect(mismatched.headers['cache-control']).toBe('no-store')
        expect(mockReadPublicInterpretationNetwork).not.toHaveBeenCalled()
    })

    it('keeps specialized read failures retryable and applies the public runtime limiter', async () => {
        const { executor } = createExecutor()
        mockResolvePublicLayoutStructure.mockResolvedValue(dashboardLayout())
        mockReadPublicInterpretationNetwork.mockRejectedValue(new Error('temporary read failure'))
        const limiter = Object.assign(
            jest.fn((_req: Request, _res: Response, next: NextFunction) => next()),
            {
                resetKey: (_key: string) => undefined,
                getKey: (_key: string) => undefined
            }
        ) satisfies RateLimitRequestHandler
        const app = express()
        app.use(createPublicApplicationRuntimeRoutes(() => executor, limiter))

        const failure = await request(app)
            .get(
                `/public/applications/${applicationId}/runtime/widgets/${interpretationNetworkInstanceKey}/interpretation-network?locale=en`
            )
            .expect(503)
        expect(failure.body).toEqual({ code: 'PUBLIC_APPLICATION_RUNTIME_FAILED' })
        expect(failure.headers['cache-control']).toBe('no-store')
        expect(limiter).toHaveBeenCalledTimes(1)
    })

    it('normalizes malformed, unknown and private/unready references to the same 404 contract', async () => {
        const { executor } = createExecutor()
        const app = express()
        app.use(createPublicApplicationRuntimeRoutes(() => executor, readLimiter))

        const malformed = await request(app).get('/public/applications/bad%252Falias/runtime').expect(404)
        expect(malformed.body).toEqual({ code: 'PUBLIC_APPLICATION_NOT_AVAILABLE' })

        mockResolvePublicApplication.mockRejectedValueOnce(new PublicApplicationUnavailableError('application_private'))
        const privateResponse = await request(app).get('/public/applications/private-app/runtime').expect(404)
        expect(privateResponse.body).toEqual(malformed.body)

        mockResolvePublicApplication.mockRejectedValueOnce(new PublicApplicationUnavailableError('schema_status_unavailable'))
        const unready = await request(app).get('/public/applications/unready-app/runtime').expect(404)
        expect(unready.body).toEqual(malformed.body)
    })

    it('collapses damaged published materialization SQL errors into the same unavailable outcome', async () => {
        for (const sqlState of ['42P01', '3F000', '42703']) {
            const { executor } = createExecutor()
            mockCreatePublicMarketingBindingRecordLoader.mockImplementationOnce(() => {
                throw Object.assign(new Error('damaged published materialization'), { code: sqlState })
            })
            const app = express()
            app.use(createPublicApplicationRuntimeRoutes(() => executor, readLimiter))

            const damaged = await request(app).get(`/public/applications/${applicationId}/runtime?locale=en`).expect(404)
            expect(damaged.body).toEqual({ code: 'PUBLIC_APPLICATION_NOT_AVAILABLE' })
            expect(damaged.headers['cache-control']).toBe('no-store')
        }
    })

    it('keeps transient layout query failures retryable as 503', async () => {
        const { executor } = createExecutor()
        mockResolvePublicLayoutStructure.mockRejectedValue(new EffectiveLayoutError('LAYOUT_RUNTIME_QUERY_FAILED'))
        const app = express()
        app.use(createPublicApplicationRuntimeRoutes(() => executor, readLimiter))

        const failure = await request(app).get(`/public/applications/${applicationId}/runtime?locale=en`).expect(503)
        expect(failure.body).toEqual({ code: 'PUBLIC_APPLICATION_RUNTIME_FAILED' })
        expect(failure.headers['cache-control']).toBe('no-store')

        const probe = await request(app)
            .get(`/public/applications/${applicationId}/runtime?locale=en`)
            .set('Accept', 'application/vnd.universo.public-runtime-probe+json')
            .expect(503)
        expect(probe.body).toEqual({ code: 'PUBLIC_APPLICATION_RUNTIME_FAILED' })
    })

    it('uses no-content for the browser UI probe without changing the direct API 404 contract', async () => {
        const { executor } = createExecutor()
        const app = express()
        app.use(createPublicApplicationRuntimeRoutes(() => executor, readLimiter))
        mockResolvePublicApplication.mockRejectedValueOnce(new PublicApplicationUnavailableError('application_private'))

        await request(app)
            .get('/public/applications/private-app/runtime?locale=en')
            .set('Accept', 'application/vnd.universo.public-runtime-probe+json')
            .expect(204)
    })

    it('rejects arbitrary public query authority and never forwards workspaceId', async () => {
        const { executor } = createExecutor()
        const app = express()
        app.use(createPublicApplicationRuntimeRoutes(() => executor, readLimiter))

        await request(app)
            .get(`/public/applications/${applicationId}/runtime?locale=en&workspaceId=0190a9b5-3cde-7abc-8def-0123456789ad`)
            .expect(404, { code: 'PUBLIC_APPLICATION_NOT_AVAILABLE' })

        expect(mockResolvePublicApplication).not.toHaveBeenCalled()
        expect(executor.transaction).not.toHaveBeenCalled()
    })
})
