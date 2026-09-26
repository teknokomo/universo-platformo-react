import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo-react/utils'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

const mockResolvePublicApplication = jest.fn()
const mockResolvePublicEntryWorkspace = jest.fn()
const mockResolveEffectiveLayout = jest.fn()
const mockCreateMarketingController = jest.fn()
const mockLoadAllowlistedPublishedMarketingRows = jest.fn()
const mockSerializePublicMarketingRuntime = jest.fn()

jest.mock('../../services/publicApplicationRuntime', () => ({
    __esModule: true,
    ...jest.requireActual('../../services/publicApplicationRuntime'),
    resolvePublicApplication: (...args: unknown[]) => mockResolvePublicApplication(...args)
}))

jest.mock('../../services/applicationWorkspaces', () => ({
    __esModule: true,
    ...jest.requireActual('../../services/applicationWorkspaces'),
    resolvePublicEntryWorkspace: (...args: unknown[]) => mockResolvePublicEntryWorkspace(...args)
}))

jest.mock('../../services/effectiveLayoutResolver', () => ({
    __esModule: true,
    resolveEffectiveLayoutForPublicTransaction: (...args: unknown[]) => mockResolveEffectiveLayout(...args)
}))

jest.mock('../../controllers/runtimeMarketingPageController', () => ({
    __esModule: true,
    createRuntimeMarketingPageController: (...args: unknown[]) => mockCreateMarketingController(...args)
}))

jest.mock('../../persistence/publicApplicationRuntimeStore', () => ({
    __esModule: true,
    ...jest.requireActual('../../persistence/publicApplicationRuntimeStore'),
    loadAllowlistedPublishedMarketingRows: (...args: unknown[]) => mockLoadAllowlistedPublishedMarketingRows(...args)
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
const schemaName = 'app_0190a9b53cde7abc8def0123456789ab'

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
                config: {
                    instanceKey: 'marketing-image-0',
                    media: {
                        kind: 'hero',
                        resource: { type: 'url', url: 'https://example.test/hero.webp', launchMode: 'inline' },
                        decorative: true
                    }
                },
                data: { records: [] }
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
        mockResolveEffectiveLayout.mockResolvedValue({ layout: { id: layoutId }, widgets: [] })
        mockLoadAllowlistedPublishedMarketingRows.mockResolvedValue(new Map())
        mockSerializePublicMarketingRuntime.mockReturnValue(publicMarketingPayload)
        mockCreateMarketingController.mockImplementation((_getExecutor, options) => ({
            getMarketingPage: async (req: Request, res: Response) => {
                const context = await options.resolveRuntimeContext(req, res)
                await options.resolveEffectiveLayout(context, applicationId, { applicationId, locale: 'en' })
                return res.status(200).json(internalMarketingPayload)
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
        expect(mockLoadAllowlistedPublishedMarketingRows).toHaveBeenCalledWith(tx, {
            schemaName,
            workspaceId: null,
            heroTargets: []
        })
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
        const app = express()
        app.use(createPublicApplicationRuntimeRoutes(() => executor, readLimiter))

        await request(app).get(`/public/applications/${applicationId}/runtime?locale=en`).expect(200)

        expect(mockResolvePublicEntryWorkspace).toHaveBeenCalledWith(tx, schemaName)
        expect(mockResolveEffectiveLayout).toHaveBeenCalledWith(tx, expect.any(Object), workspaceId)
        expect(mockCreateMarketingController).not.toHaveBeenCalled()
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
            mockLoadAllowlistedPublishedMarketingRows.mockRejectedValueOnce(
                Object.assign(new Error('damaged published materialization'), { code: sqlState })
            )
            const app = express()
            app.use(createPublicApplicationRuntimeRoutes(() => executor, readLimiter))

            const damaged = await request(app).get(`/public/applications/${applicationId}/runtime?locale=en`).expect(404)
            expect(damaged.body).toEqual({ code: 'PUBLIC_APPLICATION_NOT_AVAILABLE' })
            expect(damaged.headers['cache-control']).toBe('no-store')
        }
    })

    it('keeps transient layout query failures retryable as 503', async () => {
        const { executor } = createExecutor()
        mockResolveEffectiveLayout.mockRejectedValue(new EffectiveLayoutError('LAYOUT_RUNTIME_QUERY_FAILED'))
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
    })
})
